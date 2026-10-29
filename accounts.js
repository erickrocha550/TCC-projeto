const crypto = require('node:crypto');
const { promisify } = require('node:util');
const derive = promisify(crypto.scrypt);
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + (await derive(password, salt, 64)).toString('hex');
}
async function verifyPassword(password, stored) {
  const [salt, hex] = stored.split(':');
  const actual = await derive(password, salt, 64);
  const expected = Buffer.from(hex, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
module.exports = function accounts({ pool, body, json, findReport, visible }) {
  const publicUser = u => ({ id: u.id, name: u.name, email: u.email, role: u.role });
  const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
  const attempts = new Map();
  const digest = value => crypto.createHash('sha256').update(value).digest('hex');
  const cookie = (value, age) => `ecofila_session=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
  async function initialize() {
    await pool.query("CREATE TABLE IF NOT EXISTS users (id VARCHAR(36) PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(190) NOT NULL UNIQUE, password_hash VARCHAR(200) NOT NULL, role VARCHAR(20) NOT NULL DEFAULT 'citizen') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    await pool.query('CREATE TABLE IF NOT EXISTS user_sessions (token_hash CHAR(64) PRIMARY KEY, user_id VARCHAR(36) NOT NULL, expires_at BIGINT NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    await pool.query('CREATE TABLE IF NOT EXISTS report_accounts (report_id VARCHAR(100) PRIMARY KEY, user_id VARCHAR(36) NOT NULL, FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    await pool.query('CREATE TABLE IF NOT EXISTS report_history (id BIGINT AUTO_INCREMENT PRIMARY KEY, report_id VARCHAR(100) NOT NULL, user_id VARCHAR(36) NOT NULL, status VARCHAR(40) NOT NULL, note VARCHAR(1000) NOT NULL, created_at BIGINT NOT NULL, FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
      const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
      const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
      if (!existing.length) {
        if (process.env.ADMIN_PASSWORD.length < 10) fail('ADMIN_PASSWORD precisa ter pelo menos 10 caracteres.');
        await pool.execute('INSERT INTO users (id,name,email,password_hash,role) VALUES (?,?,?,?,?)', [crypto.randomUUID(), 'Administrador', email, await hashPassword(process.env.ADMIN_PASSWORD), 'admin']);
      }
    }
  }
  async function identify(req) {
    const token = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('ecofila_session='))?.slice(16);
    if (!token) return null;
    const [rows] = await pool.execute('SELECT u.* FROM users u JOIN user_sessions s ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?', [digest(token), Date.now()]);
    return rows[0] || null;
  }
  async function requireUser(req) {
    const user = await identify(req);
    if (!user) fail('Entre na sua conta para continuar.', 401);
    return user;
  }
  async function handle(req, res, url) {
    res.setHeader('Cache-Control', 'no-store');
    const route = url.pathname;
    const allowedOrigins = new Set((process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(s => /^https?:\/\//.test(s)));
    if (process.env.RENDER_EXTERNAL_URL) allowedOrigins.add(new URL(process.env.RENDER_EXTERNAL_URL).origin);
    if (req.headers.host) {
      allowedOrigins.add(new URL('http://' + req.headers.host).origin);
      allowedOrigins.add(new URL('https://' + req.headers.host).origin);
    }
    if (req.method !== 'GET' && req.headers.origin && !allowedOrigins.has(req.headers.origin)) fail('Origem da solicitação não permitida. Abra o site pelo endereço do Render ou configure CORS_ORIGIN com o endereço exato da página.', 403);
    if (route === '/api/auth/register' || route === '/api/auth/login') {
      if (req.method !== 'POST') fail('Método não permitido.', 405);
      const key = req.socket.remoteAddress;
      const now = Date.now();
      if (attempts.size > 10000) for (const [k,v] of attempts) if (v.until < now) attempts.delete(k);
      const count = attempts.get(key);
      if (count && count.until > now && count.total >= 20) fail('Muitas tentativas. Aguarde 15 minutos.', 429);
      attempts.set(key, count && count.until > now ? { ...count, total: count.total + 1 } : { total: 1, until: now + 900000 });
      const data = await body(req);
      const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 190 || typeof data.password !== 'string' || data.password.length > 128) fail('Informe e-mail e senha válidos.');
      let user;
      if (route.endsWith('register')) {
        if (data.password.length < 10 || typeof data.name !== 'string' || !data.name.trim() || data.name.length > 100) fail('Informe seu nome e uma senha com pelo menos 10 caracteres.');
        user = { id: crypto.randomUUID(), name: data.name.trim(), email, role: 'citizen' };
        try { await pool.execute('INSERT INTO users (id,name,email,password_hash,role) VALUES (?,?,?,?,?)', [user.id, user.name, email, await hashPassword(data.password), user.role]); }
        catch (e) { if (e.code === 'ER_DUP_ENTRY') fail('Este e-mail já está cadastrado.', 409); throw e; }
      } else {
        const [rows] = await pool.execute('SELECT * FROM users WHERE email=?', [email]);
        user = rows[0];
        const stored = user?.password_hash || '00000000000000000000000000000000:' + '00'.repeat(64);
        if (!(await verifyPassword(data.password, stored)) || !user) fail('E-mail ou senha incorretos.', 401);
      }
      const token = crypto.randomBytes(32).toString('hex');
      await pool.execute('DELETE FROM user_sessions WHERE expires_at < ?', [Date.now()]);
      await pool.execute('INSERT INTO user_sessions (token_hash,user_id,expires_at) VALUES (?,?,?)', [digest(token), user.id, Date.now() + 86400000]);
      res.setHeader('Set-Cookie', cookie(token, 86400));
      json(res, 200, { user: publicUser(user) }); return true;
    }
    if (route === '/api/auth/me') { const u = await identify(req); json(res, 200, { user: u ? publicUser(u) : null }); return true; }
    if (route === '/api/auth/logout' && req.method === 'POST') {
      const token = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('ecofila_session='))?.slice(16);
      if (token) await pool.execute('DELETE FROM user_sessions WHERE token_hash=?', [digest(token)]);
      res.setHeader('Set-Cookie', cookie('', 0)); json(res, 200, { ok: true }); return true;
    }
    if (route === '/api/my-reports' && req.method === 'GET') {
      const u = await requireUser(req);
      const [rows] = await pool.execute('SELECT report_id FROM report_accounts WHERE user_id=?', [u.id]);
      const reports = await Promise.all(rows.map(r => findReport(r.report_id)));
      json(res, 200, { reports: reports.filter(Boolean).reverse().map(r => visible(r, '')) }); return true;
    }
    const cancel = route.match(/^\/api\/reports\/([^/]+)\/cancel$/);
    if (cancel && req.method === 'POST') {
      const u = await requireUser(req); const id = decodeURIComponent(cancel[1]);
      const [owners] = await pool.execute('SELECT report_id FROM report_accounts WHERE report_id=? AND user_id=?', [id, u.id]);
      if (!owners.length) fail('Você só pode cancelar denúncias vinculadas à sua conta.', 403);
      const [result] = await pool.execute("UPDATE reports SET status='Cancelado' WHERE id=? AND status NOT IN ('Resolvido','Cancelado')", [id]);
      const report = await findReport(id);
      if (!result.affectedRows && report?.status !== 'Cancelado') fail('Esta denúncia já foi concluída.', 409);
      json(res, 200, { report: visible(report, '') }); return true;
    }
    if (route.startsWith('/api/staff/')) {
      const u = await requireUser(req);
      if (!['operator','admin'].includes(u.role)) fail('Acesso restrito à equipe da prefeitura.', 403);
      if (route === '/api/staff/users') {
        if (u.role !== 'admin') fail('Acesso exclusivo do administrador.', 403);
        if (req.method === 'GET') { const [users] = await pool.query('SELECT id,name,email,role FROM users ORDER BY name'); json(res,200,{users}); return true; }
        if (req.method === 'POST') {
          const data = await body(req);
          if (!['citizen','operator','admin'].includes(data.role) || data.id === u.id) fail('Selecione outro usuário e um perfil válido.');
          const [result] = await pool.execute('UPDATE users SET role=? WHERE id=?', [data.role, data.id]);
          if (!result.affectedRows) fail('Usuário não encontrado.',404);
          json(res,200,{ok:true}); return true;
        }
      }
      if (route === '/api/staff/status' && req.method === 'POST') {
        const data = await body(req);
        if (!['Em Análise','Em Atendimento','Resolvido'].includes(data.status) || typeof data.note !== 'string' || !data.note.trim() || data.note.length > 1000) fail('Selecione a situação e descreva o atendimento (até 1000 caracteres).');
        const connection = await pool.getConnection();
        try {
          await connection.beginTransaction();
          const [result] = await connection.execute("UPDATE reports SET status=? WHERE id=? AND status NOT IN ('Cancelado','Resolvido')", [data.status, data.id]);
          if (!result.affectedRows) fail('Denúncia não encontrada ou já encerrada.',409);
          await connection.execute('INSERT INTO report_history (report_id,user_id,status,note,created_at) VALUES (?,?,?,?,?)', [data.id,u.id,data.status,data.note.trim(),Date.now()]);
          await connection.commit();
        } catch(e) { await connection.rollback(); throw e; } finally { connection.release(); }
        json(res,200,{report:visible(await findReport(data.id),'')}); return true;
      }
      fail('Rota não encontrada.',404);
    }
    return false;
  }
  return { initialize, handle, requireUser };
};
