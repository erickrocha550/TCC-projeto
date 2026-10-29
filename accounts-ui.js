let accountUser = null;
const roleLabels = { citizen: 'Cidadão', operator: 'Operador', admin: 'Administrador' };
const originalLoad = window.onload;
const originalOpenReport = openReportModal;
openReportModal = function () {
    if (!accountUser) { showAccountDialog(); showToast('Entre na sua conta para registrar uma denúncia.', 'error'); return; }
    originalOpenReport();
};
function showAccountDialog() {
    document.getElementById('account-dialog').showModal();
}
window.onload = async function () {
    const toolbar = document.createElement('div');
    toolbar.className = 'bg-slate-100 border-b border-slate-200 px-4 py-2 flex flex-wrap gap-3 items-center justify-end text-sm';
    toolbar.id = 'account-toolbar';
    document.body.insertBefore(toolbar, document.body.firstChild);
    document.body.insertAdjacentHTML('beforeend', `<dialog id="account-dialog" class="rounded-2xl p-6 w-full max-w-md shadow-xl" aria-labelledby="account-title"><div class="flex justify-between items-center"><h2 id="account-title" class="text-xl font-bold">Sua conta EcoFila</h2><button type="button" id="account-close" class="p-2" aria-label="Fechar">✕</button></div><p class="text-sm text-slate-600 my-3">Entre com e-mail e senha. Para se cadastrar, preencha também seu nome.</p><form id="account-form" class="space-y-3"><label class="block">Nome (para cadastro)<input name="name" autocomplete="name" maxlength="100" class="block border rounded-lg p-2 w-full"></label><label class="block">E-mail<input name="email" type="email" required maxlength="190" autocomplete="email" class="block border rounded-lg p-2 w-full"></label><label class="block">Senha<input name="password" type="password" required maxlength="128" autocomplete="current-password" class="block border rounded-lg p-2 w-full"></label><p class="text-xs text-slate-600">Novas senhas devem ter pelo menos 10 caracteres.</p><p id="account-error" role="alert" class="text-sm text-red-700"></p><div class="flex gap-3"><button name="action" value="login" class="bg-brand-700 text-white px-4 py-2 rounded-lg">Entrar</button><button name="action" value="register" class="border px-4 py-2 rounded-lg">Criar conta</button></div></form></dialog>`);
    document.getElementById('account-close').onclick = () => document.getElementById('account-dialog').close();
    document.getElementById('account-form').onsubmit = async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const action = event.submitter.value;
        const data = Object.fromEntries(new FormData(form));
        document.getElementById('account-error').textContent = '';
        form.querySelectorAll('button').forEach(b => b.disabled = true);
        try {
            accountUser = (await apiRequest('/api/auth/' + action, { method: 'POST', body: JSON.stringify(data) })).user;
            form.reset(); document.getElementById('account-dialog').close(); renderAccountToolbar();
            switchTab('minhas');
        } catch (error) { document.getElementById('account-error').textContent = error.message; }
        finally { form.querySelectorAll('button').forEach(b => b.disabled = false); }
    };
    const staff = document.createElement('section');
    staff.id = 'tab-equipe'; staff.className = 'hidden max-w-4xl mx-auto space-y-5';
    document.querySelector('main').appendChild(staff);
    try { accountUser = (await apiRequest('/api/auth/me')).user; } catch {}
    renderAccountToolbar();
    await originalLoad();
};
function renderAccountToolbar() {
    const target = document.getElementById('account-toolbar');
    target.innerHTML = accountUser ? `<span>${escapeHtml(accountUser.name)} · ${roleLabels[accountUser.role]}</span><button id="account-mine" class="font-bold text-brand-700">Minhas denúncias</button>${accountUser.role !== 'citizen' ? '<button id="account-staff" class="font-bold text-brand-700">Atendimento</button>' : ''}<button id="account-logout" class="underline">Sair</button>` : '<span>Acesso público</span><button id="account-login" class="font-bold text-brand-700">Entrar / Criar conta</button>';
    if (!accountUser) { document.getElementById('account-login').onclick = showAccountDialog; return; }
    document.getElementById('account-mine').onclick = () => switchTab('minhas');
    if (document.getElementById('account-staff')) document.getElementById('account-staff').onclick = showStaff;
    document.getElementById('account-logout').onclick = async () => {
        try { await apiRequest('/api/auth/logout', { method: 'POST' }); accountUser = null; document.getElementById('my-reports-list').innerHTML = ''; document.getElementById('tab-equipe').innerHTML = ''; renderAccountToolbar(); switchTab('feed'); }
        catch(error) { showToast(error.message, 'error'); }
    };
}
const originalSwitchTab = switchTab;
switchTab = function(tab) {
    document.getElementById('tab-equipe')?.classList.add('hidden');
    originalSwitchTab(tab);
};
let myRequestVersion = 0;
refreshMyReports = async function () {
    const target = document.getElementById('my-reports-list');
    const version = ++myRequestVersion;
    const userId = accountUser?.id;
    if (!accountUser) { target.innerHTML = '<p>Entre na sua conta para consultar suas denúncias.</p><button id="my-login" class="text-brand-700 font-bold underline">Entrar / Criar conta</button>'; document.getElementById('my-login').onclick = showAccountDialog; return; }
    target.textContent = 'Carregando suas denúncias…';
    try {
        const result = await apiRequest('/api/my-reports');
        if (version !== myRequestVersion || accountUser?.id !== userId) return;
        target.innerHTML = result.reports.length ? result.reports.map(r => `<article class="bg-white border rounded-2xl p-5 space-y-3"><p class="font-mono font-bold text-brand-700">${escapeHtml(r.id)}</p><h3 class="font-bold">${escapeHtml(r.title)}</h3><p>${escapeHtml(r.bairro)} · ${escapeHtml(r.status)}</p><button data-view="${escapeHtml(r.id)}" class="underline text-brand-700">Consultar protocolo</button>${!['Resolvido','Cancelado'].includes(r.status) ? `<button data-cancel="${escapeHtml(r.id)}" class="ml-4 text-red-700 underline">Cancelar denúncia</button>` : ''}</article>`).join('') : '<p>Você ainda não possui denúncias vinculadas à sua conta.</p>';
        target.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { switchTab('busca'); document.getElementById('protocol-search-input').value = b.dataset.view; searchProtocol({ preventDefault() {} }); });
        target.querySelectorAll('[data-cancel]').forEach(b => b.onclick = async () => { await cancelMyReport(b.dataset.cancel, b); await refreshMyReports(); });
    } catch(error) { if (accountUser?.id === userId) target.textContent = error.message; }
};
// A autoria e o histórico desta cópia são mantidos no servidor por conta.
saveMyReport = function () {};
async function showStaff() {
    if (!accountUser || accountUser.role === 'citizen') return;
    switchTab('feed'); document.getElementById('tab-feed').classList.add('hidden');
    const target = document.getElementById('tab-equipe'); target.classList.remove('hidden'); target.textContent = 'Carregando atendimento…';
    try {
        const result = await apiRequest('/api/reports');
        if (!accountUser || accountUser.role === 'citizen') return;
        target.innerHTML = '<h2 class="text-xl font-bold">Atendimento da prefeitura</h2><p>Analise as ocorrências e registre o andamento do serviço.</p>' + result.reports.map(r => `<article class="bg-white border rounded-xl p-4 space-y-3"><h3 class="font-bold">${escapeHtml(r.id)} — ${escapeHtml(r.title)}</h3><p>${escapeHtml(r.address)} · ${escapeHtml(r.status)}</p><p>${escapeHtml(r.desc)}</p>${!['Cancelado','Resolvido'].includes(r.status) ? `<form data-status="${escapeHtml(r.id)}" class="space-y-3"><label class="block">Nova situação<select name="status" class="block border rounded p-2"><option>Em Análise</option><option>Em Atendimento</option><option>Resolvido</option></select></label><label class="block">Registro do atendimento<textarea name="note" required maxlength="1000" class="block border rounded p-2 w-full"></textarea></label><button class="bg-brand-700 text-white rounded px-4 py-2">Salvar andamento</button></form>` : ''}</article>`).join('');
        target.querySelectorAll('[data-status]').forEach(form => form.onsubmit = async event => {
            event.preventDefault(); const button = form.querySelector('button'); button.disabled = true;
            try { await apiRequest('/api/staff/status', { method: 'POST', body: JSON.stringify({ id: form.dataset.status, ...Object.fromEntries(new FormData(form)) }) }); await reloadPublicReports(); await showStaff(); showToast('Atendimento atualizado.', 'success'); }
            catch(error) { showToast(error.message, 'error'); } finally { button.disabled = false; }
        });
        if (accountUser.role === 'admin') {
            const { users } = await apiRequest('/api/staff/users');
            target.insertAdjacentHTML('beforeend', '<h2 class="text-xl font-bold">Usuários e permissões</h2>' + users.map(u => `<form data-user="${escapeHtml(u.id)}" class="bg-white border rounded-xl p-4 flex flex-wrap items-center gap-3"><span>${escapeHtml(u.name)} — ${escapeHtml(u.email)}</span><label>Perfil <select name="role" class="border rounded p-2" ${u.id === accountUser.id ? 'disabled' : ''}>${Object.entries(roleLabels).map(([key,label]) => `<option value="${key}" ${u.role === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label><button class="underline text-brand-700" ${u.id === accountUser.id ? 'disabled' : ''}>Salvar perfil</button></form>`).join(''));
            target.querySelectorAll('[data-user]').forEach(form => form.onsubmit = async event => { event.preventDefault(); try { await apiRequest('/api/staff/users', { method: 'POST', body: JSON.stringify({ id: form.dataset.user, role: new FormData(form).get('role') }) }); showToast('Perfil atualizado.', 'success'); } catch(error) { showToast(error.message, 'error'); } });
        }
    } catch(error) { target.textContent = error.message; }
}
async function reloadPublicReports() {
    reports = (await apiRequest('/api/reports?clientId=' + encodeURIComponent(getClientId()))).reports;
    renderReportsFeed(); updateMapMarkers(); updateTopCounters();
}
