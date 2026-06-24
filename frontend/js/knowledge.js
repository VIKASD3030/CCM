const KnowledgePage = {
    searchTimeout: null,
    allDocs: [],

    async render() {
        const content = document.getElementById('page-content');
        document.getElementById('topbar-actions').innerHTML = `
            <button class="btn btn-primary btn-sm" onclick="document.getElementById('kb-file-input').click()">
                <i class="ti ti-upload"></i> Upload
            </button>
        `;

        content.innerHTML = `
            <div class="stat-row" id="kb-stats">
                <div class="stat-card">
                    <div class="stat-icon" style="background:var(--color-blue-bg);color:var(--color-blue);">
                        <i class="ti ti-files"></i>
                    </div>
                    <div class="stat-body">
                        <div class="stat-label">Documents</div>
                        <div class="stat-value" id="kb-stat-docs">—</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background:var(--color-purple-bg);color:var(--color-purple);">
                        <i class="ti ti-cut"></i>
                    </div>
                    <div class="stat-body">
                        <div class="stat-label">Text Chunks</div>
                        <div class="stat-value" id="kb-stat-chunks">—</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background:var(--color-green-bg);color:var(--color-green);">
                        <i class="ti ti-database"></i>
                    </div>
                    <div class="stat-body">
                        <div class="stat-label">Indexed</div>
                        <div class="stat-value" id="kb-stat-indexed">—</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background:var(--color-amber-bg);color:var(--color-amber);">
                        <i class="ti ti-eye"></i>
                    </div>
                    <div class="stat-body">
                        <div class="stat-label">Pending Review</div>
                        <div class="stat-value" id="kb-stat-pending">—</div>
                    </div>
                </div>
            </div>

            <div class="banner banner-info" id="kb-banner" style="display:none;">
                <i class="ti ti-info-circle"></i>
                <span>Knowledge base is healthy and all chunks are indexed.</span>
            </div>

            <div class="filter-bar" id="kb-category-tabs">
                <button class="filter-btn active" data-cat="" onclick="KnowledgePage.setCategory(this, '')">All</button>
                <button class="filter-btn" data-cat="policy" onclick="KnowledgePage.setCategory(this, 'policy')">Policy</button>
                <button class="filter-btn" data-cat="contract" onclick="KnowledgePage.setCategory(this, 'contract')">Contract</button>
                <button class="filter-btn" data-cat="guideline" onclick="KnowledgePage.setCategory(this, 'guideline')">Guideline</button>
                <button class="filter-btn" data-cat="template" onclick="KnowledgePage.setCategory(this, 'template')">Template</button>
            </div>

            <div class="card" style="margin-bottom:var(--gutter);">
                <div class="upload-zone" id="kb-upload-zone">
                    <input type="file" id="kb-file-input" accept=".pdf,.docx,.txt" style="display:none;">
                    <div class="upload-zone-icon"><i class="ti ti-cloud-upload"></i></div>
                    <div class="upload-zone-title">Drag & drop a document here</div>
                    <div class="upload-zone-hint">Supports PDF, DOCX, TXT · Automatically chunked and indexed</div>
                    <button class="btn btn-secondary btn-sm" onclick="document.getElementById('kb-file-input').click(); event.stopPropagation();">
                        Browse files
                    </button>
                </div>
                <div id="kb-upload-status"></div>
            </div>

            <div class="filter-bar" style="justify-content:space-between;background:none;border:none;padding:0;margin-bottom:var(--gutter);">
                <div class="search-bar" style="max-width:360px;">
                    <i class="ti ti-search"></i>
                    <input type="text" id="kb-search" placeholder="Search documents…" oninput="KnowledgePage.handleSearch(this.value)">
                </div>
                <button class="btn btn-ghost btn-sm" onclick="KnowledgePage.loadDocuments()">
                    <i class="ti ti-refresh"></i> Refresh
                </button>
            </div>

            <div id="kb-grid">
                <div class="loading-overlay"><div class="spinner"></div><span>Loading documents…</span></div>
            </div>

            <div id="kb-search-results" style="display:none;"></div>
        `;

        this.setupUploadZone();
        this.loadDocuments();
        this.loadStats();
    },

    setCategory(el, cat) {
        document.querySelectorAll('#kb-category-tabs .filter-btn').forEach(b => b.classList.remove('active'));
        el.classList.add('active');
        this.renderGrid(this.allDocs, cat);
    },

    setupUploadZone() {
        const zone  = document.getElementById('kb-upload-zone');
        const input = document.getElementById('kb-file-input');
        zone.addEventListener('click',     () => input.click());
        zone.addEventListener('dragover',  (e) => { e.preventDefault(); zone.classList.add('dragover'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
            if (e.dataTransfer.files[0]) this.uploadDoc(e.dataTransfer.files[0]);
        });
        input.addEventListener('change', () => {
            if (input.files[0]) this.uploadDoc(input.files[0]);
        });
    },

    async loadStats() {
        try {
            const stats = await API.knowledge.stats();
            const docs = stats.total_documents || 0;
            document.getElementById('kb-stat-docs').textContent    = docs;
            document.getElementById('kb-stat-chunks').textContent  = stats.total_chunks || 0;
            document.getElementById('kb-stat-indexed').textContent = docs > 0 ? `${docs}` : '0';
            document.getElementById('kb-stat-pending').textContent = stats.pending_review || 0;

            const banner = document.getElementById('kb-banner');
            if (stats.total_documents > 0) {
                banner.style.display = 'flex';
            }
        } catch (e) {
            console.error('KB stats error:', e);
        }
    },

    async loadDocuments() {
        const grid = document.getElementById('kb-grid');
        document.getElementById('kb-search-results').style.display = 'none';
        grid.style.display = '';
        grid.innerHTML = `<div class="loading-overlay"><div class="spinner"></div><span>Loading…</span></div>`;

        try {
            const data = await API.knowledge.list();
            this.allDocs = data.documents || [];
            this.renderGrid(this.allDocs);
        } catch (error) {
            grid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i class="ti ti-alert-circle"></i></div>
                    <div class="empty-state-title">Failed to load</div>
                    <div class="empty-state-body">${this.escapeHtml(error.message)}</div>
                    <button class="btn btn-ghost btn-sm" onclick="KnowledgePage.loadDocuments()"><i class="ti ti-refresh"></i> Retry</button>
                </div>
            `;
        }
    },

    renderGrid(docs, cat) {
        const grid = document.getElementById('kb-grid');
        let filtered = docs;
        if (cat) filtered = docs.filter(d => (d.doc_type || '').toLowerCase() === cat);

        if (!filtered.length) {
            grid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i class="ti ti-book-off"></i></div>
                    <div class="empty-state-title">No documents ${cat ? 'in this category' : 'yet'}</div>
                    <div class="empty-state-body">Upload policy documents, contract templates, or guidelines.</div>
                    <button class="btn btn-primary btn-sm" onclick="document.getElementById('kb-file-input').click()">
                        <i class="ti ti-upload"></i> Upload
                    </button>
                </div>
            `;
            return;
        }

        const typeInfo = {
            '.pdf':  { icon: 'ti-file-type-pdf', color: 'var(--color-red)',   bg: 'var(--color-red-bg)', label: 'PDF' },
            '.docx': { icon: 'ti-file-type-doc', color: 'var(--color-blue)',  bg: 'var(--color-blue-bg)', label: 'DOCX' },
            '.txt':  { icon: 'ti-file-text',     color: 'var(--color-grey)',  bg: 'var(--color-grey-bg)', label: 'TXT' },
        };

        grid.innerHTML = `<div class="kb-grid">${filtered.map(doc => {
            const ext  = '.' + (doc.filename || '').split('.').pop().toLowerCase();
            const info = typeInfo[ext] || { icon: 'ti-file', color: 'var(--text-secondary)', bg: 'var(--bg-elevated)', label: 'FILE' };
            const date = doc.uploaded_at
                ? new Date(doc.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : '—';
            const category = doc.doc_type || 'General';

            return `
                <div class="kb-card">
                    <button class="kb-delete-btn" onclick="KnowledgePage.deleteDoc('${doc.id}','${this.escapeHtml(doc.filename)}')" title="Delete">
                        <i class="ti ti-trash"></i>
                    </button>
                    <div class="kb-card-header">
                        <div class="kb-card-icon" style="background:${info.bg};color:${info.color};">
                            <i class="ti ${info.icon}"></i>
                        </div>
                        <div style="flex:1;min-width:0;padding-right:24px;">
                            <div class="kb-card-title">${this.escapeHtml(doc.filename)}</div>
                        </div>
                    </div>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        <span class="status-pill received">${info.label}</span>
                        <span class="status-pill received">${category}</span>
                    </div>
                    <div class="kb-card-meta">
                        <span>${doc.chunk_count || 0} chunks</span>
                        <span>${date}</span>
                    </div>
                </div>
            `;
        }).join('')}</div>`;
    },

    handleSearch(query) {
        clearTimeout(this.searchTimeout);
        if (!query.trim()) {
            document.getElementById('kb-search-results').style.display = 'none';
            document.getElementById('kb-grid').style.display = '';
            return;
        }
        this.searchTimeout = setTimeout(() => this.runSearch(query.trim()), 400);
    },

    async runSearch(query) {
        const grid    = document.getElementById('kb-grid');
        const results = document.getElementById('kb-search-results');
        grid.style.display = 'none';
        results.style.display = '';
        results.innerHTML = `<div class="loading-overlay"><div class="spinner"></div><span>Searching…</span></div>`;

        try {
            const data   = await API.knowledge.search(query);
            const chunks = data.chunks || [];

            if (!chunks.length) {
                results.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon"><i class="ti ti-search-off"></i></div>
                        <div class="empty-state-title">No results for "${this.escapeHtml(query)}"</div>
                        <div class="empty-state-body">Try different search terms.</div>
                    </div>
                `;
                return;
            }

            results.innerHTML = `
                <div class="label-text" style="margin-bottom:10px;">${chunks.length} result${chunks.length === 1 ? '' : 's'}</div>
                <div style="display:flex;flex-direction:column;gap:10px;">
                    ${chunks.map(c => `
                        <div class="card" style="display:flex;gap:12px;padding:14px;">
                            <i class="ti ti-file-text" style="color:var(--color-purple);font-size:18px;margin-top:2px;flex-shrink:0;"></i>
                            <div style="min-width:0;">
                                <div style="font-weight:500;font-size:13px;margin-bottom:4px;">${this.escapeHtml(c.source || 'Document')}</div>
                                <div style="font-size:13px;color:var(--text-secondary);line-height:1.6;">${this.escapeHtml((c.chunk_text || '').substring(0, 200))}…</div>
                                ${c.similarity_score ? `<div class="trend-chip up" style="margin-top:6px;">Match: ${(c.similarity_score * 100).toFixed(1)}%</div>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (error) {
            results.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i class="ti ti-alert-circle"></i></div>
                    <div class="empty-state-title">Search failed</div>
                    <div class="empty-state-body">${this.escapeHtml(error.message)}</div>
                </div>
            `;
        }
    },

    async uploadDoc(file) {
        const status = document.getElementById('kb-upload-status');
        status.innerHTML = `<div class="loading-overlay"><div class="spinner"></div><span>Indexing "${file.name}"…</span></div>`;

        try {
            const result = await API.knowledge.upload(file);
            status.innerHTML = `
                <div class="upload-success">
                    <i class="ti ti-check-circle"></i>
                    <span>Indexed into <strong>${result.document?.chunk_count || 0} chunks</strong></span>
                </div>
            `;
            App.showToast('Document added!', 'success');
            setTimeout(() => { status.innerHTML = ''; this.loadDocuments(); this.loadStats(); }, 2000);
        } catch (error) {
            status.innerHTML = `
                <div class="upload-error">
                    <i class="ti ti-alert-circle"></i>
                    <span>${this.escapeHtml(error.message)}</span>
                </div>
            `;
            App.showToast(`Upload failed: ${error.message}`, 'error');
        }
    },

    async deleteDoc(docId, filename) {
        if (!confirm(`Delete "${filename}"?`)) return;
        try {
            await API.knowledge.delete(docId);
            App.showToast('Document deleted.', 'info');
            this.loadDocuments();
            this.loadStats();
        } catch (error) {
            App.showToast(`Delete failed: ${error.message}`, 'error');
        }
    },

    escapeHtml(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    },
};
