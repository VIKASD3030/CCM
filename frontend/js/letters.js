const LettersPage = {
    currentFilter: null,
    allLetters: [],

    async render() {
        const content = document.getElementById('page-content');
        document.getElementById('topbar-actions').innerHTML = `
            <button class="btn btn-primary btn-sm" onclick="LettersPage.showUploadModal()">
                <i class="ti ti-plus"></i> New Letter
            </button>
        `;

        content.innerHTML = `
            <div class="filter-bar" id="letter-filters">
                <button class="filter-btn active" data-filter="" onclick="LettersPage.setFilter(this, '')">
                    All <span class="filter-count" id="fc-all">0</span>
                </button>
                <button class="filter-btn" data-filter="received" onclick="LettersPage.setFilter(this, 'received')">
                    Received <span class="filter-count" id="fc-received">0</span>
                </button>
                <button class="filter-btn" data-filter="classified" onclick="LettersPage.setFilter(this, 'classified')">
                    Classified <span class="filter-count" id="fc-classified">0</span>
                </button>
                <button class="filter-btn" data-filter="drafted" onclick="LettersPage.setFilter(this, 'drafted')">
                    Drafted <span class="filter-count" id="fc-drafted">0</span>
                </button>
                <button class="filter-btn" data-filter="approved" onclick="LettersPage.setFilter(this, 'approved')">
                    Approved <span class="filter-count" id="fc-approved">0</span>
                </button>
                <button class="filter-btn" data-filter="sent" onclick="LettersPage.setFilter(this, 'sent')">
                    Sent <span class="filter-count" id="fc-sent">0</span>
                </button>
            </div>

            <div class="filter-bar" style="justify-content:space-between;background:none;border:none;padding:0;margin-bottom:var(--gutter);">
                <div style="display:flex;gap:8px;flex:1;max-width:560px;">
                    <div class="search-bar" style="flex:1;">
                        <i class="ti ti-search"></i>
                        <input type="text" id="letter-search" placeholder="Search by sender or subject…" oninput="LettersPage.handleSearch(this.value)">
                    </div>
                    <select class="form-input" id="letter-category-filter" style="width:auto;min-width:120px;" onchange="LettersPage.applyFilters()">
                        <option value="">All categories</option>
                        <option value="general">General</option>
                        <option value="complaint">Complaint</option>
                        <option value="inquiry">Inquiry</option>
                        <option value="legal">Legal</option>
                        <option value="billing">Billing</option>
                    </select>
                </div>
                <button class="btn btn-ghost btn-sm" onclick="LettersPage.loadLetters()">
                    <i class="ti ti-refresh"></i>
                </button>
            </div>

            <div id="letters-list" style="display:flex;flex-direction:column;gap:var(--gutter);">
                <div class="loading-overlay"><div class="spinner"></div><span>Loading letters…</span></div>
            </div>
        `;

        this.loadLetters();
    },

    handleSearch(value) {
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => this.renderCards(), 300);
    },

    applyFilters() {
        this.renderCards();
    },

    setFilter(el, filter) {
        document.querySelectorAll('#letter-filters .filter-btn').forEach(b => b.classList.remove('active'));
        el.classList.add('active');
        this.currentFilter = filter || null;
        this.renderCards();
    },

    async loadLetters() {
        try {
            const data = await API.letters.list();
            this.allLetters = data.letters || data || [];
            this.updateFilterCounts();
            this.renderCards();
        } catch (error) {
            document.getElementById('letters-list').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i class="ti ti-alert-circle"></i></div>
                    <div class="empty-state-title">Failed to load</div>
                    <div class="empty-state-body">${this.escapeHtml(error.message)}</div>
                    <button class="btn btn-ghost btn-sm" onclick="LettersPage.loadLetters()"><i class="ti ti-refresh"></i> Retry</button>
                </div>
            `;
        }
    },

    updateFilterCounts() {
        const counts = { all: this.allLetters.length };
        ['received', 'classified', 'drafted', 'approved', 'sent', 'rejected'].forEach(s => {
            counts[s] = this.allLetters.filter(l => l.status === s).length;
        });
        document.getElementById('fc-all').textContent = counts.all;
        document.getElementById('fc-received').textContent = counts.received || 0;
        document.getElementById('fc-classified').textContent = counts.classified || 0;
        document.getElementById('fc-drafted').textContent = counts.drafted || 0;
        document.getElementById('fc-approved').textContent = counts.approved || 0;
        document.getElementById('fc-sent').textContent = counts.sent || 0;

        const unread = counts.received || 0;
        const badge = document.getElementById('inbox-badge');
        if (badge) { badge.textContent = unread; badge.style.display = unread > 0 ? 'inline-block' : 'none'; }
    },

    renderCards() {
        const container = document.getElementById('letters-list');
        let filtered = this.allLetters;

        if (this.currentFilter) {
            filtered = filtered.filter(l => l.status === this.currentFilter);
        }

        const searchVal = document.getElementById('letter-search')?.value.toLowerCase().trim();
        if (searchVal) {
            filtered = filtered.filter(l =>
                (l.sender || '').toLowerCase().includes(searchVal) ||
                (l.subject || l.filename || '').toLowerCase().includes(searchVal)
            );
        }

        const catVal = document.getElementById('letter-category-filter')?.value;
        if (catVal) {
            filtered = filtered.filter(l => (l.category || '').toLowerCase() === catVal);
        }

        if (!filtered.length) {
            const msg = this.currentFilter ? `No letters with status "${this.currentFilter}".` : 'Upload a client letter to get started.';
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i class="ti ti-inbox-off"></i></div>
                    <div class="empty-state-title">No letters found</div>
                    <div class="empty-state-body">${msg}</div>
                    <button class="btn btn-primary btn-sm" onclick="LettersPage.showUploadModal()"><i class="ti ti-upload"></i> Upload Letter</button>
                </div>
            `;
            return;
        }

        const statusMap = {
            received: 'received', classified: 'classified',
            drafted: 'drafted', approved: 'approved',
            sent: 'sent', rejected: 'rejected', pending_review: 'pending',
        };

        container.innerHTML = filtered.map(l => {
            const sk = statusMap[l.status] || 'received';
            const date = l.received_at
                ? new Date(l.received_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : '—';
            const category = l.category ? l.category.replace(/_/g, ' ') : '';
            const priority = l.urgency === 'high';
            const name = l.sender || 'Unknown Sender';
            const subj = l.subject || l.filename || '(no subject)';

            return `
                <div class="letter-card ${priority ? 'priority-high' : ''}" onclick="LettersPage.openDrawer('${l.id}')">
                    <div class="letter-card-left">
                        <div class="letter-card-avatar">${this.escapeHtml((name[0] || '?').toUpperCase())}</div>
                        <div class="letter-card-body">
                            <div class="letter-card-sender">${this.escapeHtml(name)}</div>
                            <div class="letter-card-subject">${this.escapeHtml(subj)}</div>
                        </div>
                    </div>
                    <div class="letter-card-meta">
                        ${category ? `<span class="status-pill received" style="text-transform:capitalize;">${category}</span>` : ''}
                        <span class="status-pill ${sk}" style="text-transform:capitalize;">${l.status.replace('_', ' ')}</span>
                        <span class="letter-card-date">${date}</span>
                        <div class="letter-card-actions" onclick="event.stopPropagation()">
                            ${l.status === 'classified' ? `
                                <button class="btn btn-primary btn-sm" onclick="LettersPage.generateDraft('${l.id}')">Draft</button>
                            ` : ''}
                            ${['pending_review', 'drafted'].includes(l.status) ? `
                                <button class="btn btn-ghost btn-sm" onclick="window.location.hash='#review'">
                                    <i class="ti ti-checkup-list" style="font-size:14px;"></i>
                                </button>
                            ` : ''}
                            <button class="btn btn-ghost btn-sm" onclick="LettersPage.openDrawer('${l.id}')">
                                <i class="ti ti-eye" style="font-size:14px;"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    /* ── Slide-over Drawer ─────────────────────────────────── */

    async openDrawer(letterId) {
        App.openDrawer('Loading…', `<div class="loading-overlay"><div class="spinner"></div></div>`);
        try {
            const result = await API.letters.get(letterId);
            const l = result.letter;
            document.getElementById('slide-over-title').textContent = l.filename || l.sender || 'Letter Detail';

            const statusKey = { received: 'received', classified: 'classified', drafted: 'drafted', approved: 'approved', sent: 'sent', rejected: 'rejected', pending_review: 'pending' }[l.status] || 'received';
            const date = l.received_at ? new Date(l.received_at).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

            document.getElementById('slide-over-body').innerHTML = `
                <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
                    <span class="status-pill ${statusKey}" style="text-transform:capitalize;">${l.status.replace('_', ' ')}</span>
                    ${l.category ? `<span class="status-pill received" style="text-transform:capitalize;">${l.category.replace(/_/g, ' ')}</span>` : ''}
                    ${l.urgency ? `<span class="status-pill ${l.urgency === 'high' ? 'rejected' : 'pending'}">${l.urgency} urgency</span>` : ''}
                    ${l.confidence_score ? `<span class="status-pill received">Conf: ${Math.round(l.confidence_score * 100)}%</span>` : ''}
                </div>

                <div style="display:flex;flex-direction:column;gap:14px;">
                    <div>
                        <div class="label-text">Sender</div>
                        <div style="font-weight:500;">${this.escapeHtml(l.sender || '—')}</div>
                    </div>
                    <div>
                        <div class="label-text">Subject</div>
                        <div>${this.escapeHtml(l.subject || l.filename || '—')}</div>
                    </div>
                    <div>
                        <div class="label-text">Received</div>
                        <div class="text-muted">${date}</div>
                    </div>

                    ${l.intent ? `
                    <div>
                        <div class="label-text">AI Intent Summary</div>
                        <div class="doc-block">${this.escapeHtml(l.intent)}</div>
                    </div>` : ''}

                    ${l.raw_text ? `
                    <div>
                        <div class="label-text">Letter Content</div>
                        <div class="doc-block mono" style="max-height:300px;">${this.escapeHtml(l.raw_text)}</div>
                    </div>` : ''}

                    ${l.key_entities && (l.key_entities.names?.length || l.key_entities.dates?.length || l.key_entities.contract_numbers?.length) ? `
                    <div>
                        <div class="label-text">Key Entities</div>
                        <div style="font-size:13px;color:var(--text-secondary);">
                            ${l.key_entities.names?.length ? `<div><span class="text-tertiary">Names: </span>${l.key_entities.names.join(', ')}</div>` : ''}
                            ${l.key_entities.dates?.length ? `<div><span class="text-tertiary">Dates: </span>${l.key_entities.dates.join(', ')}</div>` : ''}
                            ${l.key_entities.contract_numbers?.length ? `<div><span class="text-tertiary">Contracts: </span>${l.key_entities.contract_numbers.join(', ')}</div>` : ''}
                        </div>
                    </div>` : ''}
                </div>
            `;

            let footerHtml = '';
            if (l.status === 'classified') {
                footerHtml = `
                    <button class="btn btn-primary" onclick="LettersPage.generateDraft('${l.id}');App.closeDrawer();">
                        <i class="ti ti-writing"></i> Generate Draft
                    </button>
                    <button class="btn btn-ghost" onclick="App.closeDrawer()">Close</button>
                `;
            } else if (['pending_review', 'drafted'].includes(l.status)) {
                footerHtml = `
                    <button class="btn btn-secondary" onclick="window.location.hash='#review';App.closeDrawer();">
                        <i class="ti ti-checkup-list"></i> Review
                    </button>
                    <button class="btn btn-ghost" onclick="App.closeDrawer()">Close</button>
                `;
            } else {
                footerHtml = `<button class="btn btn-ghost" onclick="App.closeDrawer()">Close</button>`;
            }

            const footer = document.getElementById('slide-over-footer');
            footer.innerHTML = footerHtml;
            footer.style.display = 'flex';
        } catch (error) {
            document.getElementById('slide-over-body').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i class="ti ti-alert-circle"></i></div>
                    <div class="empty-state-body">${this.escapeHtml(error.message)}</div>
                </div>
            `;
        }
    },

    /* ── Upload Modal ──────────────────────────────────────── */

    showUploadModal() {
        const modal   = document.getElementById('modal-overlay');
        const content = document.getElementById('modal-content');
        content.innerHTML = `
            <div class="modal-header">
                <span class="modal-title">Upload Client Letter</span>
                <button class="btn-ghost btn-sm" onclick="App.closeModal()" style="padding:4px 8px;">
                    <i class="ti ti-x" style="font-size:16px;"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="upload-zone" id="letter-upload-zone">
                    <div class="upload-zone-icon"><i class="ti ti-mail"></i></div>
                    <div class="upload-zone-title">Drop your letter here, or click to browse</div>
                    <div class="upload-zone-hint">PDF, DOCX, JPG, PNG · Max 20 MB</div>
                    <input type="file" id="letter-file-input" accept=".pdf,.docx,.jpg,.jpeg,.png" style="display:none;">
                </div>
                <div id="letter-upload-status"></div>
            </div>
        `;
        modal.style.display = 'flex';

        const zone  = document.getElementById('letter-upload-zone');
        const input = document.getElementById('letter-file-input');
        zone.addEventListener('click',     () => input.click());
        zone.addEventListener('dragover',  (e) => { e.preventDefault(); zone.classList.add('dragover'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
            if (e.dataTransfer.files[0]) this.uploadLetter(e.dataTransfer.files[0]);
        });
        input.addEventListener('change', () => {
            if (input.files[0]) this.uploadLetter(input.files[0]);
        });
    },

    async uploadLetter(file) {
        const status = document.getElementById('letter-upload-status');
        status.innerHTML = `<div class="loading-overlay"><div class="spinner"></div><span>Classifying "${file.name}"…</span></div>`;
        try {
            const result = await API.letters.upload(file);
            status.innerHTML = `
                <div class="upload-success">
                    <i class="ti ti-check-circle"></i>
                    <span>Classified as <strong>${result.letter?.category || 'general'}</strong></span>
                </div>
            `;
            App.showToast('Letter uploaded!', 'success');
            setTimeout(() => { App.closeModal(); this.loadLetters(); }, 1500);
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

    async generateDraft(letterId) {
        App.showToast('Generating AI draft…', 'info');
        try {
            await API.drafts.generate(letterId);
            App.showToast('Draft generated!', 'success');
            window.location.hash = '#drafting';
            setTimeout(() => DraftingPage.openForLetter(letterId), 300);
        } catch (error) {
            App.showToast(`Generation failed: ${error.message}`, 'error');
        }
    },

    escapeHtml(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    },
};
