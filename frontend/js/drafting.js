/**
 * DraftingPage — ChatGPT-style AI Drafting panel
 * Full conversation persistence via drafting_sessions API.
 */

const DraftingPage = {
    // ── State ──────────────────────────────────────────────────────────────────
    currentSessionId: null,
    currentLetterId: null,
    currentProjectId: null,
    currentLetterData: null,
    currentProjectData: null,
    sessions: [],
    templates: [],
    letters: [],
    sidebarCollapsed: false,
    searchDebounce: null,
    isGenerating: false,

    // ── Entry Point ────────────────────────────────────────────────────────────
    async render() {
        const content = document.getElementById('page-content');
        await App.loadProjects();

        content.innerHTML = `
        <div class="drafting-layout" id="drafting-layout">

            <!-- ── Left Sidebar ── -->
            <aside class="drafting-sidebar" id="drafting-sidebar">
                <div class="drafting-sidebar-inner">

                    <!-- Top controls -->
                    <div class="dsb-top">
                        <button class="sidebar-toggle-btn" id="dsb-toggle" onclick="DraftingPage.toggleSidebar()" title="Collapse sidebar">
                            <i class="ti ti-layout-sidebar-left-collapse"></i>
                        </button>
                        <button class="new-draft-btn" id="new-draft-btn" onclick="DraftingPage.startNewDraft()">
                            <i class="ti ti-edit"></i>
                            <span class="dsb-label">New Draft</span>
                        </button>
                    </div>

                    <!-- Search -->
                    <div class="dsb-search-wrap dsb-label-item">
                        <div class="dsb-search">
                            <i class="ti ti-search"></i>
                            <input type="text" id="dsb-search-input" placeholder="Search drafts…"
                                oninput="DraftingPage.onSearch(this.value)">
                        </div>
                    </div>

                    <!-- Session list -->
                    <div class="dsb-session-list" id="dsb-session-list">
                        <div class="dsb-loading"><div class="spinner"></div></div>
                    </div>

                    <!-- User profile -->
                    <div class="dsb-profile dsb-label-item" id="dsb-profile">
                        <div class="dsb-profile-avatar" id="dsb-avatar">?</div>
                        <div class="dsb-profile-info dsb-label">
                            <div class="dsb-profile-name" id="dsb-profile-name">Loading…</div>
                            <div class="dsb-profile-role" id="dsb-profile-role"></div>
                        </div>
                    </div>
                </div>
            </aside>

            <!-- ── Main Panel ── -->
            <main class="drafting-main" id="drafting-main">

                <!-- Empty state (shown when no session is active) -->
                <div class="drafting-empty" id="drafting-empty">
                    <div class="drafting-empty-inner">
                        <div class="drafting-empty-logo">
                            <i class="ti ti-writing"></i>
                        </div>
                        <h2 class="drafting-empty-greeting">What would you like to draft?</h2>
                        <p class="drafting-empty-sub">Select a letter and describe what to write — or click a template below.</p>

                        <!-- Centered input box -->
                        <div class="drafting-empty-composer" id="drafting-empty-composer">
                            <div class="dec-inner">
                                <button class="dec-attach-btn" onclick="DraftingPage.openLetterPicker()" title="Attach letter">
                                    <i class="ti ti-plus"></i>
                                </button>
                                <textarea id="empty-chat-input" class="dec-textarea" placeholder="Ask anything…" rows="1"
                                    oninput="DraftingPage.autoResizeEmpty(this)"
                                    onkeydown="DraftingPage.onEmptyKeyDown(event)"></textarea>
                                <button class="dec-send-btn" id="empty-send-btn" onclick="DraftingPage.sendFromEmpty()" title="Send">
                                    <i class="ti ti-arrow-up"></i>
                                </button>
                            </div>
                            <div class="dec-context-hint" id="dec-context-hint">
                                <span id="dec-letter-hint">No letter selected — click <strong>+</strong> to attach one</span>
                            </div>
                        </div>

                        <!-- Template chips -->
                        <div class="drafting-template-chips" id="drafting-template-chips">
                            <div class="dtc-loading"><div class="spinner"></div></div>
                        </div>
                    </div>
                </div>

                <!-- Active conversation state -->
                <div class="drafting-active" id="drafting-active" style="display:none;">

                    <!-- Context bar -->
                    <div class="drafting-context-bar" id="drafting-context-bar">
                        <div class="dcb-left">
                            <i class="ti ti-file-text"></i>
                            <span class="dcb-letter" id="dcb-letter-name">—</span>
                            <span class="dcb-sep">·</span>
                            <i class="ti ti-folder"></i>
                            <span class="dcb-project" id="dcb-project-name">—</span>
                        </div>
                        <div class="dcb-right">
                            <button class="dcb-sources-btn" id="dcb-sources-btn" onclick="DraftingPage.toggleSourcesPanel()" style="display:none;">
                                <i class="ti ti-books"></i>
                                <span id="dcb-sources-count">Sources</span>
                            </button>
                            <button class="dcb-close-btn" onclick="DraftingPage.closeSession()" title="Close session">
                                <i class="ti ti-x"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Thread -->
                    <div class="drafting-thread" id="drafting-thread"></div>

                    <!-- Sources drawer (inline, below context bar when expanded) -->
                    <div class="drafting-sources-panel" id="drafting-sources-panel" style="display:none;">
                        <div class="dsp-header">
                            <span><i class="ti ti-books"></i> Source Documents</span>
                            <button onclick="DraftingPage.toggleSourcesPanel()"><i class="ti ti-x"></i></button>
                        </div>
                        <div class="dsp-body" id="dsp-body"></div>
                    </div>

                    <!-- Sticky composer -->
                    <div class="drafting-composer" id="drafting-composer">
                        <div class="dc-wrapper">
                            <button class="dc-attach-btn" onclick="DraftingPage.openLetterPicker()" title="Switch letter">
                                <i class="ti ti-plus"></i>
                            </button>
                            <textarea id="chat-input" class="dc-textarea" placeholder="Refine the draft, or ask for another…"
                                rows="1"
                                oninput="DraftingPage.autoResize(this)"
                                onkeydown="DraftingPage.onKeyDown(event)"></textarea>
                            <button class="dc-send-btn" id="chat-send-btn" onclick="DraftingPage.sendMessage()" title="Send">
                                <i class="ti ti-arrow-up"></i>
                            </button>
                        </div>
                        <div class="dc-footer">
                            <!-- <span class="text-xs text-tertiary" id="dc-model-label">Knower API · GPT-5.5</span> -->
                            <span class="text-xs text-tertiary" id="dc-letter-label">No letter selected</span>
                        </div>
                    </div>
                </div>
            </main>
        </div>

        <!-- Letter picker modal (shared) -->
        <div id="letter-picker-modal" style="display:none;" class="lp-modal-overlay" onclick="if(event.target===this)DraftingPage.closeLetterPicker()">
            <div class="lp-modal">
                <div class="lp-modal-header">
                    <span><i class="ti ti-file-search"></i> Select Letter & Project</span>
                    <button onclick="DraftingPage.closeLetterPicker()"><i class="ti ti-x"></i></button>
                </div>
                <div class="lp-modal-body" style="padding-top:10px;">
                    <!-- Tab selector -->
                    <div class="cat-tabs" style="margin-bottom:15px; border-bottom:1px solid var(--border); padding-bottom:8px;">
                        <button class="cat-tab active" id="lp-tab-select-btn" onclick="DraftingPage.setPickerTab('select')">Select Existing</button>
                        <button class="cat-tab" id="lp-tab-upload-btn" onclick="DraftingPage.setPickerTab('upload')">Upload New</button>
                    </div>

                    <!-- Select Tab Content -->
                    <div id="lp-tab-select-content">
                        <div class="lp-field">
                            <label>Project</label>
                            <select id="lp-project-select" class="filter-select" onchange="DraftingPage.onPickerProjectChange(this.value)">
                                <option value="">All Projects</option>
                                ${App.projects.map(p => `<option value="${p.id}">${App.escapeHtml(p.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="lp-field" style="margin-top:10px;">
                            <label>Search letters</label>
                            <input type="text" id="lp-search" class="form-input" placeholder="Filter by filename…"
                                oninput="DraftingPage.filterPickerLetters(this.value)">
                        </div>
                        <div class="lp-letter-list" id="lp-letter-list" style="margin-top:10px;">
                            <div class="dsb-loading"><div class="spinner"></div></div>
                        </div>
                    </div>

                    <!-- Upload Tab Content -->
                    <div id="lp-tab-upload-content" style="display:none;">
                        <div class="lp-field">
                            <label>Project Scope</label>
                            <select id="lp-upload-project-select" class="filter-select" style="width:100%;">
                                <option value="">All Projects / Global</option>
                                ${App.projects.map(p => `<option value="${p.id}">${App.escapeHtml(p.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="upload-zone" id="lp-upload-zone" style="margin-top:15px;">
                            <div class="upload-zone-icon"><i class="ti ti-mail"></i></div>
                            <div class="upload-zone-title">Drop your letter here, or click to browse</div>
                            <div class="upload-zone-hint">PDF, DOCX, JPG, PNG · Max 20 MB</div>
                            <input type="file" id="lp-file-input" accept=".pdf,.docx,.jpg,.jpeg,.png" style="display:none;">
                        </div>
                        <div id="lp-upload-status" style="margin-top:15px;"></div>
                    </div>
                </div>
            </div>
        </div>
        `;

        // Load data in parallel
        await Promise.all([
            this.loadSessions(),
            this.loadTemplates(),
            this.loadLetters(),
            this.loadUserProfile(),
        ]);
    },

    // ── Data Loading ───────────────────────────────────────────────────────────

    async loadSessions() {
        try {
            const data = await API.draftingSessions.list();
            this.sessions = data.sessions || [];
            this.renderSessionList(this.sessions);
        } catch (e) {
            document.getElementById('dsb-session-list').innerHTML =
                `<div class="dsb-empty"><i class="ti ti-alert-circle"></i> Failed to load</div>`;
        }
    },

    async loadTemplates() {
        try {
            const data = await API.draftingSessions.templates();
            this.templates = data.templates || [];
        } catch (e) {
            // Fall back to empty — chips won't show
            this.templates = [];
        }
        this.renderTemplateChips();
    },

    async loadLetters() {
        try {
            const data = await API.letters.list();
            this.letters = (data.letters || data || []).filter(l =>
                ['classified', 'drafted', 'pending_review', 'approved'].includes(l.status)
            );
        } catch (e) {
            this.letters = [];
        }
    },

    async loadUserProfile() {
        try {
            const data = await API.auth.me();
            const user = data.user || data;
            const name = user.name || user.email || 'User';
            const initials = name.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase();
            document.getElementById('dsb-avatar').textContent = initials;
            document.getElementById('dsb-profile-name').textContent = name;
            document.getElementById('dsb-profile-role').textContent = (user.role || '').replace(/^\w/, c => c.toUpperCase());
        } catch (e) {
            // silent
        }
    },

    // ── Sidebar Rendering ──────────────────────────────────────────────────────

    renderSessionList(sessions) {
        const el = document.getElementById('dsb-session-list');
        if (!sessions.length) {
            el.innerHTML = `<div class="dsb-empty"><i class="ti ti-messages-off"></i><span>No drafts yet</span></div>`;
            return;
        }

        const pinned = sessions.filter(s => s.is_pinned);
        const recents = sessions.filter(s => !s.is_pinned);

        // Group recents
        const groups = {};
        for (const s of recents) {
            const g = s.group || 'Older';
            if (!groups[g]) groups[g] = [];
            groups[g].push(s);
        }

        const groupOrder = ['Today', 'Previous 7 days', 'Older'];

        let html = '';

        if (pinned.length) {
            html += `<div class="dsb-group-label dsb-label">Pinned</div>`;
            html += pinned.map(s => this.renderSessionItem(s)).join('');
        }

        for (const gName of groupOrder) {
            const items = groups[gName];
            if (!items || !items.length) continue;
            html += `<div class="dsb-group-label dsb-label">${gName}</div>`;
            html += items.map(s => this.renderSessionItem(s)).join('');
        }

        el.innerHTML = html;
    },

    renderSessionItem(s) {
        const isActive = s.id === this.currentSessionId;
        const escapedTitle = App.escapeHtml(s.title || 'Draft');
        const escapedPreview = App.escapeHtml(s.preview || '');
        return `
            <div class="dsb-session-item ${isActive ? 'active' : ''} ${s.is_pinned ? 'pinned' : ''}"
                 data-session-id="${s.id}"
                 onclick="DraftingPage.openSession('${s.id}')">
                <div class="dsi-content">
                    <div class="dsi-title dsb-label" title="${escapedTitle}">${escapedTitle}</div>
                    <div class="dsi-preview">${escapedPreview}</div>
                </div>
                <div class="dsi-actions">
                    <button class="dsi-action-btn" onclick="event.stopPropagation(); DraftingPage.togglePin('${s.id}')"
                        title="${s.is_pinned ? 'Unpin' : 'Pin'}">
                        <i class="ti ${s.is_pinned ? 'ti-pin-filled' : 'ti-pin'}"></i>
                    </button>
                    <button class="dsi-action-btn dsi-delete-btn" onclick="event.stopPropagation(); DraftingPage.deleteSession('${s.id}')"
                        title="Delete">
                        <i class="ti ti-trash"></i>
                    </button>
                </div>
            </div>
        `;
    },

    // ── Template Chips ─────────────────────────────────────────────────────────

    renderTemplateChips() {
        const el = document.getElementById('drafting-template-chips');
        if (!el) return;
        if (!this.templates.length) {
            el.innerHTML = '';
            return;
        }
        el.innerHTML = this.templates.map(t => `
            <button class="drafting-chip" onclick="DraftingPage.useTemplate(${JSON.stringify(t.prompt_text).replace(/'/g, '&#39;')})">
                <i class="ti ${App.escapeHtml(t.icon || 'ti-sparkles')}"></i>
                ${App.escapeHtml(t.label)}
            </button>
        `).join('');
    },

    useTemplate(text) {
        // Fill the currently visible input (empty state or active composer)
        const emptyInput = document.getElementById('empty-chat-input');
        const activeInput = document.getElementById('chat-input');
        const target = document.getElementById('drafting-active').style.display !== 'none'
            ? activeInput : emptyInput;
        if (target) {
            target.value = text;
            this.autoResizeAny(target);
            target.focus();
        }
    },

    // ── Sidebar Toggle ─────────────────────────────────────────────────────────

    toggleSidebar() {
        this.sidebarCollapsed = !this.sidebarCollapsed;
        const sidebar = document.getElementById('drafting-sidebar');
        const layout = document.getElementById('drafting-layout');
        const toggleBtn = document.getElementById('dsb-toggle');

        if (this.sidebarCollapsed) {
            sidebar.classList.add('collapsed');
            layout.classList.add('sidebar-collapsed');
            toggleBtn.innerHTML = '<i class="ti ti-layout-sidebar-left-expand"></i>';
            toggleBtn.title = 'Expand sidebar';
        } else {
            sidebar.classList.remove('collapsed');
            layout.classList.remove('sidebar-collapsed');
            toggleBtn.innerHTML = '<i class="ti ti-layout-sidebar-left-collapse"></i>';
            toggleBtn.title = 'Collapse sidebar';
        }
    },

    // ── Search ─────────────────────────────────────────────────────────────────

    onSearch(value) {
        clearTimeout(this.searchDebounce);
        if (!value.trim()) {
            this.renderSessionList(this.sessions);
            return;
        }
        this.searchDebounce = setTimeout(async () => {
            try {
                const data = await API.draftingSessions.search(value.trim());
                this.renderSessionList(data.sessions || []);
            } catch (e) {
                // silent
            }
        }, 300);
    },

    // ── Session Lifecycle ──────────────────────────────────────────────────────

    async startNewDraft() {
        // Reset state
        this.currentSessionId = null;
        this.currentLetterId = null;
        this.currentProjectId = null;
        this.currentLetterData = null;
        this.currentProjectData = null;

        this.showEmptyState();
        document.getElementById('empty-chat-input').value = '';
        this.updateDecContextHint();

        // Update sidebar active state
        document.querySelectorAll('.dsb-session-item').forEach(el => el.classList.remove('active'));
    },

    async openSession(sessionId) {
        try {
            const data = await API.draftingSessions.get(sessionId);
            const session = data.session;

            this.currentSessionId = sessionId;
            this.currentLetterId = session.letter_id;
            this.currentProjectId = session.project_id;

            // Load letter and project metadata for context bar
            await this.loadContextMetadata(session.letter_id, session.project_id);
            this.showActiveState();
            this.renderThread(session.messages || []);
            this.updateContextBar();
            this.updateSidebarActive(sessionId);
        } catch (e) {
            App.showToast(`Failed to open session: ${e.message}`, 'error');
        }
    },

    async loadContextMetadata(letterId, projectId) {
        try {
            if (letterId) {
                const ld = await API.letters.get(letterId);
                this.currentLetterData = ld.letter || ld;
            } else {
                this.currentLetterData = null;
            }
        } catch (e) { this.currentLetterData = null; }

        try {
            if (projectId) {
                const pd = await API.projects.get(projectId);
                this.currentProjectData = pd.project || pd;
            } else {
                this.currentProjectData = null;
            }
        } catch (e) { this.currentProjectData = null; }
    },

    closeSession() {
        this.currentSessionId = null;
        this.currentLetterId = null;
        this.currentLetterData = null;
        this.currentProjectData = null;
        this.showEmptyState();
        this.updateDecContextHint();
        document.querySelectorAll('.dsb-session-item').forEach(el => el.classList.remove('active'));
    },

    updateSidebarActive(sessionId) {
        document.querySelectorAll('.dsb-session-item').forEach(el => {
            el.classList.toggle('active', el.dataset.sessionId === sessionId);
        });
    },

    // ── Letter Picker ──────────────────────────────────────────────────────────

    openLetterPicker() {
        const modal = document.getElementById('letter-picker-modal');
        modal.style.display = 'flex';
        this.setPickerTab('select');
        this.filterPickerLetters('');
        const status = document.getElementById('lp-upload-status');
        if (status) status.innerHTML = '';
    },

    closeLetterPicker() {
        document.getElementById('letter-picker-modal').style.display = 'none';
    },

    setPickerTab(tab) {
        const selectBtn = document.getElementById('lp-tab-select-btn');
        const uploadBtn = document.getElementById('lp-tab-upload-btn');
        const selectContent = document.getElementById('lp-tab-select-content');
        const uploadContent = document.getElementById('lp-tab-upload-content');
        
        if (!selectBtn || !uploadBtn || !selectContent || !uploadContent) return;

        if (tab === 'select') {
            selectBtn.classList.add('active');
            uploadBtn.classList.remove('active');
            selectContent.style.display = 'block';
            uploadContent.style.display = 'none';
        } else {
            selectBtn.classList.remove('active');
            uploadBtn.classList.add('active');
            selectContent.style.display = 'none';
            uploadContent.style.display = 'block';
            
            // Lazy initialize upload listeners when the tab is first opened
            this.initPickerUploadListeners();
        }
    },

    initPickerUploadListeners() {
        if (this._pickerUploadListenersInitialized) return;
        this._pickerUploadListenersInitialized = true;
        
        const zone = document.getElementById('lp-upload-zone');
        const input = document.getElementById('lp-file-input');
        if (!zone || !input) return;
        
        zone.addEventListener('click', () => input.click());
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('dragover');
        });
        zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
            if (e.dataTransfer.files[0]) this.uploadPickerLetter(e.dataTransfer.files[0]);
        });
        input.addEventListener('change', () => {
            if (input.files[0]) this.uploadPickerLetter(input.files[0]);
        });
    },

    async uploadPickerLetter(file) {
        const status = document.getElementById('lp-upload-status');
        if (!status) return;

        status.innerHTML = `<div class="loading-overlay"><div class="spinner"></div><span>Uploading and classifying "${App.escapeHtml(file.name)}"…</span></div>`;
        try {
            const projectId = document.getElementById('lp-upload-project-select')?.value || null;
            const result = await API.letters.upload(file, projectId);
            
            status.innerHTML = `
                <div class="upload-success">
                    <i class="ti ti-check-circle" style="color:var(--status-green-text);"></i>
                    <span>Uploaded successfully! Classified as <strong>${App.escapeHtml(result.letter?.category || 'general')}</strong></span>
                </div>
            `;
            
            App.showToast('Letter uploaded successfully!', 'success');
            
            // Reload letters in background
            await this.loadLetters();
            
            // Auto-select the newly uploaded letter
            if (result.letter?.id) {
                setTimeout(async () => {
                    this.selectLetter(result.letter.id);
                    this.closeLetterPicker();
                    this.setPickerTab('select');
                    status.innerHTML = '';
                }, 1000);
            }
        } catch (error) {
            status.innerHTML = `
                <div class="upload-error">
                    <i class="ti ti-alert-circle" style="color:var(--status-red-text);"></i>
                    <span>${App.escapeHtml(error.message)}</span>
                </div>
            `;
            App.showToast(`Upload failed: ${error.message}`, 'error');
        }
    },

    onPickerProjectChange(projectId) {
        this.filterPickerLetters(document.getElementById('lp-search')?.value || '');
    },

    filterPickerLetters(query) {
        const projectId = document.getElementById('lp-project-select')?.value || '';
        const filtered = this.letters.filter(l => {
            const matchesQuery = !query || (l.filename || '').toLowerCase().includes(query.toLowerCase());
            const matchesProject = !projectId || l.project_id === projectId;
            return matchesQuery && matchesProject;
        });

        const el = document.getElementById('lp-letter-list');
        if (!filtered.length) {
            el.innerHTML = `<div class="dsb-empty"><i class="ti ti-mail-off"></i> No letters found</div>`;
            return;
        }

        el.innerHTML = filtered.map(l => {
            const isSelected = l.id === this.currentLetterId;
            return `
                <div class="lp-letter-item ${isSelected ? 'selected' : ''}" onclick="DraftingPage.selectLetter('${l.id}')">
                    <div class="lp-letter-icon"><i class="ti ti-file-text"></i></div>
                    <div class="lp-letter-info">
                        <div class="lp-letter-name">${App.escapeHtml(l.filename || 'Letter')}</div>
                        <div class="lp-letter-meta">
                            <span class="status-pill ${l.status}" style="font-size:9px;">${l.status.replace('_', ' ')}</span>
                            ${l.category ? `<span class="text-xs text-tertiary">${l.category.replace(/_/g, ' ')}</span>` : ''}
                        </div>
                    </div>
                    ${isSelected ? '<i class="ti ti-check lp-check"></i>' : ''}
                </div>
            `;
        }).join('');
    },

    async selectLetter(letterId) {
        this.currentLetterId = letterId;
        // Detect project from letter
        const letter = this.letters.find(l => l.id === letterId);
        if (letter?.project_id) {
            this.currentProjectId = letter.project_id;
        }
        try {
            const ld = await API.letters.get(letterId);
            this.currentLetterData = ld.letter || ld;
        } catch (e) {
            this.currentLetterData = letter || null;
        }
        this.closeLetterPicker();
        this.updateDecContextHint();

        if (this.currentSessionId) {
            this.updateContextBar();
        }
    },

    updateDecContextHint() {
        const el = document.getElementById('dec-letter-hint');
        if (!el) return;
        if (this.currentLetterData) {
            el.innerHTML = `<i class="ti ti-file-text" style="color:var(--accent);"></i> <strong>${App.escapeHtml(this.currentLetterData.filename || 'Letter')}</strong> selected`;
        } else {
            el.innerHTML = `No letter selected — click <strong>+</strong> to attach one`;
        }
    },

    // ── State Display ──────────────────────────────────────────────────────────

    showEmptyState() {
        document.getElementById('drafting-empty').style.display = 'flex';
        document.getElementById('drafting-active').style.display = 'none';
    },

    showActiveState() {
        document.getElementById('drafting-empty').style.display = 'none';
        document.getElementById('drafting-active').style.display = 'flex';
    },

    updateContextBar() {
        const letterEl = document.getElementById('dcb-letter-name');
        const projectEl = document.getElementById('dcb-project-name');
        const dcLetterLabel = document.getElementById('dc-letter-label');

        if (this.currentLetterData) {
            letterEl.textContent = this.currentLetterData.filename || 'Letter';
            if (dcLetterLabel) dcLetterLabel.textContent = `Letter: ${this.currentLetterData.filename || 'selected'}`;
        } else {
            letterEl.textContent = '—';
            if (dcLetterLabel) dcLetterLabel.textContent = 'No letter selected';
        }
        if (this.currentProjectData) {
            projectEl.textContent = this.currentProjectData.name || '—';
        } else {
            projectEl.textContent = '—';
        }
    },

    // ── Thread Rendering (restore from DB) ────────────────────────────────────

    renderThread(messages) {
        const thread = document.getElementById('drafting-thread');
        thread.innerHTML = '';

        if (!messages.length) {
            thread.innerHTML = `
                <div class="drafting-thread-empty">
                    <i class="ti ti-sparkles"></i>
                    <p>Send a message to start drafting</p>
                </div>`;
            return;
        }

        let latestSourceDocs = null;

        for (const msg of messages) {
            const el = this.buildMessageElement(msg.role, msg.content, {
                draftId: msg.draft_response_id,
                version: msg.draft_version,
                status: msg.draft_status,
                contextDocs: msg.context_documents || [],
                messageId: msg.id,
            });
            thread.appendChild(el);
            if (msg.role === 'assistant' && msg.context_documents?.length) {
                latestSourceDocs = msg.context_documents;
            }
        }

        // Update sources button if we have docs
        if (latestSourceDocs) {
            this._lastSourceDocs = latestSourceDocs;
            const btn = document.getElementById('dcb-sources-btn');
            const countEl = document.getElementById('dcb-sources-count');
            if (btn) {
                btn.style.display = 'flex';
                if (countEl) countEl.textContent = `${latestSourceDocs.length} source${latestSourceDocs.length !== 1 ? 's' : ''}`;
            }
        }

        thread.scrollTop = thread.scrollHeight;
    },

    buildMessageElement(role, content, extra = {}) {
        const div = document.createElement('div');
        div.className = `drafting-message ${role}`;
        if (extra.messageId) div.dataset.messageId = extra.messageId;

        let actionsHtml = '';
        if (role === 'assistant') {
            actionsHtml = `
                <div class="dm-actions">
                    <button class="dm-action" onclick="DraftingPage.regenerateFromMessage(this)" title="Regenerate">
                        <i class="ti ti-refresh"></i> Regenerate
                    </button>
                    <button class="dm-action" onclick="DraftingPage.editMessage(this)" title="Edit">
                        <i class="ti ti-edit"></i> Edit
                    </button>
                    <button class="dm-action" onclick="DraftingPage.copyMessage(this)" title="Copy">
                        <i class="ti ti-copy"></i> Copy
                    </button>
                    ${extra.status !== 'approved' ? `
                    <button class="dm-action dm-approve-btn" data-draft-id="${extra.draftId || ''}"
                        onclick="DraftingPage.approveDraft(this)" title="Approve">
                        <i class="ti ti-check"></i> Approve
                    </button>` : `
                    <span class="dm-approved-badge"><i class="ti ti-check"></i> Approved</span>`}
                    <button class="dm-action" onclick="DraftingPage.markForReview(this)" title="Mark for review">
                        <i class="ti ti-send"></i> Review
                    </button>
                    ${extra.contextDocs?.length ? `
                    <button class="dm-action" onclick="DraftingPage.showMessageSources(${JSON.stringify(extra.contextDocs).replace(/"/g, '&quot;')})" title="Sources">
                        <i class="ti ti-books"></i> ${extra.contextDocs.length} source${extra.contextDocs.length !== 1 ? 's' : ''}
                    </button>` : ''}
                </div>
            `;
        }

        div.innerHTML = `
            <div class="dm-avatar">
                ${role === 'user' ? '<i class="ti ti-user"></i>' : '<i class="ti ti-robot"></i>'}
            </div>
            <div class="dm-body">
                ${extra.version ? `<div class="dm-version-badge">v${extra.version} · ${(extra.status || 'draft').replace('_', ' ')}</div>` : ''}
                <div class="dm-content ${role === 'assistant' ? 'dm-draft-text' : ''}">
                    ${role === 'user'
                        ? `<p>${App.escapeHtml(content)}</p>`
                        : this.renderDraftText(content)}
                </div>
                ${actionsHtml}
            </div>
        `;
        return div;
    },

    renderDraftText(text) {
        if (!text) return '<em style="color:var(--text-tertiary);">No content</em>';
        return text.split('\n').map(p =>
            p.trim() ? `<p>${App.escapeHtml(p)}</p>` : '<br>'
        ).join('');
    },

    // ── Sending Messages ───────────────────────────────────────────────────────

    // Send from the empty state (may trigger session creation)
    async sendFromEmpty() {
        const input = document.getElementById('empty-chat-input');
        const text = input.value.trim();
        if (!text) return;

        if (!this.currentLetterId) {
            App.showToast('Please select a letter first — click the + button', 'warning');
            return;
        }

        // Create session if none
        if (!this.currentSessionId) {
            await this.ensureSession(text);
            if (!this.currentSessionId) return; // creation failed
        }

        this.showActiveState();
        this.updateContextBar();
        input.value = '';

        await this._sendAndGenerate(text);
    },

    // Send from active composer
    async sendMessage() {
        if (this.isGenerating) return;
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        if (!text) return;

        if (!this.currentLetterId) {
            App.showToast('Please attach a letter first — click the + button', 'warning');
            return;
        }

        // Ensure session exists (edge case)
        if (!this.currentSessionId) {
            await this.ensureSession(text);
            if (!this.currentSessionId) return;
        }

        input.value = '';
        this.autoResize(input);
        await this._sendAndGenerate(text);
    },

    async ensureSession(firstPrompt) {
        try {
            // Auto-generate title from letter filename
            const letterName = this.currentLetterData?.filename || 'Draft';
            const category = this.currentLetterData?.category?.replace(/_/g, ' ') || '';
            const titleStr = category ? `${letterName} — ${category}` : letterName;

            const data = await API.draftingSessions.create(
                this.currentLetterId,
                this.currentProjectId || '',
                titleStr.substring(0, 480),
            );
            const session = data.session;
            this.currentSessionId = session.id;

            // Load project metadata if not already loaded
            if (!this.currentProjectData && this.currentProjectId) {
                try {
                    const pd = await API.projects.get(this.currentProjectId);
                    this.currentProjectData = pd.project || pd;
                } catch (e) {}
            }

            // Refresh sidebar
            await this.loadSessions();
            this.updateSidebarActive(session.id);
        } catch (e) {
            App.showToast(`Failed to create session: ${e.message}`, 'error');
        }
    },

    async _sendAndGenerate(text) {
        this.isGenerating = true;

        // 1. Persist user message
        try {
            await API.draftingSessions.addMessage(this.currentSessionId, 'user', text);
        } catch (e) {
            App.showToast('Failed to persist message', 'warning');
        }

        // 2. Add user bubble to thread
        const thread = document.getElementById('drafting-thread');
        thread.querySelector('.drafting-thread-empty')?.remove();

        const userEl = this.buildMessageElement('user', text);
        thread.appendChild(userEl);

        // 3. Show thinking indicator
        const thinkingId = 'thinking-' + Date.now();
        const thinkingEl = document.createElement('div');
        thinkingEl.className = 'drafting-message assistant thinking';
        thinkingEl.id = thinkingId;
        thinkingEl.innerHTML = `
            <div class="dm-avatar"><i class="ti ti-robot"></i></div>
            <div class="dm-body">
                <div class="typing-indicator"><span></span><span></span><span></span></div>
                <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px;">Generating draft…</div>
            </div>
        `;
        thread.appendChild(thinkingEl);
        thread.scrollTop = thread.scrollHeight;

        // 4. Generate draft via existing /api/drafts endpoint (passing currentSessionId)
        try {
            const result = await API.drafts.generate(this.currentLetterId, text, this.currentSessionId);
            const draft = await this.pollDraftResult(result.job_id);

            document.getElementById(thinkingId)?.remove();

            if (draft) {
                // 5. Get the updated session which has the new assistant message added by the worker
                const sessionRes = await API.draftingSessions.get(this.currentSessionId);
                const session = sessionRes.session;
                this.renderThread(session.messages || []);

                App.showToast('Draft generated!', 'success');
                await this.loadSessions(); // refresh sidebar preview
            }
        } catch (e) {
            document.getElementById(thinkingId)?.remove();
            const errEl = this.buildMessageElement('assistant', `Error: ${e.message}`);
            thread.appendChild(errEl);
            App.showToast(`Generation failed: ${e.message}`, 'error');
        } finally {
            this.isGenerating = false;
        }
    },

    async pollDraftResult(jobId) {
        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 1000));
            try {
                const jobData = await API.jobs.get(jobId);
                const job = jobData.job || jobData;
                if (job.status === 'completed') {
                    const draftsRes = await API.drafts.forLetter(this.currentLetterId);
                    const drafts = (draftsRes.drafts || []).sort((a, b) => (b.version || 0) - (a.version || 0));
                    return drafts[0] || null;
                }
                if (job.status === 'failed') throw new Error(job.error_message || 'Job failed');
            } catch (e) {
                if (e.message !== 'Job failed') throw e;
            }
        }
        throw new Error('Timed out waiting for draft');
    },

    // ── Message Actions ────────────────────────────────────────────────────────

    async regenerateFromMessage(btn) {
        if (this.isGenerating) return;
        const msgEl = btn.closest('.drafting-message');
        // Find preceding user message
        let userText = 'Regenerate with improvements.';
        let prev = msgEl?.previousElementSibling;
        while (prev) {
            if (prev.classList.contains('user')) {
                userText = prev.querySelector('.dm-content')?.textContent?.trim() || userText;
                break;
            }
            prev = prev.previousElementSibling;
        }
        await this._sendAndGenerate(userText);
    },

    copyMessage(btn) {
        const msgEl = btn.closest('.drafting-message');
        const text = msgEl?.querySelector('.dm-content')?.textContent || '';
        navigator.clipboard.writeText(text).then(() => {
            App.showToast('Copied to clipboard', 'success');
        }).catch(() => {
            App.showToast('Copy failed', 'error');
        });
    },

    editMessage(btn) {
        const msgEl = btn.closest('.drafting-message');
        const contentEl = msgEl?.querySelector('.dm-content');
        if (!contentEl) return;

        const currentText = contentEl.textContent.trim();
        const textarea = document.createElement('textarea');
        textarea.className = 'dm-edit-textarea';
        textarea.value = currentText;

        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn btn-primary btn-sm dm-edit-save';
        saveBtn.innerHTML = '<i class="ti ti-check"></i> Save';
        saveBtn.onclick = async () => {
            const draftId = msgEl.querySelector('.dm-approve-btn')?.dataset?.draftId;
            if (draftId) {
                try {
                    await API.drafts.update(draftId, textarea.value);
                    contentEl.innerHTML = this.renderDraftText(textarea.value);
                    App.showToast('Draft updated', 'success');
                } catch (e) {
                    App.showToast(`Save failed: ${e.message}`, 'error');
                }
            }
            textarea.replaceWith(contentEl);
            saveBtn.remove();
            cancelBtn.remove();
            btn.style.display = '';
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-ghost btn-sm dm-edit-cancel';
        cancelBtn.innerHTML = '<i class="ti ti-x"></i> Cancel';
        cancelBtn.onclick = () => {
            textarea.replaceWith(contentEl);
            saveBtn.remove();
            cancelBtn.remove();
            btn.style.display = '';
        };

        contentEl.replaceWith(textarea);
        const actionsEl = msgEl.querySelector('.dm-actions');
        if (actionsEl) {
            actionsEl.prepend(cancelBtn);
            actionsEl.prepend(saveBtn);
        }
        btn.style.display = 'none';
    },

    async approveDraft(btn) {
        const draftId = btn?.dataset?.draftId;
        if (!draftId) {
            App.showToast('No draft ID found', 'warning');
            return;
        }
        try {
            await API.review.approve(draftId);
            App.showToast('Draft approved!', 'success');
            btn.replaceWith(Object.assign(document.createElement('span'), {
                className: 'dm-approved-badge',
                innerHTML: '<i class="ti ti-check"></i> Approved',
            }));
        } catch (e) {
            App.showToast(`Approval failed: ${e.message}`, 'error');
        }
    },

    async markForReview(btn) {
        App.showToast('Marked for review', 'success');
    },

    showMessageSources(contextDocs) {
        this._lastSourceDocs = contextDocs;
        this.showSourcesPanel(contextDocs);
    },

    // ── Sources Panel ──────────────────────────────────────────────────────────

    toggleSourcesPanel() {
        const panel = document.getElementById('drafting-sources-panel');
        if (panel.style.display === 'none') {
            this.showSourcesPanel(this._lastSourceDocs || []);
        } else {
            panel.style.display = 'none';
        }
    },

    showSourcesPanel(docs) {
        const panel = document.getElementById('drafting-sources-panel');
        const body = document.getElementById('dsp-body');
        panel.style.display = 'flex';

        if (!docs?.length) {
            body.innerHTML = `<div class="dsb-empty"><i class="ti ti-books-off"></i> No source documents</div>`;
            return;
        }

        body.innerHTML = docs.map(d => `
            <div class="dsp-source-item">
                <i class="ti ti-file-text"></i>
                <div>
                    <div class="dsp-source-name">${App.escapeHtml(d.source || 'Document')}</div>
                    <div class="dsp-source-meta">
                        ${d.similarity != null ? `Relevance: ${(d.similarity * 100).toFixed(1)}%` : ''}
                    </div>
                    ${d.chunk_text ? `<div class="dsp-source-preview">${App.escapeHtml(d.chunk_text.substring(0, 150))}…</div>` : ''}
                </div>
            </div>
        `).join('');
    },

    // ── Pin / Delete ───────────────────────────────────────────────────────────

    async togglePin(sessionId) {
        try {
            await API.draftingSessions.togglePin(sessionId);
            await this.loadSessions();
        } catch (e) {
            App.showToast(`Failed to pin: ${e.message}`, 'error');
        }
    },

    async deleteSession(sessionId) {
        if (!confirm('Delete this drafting conversation? This cannot be undone.')) return;
        try {
            await API.draftingSessions.delete(sessionId);
            if (this.currentSessionId === sessionId) {
                this.closeSession();
            }
            await this.loadSessions();
            App.showToast('Draft deleted', 'success');
        } catch (e) {
            App.showToast(`Delete failed: ${e.message}`, 'error');
        }
    },

    // ── Auto-resize helpers ────────────────────────────────────────────────────

    autoResize(el) {
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    },

    autoResizeEmpty(el) {
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    },

    autoResizeAny(el) {
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    },

    onKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
        }
    },

    onEmptyKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendFromEmpty();
        }
    },
};
