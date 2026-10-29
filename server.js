'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mysql = require('mysql2/promise');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const MAX_BODY = 6 * 1024 * 1024;
const CORS_ORIGINS = (process.env.CORS_ORIGIN || '').split(',').map(value => value.trim()).filter(Boolean);
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ecofila',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4'
});

const categories = {
  transito: ['Engarrafamento', '🚗'],
  buraco: ['Buraco em Via Pública', '🕳️'],
  lixo: ['Lixo e Entulho Acumulado', '🧹'],
  iluminacao: ['Iluminação Pública', '💡'],
  outros: ['Outros Problemas', '⚠️']
};

const seeds = [
  {id:'URB-2026-1041',category:'transito',categoryName:'Engarrafamento',categoryIcon:'🚗',title:'Semáforo quebrado provocando nó no trânsito',desc:'Semáforo no cruzamento em amarelo piscante há mais de 2 horas. Agentes de trânsito não chegaram ao local.',bairro:'Adrianópolis / Vieiralves',address:'Cruzamento da Av. Djalma Batista',urgency:'Crítica',status:'Em Análise',supports:128,date:'Hoje às 08:15',lat:-3.115,lng:-60.022,image:'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=600&q=80',supporters:[]},
  {id:'URB-2026-1039',category:'buraco',categoryName:'Buraco em Via Pública',categoryIcon:'🕳️',title:'Cratera na via estourando pneus',desc:'Vazamento de água abriu um buraco profundo na faixa da direita. Três veículos já estouraram pneu.',bairro:'Zona Sul / Flores',address:'Rua Professor Nilton Lins',urgency:'Média',status:'Em Aberto',supports:45,date:'Ontem às 17:40',lat:-3.088,lng:-60.015,image:'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=600&q=80',supporters:[]},
  {id:'URB-2026-1035',category:'lixo',categoryName:'Lixo e Entulho Acumulado',categoryIcon:'🧹',title:'Acúmulo de lixo sem coleta há 5 dias',desc:'Sacos rasgados e mau cheiro atraindo pragas ao lado da entrada da escola municipal.',bairro:'Zona Leste / Cidade Nova',address:'Rua Noel Nutels',urgency:'Média',status:'Em Aberto',supports:32,date:'Há 2 dias',lat:-3.05,lng:-59.98,image:'https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=600&q=80',supporters:[]},
  {id:'URB-2026-1020',category:'iluminacao',categoryName:'Iluminação Pública',categoryIcon:'💡',title:'Rua inteira no escuro por lâmpadas queimadas',desc:'Sequência de 6 postes sem iluminação gerando grande sensação de insegurança.',bairro:'Ponta Negra / Oeste',address:'Alameda das Palmeiras',urgency:'Baixa',status:'Resolvido',supports:19,date:'Há 4 dias',lat:-3.07,lng:-60.07,image:'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?auto=format&fit=crop&w=600&q=80',supporters:[]}
];

function json(res, status, data) {
  const content = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(content),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(content);
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && CORS_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
}
function cleanId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9._:-]{1,100}$/.test(value) ? value : '';
}

