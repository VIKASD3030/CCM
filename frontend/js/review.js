const ReviewPage = {
    activeTab: 'pending',

    async render() {
        const content = document.getElementById('page-content');
        document.getElementById('topbar-actions').innerHTML = '';

        content.innerHTML = `
            <div class="filter-bar" id="review-tab-bar">
                <button class="filter-btn active" onclick="ReviewPage.switchTab(this, 'pending')">
                    Pending Review <span class="filter-count" id="badge-pending">0</span>
                </button>
                <button class="filter-btn" onclick="ReviewPage.switchTab(this, 'approved')">
                    Approved <span class="filter-count" id="badge-approved">0</span>
                </button>
                <button class="filter-btn" onclick="ReviewPage.switchTab(this, 'rejected')">
                    Rejected <span class="filter-count" id="badge-rejected">0</span>
                </button>
                <button class="filter-btn" onclick="ReviewPage.switchTab(this, 'audit')">
                    Audit Trail
                </button>
            </div>

            <div id="review-content">
                <div class="loading-overlay"><div class="spinner"></div><span>Loading…</span></div>
            </div>
        `;

        this.loadTab('pending');
    },

    switchTab(el, tab) {
        document.querySelectorAll('#review-tab-bar .filter-btn').forEach(b => b.classList.remove('active'));
        el.classList.add('active');
        this.activeTab = tab;
        this.loadTab(tab);
    },

    async loadTab(tab) {
        const container = document.getElementById('review-content');
        container.innerHTML = `<div class="loading-overlay"><div class="spinner"></div><span>Loading…</span></div>`;

        if (tab === 'audit') { await this.loadAuditTrail(); return; }

        try {
            const lettersData = await API.letters.list();
            const letters = lettersData.letters || lettersData || [];
            const items = [];
            let pendingCount = 0, approvedCount = 0, rejectedCount = 0;

            for (const letter of letters) {
                try {
                    const draftsData = await API.drafts.forLetter(letter.id);
                    for (const draft of (draftsData.drafts || [])) {
                        if (draft.status === 'pending_review') pendingCount++;
                        if (draft.status === 'approved')       approvedCount++;
                        if (draft.status === 'rejected')       rejectedCount++;

                        if (
                            (tab === 'pending'  && draft.status === 'pending_review') ||
                            (tab === 'approved' && draft.status === 'approved') ||
                            (tab === 'rejected' && draft.status === 'rejected')
                        ) {
                            items.push({ letter, draft });
                        }
                    }
                } catch (e) { /* skip */ }
            }

            const bp = document.getElementById('badge-pending');
            const ba = document.getElementById('badge-approved');
            const br = document.getElementById('badge-rejected');
            if (bp) { bp.textContent = pendingCount; bp.style.display = pendingCount ? '' : 'none'; }
            if (ba) { ba.textContent = approvedCount; ba.style.display = approvedCount ? '' : 'none'; }
            if (br) { br.textContent = rejectedCount; br.style.display = rejectedCount ? '' : 'none'; }
            this.updateBadgeCount(pendingCount);

            if (!items.length) {
                const msgs = {
                    pending:  ['ti-checks', 'All caught up!', 'No drafts awaiting review.'],
                    approved: ['ti-thumb-up', 'No approved drafts', ''],
                    rejected: ['ti-ban', 'No rejected drafts', ''],
                };
                const [icon, title, body] = msgs[tab] || ['ti-inbox-off', 'Nothing here', ''];
                container.innerHTML = `
                    <div class="empty-state" style="padding:64px 24px;">
                        <div class="empty-state-icon"><i class="ti ${icon}"></i></div>
                        <div class="empty-state-title">${title}</div>
                        ${body ? `<div class="empty-state-body">${body}</div>` : ''}
                    </div>
                `;
                return;
            }

            if (tab === 'pending') {
                container.innerHTML = `<div style="display:flex;flex-direction:column;gap:var(--gutter);">${items.map(item => this.renderPendingCard(item.letter, item.draft)).join('')}</div>`;
            } else {
                container.innerHTML = `
                    <div class="card" style="padding:0;">
                        <table class="data-table" style="margin:0;">
                            <thead>
                                <tr>
                                    <th>Sender</th>
                                    <th>Subject</th>
                                    <th>Category</th>
                                    <th>Version</th>
                                    <th>Status</th>
                                    <th style="text-align:right;">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${items.map(item => this.renderQueueRow(item.letter, item.draft)).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }
        } catch (error) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i class="ti ti-alert-circle"></i></div>
                    <div class="empty-state-title">Failed to load</div>
                    <div class="empty-state-body">${this.escapeHtml(error.message)}</div>
                    <button class="btn btn-ghost btn-sm" onclick="ReviewPage.loadTab('${tab}')"><i class="ti ti-refresh"></i> Retry</button>
                </div>
            `;
        }
    },

    renderPendingCard(letter, draft) {
        const draftExcerpt  = (draft.draft_text  || '').substring(0, 200);
        const letterExcerpt = (letter.raw_text || letter.intent || '').substring(0, 200);
        const timeInQueue   = draft.created_at ? this._timeSince(new Date(draft.created_at)) : '';

        return `
            <div class="review-card" id="review-card-${draft.id}">
                <div class="review-card-header">
                    <div style="display:flex;flex-direction:column;gap:4px;">
                        <div style="display:flex;align-items:center;gap:8px;">
                            <span style="font-weight:500;font-size:14px;color:var(--text-primary);">${this.escapeHtml(letter.sender || 'Unknown Sender')}</span>
                            ${letter.category ? `<span class="status-pill received" style="text-transform:capitalize;">${letter.category.replace(/_/g,' ')}</span>` : ''}
                            <span class="status-pill pending">Pending Review</span>
                        </div>
                        <div style="font-size:13px;color:var(--text-secondary);">
                            ${this.escapeHtml(letter.subject || letter.filename || '—')}
                            ${timeInQueue ? `<span style="color:var(--text-tertiary);margin-left:8px;">· ${timeInQueue}</span>` : ''}
                        </div>
                    </div>
                    <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
                        <button class="btn btn-primary btn-sm" onclick="ReviewPage.approve('${draft.id}')">
                            <i class="ti ti-check"></i> Approve
                        </button>
                        <button class="btn btn-ghost btn-sm" onclick="ReviewPage.toggleComment('${draft.id}')">
                            <i class="ti ti-message-circle"></i> Request Changes
                        </button>
                        <button class="btn btn-destructive btn-sm" onclick="ReviewPage.showRejectModal('${draft.id}')">
                            <i class="ti ti-x"></i> Reject
                        </button>
                    </div>
                </div>

                <div class="review-card-body">
                    <div class="review-pane">
                        <div class="review-pane-label">Original Request</div>
                        <div class="font-mono" style="font-size:12px;line-height:1.7;color:var(--text-secondary);">
                            ${this.escapeHtml(letterExcerpt)}${letterExcerpt.length === 200 ? '…' : ''}
                        </div>
                    </div>
                    <div class="review-pane review-pane-right">
                        <div class="review-pane-label">AI Draft Response</div>
                        <div style="font-size:13px;line-height:1.7;color:var(--text-primary);">
                            ${this.escapeHtml(draftExcerpt)}${draftExcerpt.length === 200 ? '…' : ''}
                        </div>
                    </div>
                </div>

                <div class="inline-comment" id="inline-comment-${draft.id}">
                    <div class="form-group">
                        <label class="form-label">Revision instructions for the AI</label>
                        <textarea class="form-textarea" id="comment-text-${draft.id}"
                            placeholder="e.g. 'Make the tone more empathetic, and mention the 30-day resolution window.'"></textarea>
                    </div>
                    <div style="display:flex;gap:8px;">
                        <button class="btn btn-secondary btn-sm" onclick="ReviewPage.submitRevision('${draft.id}')">
                            <i class="ti ti-send"></i> Submit for Revision
                        </button>
                        <button class="btn btn-ghost btn-sm" onclick="ReviewPage.toggleComment('${draft.id}')">Cancel</button>
                    </div>
                </div>

                <div class="review-card-footer">
                    <button class="btn btn-ghost btn-sm" onclick="ReviewPage.viewDraftDetail('${draft.id}','${letter.id}')">
                        <i class="ti ti-maximize"></i> Full View
                    </button>
                    <span class="text-xs text-tertiary">v${draft.version || 1}</span>
                </div>
            </div>
        `;
    },

    renderQueueRow(letter, draft) {
        const isApproved = draft.status === 'approved';
        const statusKey  = isApproved ? 'approved' : 'rejected';
        const category = letter.category ? letter.category.replace(/_/g, ' ') : '—';

        return `
            <tr onclick="ReviewPage.viewDraftDetail('${draft.id}','${letter.id}')">
                <td style="font-weight:500;">${this.escapeHtml(letter.sender || 'Unknown')}</td>
                <td class="text-muted">${this.escapeHtml(letter.subject || letter.filename || '—')}</td>
                <td><span class="status-pill received" style="text-transform:capitalize;">${category}</span></td>
                <td class="text-muted">v${draft.version || 1}</td>
                <td><span class="status-pill ${statusKey}" style="text-transform:capitalize;">${draft.status.replace('_', ' ')}</span></td>
                <td style="text-align:right;" onclick="event.stopPropagation()">
                    <div style="display:flex;gap:6px;justify-content:flex-end;">
                        ${isApproved ? `
                            <button class="btn btn-primary btn-sm" onclick="ReviewPage.markSent('${draft.id}')">
                                <i class="ti ti-send"></i> Send
                            </button>
                        ` : `
                            <button class="btn btn-ghost btn-sm" onclick="window.location.hash='#drafting'">
                                <i class="ti ti-refresh"></i> Re-draft
                            </button>
                        `}
                        <button class="btn btn-ghost btn-sm" onclick="ReviewPage.viewDraftDetail('${draft.id}','${letter.id}')">
                            <i class="ti ti-eye"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    },

    toggleComment(draftId) {
        const box = document.getElementById(`inline-comment-${draftId}`);
        box.classList.toggle('open');
        if (box.classList.contains('open')) box.querySelector('textarea').focus();
    },

    async submitRevision(draftId) {
        const feedback = document.getElementById(`comment-text-${draftId}`)?.value.trim();
        if (!feedback) { App.showToast('Please enter revision instructions.', 'warning'); return; }
        try {
            await API.review.reject(draftId, feedback);
            App.showToast('Revision requested.', 'info');
            this.loadTab(this.activeTab);
        } catch (error) {
            App.showToast(`Failed: ${error.message}`, 'error');
        }
    },

    async approve(draftId) {
        try {
            await API.review.approve(draftId);
            App.showToast('Draft approved!', 'success');
            this.loadTab(this.activeTab);
        } catch (error) {
            App.showToast(`Approval failed: ${error.message}`, 'error');
        }
    },

    showRejectModal(draftId) {
        const modal = document.getElementById('modal-overlay');
        document.getElementById('modal-content').innerHTML = `
            <div class="modal-header">
                <span class="modal-title">Reject Draft</span>
                <button class="btn-ghost btn-sm" onclick="App.closeModal()" style="padding:4px 8px;">
                    <i class="ti ti-x" style="font-size:16px;"></i>
                </button>
            </div>
            <div class="modal-body" style="display:flex;flex-direction:column;gap:12px;">
                <div class="form-group">
                    <label class="form-label">Reason for rejection</label>
                    <textarea id="reject-notes" class="form-textarea" placeholder="Explain what needs to change…"></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-ghost" onclick="App.closeModal()">Cancel</button>
                <button class="btn btn-destructive" onclick="ReviewPage.confirmReject('${draftId}')">
                    <i class="ti ti-x"></i> Reject
                </button>
            </div>
        `;
        modal.style.display = 'flex';
    },

    async confirmReject(draftId) {
        const feedback = document.getElementById('reject-notes')?.value.trim();
        if (!feedback) { App.showToast('Please provide a reason.', 'warning'); return; }
        try {
            await API.review.reject(draftId, feedback);
            App.closeModal();
            App.showToast('Draft rejected.', 'info');
            this.loadTab(this.activeTab);
        } catch (error) {
            App.showToast(`Rejection failed: ${error.message}`, 'error');
        }
    },

    async markSent(draftId) {
        try {
            await API.review.send(draftId);
            App.showToast('Marked as sent!', 'success');
            this.loadTab(this.activeTab);
        } catch (error) {
            App.showToast(`Failed: ${error.message}`, 'error');
        }
    },

    async viewDraftDetail(draftId, letterId) {
        const modal = document.getElementById('modal-overlay');
        document.getElementById('modal-content').innerHTML = `
            <div class="modal-header">
                <span class="modal-title">Draft Detail</span>
                <button class="btn-ghost btn-sm" onclick="App.closeModal()" style="padding:4px 8px;">
                    <i class="ti ti-x" style="font-size:16px;"></i>
                </button>
            </div>
            <div class="modal-body"><div class="loading-overlay"><div class="spinner"></div></div></div>
        `;
        modal.style.display = 'flex';

        try {
            const [letterResult, draftsResult] = await Promise.all([
                API.letters.get(letterId),
                API.drafts.forLetter(letterId),
            ]);
            const letter = letterResult.letter;
            const draft  = (draftsResult.drafts || []).find(d => d.id === draftId);
            if (!draft) { document.querySelector('.modal-body').innerHTML = `<div class="empty-state"><div class="empty-state-title">Draft not found</div></div>`; return; }

            const statusKey = { pending_review: 'pending', approved: 'approved', rejected: 'rejected' }[draft.status] || 'drafted';

            document.querySelector('.modal-body').innerHTML = `
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
                    <span class="status-pill ${statusKey}" style="text-transform:capitalize;">${draft.status.replace('_', ' ')}</span>
                    ${letter.category ? `<span class="status-pill received" style="text-transform:capitalize;">${letter.category.replace(/_/g,' ')}</span>` : ''}
                    <span class="status-pill received">v${draft.version || 1}</span>
                </div>

                ${letter.intent ? `
                    <div class="form-group">
                        <label class="form-label">Intent Summary</label>
                        <div class="doc-block">${this.escapeHtml(letter.intent)}</div>
                    </div>
                ` : ''}

                <div class="form-group">
                    <label class="form-label">Draft Response</label>
                    <div class="doc-block mono" style="max-height:280px;">${this.escapeHtml(draft.draft_text)}</div>
                </div>

                ${draft.reviewer_notes ? `
                    <div class="form-group">
                        <label class="form-label">Reviewer Notes</label>
                        <div class="doc-block" style="background:var(--color-amber-bg);border-color:var(--color-amber);">${this.escapeHtml(draft.reviewer_notes)}</div>
                    </div>
                ` : ''}
            `;

            const footer = document.createElement('div');
            footer.className = 'modal-footer';
            footer.innerHTML = `
                ${draft.status === 'pending_review' ? `
                    <button class="btn btn-primary" onclick="ReviewPage.approve('${draft.id}');App.closeModal();">
                        <i class="ti ti-check"></i> Approve
                    </button>
                    <button class="btn btn-destructive" onclick="App.closeModal();ReviewPage.showRejectModal('${draft.id}');">
                        <i class="ti ti-x"></i> Reject
                    </button>
                ` : ''}
                ${draft.status === 'approved' ? `
                    <button class="btn btn-primary" onclick="ReviewPage.markSent('${draft.id}');App.closeModal();">
                        <i class="ti ti-send"></i> Mark as Sent
                    </button>
                ` : ''}
                <button class="btn btn-ghost" onclick="App.closeModal()">Close</button>
            `;
            document.getElementById('modal-content').appendChild(footer);
        } catch (error) {
            document.querySelector('.modal-body').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i class="ti ti-alert-circle"></i></div>
                    <div class="empty-state-body">${this.escapeHtml(error.message)}</div>
                </div>
            `;
        }
    },

    async loadAuditTrail() {
        const container = document.getElementById('review-content');
        try {
            const data    = await API.review.audit();
            const entries = data.audit_entries || [];

            if (!entries.length) {
                container.innerHTML = `
                    <div class="empty-state" style="padding:64px;">
                        <div class="empty-state-icon"><i class="ti ti-list"></i></div>
                        <div class="empty-state-title">No audit entries yet</div>
                        <div class="empty-state-body">Actions will appear here as you process letters and drafts.</div>
                    </div>
                `;
                return;
            }

            container.innerHTML = `
                <div class="card" style="padding:0;">
                    <table class="audit-table">
                        <thead>
                            <tr>
                                <th>Date &amp; Time</th>
                                <th>Action</th>
                                <th>Entity</th>
                                <th>User</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${entries.map(e => this.renderAuditRow(e)).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (error) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i class="ti ti-alert-circle"></i></div>
                    <div class="empty-state-title">Failed to load audit trail</div>
                    <div class="empty-state-body">${this.escapeHtml(error.message)}</div>
                </div>
            `;
        }
    },

    renderAuditRow(entry) {
        const time = entry.timestamp
            ? new Date(entry.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '—';
        const details = entry.details
            ? Object.entries(entry.details).map(([k, v]) => `${k}: ${v}`).join(', ')
            : '';
        const actionStatusMap = { approved: 'approved', rejected: 'rejected', sent: 'sent', draft_generated: 'drafted' };
        const statusKey = actionStatusMap[entry.action] || 'received';

        return `
            <tr>
                <td style="white-space:nowrap;" class="text-muted">${time}</td>
                <td><span class="status-pill ${statusKey}" style="text-transform:capitalize;">${entry.action.replace(/_/g, ' ')}</span></td>
                <td class="text-muted" style="text-transform:capitalize;">${entry.entity_type || '—'}</td>
                <td class="text-muted">${entry.actor || '—'}</td>
                <td class="text-muted" style="font-size:12px;">${this.escapeHtml(details)}</td>
            </tr>
        `;
    },

    updateBadgeCount(count) {
        const badge = document.getElementById('review-badge');
        if (badge) { badge.textContent = count; badge.style.display = count > 0 ? 'inline-block' : 'none'; }
    },

    _timeSince(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 60)  return `${seconds}s ago`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    },

    escapeHtml(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    },
};
