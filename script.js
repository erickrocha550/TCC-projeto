const garbageTrucks = [
            { id: "CAM-01", plate: "ABC-1234", bairro: "Adrianópolis / Vieiralves", type: "Coleta Doméstica Orgânica", status: "Em Operação", progress: "75%", lat: -3.1120, lng: -60.0210, nextStreet: "Av. Mário Ypiranga", speed: "18 km/h" },
            { id: "CAM-02", plate: "XYZ-9876", bairro: "Zona Sul / Flores", type: "Coleta Seletiva / Reciclável", status: "Em Operação", progress: "40%", lat: -3.0850, lng: -60.0120, nextStreet: "Rua Nilton Lins", speed: "12 km/h" },
            { id: "CAM-03", plate: "KLM-5544", bairro: "Zona Leste / Cidade Nova", type: "Coleta Doméstica Orgânica", status: "Deslocamento", progress: "15%", lat: -3.0480, lng: -59.9750, nextStreet: "Av. Noel Nutels", speed: "35 km/h" }
        ];

        const initialReports = [
            { id: "URB-2026-1041", category: "transito", categoryName: "Engarrafamento", categoryIcon: "🚗", title: "Semáforo quebrado provocando nó no trânsito", desc: "Semáforo no cruzamento em amarelo piscante há mais de 2 horas. Agentes de trânsito não chegaram ao local.", bairro: "Adrianópolis / Vieiralves", address: "Cruzamento da Av. Djalma Batista", urgency: "Crítica", status: "Em Análise", supports: 128, userSupported: false, date: "Hoje às 08:15", lat: -3.1150, lng: -60.0220, image: "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=600&q=80" },
            { id: "URB-2026-1039", category: "buraco", categoryName: "Buraco em Via Pública", categoryIcon: "🕳️", title: "Cratera na via estourando pneus", desc: "Vazamento de água abriu um buraco profundo na faixa da direita. Três veículos já estouraram pneu.", bairro: "Zona Sul / Flores", address: "Rua Professor Nilton Lins", urgency: "Média", status: "Em Aberto", supports: 45, userSupported: false, date: "Ontem às 17:40", lat: -3.0880, lng: -60.0150, image: "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=600&q=80" },
            { id: "URB-2026-1035", category: "lixo", categoryName: "Lixo e Entulho Acumulado", categoryIcon: "🧹", title: "Acúmulo de lixo sem coleta há 5 dias", desc: "Sacos rasgados e mau cheiro atraindo pragas ao lado da entrada da escola municipal.", bairro: "Zona Leste / Cidade Nova", address: "Rua Noel Nutels", urgency: "Média", status: "Em Aberto", supports: 32, userSupported: false, date: "Há 2 dias", lat: -3.0500, lng: -59.9800, image: "https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=600&q=80" },
            { id: "URB-2026-1020", category: "iluminacao", categoryName: "Iluminação Pública", categoryIcon: "💡", title: "Rua inteira no escuro por lâmpadas queimadas", desc: "Sequência de 6 postes sem iluminação gerando grande sensação de insegurança.", bairro: "Ponta Negra / Oeste", address: "Alameda das Palmeiras", urgency: "Baixa", status: "Resolvido", supports: 19, userSupported: false, date: "Há 4 dias", lat: -3.0700, lng: -60.0700, image: "https://images.unsplash.com/photo-1509114397022-ed747cca3f65?auto=format&fit=crop&w=600&q=80" }
        ];

        let reports = [...initialReports];
        let currentCategoryFilter = 'all';
        let currentStatusFilter = 'all';
        let showTrucksLayer = true;
        let map;
        let mapMarkers = [];
        let truckMarkers = [];
        let truckMovementInterval;
        let movementPaused = false;
        const CLIENT_ID_KEY = 'ecofila-client-id';
        function getClientId() {
            try { let id = localStorage.getItem(CLIENT_ID_KEY); if (!id) { id = globalThis.crypto?.randomUUID?.() || `browser-${Date.now()}-${Math.random().toString(36).slice(2)}`; localStorage.setItem(CLIENT_ID_KEY, id); } return id; }
            catch (error) { return `browser-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
        }
        // Para frontend hospedado em outro domínio, configure ECOFILA_API_BASE com a origem pública da API.
        const API_BASE_URL = (window.ECOFILA_API_BASE || '').replace(/\/+$/, '');

        async function apiRequest(url, options = {}) {
            const response = await fetch(API_BASE_URL + url, { cache: 'no-store', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || 'O servidor não conseguiu concluir a solicitação.');
            return result;
        }
        function escapeHtml(value) {
            return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
        }

        window.onload = async function() {
            lucide.createIcons();
            try {
                const result = await apiRequest('/api/reports?clientId=' + encodeURIComponent(getClientId()));
                if (Array.isArray(result.reports)) reports = result.reports;
            } catch (error) {
                showToast('Não foi possível conectar ao backend. Exibindo dados de demonstração.', 'error');
            }
            initMap();
            renderReportsFeed();
            renderTruckRoutesList();
            updateTopCounters();
            initCharts();
            setupCategoryCardSelection();
            initializeAccessibilityOptions();
            truckMovementInterval = setInterval(simulateTruckMovement, 10000);
        };

        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                toggleMobileMenu(false);
                const modal = document.getElementById('report-modal');
                if (!modal.classList.contains('hidden')) {
                    closeReportModal();
                }
            }
        });

        function initMap() {
            map = L.map('map').setView([-3.0900, -60.0200], 12);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19, attribution: '&copy; OpenStreetMap'
            }).addTo(map);
            updateMapMarkers();
            updateTruckMarkersOnMap();
        }

        function updateTruckMarkersOnMap() {
            truckMarkers.forEach(m => map.removeLayer(m));
            truckMarkers = [];
            if (!showTrucksLayer) return;

            garbageTrucks.forEach(truck => {
                const customTruckIcon = L.divIcon({
                    className: 'custom-truck-pin truck-ping',
                    html: `<div style="background-color: #047857; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 16px; border: 3px solid #ffffff; box-shadow: 0 4px 8px rgba(0,0,0,0.35);">🚛</div>`,
                    iconSize: [34, 34], iconAnchor: [17, 17]
                });
                const marker = L.marker([truck.lat, truck.lng], { icon: customTruckIcon }).addTo(map);
                const popupTruckContent = `
                    <div class="custom-popup p-2 max-w-[210px]">
                        <div class="flex items-center gap-1.5 bg-brand-100 text-brand-800 text-xs font-extrabold px-2 py-0.5 rounded-md mb-1 w-fit">
                            <span>🟢 GPS EM TEMPO REAL</span>
                        </div>
                        <h4 class="font-extrabold text-xs text-slate-900">${truck.type}</h4>
                        <p class="text-xs font-bold text-slate-700 mt-0.5">Veículo: ${truck.id} (${truck.plate})</p>
                        <p class="text-xs text-slate-500">Região: <strong>${truck.bairro}</strong></p>
                        <div class="mt-2 text-xs bg-slate-100 p-1.5 rounded-lg flex items-center justify-between font-bold text-slate-700">
                            <span>Velocidade: ${truck.speed}</span>
                            <span class="text-brand-700">${truck.progress}</span>
                        </div>
                    </div>
                `;
                marker.bindPopup(popupTruckContent);
                truckMarkers.push(marker);
            });
        }

        function toggleGarbageTrucksLayer() {
            showTrucksLayer = !showTrucksLayer;
            const statusElem = document.getElementById('truck-layer-status');
            const btnElem = document.getElementById('toggle-trucks-btn');

            if (showTrucksLayer) {
                statusElem.innerText = 'ON';
                btnElem.classList.replace('bg-slate-100', 'bg-brand-50');
                btnElem.classList.replace('text-slate-700', 'text-brand-700');
                btnElem.classList.replace('border-slate-300', 'border-brand-300');
                showToast('🚛 Camada de caminhões VISÍVEL.', 'info');
            } else {
                statusElem.innerText = 'OFF';
                btnElem.classList.replace('bg-brand-50', 'bg-slate-100');
                btnElem.classList.replace('text-brand-700', 'text-slate-700');
                btnElem.classList.replace('border-brand-300', 'border-slate-300');
                showToast('🙈 Camada de caminhões ocultada.', 'info');
            }
            updateTruckMarkersOnMap();
        }

        function renderTruckRoutesList() {
            const container = document.getElementById('truck-routes-list');
            container.innerHTML = garbageTrucks.map(truck => `
                <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-brand-300 transition-colors flex items-center justify-between gap-2">
                    <div class="flex items-center space-x-2.5">
                        <div class="w-8 h-8 rounded-lg bg-brand-100 text-brand-800 flex items-center justify-center font-bold shrink-0 text-sm">🚛</div>
                        <div>
                            <span class="font-extrabold text-slate-900 block leading-tight">${truck.bairro}</span>
                            <span class="text-xs text-slate-500">${truck.type} • ${truck.speed}</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="text-right hidden sm:block">
                            <span class="text-xs font-bold text-brand-700 block">${truck.progress} da Rota</span>
                            <span class="text-xs text-slate-400">Próx: ${truck.nextStreet}</span>
                        </div>
                        <button onclick="focusSingleTruck('${truck.id}')" aria-label="Rastrear caminhão ${truck.id}" class="bg-white hover:bg-brand-50 border border-slate-200 text-brand-700 px-2 py-1 rounded-lg font-bold text-xs flex items-center gap-1 shadow-sm">
                            <i data-lucide="crosshair" class="w-3 h-3"></i> GPS
                        </button>
                    </div>
                </div>
            `).join('');
            lucide.createIcons();
        }

        function focusSingleTruck(truckId) {
            const truck = garbageTrucks.find(t => t.id === truckId);
            if (!truck) return;
            window.scrollTo({ top: 0, behavior: 'smooth' });
            map.setView([truck.lat, truck.lng], 15);
            const marker = truckMarkers.find((m, index) => garbageTrucks[index].id === truckId);
            if (marker) marker.openPopup();
            showToast(`📍 Rastreando Caminhão ${truck.id}`);
        }

        function focusTrucksOnMap() {
            switchTab('feed');
            if (garbageTrucks.length > 0) {
                map.setView([garbageTrucks[0].lat, garbageTrucks[0].lng], 13);
            }
        }

        function simulateTruckMovement() {
            garbageTrucks.forEach(t => {
                t.lat += (Math.random() - 0.5) * 0.002;
                t.lng += (Math.random() - 0.5) * 0.002;
            });
            updateTruckMarkersOnMap();
        }

        function toggleTruckMovement() {
            movementPaused = !movementPaused;
            const btn = document.getElementById('pause-trucks-btn');
            if (movementPaused) {
                clearInterval(truckMovementInterval);
                document.body.classList.add('motion-paused');
                btn.innerHTML = '<i data-lucide="play-circle" class="w-4 h-4"></i><span>Retomar Movimento</span>';
                btn.setAttribute('aria-pressed', 'true');
                showToast('Movimento e animações pausados.', 'info');
            } else {
                truckMovementInterval = setInterval(simulateTruckMovement, 10000);
                document.body.classList.remove('motion-paused');
                btn.innerHTML = '<i data-lucide="pause-circle" class="w-4 h-4"></i><span>Pausar Movimento</span>';
                btn.setAttribute('aria-pressed', 'false');
                showToast('Movimento e animações retomados.', 'info');
            }
            lucide.createIcons();
        }

        function getMarkerColor(category) {
            switch(category) {
                case 'transito': return '#f59e0b';
                case 'buraco': return '#f97316';
                case 'lixo': return '#047857';
                case 'iluminacao': return '#0284c7'; // Usando o azul da logo nas redes
                default: return '#047857';
            }
        }

        function updateMapMarkers() {
            mapMarkers.forEach(m => map.removeLayer(m));
            mapMarkers = [];
            const filtered = getFilteredReports();

            filtered.forEach(report => {
                const color = getMarkerColor(report.category);
                const customIcon = L.divIcon({
                    className: 'custom-map-pin',
                    html: `<div style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 14px; border: 3px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">${report.categoryIcon}</div>`,
                    iconSize: [30, 30], iconAnchor: [15, 15]
                });

                const marker = L.marker([report.lat, report.lng], { icon: customIcon }).addTo(map);
                const popupContent = `
                    <div class="custom-popup p-1 max-w-[200px]">
                        <span class="text-xs font-extrabold uppercase px-2 py-0.5 rounded text-white" style="background-color: ${color}">${escapeHtml(report.categoryName)}</span>
                        <h4 class="font-bold text-xs mt-1 text-slate-900">${escapeHtml(report.title)}</h4>
                        <p class="text-xs text-slate-500 mt-0.5">${escapeHtml(report.bairro)}</p>
                        <div class="mt-2 text-xs text-brand-600 font-bold">👍 ${report.supports} confirmações</div>
                    </div>
                `;
                marker.bindPopup(popupContent);
                mapMarkers.push(marker);
            });
        }

        function getFilteredReports() {
            return reports.filter(r => {
                const catMatch = (currentCategoryFilter === 'all') || (r.category === currentCategoryFilter);
                const statusMatch = (currentStatusFilter === 'all') || (r.status === currentStatusFilter);
                return catMatch && statusMatch;
            });
        }

        function filterCategory(cat) {
            currentCategoryFilter = cat;
            document.querySelectorAll('.cat-filter-btn').forEach(btn => {
                btn.classList.remove('bg-brand-900', 'text-white');
                btn.classList.add('bg-slate-100', 'text-slate-700');
            });
            const activeBtn = document.getElementById(`cat-btn-${cat}`);
            if (activeBtn) {
                activeBtn.classList.remove('bg-slate-100', 'text-slate-700');
                activeBtn.classList.add('bg-brand-900', 'text-white');
            }
            renderReportsFeed();
            updateMapMarkers();
        }

        function applyFilters() {
            currentStatusFilter = document.getElementById('status-filter').value;
            renderReportsFeed();
            updateMapMarkers();
        }

        function renderReportsFeed() {
            const listContainer = document.getElementById('reports-list');
            const filtered = getFilteredReports();
            document.getElementById('feed-count-badge').innerText = filtered.length;

            if (filtered.length === 0) {
                listContainer.innerHTML = `
                    <div class="bg-white rounded-2xl p-8 text-center border border-slate-200">
                        <i data-lucide="info" class="w-10 h-10 text-slate-400 mx-auto mb-2"></i>
                        <p class="font-bold text-slate-700">Nenhuma ocorrência encontrada.</p>
                        <p class="text-xs text-slate-500 mt-1">Tente alterar os filtros acima ou seja o primeiro a reportar!</p>
                    </div>
                `;
                lucide.createIcons();
                return;
            }

            listContainer.innerHTML = filtered.map(report => {
                const urgencyBadge = report.urgency === 'Crítica' 
                    ? '<span class="bg-red-100 text-red-700 text-xs font-extrabold px-2 py-0.5 rounded-full">🔴 URGÊNCIA CRÍTICA</span>'
                    : report.urgency === 'Média'
                    ? '<span class="bg-amber-100 text-amber-700 text-xs font-extrabold px-2 py-0.5 rounded-full">🟠 URGÊNCIA MÉDIA</span>'
                    : '<span class="bg-brand-100 text-brand-700 text-xs font-extrabold px-2 py-0.5 rounded-full">🟢 BAIXA URGÊNCIA</span>';

                const statusBadge = report.status === 'Resolvido'
                    ? '<span class="bg-brand-50 text-brand-700 border border-brand-200 text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1"><i data-lucide="check-circle" class="w-3.5 h-3.5"></i> Resolvido</span>'
                    : report.status === 'Em Análise'
                    ? '<span class="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1"><i data-lucide="clock" class="w-3.5 h-3.5"></i> Em Análise</span>'
                    : '<span class="bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1"><i data-lucide="alert-circle" class="w-3.5 h-3.5"></i> Em Aberto</span>';

                const btnSupportClass = report.userSupported 
                    ? 'bg-brand-700 text-white font-bold' 
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold';

                return `
                    <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:shadow-md transition-all space-y-3">
                        <div class="flex items-start justify-between gap-2">
                            <div class="flex items-center space-x-2">
                                <span class="text-2xl" aria-hidden="true">${report.categoryIcon}</span>
                                <div>
                                    <span class="text-xs font-extrabold text-slate-500 uppercase tracking-wide block">${escapeHtml(report.categoryName)}</span>
                                    <span class="text-xs text-slate-400">Protocolo: ${escapeHtml(report.id)}</span>
                                </div>
                            </div>
                            <div class="flex flex-col items-end gap-1">
                                ${statusBadge}
                                ${urgencyBadge}
                            </div>
                        </div>
                        <div>
                            <h3 class="text-base font-bold text-slate-900 leading-snug">${escapeHtml(report.title)}</h3>
                            <p class="text-xs text-slate-600 mt-1.5 leading-relaxed">${escapeHtml(report.desc)}</p>
                        </div>
                        ${report.image ? `
                            <div class="overflow-hidden rounded-xl h-44 w-full bg-slate-100">
                                <img src="${escapeHtml(report.image)}" class="w-full h-full object-cover hover:scale-105 transition-transform duration-300" alt="Evidência para: ${escapeHtml(report.title)}">
                            </div>
                        ` : ''}
                        <div class="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 gap-2">
                            <div class="flex items-center space-x-1.5 text-slate-700 font-medium">
                                <i data-lucide="map-pin" class="w-3.5 h-3.5 text-brand-600 shrink-0"></i>
                                <span>${escapeHtml(report.address)} (${escapeHtml(report.bairro)})</span>
                            </div>
                            <span class="text-xs text-slate-400">${escapeHtml(report.date)}</span>
                        </div>
                        <div class="pt-2 flex items-center justify-between">
                            <button onclick="toggleSupport('${escapeHtml(report.id)}')" aria-label="${report.userSupported ? 'Remover apoio' : 'Apoiar denúncia'}" class="${btnSupportClass} px-3.5 py-2 rounded-xl text-xs transition-colors flex items-center gap-1.5">
                                <i data-lucide="thumbs-up" class="w-4 h-4"></i>
                                <span>${report.userSupported ? 'Apoiado por Você' : 'Eu Também Passei por Isso'}</span>
                                <span class="bg-white/20 text-current px-1.5 py-0.5 rounded-md text-xs font-black">${report.supports}</span>
                            </button>
                            <button onclick="focusOnMap(${report.lat}, ${report.lng})" class="text-xs text-brand-600 hover:text-brand-800 font-bold flex items-center gap-1">
                                <i data-lucide="navigation" class="w-3.5 h-3.5"></i> Ver no Mapa
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
            lucide.createIcons();
        }

        async function toggleSupport(id) {
            const report = reports.find(item => item.id === id);
            if (!report) return;
            try {
                const result = await apiRequest(`/api/reports/${encodeURIComponent(id)}/support`, { method: 'POST', body: JSON.stringify({ clientId: getClientId() }) });
                Object.assign(report, result.report);
                showToast(report.userSupported ? '✅ Você confirmou essa ocorrência!' : 'O apoio foi removido.', report.userSupported ? 'success' : 'info');
                renderReportsFeed(); updateTopCounters(); updateMapMarkers();
            } catch (error) { showToast(error.message, 'error'); }
        }
        function focusOnMap(lat, lng) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            map.setView([lat, lng], 15);
            showToast('📍 Localização centralizada.');
        }

        function updateTopCounters() {
            const active = reports.filter(r => r.status !== 'Resolvido' && r.status !== 'Cancelado').length;
            const totalSupports = reports.reduce((acc, curr) => acc + curr.supports, 1820);
            document.getElementById('stat-total-active').innerText = active;
            document.getElementById('stat-trucks-active').innerText = `${garbageTrucks.length} Caminhões`;
            document.getElementById('stat-total-supports').innerText = totalSupports.toLocaleString('pt-BR');
        }

        function openReportModal() { document.getElementById('report-modal').classList.remove('hidden'); }
        function closeReportModal() { 
            document.getElementById('report-modal').classList.add('hidden'); 
            document.getElementById('denuncia-form').reset();
            document.getElementById('image-preview-container').classList.add('hidden');
        }

        function setupCategoryCardSelection() {
            document.querySelectorAll('.modal-cat-card').forEach(card => {
                card.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.click(); }
                });
                card.addEventListener('click', function() {
                    document.querySelectorAll('.modal-cat-card').forEach(c => c.classList.remove('border-brand-500', 'bg-brand-50'));
                    this.classList.add('border-brand-500', 'bg-brand-50');
                    this.querySelector('input').checked = true;
                });
            });
        }

        function previewImage(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    document.getElementById('image-preview').src = e.target.result;
                    document.getElementById('image-preview-container').classList.remove('hidden');
                }
                reader.readAsDataURL(file);
            }
        }

        function useCurrentLocation() {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        document.getElementById('report-address').value = `Lat: ${pos.coords.latitude.toFixed(4)}, Lng: ${pos.coords.longitude.toFixed(4)}`;
                        showToast('Localização GPS preenchida!', 'success');
                    },
                    () => { showToast('Não foi possível obter GPS.', 'error'); }
                );
            }
        }

        async function submitNewReport(e) {
            e.preventDefault();
            const categoryInput = document.querySelector('input[name="modal_categoria"]:checked');
            if (!categoryInput) return showToast('Selecione uma categoria.', 'error');
            const image = document.getElementById('image-preview').src;
            const request = {
                category: categoryInput.value, title: document.getElementById('report-title').value,
                desc: document.getElementById('report-desc').value, bairro: document.getElementById('report-bairro').value,
                address: document.getElementById('report-address').value, urgency: document.querySelector('input[name="urgency"]:checked').value,
                clientId: getClientId(), lat: -3.0900 + (Math.random() - 0.5) * 0.05,
                lng: -60.0200 + (Math.random() - 0.5) * 0.05, image: image && image.length > 50 ? image : null
            };
            try {
                const result = await apiRequest('/api/reports', { method: 'POST', body: JSON.stringify(request) });
                saveMyReport(result.report); reports.unshift(result.report); closeReportModal(); renderReportsFeed(); updateTopCounters(); updateMapMarkers();
                showToast(`Denúncia enviada! Protocolo: ${result.report.id}`, 'success');
            } catch (error) { showToast(error.message, 'error'); }
        }
        async function searchProtocol(e) {
            e.preventDefault();
            const query = document.getElementById('protocol-search-input').value.trim().toUpperCase();
            const resultCard = document.getElementById('protocol-result-card');
            let found = null;
            try {
                const params = new URLSearchParams({ protocol: query, clientId: getClientId() });
                found = (await apiRequest(`/api/reports?${params.toString()}`)).report;
            } catch (error) {
                showToast('Não foi possível consultar o backend. Verifique se o servidor está em execução.', 'error');
                found = reports.find(report => report.id.toUpperCase().includes(query)) || null;
            }
            resultCard.classList.remove('hidden');
            if (found) {
                resultCard.innerHTML = `
                    <div class="flex items-center justify-between border-b border-slate-100 pb-4">
                        <div><span class="text-xs text-slate-400 uppercase font-bold">Protocolo Encontrado</span><h3 class="text-xl font-bold font-mono text-slate-900">${escapeHtml(found.id)}</h3></div>
                        <span class="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full">${escapeHtml(found.status)}</span>
                    </div>
                    <div class="space-y-2 text-xs text-slate-700 mt-4">
                        <p><strong>Categoria:</strong> ${escapeHtml(found.categoryIcon)} ${escapeHtml(found.categoryName)}</p>
                        <p><strong>Título:</strong> ${escapeHtml(found.title)}</p><p><strong>Local:</strong> ${escapeHtml(found.address)}</p>
                    </div>`;
            } else resultCard.innerHTML = '<div class="text-center py-4"><p class="font-bold text-slate-800">Protocolo não encontrado.</p></div>';
        }
        function switchTab(tab) {
            ['feed', 'stats', 'busca', 'minhas'].forEach(t => {
                document.getElementById(`tab-${t}`).classList.add('hidden');
                const btn = document.getElementById(`nav-${t}`);
                if (btn) {
                    btn.classList.remove('text-brand-700', 'bg-brand-50');
                    btn.classList.add('text-slate-600');
                }
            });
            document.getElementById(`tab-${tab}`).classList.remove('hidden');
            const activeBtn = document.getElementById(`nav-${tab}`);
            if (activeBtn) {
                activeBtn.classList.remove('text-slate-600');
                activeBtn.classList.add('text-brand-700', 'bg-brand-50');
            }
            if (tab === 'minhas') refreshMyReports();
            if (tab === 'feed' && map) setTimeout(() => map.invalidateSize(), 200);
        }

        const accessibilityOptions = {
            colorblind: 'access-colorblind',
            hearing: 'access-hearing',
            motor: 'motor-accessibility',
            cognitive: 'access-cognitive'
        };

        function setAccessibilityOption(option, enabled) {
            const bodyClass = accessibilityOptions[option];
            if (!bodyClass) return;
            document.body.classList.toggle(bodyClass, enabled);
            try {
                const settings = JSON.parse(localStorage.getItem('ecofila-accessibility') || '{}');
                settings[option] = enabled;
                localStorage.setItem('ecofila-accessibility', JSON.stringify(settings));
            } catch (error) {}
        }

        function initializeAccessibilityOptions() {
            let settings = {};
            try {
                settings = JSON.parse(localStorage.getItem('ecofila-accessibility') || '{}');
                if (settings.motor === undefined) {
                    settings.motor = localStorage.getItem('ecofila-motor-accessibility') === 'on';
                }
            } catch (error) {}
            Object.entries(accessibilityOptions).forEach(([option, bodyClass]) => {
                const enabled = settings[option] === true;
                document.body.classList.toggle(bodyClass, enabled);
                const checkbox = document.getElementById(`access-${option}`);
                if (checkbox) checkbox.checked = enabled;
            });
        }

        function toggleAccessibilityMenu(forceOpen) {
            const menu = document.getElementById('accessibility-menu');
            const button = document.getElementById('accessibility-menu-button');
            const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : menu.classList.contains('hidden');
            menu.classList.toggle('hidden', !shouldOpen);
            button.setAttribute('aria-expanded', String(shouldOpen));
            if (shouldOpen) menu.querySelector('input').focus();
        }

        document.addEventListener('click', function(event) {
            const wrapper = document.getElementById('accessibility-menu-button').parentElement;
            if (!wrapper.contains(event.target)) toggleAccessibilityMenu(false);
        });
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') toggleAccessibilityMenu(false);
        });
                function toggleMobileMenu(forceOpen) {
            const menu = document.getElementById('mobile-menu');
            const button = document.getElementById('mobile-menu-button');
            const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : menu.classList.contains('hidden');
            menu.classList.toggle('hidden', !shouldOpen);
            button.setAttribute('aria-expanded', String(shouldOpen));
            button.setAttribute('aria-label', shouldOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação');
        }

        window.addEventListener('resize', function() {
            if (map) window.requestAnimationFrame(() => map.invalidateSize());
        });

        function toggleMapExpand() {
            const mapCol = document.getElementById('map-col');
            const feedCol = document.getElementById('feed-col');
            const btnText = document.getElementById('map-toggle-text');
            if (mapCol.classList.contains('lg:col-span-12')) {
                mapCol.classList.remove('lg:col-span-12'); mapCol.classList.add('lg:col-span-6');
                feedCol.classList.remove('hidden'); btnText.innerText = 'Expandir Mapa';
            } else {
                mapCol.classList.remove('lg:col-span-6'); mapCol.classList.add('lg:col-span-12');
                feedCol.classList.add('hidden'); btnText.innerText = 'Mostrar Lista';
            }
            setTimeout(() => map.invalidateSize(), 300);
        }

        function showToast(message, type = 'info') {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            const isError = type === 'error';
            
            container.setAttribute('aria-live', isError ? 'assertive' : 'polite');
            const bgColor = type === 'success' ? 'bg-brand-800' : isError ? 'bg-red-800' : 'bg-slate-800';
            const icon = type === 'success' ? '✅' : isError ? '❌' : 'ℹ️';

            toast.className = `${bgColor} text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 transform transition-all duration-300 pointer-events-auto max-w-sm`;
            const closeBtn = isError ? `<button type="button" aria-label="Fechar" onclick="this.parentElement.remove()" class="ml-2 bg-red-900/50 hover:bg-red-900 p-1.5 rounded-lg text-white font-bold"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>` : '';

            toast.innerHTML = `<span>${icon}</span> <span class="flex-grow">${message}</span> ${closeBtn}`;
            container.appendChild(toast);
            lucide.createIcons();

            if (!isError) {
                setTimeout(() => {
                    toast.classList.add('opacity-0', 'translate-y-4');
                    setTimeout(() => toast.remove(), 300);
                }, document.body.classList.contains('access-hearing') ? 10000 : 4000);
            }
        }

        function initCharts() {
            const ctx1 = document.getElementById('categoryChart').getContext('2d');
            new Chart(ctx1, {
                type: 'doughnut',
                data: {
                    labels: ['Trânsito', 'Buracos / Vias', 'Lixo', 'Iluminação'],
                    datasets: [{ data: [40, 30, 18, 12], backgroundColor: ['#f59e0b', '#f97316', '#047857', '#0ea5e9'] }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
            });

            const ctx2 = document.getElementById('neighborhoodChart').getContext('2d');
            new Chart(ctx2, {
                type: 'bar',
                data: {
                    labels: ['Centro', 'Zona Leste', 'Zona Sul', 'Ponta Negra', 'Vieiralves'],
                    datasets: [{ label: 'Reclamações Ativas', data: [42, 68, 30, 15, 22], backgroundColor: '#047857' }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });
        }
        function readMyReports() {
            try {
                const saved = JSON.parse(localStorage.getItem('ecofila-my-reports-' + getClientId()) || '[]');
                return Array.isArray(saved) ? saved.filter(r => r && typeof r.id === 'string') : [];
            } catch { return []; }
        }
        function saveMyReport(report) {
            try {
                const saved = readMyReports().filter(r => r.id !== report.id);
                saved.unshift({ id: report.id, title: report.title, status: report.status, bairro: report.bairro, submittedAt: new Date().toISOString() });
                localStorage.setItem('ecofila-my-reports-' + getClientId(), JSON.stringify(saved));
            } catch { showToast('Denúncia enviada, mas não foi possível salvar o histórico neste navegador. Anote o protocolo: ' + report.id, 'error'); }
        }
        function renderMyReports() {
            const container = document.getElementById('my-reports-list');
            const saved = readMyReports();
            if (!saved.length) {
                container.innerHTML = '<div class="bg-white border border-slate-200 rounded-2xl p-6 text-center"><p class="font-bold text-slate-800">Você ainda não enviou denúncias neste navegador.</p><p class="text-sm text-slate-600 mt-2">As denúncias enviadas a partir de agora aparecerão aqui com seu protocolo.</p><button onclick="openReportModal()" class="mt-4 bg-brand-700 text-white font-bold px-4 py-2 rounded-xl">Nova denúncia</button></div>';
                return;
            }
            container.innerHTML = saved.map(item => {
                const current = reports.find(r => r.id === item.id);
                const report = current || item;
                return `<article class="bg-white border border-slate-200 rounded-2xl p-5 space-y-3"><div class="flex flex-wrap items-center justify-between gap-2"><span class="font-mono font-bold text-brand-700">${escapeHtml(item.id)}</span><span class="text-xs font-bold bg-slate-100 text-slate-800 px-3 py-1 rounded-full">${escapeHtml(report.status)}</span></div><h3 class="font-bold text-slate-900">${escapeHtml(report.title)}</h3><p class="text-sm text-slate-600">${escapeHtml(report.bairro)} · Enviada em ${escapeHtml(new Date(item.submittedAt).toLocaleString('pt-BR'))}</p>${current ? '' : '<p class="text-xs text-slate-500">Situação registrada no envio. Consulte o protocolo para confirmar o andamento.</p>'}<button type="button" data-my-protocol="${escapeHtml(item.id)}" class="text-brand-700 font-bold text-sm underline">Consultar protocolo</button>${!["Cancelado", "Resolvido"].includes(report.status) ? `<button type="button" data-cancel-protocol="${escapeHtml(item.id)}" class="ml-4 text-red-700 font-bold text-sm underline">Cancelar denúncia</button>` : ""}</article>`;
            }).join('');
            container.querySelectorAll('[data-cancel-protocol]').forEach(button => button.addEventListener('click', () => cancelMyReport(button.dataset.cancelProtocol, button)));
            container.querySelectorAll('[data-my-protocol]').forEach(button => button.addEventListener('click', () => {
                switchTab('busca');
                document.getElementById('protocol-search-input').value = button.dataset.myProtocol;
                searchProtocol({ preventDefault() {} });
            }));
        }
        async function cancelMyReport(id, button) {
            if (!confirm('Deseja cancelar a denúncia ' + id + '? O protocolo será mantido no histórico.')) return;
            button.disabled = true;
            try {
                const result = await apiRequest('/api/reports/' + encodeURIComponent(id) + '/cancel', { method: 'POST', body: JSON.stringify({ clientId: getClientId() }) });
                const index = reports.findIndex(r => r.id === id);
                if (index >= 0) reports[index] = result.report;
                else reports.push(result.report);
                const saved = readMyReports().map(r => r.id === id ? { ...r, status: result.report.status } : r);
                try { localStorage.setItem('ecofila-my-reports-' + getClientId(), JSON.stringify(saved)); } catch {}
                renderMyReports(); renderReportsFeed(); updateMapMarkers(); updateTopCounters();
                showToast('Denúncia cancelada. O protocolo permanece no histórico.', 'success');
            } catch (error) { showToast(error.message, 'error'); }
            finally { button.disabled = false; }
        }
        async function refreshMyReports() {
            renderMyReports();
            try {
                const result = await apiRequest('/api/reports?clientId=' + encodeURIComponent(getClientId()));
                if (!Array.isArray(result.reports)) throw new Error('Resposta inválida do servidor.');
                reports = result.reports;
                const existing = new Set(reports.map(report => report.id));
                const saved = readMyReports().filter(report => existing.has(report.id));
                localStorage.setItem('ecofila-my-reports-' + getClientId(), JSON.stringify(saved));
                renderMyReports(); renderReportsFeed(); updateMapMarkers(); updateTopCounters();
            } catch (error) {
                showToast('Não foi possível atualizar o histórico. Os registros salvos foram mantidos.', 'error');
            }
        }