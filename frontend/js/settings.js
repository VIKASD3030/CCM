const SettingsPage = {
    currentPanel: 'webhooks',
    webhooks: [],
    users: [],

    async render() {
        const content = document.getElementById('page-content');
        content.innerHTML = `
<div class="settings-wrap">
    <aside class="settings-sidebar">
        <div class="settings-section-title">Settings</div>
        <div class="settings-nav-item" onclick="SettingsPage.showPanel('api-keys')"><i class="ti ti-key"></i> API keys</div>
        <div class="settings-nav-item active" onclick="SettingsPage.showPanel('webhooks')"><i class="ti ti-webhook"></i> Webhooks</div>
        <div class="settings-nav-item" onclick="SettingsPage.showPanel('notifications')"><i class="ti ti-bell"></i> Notifications</div>
        <div class="settings-nav-item" onclick="SettingsPage.showPanel('users')"><i class="ti ti-users"></i> Users</div>
        <div class="settings-nav-item" onclick="SettingsPage.showPanel('database')"><i class="ti ti-database"></i> Database</div>
        <div class="settings-nav-item" onclick="SettingsPage.showPanel('security')"><i class="ti ti-shield"></i> Security</div>
        <div class="settings-nav-item" onclick="SettingsPage.showPanel('system')"><i class="ti ti-server"></i> System</div>
    </aside>

    <main class="settings-content">

        <div id="panel-api-keys" class="settings-panel">
            <div class="settings-section-header">
                <h2>API keys</h2>
                <p>Manage OpenAI API keys used for classification and draft generation.</p>
            </div>
            <div class="banner banner-info"><i class="ti ti-info-circle"></i> Multiple keys enable automatic rotation on rate-limit errors. At least one key is required.</div>
            <div class="settings-card">
                <div class="settings-card-title"><i class="ti ti-brand-openai"></i> OpenAI API keys</div>
                <div id="apikeys-list">
                    <div class="settings-webhook-row">
                        <span class="settings-webhook-url">sk-proj-•••••••••••••••••••••••abcd</span>
                        <span class="settings-tag settings-tag-success">Active</span>
                        <button class="btn btn-ghost btn-sm">Rotate</button>
                        <button class="btn btn-destructive btn-sm"><i class="ti ti-trash"></i></button>
                    </div>
                    <div class="settings-webhook-row">
                        <span class="settings-webhook-url">sk-proj-•••••••••••••••••••••••efgh</span>
                        <span class="settings-tag settings-tag-info">Standby</span>
                        <button class="btn btn-ghost btn-sm">Rotate</button>
                        <button class="btn btn-destructive btn-sm"><i class="ti ti-trash"></i></button>
                    </div>
                    <hr class="settings-divider">
                    <button class="btn btn-primary btn-sm" style="margin-top:4px;"><i class="ti ti-plus"></i> Add key</button>
                </div>
            </div>
        </div>

        <div id="panel-webhooks" class="settings-panel active">
            <div class="settings-section-header">
                <h2>Webhooks</h2>
                <p>Deliver real-time events to external systems when letters are processed or reviewed.</p>
            </div>
            <div class="settings-card">
                <div class="settings-card-title"><i class="ti ti-broadcast"></i> Endpoints</div>
                <div id="webhooks-list"><div class="loading-overlay" style="padding:24px;"><div class="spinner"></div></div></div>
                <hr class="settings-divider">
                <button class="btn btn-primary btn-sm" onclick="SettingsPage.showCreateModal()"><i class="ti ti-plus"></i> Add endpoint</button>
            </div>
            <div class="settings-card">
                <div class="settings-card-title"><i class="ti ti-settings-2"></i> Retry policy</div>
                <div class="settings-field-row">
                    <label>Max retries</label>
                    <select class="form-input"><option>3 retries</option><option>5 retries</option><option>10 retries</option></select>
                </div>
                <div class="settings-field-row">
                    <label>Retry window</label>
                    <select class="form-input"><option>1 hour</option><option>6 hours</option><option>24 hours</option></select>
                </div>
                <div class="settings-field-row">
                    <label>Backoff strategy</label>
                    <select class="form-input"><option>Exponential</option><option>Linear</option><option>Fixed</option></select>
                </div>
                <hr class="settings-divider">
                <button class="btn btn-primary btn-sm">Save policy</button>
            </div>
        </div>

        <div id="panel-notifications" class="settings-panel">
            <div class="settings-section-header">
                <h2>Notifications</h2>
                <p>Configure per-user email alerts for letter intake and review events.</p>
            </div>
            <div class="settings-card">
                <div class="settings-card-title"><i class="ti ti-mail"></i> Email triggers</div>
                <div style="display:flex;flex-direction:column;gap:8px;">
                    <div class="settings-notif-row"><div class="settings-toggle"></div><span>New letter received</span></div>
                    <div class="settings-notif-row"><div class="settings-toggle"></div><span>Draft ready for review</span></div>
                    <div class="settings-notif-row"><div class="settings-toggle off"></div><span>Draft approved or rejected</span></div>
                    <div class="settings-notif-row"><div class="settings-toggle off"></div><span>Webhook delivery failure</span></div>
                </div>
                <hr class="settings-divider">
                <div class="settings-field-row">
                    <label>Digest frequency</label>
                    <select class="form-input"><option>Immediate</option><option>Daily digest</option><option>Weekly digest</option></select>
                </div>
                <button class="btn btn-primary btn-sm" style="margin-top:8px;">Save preferences</button>
            </div>
        </div>

        <div id="panel-users" class="settings-panel">
            <div class="settings-section-header">
                <h2>Users</h2>
                <p>Manage team members, roles, and access permissions.</p>
            </div>
            <div class="settings-card">
                <div class="settings-card-title"><i class="ti ti-users"></i> Team members</div>
                <div id="users-list"><div class="loading-overlay" style="padding:24px;"><div class="spinner"></div></div></div>
                <hr class="settings-divider">
                <button class="btn btn-primary btn-sm" onclick="SettingsPage.showInviteUserModal()"><i class="ti ti-send"></i> Invite user</button>
            </div>
        </div>

        <div id="panel-database" class="settings-panel">
            <div class="settings-section-header">
                <h2>Database</h2>
                <p>Configure connection pool settings exposed as environment variables.</p>
            </div>
            <div class="settings-card">
                <div class="settings-card-title"><i class="ti ti-database"></i> Connection pool</div>
                <div class="settings-pool-grid">
                    <div class="settings-field-row" style="flex-direction:column;align-items:flex-start;gap:4px;">
                        <label style="width:auto;">Min pool size</label>
                        <input type="number" value="5" class="form-input" style="width:100%;">
                    </div>
                    <div class="settings-field-row" style="flex-direction:column;align-items:flex-start;gap:4px;">
                        <label style="width:auto;">Max pool size</label>
                        <input type="number" value="20" class="form-input" style="width:100%;">
                    </div>
                    <div class="settings-field-row" style="flex-direction:column;align-items:flex-start;gap:4px;">
                        <label style="width:auto;">Command timeout (s)</label>
                        <input type="number" value="30" class="form-input" style="width:100%;">
                    </div>
                    <div class="settings-field-row" style="flex-direction:column;align-items:flex-start;gap:4px;">
                        <label style="width:auto;">Idle lifetime (s)</label>
                        <input type="number" value="300" class="form-input" style="width:100%;">
                    </div>
                </div>
                <hr class="settings-divider">
                <button class="btn btn-primary btn-sm">Save pool settings</button>
            </div>
        </div>

        <div id="panel-security" class="settings-panel">
            <div class="settings-section-header">
                <h2>Security</h2>
                <p>Authentication, TLS, and rate limiting configuration.</p>
            </div>
            <div class="settings-card">
                <div class="settings-card-title"><i class="ti ti-lock"></i> JWT configuration</div>
                <div class="settings-field-row">
                    <label>Token expiry</label>
                    <select class="form-input"><option>1 hour</option><option>8 hours</option><option>24 hours</option></select>
                </div>
                <div class="settings-field-row">
                    <label>Secret key</label>
                    <input type="password" class="form-input" value="supersecretkey1234">
                </div>
                <hr class="settings-divider">
                <button class="btn btn-primary btn-sm">Rotate secret</button>
            </div>
            <div class="settings-card">
                <div class="settings-card-title"><i class="ti ti-shield-check"></i> Rate limiting</div>
                <div class="settings-field-row">
                    <label>Per-user (req/min)</label>
                    <input type="number" class="form-input" value="60">
                </div>
                <div class="settings-field-row">
                    <label>Global (req/min)</label>
                    <input type="number" class="form-input" value="500">
                </div>
                <hr class="settings-divider">
                <button class="btn btn-primary btn-sm">Save limits</button>
            </div>
        </div>

        <div id="panel-system" class="settings-panel">
            <div class="settings-section-header">
                <h2>System</h2>
                <p>Health status and configuration overview for all backend services.</p>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--gutter);">
                <div class="settings-card">
                    <div class="settings-card-title"><i class="ti ti-heartbeat"></i> System Health</div>
                    <div id="sys-health"><div class="loading-overlay" style="padding:16px;"><div class="spinner"></div></div></div>
                </div>
                <div class="settings-card">
                    <div class="settings-card-title"><i class="ti ti-info-circle"></i> Configuration</div>
                    <div>
                        <div class="settings-field-row"><label style="width:100px;">Storage</label><span class="text-muted" id="cfg-storage">-</span></div>
                        <div class="settings-field-row"><label style="width:100px;">Version</label><span class="text-muted" id="cfg-env">-</span></div>
                        <div class="settings-field-row"><label style="width:100px;">AI Model</label><span class="text-muted" id="cfg-model">-</span></div>
                        <div class="settings-field-row"><label style="width:100px;">Uptime</label><span class="text-muted" id="cfg-uptime">-</span></div>
                    </div>
                </div>
            </div>
        </div>

    </main>
</div>`;

        this.loadWebhooks();
        this.loadUsers();
        this.loadSystemInfo();
    },

    showPanel(id) {
        this.currentPanel = id;
        document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.settings-nav-item').forEach(n => n.classList.remove('active'));
        document.getElementById('panel-' + id).classList.add('active');
        document.querySelector(`.settings-nav-item[onclick*="'${id}'"]`).classList.add('active');
    },

    async loadWebhooks() {
        const list = document.getElementById('webhooks-list');
        try {
            const data = await API.webhooks.list();
            this.webhooks = data.webhooks || [];
            this.renderWebhookList();
        } catch (error) {
            list.innerHTML = this._errorState('Failed to load webhooks', error.message);
        }
    },

    renderWebhookList() {
        const list = document.getElementById('webhooks-list');
        if (!this.webhooks.length) {
            list.innerHTML = '<div class="empty-state" style="padding:24px;"><div class="empty-state-icon"><i class="ti ti-webhook-off"></i></div><div class="empty-state-body">No webhooks configured yet.</div></div>';
            return;
        }
        list.innerHTML = this.webhooks.map(w => {
            let tag = '';
            if (!w.is_active) tag = '<span class="settings-tag settings-tag-warning">Paused</span>';
            else if (w.failure_count > 3) tag = '<span class="settings-tag settings-tag-danger">Failing</span>';
            else tag = '<span class="settings-tag settings-tag-success">Healthy</span>';

            const testLabel = w.failure_count > 0 ? '<i class="ti ti-refresh"></i> Redeliver' : '<i class="ti ti-player-play"></i> Test';

            return `
                <div class="settings-webhook-row">
                    <div class="settings-toggle ${w.is_active ? '' : 'off'}"></div>
                    <span class="settings-webhook-url" title="${this.escapeHtml(w.url)}">${this.escapeHtml(w.url)}</span>
                    ${tag}
                    <button class="btn btn-ghost btn-sm" onclick="SettingsPage.testWebhook('${w.id}')">${testLabel}</button>
                    <button class="btn btn-destructive btn-sm" onclick="SettingsPage.deleteWebhook('${w.id}')"><i class="ti ti-trash"></i></button>
                </div>
            `;
        }).join('');
    },

    showCreateModal() {
        const eventOptions = ['letter.uploaded', 'draft.generated', 'kb.document_added', 'test.ping'];
        const modal = document.getElementById('modal-content');
        modal.innerHTML = `
            <div class="modal-header">
                <span class="modal-title">Add Webhook</span>
                <button class="btn-ghost btn-sm" onclick="App.closeModal()" style="padding:4px 8px;">
                    <i class="ti ti-x" style="font-size:16px;"></i>
                </button>
            </div>
            <div class="modal-body" style="display:flex;flex-direction:column;gap:14px;">
                <div class="form-group">
                    <label class="form-label">URL</label>
                    <input type="url" id="wh-url" class="form-input" placeholder="https://hooks.example.com/events">
                </div>
                <div class="form-group">
                    <label class="form-label">Secret Key</label>
                    <input type="text" id="wh-secret" class="form-input" placeholder="Shared secret for HMAC signing">
                </div>
                <div class="form-group">
                    <label class="form-label">Events to subscribe to</label>
                    <div style="display:flex;flex-direction:column;gap:6px;margin-top:4px;">
                        ${eventOptions.map(e => `
                            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;">
                                <input type="checkbox" value="${e}" checked>
                                <span>${e}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
                <div id="wh-create-status" style="font-size:13px;"></div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-ghost btn-sm" onclick="App.closeModal()">Cancel</button>
                <button class="btn btn-primary btn-sm" onclick="SettingsPage.createWebhook()">Create Webhook</button>
            </div>`;
        document.getElementById('modal-overlay').style.display = 'flex';
    },

    async createWebhook() {
        const url = document.getElementById('wh-url').value.trim();
        const secret = document.getElementById('wh-secret').value.trim();
        const checkboxes = document.querySelectorAll('#modal-content input[type="checkbox"]:checked');
        const events = Array.from(checkboxes).map(cb => cb.value);
        if (!url || !secret || !events.length) {
            document.getElementById('wh-create-status').innerHTML = '<span style="color:var(--color-red);">URL, secret, and at least one event are required.</span>';
            return;
        }
        const status = document.getElementById('wh-create-status');
        status.innerHTML = '<div class="spinner" style="width:14px;height:14px;display:inline-block;margin-right:6px;"></div> Creating...';
        try {
            await API.webhooks.create({ url, secret, events });
            App.closeModal();
            App.showToast('Webhook created!', 'success');
            this.loadWebhooks();
        } catch (error) {
            status.innerHTML = `<span style="color:var(--color-red);">${this.escapeHtml(error.message)}</span>`;
        }
    },

    async deleteWebhook(id) {
        const w = this.webhooks.find(x => x.id === id);
        if (!confirm(`Delete webhook pointing to "${w ? w.url : id}"?`)) return;
        try {
            await API.webhooks.delete(id);
            App.showToast('Webhook deleted.', 'info');
            this.loadWebhooks();
        } catch (e) {
            App.showToast(`Delete failed: ${e.message}`, 'error');
        }
    },

    async testWebhook(id) {
        try {
            await API.webhooks.test(id);
            App.showToast('Test ping sent!', 'success');
        } catch (e) {
            App.showToast(`Test failed: ${e.message}`, 'error');
        }
    },

    async loadUsers() {
        const list = document.getElementById('users-list');
        if (!list) return;
        try {
            const data = await API.auth.listUsers();
            this.users = data.users || [];
            this.renderUsersList();
        } catch (error) {
            list.innerHTML = this._errorState('Failed to load users', error.message);
        }
    },

    renderUsersList() {
        const list = document.getElementById('users-list');
        if (!list) return;
        if (!this.users.length) {
            list.innerHTML = '<div class="empty-state" style="padding:24px;"><div class="empty-state-icon"><i class="ti ti-users-off"></i></div><div class="empty-state-body">No users yet.</div></div>';
            return;
        }
        list.innerHTML = this.users.map(u => {
            const initials = u.email.substring(0, 2).toUpperCase();
            let tag = '';
            if (u.role === 'admin') tag = '<span class="settings-tag settings-tag-info">Admin</span>';
            else if (u.role === 'reviewer') tag = '<span class="settings-tag settings-tag-success">Reviewer</span>';
            else tag = '<span class="settings-tag settings-tag-warning">Drafter</span>';
            const locked = u.locked_until ? ' <span class="settings-tag settings-tag-danger">Locked</span>' : '';

            return `
                <div class="settings-user-row">
                    <div class="settings-avatar">${this.escapeHtml(initials)}</div>
                    <div class="settings-user-info">
                        <strong>${this.escapeHtml(u.email)}</strong>
                        <span>Role: ${u.role}${u.is_active ? '' : ' (inactive)'}${locked}</span>
                    </div>
                    ${tag}
                    <button class="btn btn-destructive btn-sm" onclick="SettingsPage.deleteUser('${u.id}')"><i class="ti ti-trash"></i></button>
                </div>
            `;
        }).join('');
    },

    showInviteUserModal() {
        const modal = document.getElementById('modal-content');
        modal.innerHTML = `
            <div class="modal-header">
                <span class="modal-title">Invite User</span>
                <button class="btn-ghost btn-sm" onclick="App.closeModal()" style="padding:4px 8px;">
                    <i class="ti ti-x" style="font-size:16px;"></i>
                </button>
            </div>
            <div class="modal-body" style="display:flex;flex-direction:column;gap:14px;">
                <div class="form-group">
                    <label class="form-label">Email</label>
                    <input type="email" id="inv-email" class="form-input" placeholder="user@example.com">
                </div>
                <div class="form-group">
                    <label class="form-label">Password</label>
                    <input type="password" id="inv-password" class="form-input" placeholder="Set initial password">
                </div>
                <div class="form-group">
                    <label class="form-label">Role</label>
                    <select id="inv-role" class="form-input">
                        <option value="drafter">Drafter</option>
                        <option value="reviewer">Reviewer</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>
                <div id="inv-status" style="font-size:13px;"></div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-ghost btn-sm" onclick="App.closeModal()">Cancel</button>
                <button class="btn btn-primary btn-sm" onclick="SettingsPage.createUser()">Create User</button>
            </div>`;
        document.getElementById('modal-overlay').style.display = 'flex';
    },

    async createUser() {
        const email = document.getElementById('inv-email').value.trim();
        const password = document.getElementById('inv-password').value.trim();
        const role = document.getElementById('inv-role').value;
        const status = document.getElementById('inv-status');
        if (!email || !password) { status.innerHTML = '<span style="color:var(--color-red);">Email and password are required.</span>'; return; }
        status.innerHTML = '<div class="spinner" style="width:14px;height:14px;display:inline-block;margin-right:6px;"></div> Creating...';
        try {
            await API.auth.register(email, password, role);
            App.closeModal();
            App.showToast('User created!', 'success');
            this.loadUsers();
        } catch (error) {
            status.innerHTML = `<span style="color:var(--color-red);">${this.escapeHtml(error.message)}</span>`;
        }
    },

    async deleteUser(id) {
        const u = this.users.find(x => x.id === id);
        if (!confirm(`Delete user "${u ? u.email : id}"?`)) return;
        try {
            await API.auth.deleteUser(id);
            App.showToast('User deleted.', 'info');
            this.loadUsers();
        } catch (e) {
            App.showToast(`Delete failed: ${e.message}`, 'error');
        }
    },

    async loadSystemInfo() {
        try {
            const health = await API.health();
            const checks = health.checks || {};
            const hc = document.getElementById('sys-health');
            if (!hc) return;
            const entries = Object.entries(checks).map(([name, check]) => {
                const ok = check.status === 'ok';
                return `
                    <div class="settings-field-row" style="margin-bottom:4px;">
                        <div style="display:flex;align-items:center;gap:8px;flex:1;">
                            <div style="width:8px;height:8px;border-radius:50%;background:${ok ? 'var(--color-green)' : 'var(--color-red)'};flex-shrink:0;"></div>
                            <span style="text-transform:capitalize;">${name.replace(/_/g, ' ')}</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;">
                            <span class="status-pill ${ok ? 'approved' : 'rejected'}">${check.status}</span>
                            ${check.latency_ms ? `<span class="text-muted" style="font-size:11px;">${check.latency_ms}ms</span>` : ''}
                        </div>
                    </div>`;
            }).join('');
            hc.innerHTML = entries || '<div class="empty-state"><div class="empty-state-body">No health data</div></div>';

            const s = checks.storage;
            document.getElementById('cfg-storage').textContent = s?.backend || '-';
            document.getElementById('cfg-env').textContent = health.version || '-';
            document.getElementById('cfg-uptime').textContent = health.uptime_seconds ? `${Math.floor(health.uptime_seconds / 60)}m ${health.uptime_seconds % 60}s` : '-';
            document.getElementById('cfg-model').textContent = checks.openai_api?.status === 'ok' ? 'gpt-4o' : '-';
        } catch (e) {
            const hc = document.getElementById('sys-health');
            if (hc) hc.innerHTML = `<div class="empty-state" style="padding:16px;"><div class="empty-state-icon"><i class="ti ti-wifi-off"></i></div><div class="empty-state-body">${this.escapeHtml(e.message)}</div></div>`;
        }
    },

    _errorState(title, body) {
        return `<div class="empty-state" style="padding:24px;">
            <div class="empty-state-icon"><i class="ti ti-alert-circle"></i></div>
            <div class="empty-state-title">${title}</div>
            <div class="empty-state-body">${this.escapeHtml(body)}</div>
            <button class="btn btn-ghost btn-sm" onclick="SettingsPage.loadWebhooks()"><i class="ti ti-refresh"></i> Retry</button>
        </div>`;
    },

    escapeHtml(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    },
};
