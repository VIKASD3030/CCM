const App = {
    currentPage: 'dashboard',
    currentProjectId: null,
    projects: [],

    init() {
        this.setupRouting();
        this.setupSidebar();
        this.checkHealth();
        this.updateDate();
        setInterval(() => this.updateDate(), 60000);
        this.navigateToHash();
    },

    updateDate() {
        const el = document.getElementById('topbar-date');
        if (el) el.textContent = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    },

    setupRouting() {
        window.addEventListener('hashchange', () => this.navigateToHash());
    },

    navigateToHash() {
        const hash = window.location.hash.replace('#', '') || 'dashboard';
        this.navigate(hash);
    },

    navigate(page) {
        this.currentPage = page;
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });

        const titles = {
            dashboard: 'Dashboard',
            drafting: 'AI Drafting',
        };
        document.getElementById('page-title').textContent = titles[page] || 'CCM';
        document.getElementById('topbar-actions').innerHTML = '';

        switch (page) {
            case 'dashboard': this.renderDashboard(); break;
            case 'drafting':  DraftingPage.render(); break;
            default:          this.renderDashboard();
        }

        document.getElementById('sidebar').classList.remove('open');
        this.closeDrawer();
    },

    setupSidebar() {
        const sidebar = document.getElementById('sidebar');
        const mobileBtn = document.getElementById('mobile-menu-btn');

        mobileBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });

        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
                if (!sidebar.contains(e.target) && e.target !== mobileBtn) {
                    sidebar.classList.remove('open');
                }
            }
        });
    },

    closeModal() {
        document.getElementById('modal-overlay').style.display = 'none';
    },

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const iconMap = {
            success: 'ti-check',
            error:   'ti-alert-circle',
            info:    'ti-info-circle',
            warning: 'ti-alert-triangle',
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="ti ${iconMap[type] || 'ti-info-circle'}" style="font-size: 16px; flex-shrink: 0;"></i>
            <span style="flex: 1;">${message}</span>
            <button onclick="this.parentElement.remove()" style="background: none; border: none; color: var(--text-tertiary); font-size: 16px; cursor: pointer; padding: 0;">
                <i class="ti ti-x"></i>
            </button>
        `;
        container.appendChild(toast);
        setTimeout(() => {
            if (toast.parentElement) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(8px)';
                toast.style.transition = 'all 0.25s ease';
                setTimeout(() => toast.remove(), 250);
            }
        }, 4500);
    },

    async checkHealth() {
        const dot  = document.getElementById('system-status-dot');
        const text = document.getElementById('system-status-text');
        try {
            await API.health();
            dot.classList.add('connected');
            dot.classList.remove('error');
            text.textContent = 'Connected';
        } catch {
            dot.classList.add('error');
            dot.classList.remove('connected');
            text.textContent = 'Disconnected';
        }
        setTimeout(() => this.checkHealth(), 30000);
    },

    async loadProjects() {
        try {
            const data = await API.projects.list();
            this.projects = data.projects || [];
        } catch {
            this.projects = [];
        }
        return this.projects;
    },

    getProjectName(id) {
        const p = this.projects.find(p => p.id === id);
        return p ? p.name : 'Legacy';
    },

    /* ── Project Switcher ── */
    projectSelector() {
        const options = this.projects.map(p =>
            `<option value="${p.id}" ${this.currentProjectId === p.id ? 'selected' : ''}>${this.escapeHtml(p.name)}</option>`
        ).join('');
        return `
            <div class="project-selector">
                <i class="ti ti-folder"></i>
                <select id="project-select" class="filter-select" onchange="App.setProject(this.value)">
                    <option value="">All Projects</option>
                    ${options}
                </select>
            </div>
        `;
    },

    setProject(projectId) {
        this.currentProjectId = projectId || null;
        this.navigate(this.currentPage);
    },

    /* ── Dashboard ── */
    async renderDashboard() {
        const content = document.getElementById('page-content');
        await this.loadProjects();

        content.innerHTML = `
            <div class="dash-toolbar">
                ${this.projectSelector()}
            </div>
            <div class="stat-row" id="dash-metrics">
                ${this._skeletonMetrics()}
            </div>

            <div class="pipeline-card" id="dash-pipeline-card">
                <div class="card-header" style="margin-bottom:0;border-bottom:none;">
                    <span style="font-size:13px;font-weight:500;color:var(--text-primary);">Pipeline</span>
                </div>
                <div class="pipeline-strip" id="dash-pipeline-bar">
                    <div class="skeleton" style="flex:1;height:52px;border-radius:8px;"></div>
                </div>
            </div>

            <div class="dash-grid">
                <div class="card">
                    <div class="card-header">
                        <span style="font-size:13px;font-weight:500;color:var(--text-primary);">Recent letters</span>
                        <button class="btn btn-ghost btn-sm" onclick="window.location.hash='#drafting'">
                            <i class="ti ti-writing"></i> Draft
                        </button>
                    </div>
                    <div id="dash-recent-letters">
                        <div class="loading-overlay"><div class="spinner"></div><span>Loading…</span></div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <span style="font-size:13px;font-weight:500;color:var(--text-primary);">Sync Status</span>
                    </div>
                    <div id="dash-sync-status">
                        <div class="loading-overlay"><div class="spinner"></div></div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <span style="font-size:13px;font-weight:500;color:var(--text-primary);">Recent activity</span>
                    </div>
                    <div id="dash-activity">
                        <div class="loading-overlay"><div class="spinner"></div></div>
                    </div>
                </div>
            </div>

            <div class="card quick-actions" style="margin-top:12px;">
                <button class="btn btn-primary" onclick="App.showUploadModal()">
                    <i class="ti ti-upload"></i> Upload Letter
                </button>
                <button class="btn btn-secondary" onclick="window.location.hash='#drafting'">
                    <i class="ti ti-writing"></i> AI Drafting
                </button>
            </div>
        `;

        this.loadDashboardStats();
    },

    _skeletonMetrics() {
        return Array(4).fill().map(() => `
            <div class="stat-card">
                <div class="skeleton" style="width:28px;height:28px;border-radius:8px;"></div>
                <div style="flex:1;">
                    <div class="skeleton" style="width:60%;height:10px;border-radius:3px;margin-bottom:6px;"></div>
                    <div class="skeleton" style="width:40%;height:22px;border-radius:3px;"></div>
                </div>
            </div>
        `).join('');
    },

    async loadDashboardStats() {
        try {
            const [statsRes, kbStats] = await Promise.all([
                API.review.dashboardStats(),
                API.knowledge.stats(),
            ]);

            const stats = statsRes;

            const metrics = [
                { icon: 'ti-inbox', color: '#534AB7', bg: '#EEEDFE', label: 'Total Letters', value: stats.total_letters || 0, id: 'dash-total-letters' },
                { icon: 'ti-writing', color: '#3B82F6', bg: '#E6F1FB', label: 'Drafts Generated', value: stats.total_drafts || 0, id: 'dash-drafts' },
                { icon: 'ti-clock-hour-4', color: '#633806', bg: '#FAEEDA', label: 'Pending Review', value: stats.pending_review || 0, id: 'dash-pending' },
                { icon: 'ti-book-2', color: '#27500A', bg: '#EAF3DE', label: 'KB Documents', value: kbStats.total_documents || 0, id: 'dash-kb-docs' },
            ];

            document.getElementById('dash-metrics').innerHTML = metrics.map(m => `
                <div class="stat-card">
                    <div class="stat-icon" style="background:${m.bg};color:${m.color};">
                        <i class="ti ${m.icon}"></i>
                    </div>
                    <div class="stat-body">
                        <div class="stat-label">${m.label}</div>
                        <div class="stat-value" id="${m.id}">${m.value}</div>
                    </div>
                </div>
            `).join('');

            // Pipeline
            const stages = [
                { label: 'Received', count: stats.total_letters || 0 },
                { label: 'Classified', count: (stats.letters_by_status && stats.letters_by_status.classified) || 0 },
                { label: 'Drafted', count: stats.total_drafts || 0 },
                { label: 'Approved', count: (stats.drafts_by_status && stats.drafts_by_status.approved) || 0 },
                { label: 'Sent', count: (stats.letters_by_status && stats.letters_by_status.sent) || 0 },
            ];
            document.getElementById('dash-pipeline-bar').innerHTML = stages.map(s => `
                <div class="pipeline-segment">
                    <div class="pipeline-seg-count">${s.count}</div>
                    <div class="pipeline-seg-label">${s.label}</div>
                </div>
            `).join('');

            // Recent letters
            const lettersRes = await API.letters.list();
            const letters    = (lettersRes.letters || []).slice(0, 5);
            const lettersEl  = document.getElementById('dash-recent-letters');

            if (!letters.length) {
                lettersEl.innerHTML = `<div class="empty-state" style="padding:24px;"><div class="empty-state-icon"><i class="ti ti-mail-off"></i></div><div class="empty-state-title">No letters yet</div></div>`;
            } else {
                const statusMap = { received:'received', classified:'classified', drafted:'drafted', approved:'approved', sent:'sent', rejected:'rejected', pending_review:'pending' };
                lettersEl.innerHTML = letters.map(l => {
                    const date = l.received_at ? new Date(l.received_at).toLocaleDateString('en-US', { month:'short', day:'numeric' }) : '—';
                    const sk = statusMap[l.status] || 'received';
                    return `
                        <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:0.5px solid var(--border);">
                            <div style="flex:1;min-width:0;">
                                <div style="font-size:13px;font-weight:500;">${this.escapeHtml(l.sender || 'Unknown')}</div>
                                <div class="truncate text-muted" style="max-width:200px;font-size:12px;">${this.escapeHtml(l.filename || '—')}</div>
                                <div style="font-size:11px;color:var(--text-tertiary);margin-top:2px;">${date}</div>
                            </div>
                            <span class="status-pill ${sk}">${l.status.replace('_',' ')}</span>
                        </div>
                    `;
                }).join('');
            }

            // Sync status
            const syncEl = document.getElementById('dash-sync-status');
            if (this.projects.length) {
                const syncData = await Promise.all(
                    this.projects.map(p =>
                        API.projects.stats(p.id).catch(() => null)
                    )
                );
                syncEl.innerHTML = this.projects.map((p, i) => {
                    const s = syncData[i];
                    const lastSync = s?.last_sync;
                    const statusClass = lastSync?.status === 'success' ? 'connected' : (lastSync?.status === 'failed' ? 'error' : '');
                    return `
                        <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:0.5px solid var(--border);">
                            <div class="status-dot ${statusClass}" style="width:8px;height:8px;"></div>
                            <div style="flex:1;font-size:12px;font-weight:500;">${this.escapeHtml(p.name)}</div>
                            <div style="font-size:11px;color:var(--text-tertiary);">
                                ${lastSync?.last_synced_at ? new Date(lastSync.last_synced_at).toLocaleString() : 'Never synced'}
                            </div>
                            <div style="font-size:11px;color:var(--text-tertiary);">
                                ${lastSync?.files_synced !== undefined ? `${lastSync.files_synced} files` : ''}
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                syncEl.innerHTML = `<div class="empty-state" style="padding:16px;"><div class="empty-state-body">No projects configured</div></div>`;
            }

            // Activity
            const activities = stats.recent_activity || [];
            const actEl      = document.getElementById('dash-activity');
            if (!activities.length) {
                actEl.innerHTML = `<div class="empty-state" style="padding:16px;"><div class="empty-state-icon"><i class="ti ti-activity"></i></div><div class="empty-state-body">No activity yet</div></div>`;
            } else {
                const iconMap = { uploaded: { icon:'ti-upload', color:'#3B82F6', bg:'#E6F1FB' }, draft: { icon:'ti-writing', color:'#534AB7', bg:'#EEEDFE' }, approved: { icon:'ti-check', color:'#27500A', bg:'#EAF3DE' }, received: { icon:'ti-mail', color:'#633806', bg:'#FAEEDA' } };
                actEl.innerHTML = `<div class="timeline">${activities.slice(0,5).map(a => {
                    let style = iconMap.received;
                    for (const [k,v] of Object.entries(iconMap)) { if (a.action.includes(k)) { style = v; break; } }
                    const time = a.timestamp ? new Date(a.timestamp).toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '';
                    return `
                        <div class="timeline-entry">
                            <div class="timeline-dot" style="background:${style.bg};color:${style.color};">
                                <i class="ti ${style.icon}" style="font-size:13px;"></i>
                            </div>
                            <div class="timeline-body">
                                <div class="timeline-action">${a.action.replace(/_/g,' ')}</div>
                                <div class="timeline-meta">${a.entity_type || ''} · ${time}</div>
                            </div>
                        </div>
                    `;
                }).join('')}</div>`;
            }

        } catch (error) {
            console.error('Dashboard error:', error);
            document.getElementById('dash-metrics').innerHTML = `<div style="grid-column:span 4;"><div class="empty-state"><div class="empty-state-icon"><i class="ti ti-alert-circle"></i></div><div class="empty-state-title">Failed to load dashboard</div><button class="btn btn-ghost btn-sm" style="margin-top:8px;" onclick="App.renderDashboard()">Retry</button></div></div>`;
        }
    },

    showUploadModal() {
        App.closeModal();
        const modal = document.getElementById('modal-content');
        modal.innerHTML = `
            <div class="modal-header">
                <span class="modal-title">Upload Client Letter</span>
                <button class="btn-ghost btn-sm" onclick="App.closeModal()"><i class="ti ti-x"></i></button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Project</label>
                    <select id="upload-project" class="form-input">
                        <option value="">Select project (optional)</option>
                        ${App.projects.map(p => `<option value="${p.id}">${App.escapeHtml(p.name)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">File</label>
                    <input type="file" id="upload-file-input" class="form-input" accept=".pdf,.docx,.txt,.jpg,.jpeg,.png">
                </div>
                <div id="upload-status"></div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-ghost" onclick="App.closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="App.submitUpload()"><i class="ti ti-upload"></i> Upload</button>
            </div>
        `;
        document.getElementById('modal-overlay').style.display = 'flex';
    },

    async submitUpload() {
        const fileInput = document.getElementById('upload-file-input');
        const projectSelect = document.getElementById('upload-project');
        const statusEl = document.getElementById('upload-status');

        if (!fileInput.files.length) {
            statusEl.innerHTML = '<div class="upload-error"><i class="ti ti-alert-circle"></i> Please select a file</div>';
            return;
        }

        const file = fileInput.files[0];
        const projectId = projectSelect.value;

        statusEl.innerHTML = '<div class="upload-success"><i class="ti ti-spinner"></i> Uploading…</div>';

        try {
            await API.letters.upload(file, projectId);
            statusEl.innerHTML = '<div class="upload-success"><i class="ti ti-check"></i> Uploaded! Classifying in background.</div>';
            App.showToast('Letter uploaded and classification enqueued', 'success');
            setTimeout(() => App.closeModal(), 1500);
        } catch (e) {
            statusEl.innerHTML = `<div class="upload-error"><i class="ti ti-alert-circle"></i> ${this.escapeHtml(e.message)}</div>`;
        }
    },

    escapeHtml(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    },
};

/* ── Auth Guard ── */
function requireAuth() {
    const token = localStorage.getItem('ccm_access_token');
    if (!token) {
        window.location.replace('/login');
        return false;
    }
    return true;
}

document.addEventListener('DOMContentLoaded', () => {
    if (!requireAuth()) return;
    App.init();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { App.closeModal(); }
});
