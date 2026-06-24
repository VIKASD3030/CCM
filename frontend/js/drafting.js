const DraftingPage = {
    currentLetterId: null,
    currentDraftId:  null,
    currentTone:     'formal',

    async render() {
        const content = document.getElementById('page-content');
        document.getElementById('topbar-actions').innerHTML = '';

        content.innerHTML = `
            <div id="drafting-selector">
                <div class="page-header">
                    <div class="page-header-left">
                        <h2>AI Drafting</h2>
                        <p>Select a classified letter to generate a draft response</p>
                    </div>
                </div>
                <div id="drafting-letter-list">
                    <div class="loading-overlay"><div class="spinner"></div><span>Loading letters…</span></div>
                </div>
            </div>

            <div id="drafting-workspace" style="display:none;flex-direction:column;height:calc(100vh - var(--topbar-height) - var(--gutter)*2);">
                <!-- Toolbar strip -->
                <div class="draft-toolbar">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <button class="btn btn-ghost btn-sm" onclick="DraftingPage.backToSelector()">
                            <i class="ti ti-arrow-left"></i>
                        </button>
                        <span style="width:1px;height:16px;background:var(--border);"></span>
                        <span id="draft-letter-name" style="font-size:13px;font-weight:500;"></span>
                        <span id="draft-category-badge"></span>
                    </div>

                    <div style="display:flex;align-items:center;gap:6px;">
                        <div class="tone-pills">
                            <button class="filter-btn active" id="tone-formal" onclick="DraftingPage.setTone('formal', this)" style="padding:3px 10px;font-size:11px;">Formal</button>
                            <button class="filter-btn" id="tone-neutral" onclick="DraftingPage.setTone('neutral', this)" style="padding:3px 10px;font-size:11px;">Neutral</button>
                            <button class="filter-btn" id="tone-apologetic" onclick="DraftingPage.setTone('apologetic', this)" style="padding:3px 10px;font-size:11px;">Apologetic</button>
                        </div>
                        <span style="width:1px;height:16px;background:var(--border);"></span>
                        <button class="btn btn-primary btn-sm" id="btn-generate" onclick="DraftingPage.generateDraftForLetter(DraftingPage.currentLetterId)">
                            <i class="ti ti-sparkles"></i> Generate
                        </button>
                        <button class="btn btn-ghost btn-sm" id="btn-regenerate" onclick="DraftingPage.regenerateDraft()" style="display:none;">
                            <i class="ti ti-refresh"></i> Regenerate
                        </button>
                        <button class="btn btn-ghost btn-sm" id="btn-copy" onclick="DraftingPage.copyDraft()" style="display:none;">
                            <i class="ti ti-copy"></i> Copy
                        </button>
                        <button class="btn btn-secondary btn-sm" id="btn-send-review" onclick="DraftingPage.sendToReview()" style="display:none;">
                            <i class="ti ti-send"></i> Send to Review
                        </button>
                    </div>
                </div>

                <!-- Split panes -->
                <div class="split-pane">
                    <div class="split-pane-left">
                        <div class="pane-header">
                            <span class="pane-title">Original Letter</span>
                            <span class="status-pill received" style="font-size:10px;">Read-only</span>
                        </div>
                        <div class="pane-body mono" id="draft-original-content">
                            <div class="loading-overlay"><div class="spinner"></div></div>
                        </div>
                    </div>
                    <div class="split-pane-right">
                        <div class="pane-header">
                            <span class="pane-title">AI Draft Response</span>
                            <span id="draft-status-badge"></span>
                        </div>
                        <div class="pane-body" id="draft-content" contenteditable="false">
                            <div style="color:var(--text-tertiary);font-style:italic;">
                                Click <strong style="color:var(--color-purple);">Generate</strong> to create an AI draft.
                            </div>
                        </div>

                        <details class="sources-panel" id="draft-sources" style="display:none;">
                            <summary>
                                <i class="ti ti-books"></i>
                                Sources used
                                <span class="status-pill received" id="draft-sources-count" style="font-size:10px;margin-left:4px;"></span>
                            </summary>
                            <div class="sources-list" id="draft-sources-list"></div>
                        </details>

                        <div id="draft-refine-row" style="display:none;padding:10px 14px;border-top:0.5px solid var(--border);">
                            <input type="text" class="form-input" id="draft-feedback" placeholder="Add instructions before regenerating…" style="flex:1;">
                            <button class="btn btn-primary btn-sm" onclick="DraftingPage.regenerateDraft()">
                                <i class="ti ti-arrow-up"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.loadLetters();
    },

    async loadLetters() {
        const list = document.getElementById('drafting-letter-list');
        try {
            const data    = await API.letters.list();
            const letters = (data.letters || data || []).filter(l =>
                ['classified', 'drafted', 'under_review', 'approved', 'pending_review'].includes(l.status)
            );

            if (!letters.length) {
                list.innerHTML = `
                    <div class="empty-state" style="padding:48px;">
                        <div class="empty-state-icon"><i class="ti ti-mail-off"></i></div>
                        <div class="empty-state-title">No classified letters</div>
                        <div class="empty-state-body">Upload and classify a letter from the Inbox first.</div>
                        <button class="btn btn-primary btn-sm" onclick="window.location.hash='#letters'">
                            <i class="ti ti-inbox"></i> Go to Inbox
                        </button>
                    </div>
                `;
                return;
            }

            const statusMap = { classified: 'received', drafted: 'drafted', approved: 'approved', pending_review: 'pending', under_review: 'pending' };

            list.innerHTML = `<div style="display:flex;flex-direction:column;gap:4px;">${letters.map(l => {
                const hasDraft = ['drafted', 'pending_review', 'under_review', 'approved'].includes(l.status);
                const category = l.category ? l.category.replace(/_/g, ' ') : '—';
                return `
                    <div class="letter-card" onclick="DraftingPage.openForLetter('${l.id}')" style="cursor:pointer;">
                        <div class="letter-card-left">
                            <div class="letter-card-avatar">${this.escapeHtml((l.sender || '?')[0].toUpperCase())}</div>
                            <div class="letter-card-body">
                                <div class="letter-card-sender">${this.escapeHtml(l.sender || 'Unknown')}</div>
                                <div class="letter-card-subject">${this.escapeHtml(l.subject || l.filename || '—')}</div>
                            </div>
                        </div>
                        <div class="letter-card-meta">
                            <span class="status-pill received" style="text-transform:capitalize;">${category}</span>
                            <span class="status-pill ${statusMap[l.status] || 'received'}" style="text-transform:capitalize;">${l.status.replace('_', ' ')}</span>
                            ${hasDraft
                                ? `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();DraftingPage.openForLetter('${l.id}')"><i class="ti ti-eye"></i></button>`
                                : `<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();DraftingPage.openAndGenerate('${l.id}')"><i class="ti ti-sparkles"></i> Generate</button>`
                            }
                        </div>
                    </div>
                `;
            }).join('')}</div>`;
        } catch (error) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i class="ti ti-alert-circle"></i></div>
                    <div class="empty-state-body">${this.escapeHtml(error.message)}</div>
                </div>
            `;
        }
    },

    async openForLetter(letterId) {
        this.currentLetterId = letterId;
        document.getElementById('drafting-selector').style.display = 'none';
        const ws = document.getElementById('drafting-workspace');
        ws.style.display = 'flex';

        document.getElementById('draft-original-content').innerHTML = `<div class="loading-overlay"><div class="spinner"></div></div>`;
        document.getElementById('draft-content').innerHTML = `<div style="color:var(--text-tertiary);font-style:italic;">Loading draft…</div>`;
        document.getElementById('draft-content').contentEditable = 'false';
        this._hideDraftActions();

        try {
            const letterResult = await API.letters.get(letterId);
            const letter = letterResult.letter;

            document.getElementById('draft-letter-name').textContent = letter.sender || letter.filename || 'Letter';
            document.getElementById('draft-category-badge').innerHTML = letter.category
                ? `<span class="status-pill received" style="text-transform:capitalize;">${letter.category.replace(/_/g, ' ')}</span>`
                : '';
            document.getElementById('draft-original-content').textContent = letter.raw_text || letter.intent || 'No content available.';

            const draftsResult = await API.drafts.forLetter(letterId);
            const drafts = (draftsResult.drafts || []).sort((a, b) => (b.version || 0) - (a.version || 0));

            if (drafts.length) {
                const latest = drafts[0];
                this.currentDraftId = latest.id;
                this._renderDraft(latest);
            } else {
                document.getElementById('draft-content').innerHTML = `
                    <div style="color:var(--text-tertiary);font-style:italic;">
                        No draft yet — click <strong style="color:var(--color-purple);">Generate</strong> to create one.
                    </div>
                `;
                document.getElementById('btn-generate').style.display = '';
                document.getElementById('btn-regenerate').style.display = 'none';
            }
        } catch (error) {
            document.getElementById('draft-original-content').innerHTML = `
                <div class="empty-state"><div class="empty-state-icon"><i class="ti ti-alert-circle"></i></div><div class="empty-state-body">${this.escapeHtml(error.message)}</div></div>
            `;
        }
    },

    async openAndGenerate(letterId) {
        await this.openForLetter(letterId);
        if (document.getElementById('draft-content')?.textContent?.includes('No draft yet')) {
            await this.generateDraftForLetter(letterId);
        }
    },

    _renderDraft(draft) {
        const el = document.getElementById('draft-content');
        el.textContent = draft.draft_text || '';
        el.contentEditable = 'true';

        const statusKey = { pending_review: 'pending', approved: 'approved', rejected: 'rejected', draft: 'drafted' }[draft.status] || 'drafted';
        document.getElementById('draft-status-badge').innerHTML = `<span class="status-pill ${statusKey}" style="text-transform:capitalize;">${(draft.status || 'draft').replace('_', ' ')}</span>`;

        document.getElementById('btn-generate').style.display = 'none';
        document.getElementById('btn-regenerate').style.display = '';
        document.getElementById('btn-copy').style.display = '';
        document.getElementById('btn-send-review').style.display = draft.status === 'pending_review' ? 'none' : '';
        document.getElementById('draft-refine-row').style.display = '';

        if (draft.context_documents && draft.context_documents.length) {
            document.getElementById('draft-sources-count').textContent = draft.context_documents.length;
            document.getElementById('draft-sources-list').innerHTML = draft.context_documents.map(doc => `
                <div class="source-item">
                    <i class="ti ti-file-text"></i>
                    <div>
                        <div style="font-weight:500;">${this.escapeHtml(doc.source || 'Document')}</div>
                        ${doc.chunk_text ? `<div style="color:var(--text-tertiary);margin-top:2px;">${this.escapeHtml(doc.chunk_text.substring(0, 120))}…</div>` : ''}
                    </div>
                </div>
            `).join('');
            document.getElementById('draft-sources').style.display = '';
        }
    },

    _hideDraftActions() {
        ['btn-regenerate', 'btn-copy', 'btn-send-review'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        document.getElementById('draft-sources').style.display = 'none';
        document.getElementById('draft-refine-row').style.display = 'none';
    },

    setTone(tone, btn) {
        this.currentTone = tone;
        document.querySelectorAll('#drafting-workspace .filter-btn[id^="tone-"]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    },

    backToSelector() {
        document.getElementById('drafting-workspace').style.display = 'none';
        document.getElementById('drafting-selector').style.display = '';
        this.currentLetterId = null;
        this.currentDraftId  = null;
    },

    async generateDraftForLetter(letterId) {
        if (!letterId) return;
        const btn = document.getElementById('btn-generate');
        const contentEl = document.getElementById('draft-content');
        contentEl.contentEditable = 'false';
        contentEl.innerHTML = `
            <div class="typing-indicator"><span></span><span></span><span></span></div>
            <div style="font-size:12px;color:var(--text-tertiary);margin-top:8px;">Generating draft response…</div>
        `;
        if (btn) btn.innerHTML = `<div class="spinner" style="width:14px;height:14px;"></div>`;

        try {
            const result = await API.drafts.generate(letterId, `Tone: ${this.currentTone}`);
            this.currentDraftId = result.draft?.id || null;
            await this.openForLetter(letterId);
            App.showToast('Draft generated!', 'success');
        } catch (error) {
            contentEl.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i class="ti ti-alert-circle"></i></div>
                    <div class="empty-state-body">${this.escapeHtml(error.message)}</div>
                    <button class="btn btn-ghost btn-sm" onclick="DraftingPage.generateDraftForLetter('${letterId}')">Retry</button>
                </div>
            `;
            App.showToast(`Generation failed: ${error.message}`, 'error');
            if (btn) btn.innerHTML = `<i class="ti ti-sparkles"></i> Generate`;
        }
    },

    async regenerateDraft() {
        const feedback = document.getElementById('draft-feedback')?.value.trim() || '';
        if (!this.currentDraftId) return this.generateDraftForLetter(this.currentLetterId);

        const btn = document.getElementById('btn-regenerate');
        if (btn) btn.innerHTML = `<div class="spinner" style="width:14px;height:14px;"></div>`;

        const contentEl = document.getElementById('draft-content');
        contentEl.contentEditable = 'false';
        contentEl.innerHTML = `
            <div class="typing-indicator"><span></span><span></span><span></span></div>
            <div style="font-size:12px;color:var(--text-tertiary);margin-top:8px;">Refining draft…</div>
        `;

        try {
            await API.drafts.regenerate(this.currentDraftId, feedback);
            const el = document.getElementById('draft-feedback');
            if (el) el.value = '';
            await this.openForLetter(this.currentLetterId);
            App.showToast('Draft regenerated!', 'success');
        } catch (error) {
            App.showToast(`Regeneration failed: ${error.message}`, 'error');
            if (btn) btn.innerHTML = `<i class="ti ti-refresh"></i> Regenerate`;
        }
    },

    copyDraft() {
        const text = document.getElementById('draft-content')?.textContent || '';
        navigator.clipboard.writeText(text).then(() => {
            App.showToast('Copied to clipboard', 'success');
        }).catch(() => {
            App.showToast('Copy failed', 'error');
        });
    },

    async sendToReview() {
        if (!this.currentDraftId) return;
        try {
            App.showToast('Sent to review queue', 'success');
            document.getElementById('draft-status-badge').innerHTML = `<span class="status-pill pending">Pending Review</span>`;
            document.getElementById('btn-send-review').style.display = 'none';
        } catch (e) {
            App.showToast('Failed to send to review', 'error');
        }
    },

    escapeHtml(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    },
};