function norm(value) {
  return String(value || '').trim().toUpperCase().replace(/^#/, '').replace(/\s+/g, '');
}

function visible(report, clientId) {
  const { supporters = [], ...data } = report;
  return { ...data, userSupported: Boolean(clientId && supporters.includes(clientId)) };
}

function rowToReport(row, supporters) {
  return {
    id: row.id,
    category: row.category,
    categoryName: row.category_name,
    categoryIcon: row.category_icon,
    title: row.title,
    desc: row.description,
    bairro: row.neighborhood,
    address: row.address,
    urgency: row.urgency,
    status: row.status,
    supports: Number(row.supports),
    date: row.report_date,
    lat: Number(row.lat),
    lng: Number(row.lng),
    image: row.image,
    supporters
  };
}

async function allReports(connection = pool) {
  const [rows] = await connection.query(
    'SELECT * FROM reports ORDER BY created_at DESC, id DESC'
  );
  const [supportRows] = await connection.query(
    'SELECT report_id, client_id FROM report_supporters'
  );
  const supportersByReport = new Map();
  for (const row of supportRows) {
    if (!supportersByReport.has(row.report_id)) supportersByReport.set(row.report_id, []);
    supportersByReport.get(row.report_id).push(row.client_id);
  }
  return rows.map(row => rowToReport(row, supportersByReport.get(row.id) || []));
}

async function findReport(id) {
  const normalized = norm(id);
  return (await allReports()).find(report => norm(report.id) === normalized);
}

async function insertReport(connection, report, createdAt) {
  await connection.execute(
    'INSERT INTO reports (id, category, category_name, category_icon, title, description, neighborhood, address, urgency, status, supports, report_date, lat, lng, image, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      report.id, report.category, report.categoryName, report.categoryIcon, report.title,
      report.desc, report.bairro, report.address, report.urgency, report.status,
      Number(report.supports || 0), report.date, Number(report.lat), Number(report.lng),
      report.image || null, createdAt
    ]
  );
  const supporters = Array.isArray(report.supporters) ? report.supporters : [];
  for (const clientId of supporters) {
    const safeClientId = cleanId(clientId);
    if (safeClientId) {
      await connection.execute(
        'INSERT IGNORE INTO report_supporters (report_id, client_id) VALUES (?, ?)',
        [report.id, safeClientId]
      );
    }
  }
}

