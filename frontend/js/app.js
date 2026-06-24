const App = {
    currentPage: 'dashboard',

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
            knowledge: 'Knowledge Base',
            letters: 'Inbox',
            drafting: 'AI Drafting',
            review: 'Review & Approve',
            settings: 'Settings',
        };
        document.getElementById('page-title').textContent = titles[page] || 'CCM';
        document.getElementById('topbar-actions').innerHTML = '';

        switch (page) {
            case 'dashboard': this.renderDashboard(); break;
            case 'knowledge': KnowledgePage.render(); break;
            case 'letters':   LettersPage.render(); break;
            case 'drafting':  DraftingPage.render(); break;
            case 'review':    ReviewPage.render(); break;
            case 'settings':  SettingsPage.render(); break;
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

    openDrawer(title, bodyHtml, footerHtml = '') {
        document.getElementById('slide-over-title').textContent = title;
        document.getElementById('slide-over-body').innerHTML = bodyHtml;
        const footer = document.getElementById('slide-over-footer');
        if (footerHtml) {
            footer.innerHTML = footerHtml;
            footer.style.display = 'flex';
        } else {
            footer.style.display = 'none';
        }
        document.getElementById('slide-over').classList.add('open');
        document.getElementById('slide-over-backdrop').classList.add('open');
    },

    closeDrawer() {
        document.getElementById('slide-over').classList.remove('open');
        document.getElementById('slide-over-backdrop').classList.remove('open');
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

    /* ── Dashboard ── */

    async renderDashboard() {
        const content = document.getElementById('page-content');

        content.innerHTML = `
            <div class="stat-row" id="dash-metrics">
                ${this._skeletonMetrics()}
            </div>

            <div class="pipeline-card" id="dash-pipeline-card">
                <div class="pipeline-strip" id="dash-pipeline-bar">
                    <div class="skeleton" style="flex:1;height:52px;border-radius:8px;"></div>
                </div>
            </div>

            <div class="two-col">
                <div class="card">
                    <div class="card-header">
                        <span style="font-size:13px;font-weight:500;color:var(--text-primary);">Recent letters</span>
                        <a href="#letters" class="btn btn-ghost btn-sm">View all</a>
                    </div>
                    <div id="dash-recent-letters">
                        <div class="loading-overlay"><div class="spinner"></div><span>Loading…</span></div>
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

            <div class="card">
                <div class="quick-actions">
                    <button class="btn btn-primary" onclick="window.location.hash='#knowledge'">
                        <i class="ti ti-upload"></i> Upload to Knowledge Base
                    </button>
                    <button class="btn btn-secondary" onclick="window.location.hash='#letters'">
                        <i class="ti ti-mail"></i> Upload Client Letter
                    </button>
                    <button class="btn btn-ghost" onclick="window.location.hash='#review'">
                        <i class="ti ti-checkup-list"></i> Review Pending Drafts
                    </button>
                </div>
            </div>
        `;

        this.loadDashboardStats();
    },

    _skeletonMetrics() {
        return Array(4).map(() => `
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
            const [stats, kbStats] = await Promise.all([
                API.review.dashboardStats(),
                API.knowledge.stats(),
            ]);

            const metrics = [
                { icon: 'ti-inbox', color: '#534AB7', bg: '#EEEDFE', label: 'Total Letters', value: stats.total_letters || 0, id: 'dash-total-letters', trend: null },
                { icon: 'ti-writing', color: '#3B82F6', bg: '#E6F1FB', label: 'Drafts Generated', value: stats.total_drafts || 0, id: 'dash-drafts', trend: null },
                { icon: 'ti-clock-hour-4', color: '#633806', bg: '#FAEEDA', label: 'Pending Review', value: stats.pending_review || 0, id: 'dash-pending', trend: stats.pending_review > 0 ? 'Needs attention' : null },
                { icon: 'ti-book-2', color: '#27500A', bg: '#EAF3DE', label: 'KB Documents', value: kbStats.total_documents || 0, id: 'dash-kb-docs', trend: null },
            ];

            document.getElementById('dash-metrics').innerHTML = metrics.map(m => `
                <div class="stat-card">
                    <div class="stat-icon" style="background:${m.bg};color:${m.color};">
                        <i class="ti ${m.icon}"></i>
                    </div>
                    <div class="stat-body">
                        <div class="stat-label">${m.label}</div>
                        <div class="stat-value" id="${m.id}">${m.value}</div>
                        ${m.trend ? `<div class="stat-trend muted">${m.trend}</div>` : ''}
                    </div>
                </div>
            `).join('');

            // Pipeline strip
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
            const letters    = (lettersRes.letters || lettersRes || []).slice(0, 5);
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
                                <div class="truncate text-muted" style="max-width:200px;font-size:12px;">${this.escapeHtml(l.subject || l.filename || '—')}</div>
                                <div style="font-size:11px;color:var(--text-tertiary);margin-top:2px;">${date}</div>
                            </div>
                            <span class="status-pill ${sk}">${l.status.replace('_',' ')}</span>
                        </div>
                    `;
                }).join('');
            }

            // Activity
            const activities = stats.recent_activity || [];
            const actEl      = document.getElementById('dash-activity');
            if (!activities.length) {
                actEl.innerHTML = `<div class="empty-state" style="padding:24px;"><div class="empty-state-icon"><i class="ti ti-activity" style="font-size:24px;"></i></div><div class="empty-state-body">No activity yet</div></div>`;
            } else {
                const iconMap = {
                    uploaded: { icon:'ti-upload', color:'#3B82F6', bg:'#E6F1FB' },
                    draft:    { icon:'ti-writing', color:'#534AB7', bg:'#EEEDFE' },
                    approved: { icon:'ti-check', color:'#27500A', bg:'#EAF3DE' },
                    received: { icon:'ti-mail', color:'#633806', bg:'#FAEEDA' },
                };
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

            // Badges
            ReviewPage.updateBadgeCount(stats.pending_review || 0);
            const unclassified = (stats.letters_by_status && stats.letters_by_status.received) || 0;
            const inboxBadge = document.getElementById('inbox-badge');
            if (inboxBadge) {
                inboxBadge.textContent = unclassified;
                inboxBadge.style.display = unclassified > 0 ? 'inline-block' : 'none';
            }

        } catch (error) {
            console.error('Dashboard error:', error);
            document.getElementById('dash-metrics').innerHTML = `<div style="grid-column:span 4;"><div class="empty-state"><div class="empty-state-icon"><i class="ti ti-alert-circle"></i></div><div class="empty-state-title">Failed to load dashboard</div><div class="empty-state-body">Check that the backend server is running.</div><button class="btn btn-ghost btn-sm" style="margin-top:8px;" onclick="App.renderDashboard()">Retry</button></div></div>`;
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
    if (e.key === 'Escape') { App.closeModal(); App.closeDrawer(); }
});

document.getElementById('slide-over-backdrop')?.addEventListener('click', () => App.closeDrawer());