async function initializeDatabase() {
  await pool.query(
    'CREATE TABLE IF NOT EXISTS reports (id VARCHAR(100) PRIMARY KEY, category VARCHAR(40) NOT NULL, category_name VARCHAR(120) NOT NULL, category_icon VARCHAR(20) NOT NULL, title VARCHAR(120) NOT NULL, description VARCHAR(1500) NOT NULL, neighborhood VARCHAR(120) NOT NULL, address VARCHAR(240) NOT NULL, urgency VARCHAR(20) NOT NULL, status VARCHAR(40) NOT NULL, supports INT UNSIGNED NOT NULL DEFAULT 0, report_date VARCHAR(80) NOT NULL, lat DOUBLE NOT NULL, lng DOUBLE NOT NULL, image MEDIUMTEXT NULL, created_at BIGINT NOT NULL, INDEX idx_reports_created_at (created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
  );
  await pool.query(
    'CREATE TABLE IF NOT EXISTS report_supporters (report_id VARCHAR(100) NOT NULL, client_id VARCHAR(100) NOT NULL, PRIMARY KEY (report_id, client_id), CONSTRAINT fk_support_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
  );
  await pool.query(
    'CREATE TABLE IF NOT EXISTS app_metadata (meta_key VARCHAR(100) PRIMARY KEY, meta_value VARCHAR(100) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
  );

  await pool.query('CREATE TABLE IF NOT EXISTS report_owners (report_id VARCHAR(100) PRIMARY KEY, client_id VARCHAR(100) NOT NULL, FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
  const [metaRows] = await pool.execute(
    'SELECT meta_value FROM app_metadata WHERE meta_key = ?',
    ['initial-data-loaded']
  );
  if (metaRows.length) return;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [countRows] = await connection.query('SELECT COUNT(*) AS total FROM reports');
    if (Number(countRows[0].total) === 0) {
      const now = Date.now();
      for (let index = 0; index < seeds.length; index += 1) {
        await insertReport(connection, seeds[index], now - index);
      }
    }
    await connection.execute(
      'INSERT INTO app_metadata (meta_key, meta_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)',
      ['initial-data-loaded', 'seeded']
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function body(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', part => {
      size += part.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Envio excede 6 MB.'), { statusCode: 413 }));
        req.destroy();
      } else {
        chunks.push(part);
      }
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(Object.assign(new Error('JSON inválido.'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function text(value, label, max) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw Object.assign(new Error('Informe ' + label + ' (até ' + max + ' caracteres).'), { statusCode: 400 });
  }
  return value.trim();
}

async function protocol() {
  let id;
  do {
    id = '#URB-' + new Date().getFullYear() + '-' + crypto.randomInt(1000, 10000);
  } while (await findReport(id));
  return id;
}

async function api(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean);
  const clientId = cleanId(url.searchParams.get('clientId'));

  if (req.method === 'GET' && url.pathname === '/api/health') {
    await pool.query('SELECT 1');
    return json(res, 200, { status: 'ok', service: 'EcoFila API', database: 'mysql' });
  }

  if (req.method === 'GET' && url.pathname === '/api/reports') {
    const query = norm(url.searchParams.get('protocol'));
    if (query) {
      const found = (await allReports()).find(report => norm(report.id).includes(query));
      return json(res, 200, { report: found ? visible(found, clientId) : null });
    }
    return json(res, 200, { reports: (await allReports()).map(report => visible(report, clientId)) });
  }

  if (parts[0] === 'api' && parts[1] === 'reports' && parts.length >= 3) {
    let id;
    try {
      id = decodeURIComponent(parts[2]);
    } catch {
      return json(res, 400, { error: 'Protocolo inválido.' });
    }

    const report = await findReport(id);
    if (req.method === 'GET' && parts.length === 3) {
      return json(res, report ? 200 : 404, { report: report ? visible(report, clientId) : null });
    }

    if (req.method === 'POST' && parts[3] === 'cancel' && parts.length === 4) {
      if (!report) return json(res, 404, { error: 'Denúncia não encontrada.' });
      const data = await body(req);
      const owner = cleanId(data.clientId);
      const [owners] = await pool.execute('SELECT client_id FROM report_owners WHERE report_id = ? AND client_id = ?', [report.id, owner]);
      if (!owner || !owners.length) return json(res, 403, { error: 'Não foi possível confirmar a autoria. Denúncias antigas, anteriores a esta função, não podem ser canceladas por aqui.' });
      await pool.execute("UPDATE reports SET status = 'Cancelado' WHERE id = ? AND status NOT IN ('Resolvido', 'Cancelado')", [report.id]);
      const updated = await findReport(report.id);
      if (updated.status === 'Resolvido') return json(res, 409, { error: 'Uma denúncia resolvida não pode ser cancelada.' });
      return json(res, 200, { report: visible(updated, owner) });
    }
    if (req.method === 'POST' && parts[3] === 'support' && parts.length === 4) {
      if (!report) return json(res, 404, { error: 'Denúncia não encontrada.' });
      const data = await body(req);
      const voter = cleanId(data.clientId);
      if (!voter) return json(res, 400, { error: 'Identificador do navegador inválido.' });

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [lockedRows] = await connection.execute(
          'SELECT id FROM reports WHERE id = ? FOR UPDATE',
          [report.id]
        );
        if (!lockedRows.length) {
          await connection.rollback();
          return json(res, 404, { error: 'Denúncia não encontrada.' });
        }
        const [supportRows] = await connection.execute(
          'SELECT client_id FROM report_supporters WHERE report_id = ? AND client_id = ?',
          [report.id, voter]
        );
        if (supportRows.length) {
          await connection.execute(
            'DELETE FROM report_supporters WHERE report_id = ? AND client_id = ?',
            [report.id, voter]
          );
          await connection.execute(
            'UPDATE reports SET supports = GREATEST(0, supports - 1) WHERE id = ?',
            [report.id]
          );
        } else {
          await connection.execute(
            'INSERT INTO report_supporters (report_id, client_id) VALUES (?, ?)',
            [report.id, voter]
          );
          await connection.execute(
            'UPDATE reports SET supports = supports + 1 WHERE id = ?',
            [report.id]
          );
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

      return json(res, 200, { report: visible(await findReport(report.id), voter) });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/reports') {
    const data = await body(req);
    const category = categories[data.category];
    if (!category) return json(res, 400, { error: 'Selecione uma categoria válida.' });
    const voter = cleanId(data.clientId);
    if (!voter) return json(res, 400, { error: 'Identificador do navegador inválido.' });
    if (!['Baixa', 'Média', 'Crítica'].includes(data.urgency)) {
      return json(res, 400, { error: 'Selecione uma urgência válida.' });
    }

    const image = data.image || null;
    if (image !== null && (
      typeof image !== 'string' ||
      image.length > 5 * 1024 * 1024 ||
      !(/^data:image\/(png|jpeg|webp|gif);base64,/i.test(image) ||
        /^https:\/\/images\.unsplash\.com\//i.test(image))
    )) {
      return json(res, 400, { error: 'A imagem deve ser PNG, JPEG, WebP ou GIF e ter até 5 MB.' });
    }

    const lat = Number(data.lat);
    const lng = Number(data.lng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      return json(res, 400, { error: 'Coordenadas inválidas.' });
    }

    const report = {
      id: await protocol(),
      category: data.category,
      categoryName: category[0],
      categoryIcon: category[1],
      title: text(data.title, 'o título', 120),
      desc: text(data.desc, 'a descrição', 1500),
      bairro: text(data.bairro, 'o bairro', 120),
      address: text(data.address, 'o endereço', 240),
      urgency: data.urgency,
      status: 'Em Aberto',
      supports: 1,
      date: 'Agora',
      lat,
      lng,
      image,
      supporters: [voter]
    };

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await insertReport(connection, report, Date.now());
      await connection.execute('INSERT INTO report_owners (report_id, client_id) VALUES (?, ?)', [report.id, voter]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return json(res, 201, { report: visible(report, voter) });
  }

  return json(res, 404, { error: 'Rota da API não encontrada.' });
}

const files = new Set(['index.html', 'head.png', 'logo.png', 'logo.jpeg']);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg'
};

async function staticFile(req, res, url) {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end('Method Not Allowed');
  }

  let name;
  try {
    name = decodeURIComponent(url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
  } catch {
    res.writeHead(400);
    return res.end();
  }

  if (!files.has(name) || path.basename(name) !== name) {
    res.writeHead(404);
    return res.end('Not Found');
  }

  try {
    const file = await fs.readFile(path.join(ROOT, name));
    res.writeHead(200, {
      'Content-Type': types[path.extname(name)] || 'application/octet-stream',
      'Content-Length': file.length,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache'
    });
    res.end(req.method === 'HEAD' ? undefined : file);
  } catch {
    res.writeHead(404);
    res.end('Not Found');
  }
}

async function start() {
  await initializeDatabase();
  const server = http.createServer(async (req, res) => {
    try {
      applyCors(req, res);
      if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
      const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
      if (url.pathname.startsWith('/api/')) await api(req, res, url);
      else await staticFile(req, res, url);
    } catch (error) {
      if (!res.headersSent) {
        json(res, error.statusCode || 500, {
          error: error.statusCode ? error.message : 'Erro interno no servidor.'
        });
      } else {
        res.destroy();
      }
      if (!error.statusCode) console.error(error);
    }
  });

  server.listen(PORT, HOST, () => {
    console.log('EcoFila disponível em http://' + HOST + ':' + PORT);
    console.log('Banco MySQL: ' + (process.env.DB_NAME || 'ecofila') + ' em ' + (process.env.DB_HOST || '127.0.0.1'));
  });

  const shutdown = () => {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

start().catch(async error => {
  console.error('Não foi possível iniciar o backend MySQL. Verifique o arquivo .env e o acesso ao banco:', error.message);
  await pool.end();
  process.exitCode = 1;
});
