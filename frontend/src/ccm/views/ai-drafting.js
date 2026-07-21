/**
 * AiDrafting — React port of the original vanilla CCM AI Drafting panel
 * (frontend/js/drafting.js). ChatGPT-style drafting with full session
 * persistence via the /api/drafting-sessions API. Behavior preserved 1:1.
 */
import React from 'react';
import { Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import CCM from '../ccm-api';
import '../ccm.css';

const DRAFTABLE = ['classified', 'drafted', 'pending_review', 'approved'];

class AiDrafting extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      // session/context
      currentSessionId: null,
      currentLetterId: null,
      currentProjectId: null,
      currentLetterData: null,
      currentProjectData: null,
      // data
      sessions: [],
      templates: [],
      letters: [],
      projects: [],
      messages: [],
      // ui
      activeView: false,       // false = empty state, true = active conversation
      sidebarCollapsed: false,
      isGenerating: false,
      searchTerm: '',
      emptyInput: '',
      activeInput: '',
      // letter picker
      pickerOpen: false,
      pickerTab: 'select',
      pickerProjectId: '',
      pickerSearch: '',
      pickerUploadProjectId: '',
      uploadStatus: null,
      // sources
      sourcesOpen: false,
      lastSourceDocs: [],
      // profile
      profile: null,
      // snackbar
      snackOpen: false,
      snackMsg: '',
      snackSeverity: 'info',
      // delete dialog
      deleteDialogOpen: false,
      deleteSessionId: null,
    };
    this.threadRef = React.createRef();
    this.searchDebounce = null;
    this.fileInputRef = React.createRef();
  }

  componentDidMount() {
    this.loadInitial();
  }

  async loadInitial() {
    await this.loadProjects();
    await Promise.all([this.loadSessions(), this.loadTemplates(), this.loadLetters(), this.loadProfile()]);
  }

  // ── Data loading ──────────────────────────────────────────
  async loadProjects() {
    try { const d = await CCM.projects.list(); this.setState({ projects: d.projects || [] }); }
    catch { this.setState({ projects: [] }); }
  }

  async loadSessions() {
    try { const d = await CCM.draftingSessions.list(); this.setState({ sessions: d.sessions || [] }); }
    catch { this.setState({ sessions: [] }); }
  }

  async loadTemplates() {
    try { const d = await CCM.draftingSessions.templates(); this.setState({ templates: d.templates || [] }); }
    catch { this.setState({ templates: [] }); }
  }

  async loadLetters() {
    try {
      const d = await CCM.letters.list();
      const letters = (d.letters || d || []).filter(l => DRAFTABLE.includes(l.status));
      this.setState({ letters });
    } catch { this.setState({ letters: [] }); }
  }

  async loadProfile() {
    try { const d = await CCM.auth.me(); this.setState({ profile: d.user || d }); }
    catch { /* silent */ }
  }

  toast(msg, type = 'info') {
    const severity = type === 'error' ? 'error' : type === 'success' ? 'success' : type === 'warning' ? 'warning' : 'info';
    this.setState({ snackOpen: true, snackMsg: msg, snackSeverity: severity });
  }

  scrollThread() {
    setTimeout(() => {
      const el = this.threadRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
  }

  // ── Session lifecycle ─────────────────────────────────────
  startNewDraft = () => {
    this.setState({
      currentSessionId: null, currentLetterId: null, currentProjectId: null,
      currentLetterData: null, currentProjectData: null,
      activeView: false, emptyInput: '', messages: [],
    });
  };

  openSession = async (sessionId) => {
    try {
      const data = await CCM.draftingSessions.get(sessionId);
      const session = data.session;
      const [letterData, projectData] = await Promise.all([
        session.letter_id ? CCM.letters.get(session.letter_id).then(r => r.letter || r).catch(() => null) : Promise.resolve(null),
        session.project_id ? CCM.projects.get(session.project_id).then(r => r.project || r).catch(() => null) : Promise.resolve(null),
      ]);
      const messages = session.messages || [];
      let lastSourceDocs = [];
      for (const m of messages) { if (m.role === 'assistant' && m.context_documents?.length) lastSourceDocs = m.context_documents; }
      this.setState({
        currentSessionId: sessionId,
        currentLetterId: session.letter_id,
        currentProjectId: session.project_id,
        currentLetterData: letterData,
        currentProjectData: projectData,
        messages, activeView: true, sourcesOpen: false, lastSourceDocs,
      }, this.scrollThread);
    } catch (e) {
      this.toast(`Failed to open session: ${e.message}`, 'error');
    }
  };

  closeSession = () => {
    this.setState({
      currentSessionId: null, currentLetterId: null, currentLetterData: null,
      currentProjectData: null, activeView: false, messages: [],
    });
  };

  // ── Templates ─────────────────────────────────────────────
  useTemplate(text) {
    if (this.state.activeView) this.setState({ activeInput: text });
    else this.setState({ emptyInput: text });
  }

  // ── Search ────────────────────────────────────────────────
  onSearch = (value) => {
    this.setState({ searchTerm: value });
    clearTimeout(this.searchDebounce);
    if (!value.trim()) { this.loadSessions(); return; }
    this.searchDebounce = setTimeout(async () => {
      try { const d = await CCM.draftingSessions.search(value.trim()); this.setState({ sessions: d.sessions || [] }); }
      catch { /* silent */ }
    }, 300);
  };

  // ── Letter picker ─────────────────────────────────────────
  openLetterPicker = () => this.setState({ pickerOpen: true, pickerTab: 'select', pickerSearch: '', uploadStatus: null });
  closeLetterPicker = () => this.setState({ pickerOpen: false });

  selectLetter = async (letterId) => {
    const letter = this.state.letters.find(l => l.id === letterId);
    let currentProjectId = this.state.currentProjectId;
    if (letter?.project_id) currentProjectId = letter.project_id;
    let currentLetterData = letter || null;
    try { const ld = await CCM.letters.get(letterId); currentLetterData = ld.letter || ld; } catch { /* keep */ }
    this.setState({ currentLetterId: letterId, currentProjectId, currentLetterData, pickerOpen: false });
  };

  onPickerFile = async (file) => {
    if (!file) return;
    this.setState({ uploadStatus: { type: 'loading', msg: `Uploading and classifying "${file.name}"…` } });
    try {
      const projectId = this.state.pickerUploadProjectId || null;
      const result = await CCM.letters.upload(file, projectId);
      this.setState({ uploadStatus: { type: 'success', msg: `Uploaded! Classified as ${result.letter?.category || 'general'}` } });
      this.toast('Letter uploaded successfully!', 'success');
      await this.loadLetters();
      if (result.letter?.id) {
        setTimeout(() => { this.selectLetter(result.letter.id); this.setState({ pickerTab: 'select', uploadStatus: null }); }, 900);
      }
    } catch (e) {
      this.setState({ uploadStatus: { type: 'error', msg: e.message } });
      this.toast(`Upload failed: ${e.message}`, 'error');
    }
  };

  // ── Sending / generating ──────────────────────────────────
  sendFromEmpty = async () => {
    const text = this.state.emptyInput.trim();
    if (!text) return;
    if (!this.state.currentLetterId) { this.toast('Please select a letter first — click the + button', 'warning'); return; }
    if (!this.state.currentSessionId) { await this.ensureSession(); if (!this.state.currentSessionId) return; }
    this.setState({ activeView: true, emptyInput: '' });
    await this.sendAndGenerate(text);
  };

  sendMessage = async () => {
    if (this.state.isGenerating) return;
    const text = this.state.activeInput.trim();
    if (!text) return;
    if (!this.state.currentLetterId) { this.toast('Please attach a letter first — click the + button', 'warning'); return; }
    if (!this.state.currentSessionId) { await this.ensureSession(); if (!this.state.currentSessionId) return; }
    this.setState({ activeInput: '' });
    await this.sendAndGenerate(text);
  };

  async ensureSession() {
    try {
      const letterName = this.state.currentLetterData?.filename || 'Draft';
      const category = this.state.currentLetterData?.category?.replace(/_/g, ' ') || '';
      const titleStr = (category ? `${letterName} — ${category}` : letterName).substring(0, 480);
      const data = await CCM.draftingSessions.create(this.state.currentLetterId, this.state.currentProjectId || '', titleStr);
      const session = data.session;
      let currentProjectData = this.state.currentProjectData;
      if (!currentProjectData && this.state.currentProjectId) {
        try { const pd = await CCM.projects.get(this.state.currentProjectId); currentProjectData = pd.project || pd; } catch { /* */ }
      }
      this.setState({ currentSessionId: session.id, currentProjectData });
      await this.loadSessions();
    } catch (e) {
      this.toast(`Failed to create session: ${e.message}`, 'error');
    }
  }

  async sendAndGenerate(text) {
    this.setState({ isGenerating: true });
    const sessionId = this.state.currentSessionId;

    // 1. persist user message
    try { await CCM.draftingSessions.addMessage(sessionId, 'user', text); }
    catch { this.toast('Failed to persist message', 'warning'); }

    // 2. optimistic user bubble + thinking indicator
    const userMsg = { role: 'user', content: text, id: 'u-' + Date.now() };
    const thinkingMsg = { role: 'assistant', content: '', id: 'thinking', thinking: true };
    this.setState(s => ({ messages: [...s.messages.filter(m => !m.thinking), userMsg, thinkingMsg] }), this.scrollThread);

    // 3. generate draft
    try {
      const result = await CCM.drafts.generate(this.state.currentLetterId, text, sessionId);
      const draft = await this.pollDraftResult(result.job_id);
      if (draft) {
        const sessionRes = await CCM.draftingSessions.get(sessionId);
        const session = sessionRes.session;
        let lastSourceDocs = this.state.lastSourceDocs;
        for (const m of (session.messages || [])) { if (m.role === 'assistant' && m.context_documents?.length) lastSourceDocs = m.context_documents; }
        this.setState({ messages: session.messages || [], lastSourceDocs }, this.scrollThread);
        this.toast('Draft generated!', 'success');
        await this.loadSessions();
      }
    } catch (e) {
      this.setState(s => ({
        messages: [...s.messages.filter(m => !m.thinking), { role: 'assistant', content: `Error: ${e.message}`, id: 'e-' + Date.now() }],
      }), this.scrollThread);
      this.toast(`Generation failed: ${e.message}`, 'error');
    } finally {
      this.setState({ isGenerating: false });
    }
  }

  async pollDraftResult(jobId) {
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000));
      try {
        const jobData = await CCM.jobs.get(jobId);
        const job = jobData.job || jobData;
        if (job.status === 'completed') {
          const draftsRes = await CCM.drafts.forLetter(this.state.currentLetterId);
          const drafts = (draftsRes.drafts || []).sort((a, b) => (b.version || 0) - (a.version || 0));
          return drafts[0] || null;
        }
        if (job.status === 'failed') throw new Error(job.error_message || 'Job failed');
      } catch (e) { if (e.message !== 'Job failed') throw e; }
    }
    throw new Error('Timed out waiting for draft');
  }

  // ── Message actions ───────────────────────────────────────
  regenerateFromMessage = async (idx) => {
    if (this.state.isGenerating) return;
    let userText = 'Regenerate with improvements.';
    for (let i = idx - 1; i >= 0; i--) { if (this.state.messages[i].role === 'user') { userText = this.state.messages[i].content; break; } }
    await this.sendAndGenerate(userText);
  };

  copyMessage = (content) => {
    navigator.clipboard.writeText(content || '')
      .then(() => this.toast('Copied to clipboard', 'success'))
      .catch(() => this.toast('Copy failed', 'error'));
  };

  approveDraft = async (draftId, idx) => {
    if (!draftId) { this.toast('No draft ID found', 'warning'); return; }
    try {
      await CCM.review.approve(draftId);
      this.toast('Draft approved!', 'success');
      this.setState(s => {
        const messages = [...s.messages];
        if (messages[idx]) messages[idx] = { ...messages[idx], draft_status: 'approved' };
        return { messages };
      });
    } catch (e) { this.toast(`Approval failed: ${e.message}`, 'error'); }
  };

  togglePin = async (sessionId, e) => {
    e.stopPropagation();
    try { await CCM.draftingSessions.togglePin(sessionId); await this.loadSessions(); }
    catch (err) { this.toast(`Failed to pin: ${err.message}`, 'error'); }
  };

  deleteSession = (sessionId, e) => {
    e.stopPropagation();
    this.setState({ deleteDialogOpen: true, deleteSessionId: sessionId });
  };

  confirmDeleteSession = async () => {
    const { deleteSessionId } = this.state;
    this.setState({ deleteDialogOpen: false, deleteSessionId: null });
    try {
      await CCM.draftingSessions.delete(deleteSessionId);
      if (this.state.currentSessionId === deleteSessionId) this.closeSession();
      await this.loadSessions();
      this.toast('Draft deleted', 'success');
    } catch (err) { this.toast(`Delete failed: ${err.message}`, 'error'); }
  };

  toggleSourcesPanel = () => this.setState(s => ({ sourcesOpen: !s.sourcesOpen }));

  autoResize = (e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px'; };

  // ── Rendering helpers ─────────────────────────────────────
  renderDraftText(text) {
    if (!text) return <em style={{ color: 'var(--text-tertiary)' }}>No content</em>;
    return text.split('\n').map((p, i) => p.trim() ? <p key={i}>{p}</p> : <br key={i} />);
  }

  groupedSessions() {
    const { sessions } = this.state;
    const pinned = sessions.filter(s => s.is_pinned);
    const recents = sessions.filter(s => !s.is_pinned);
    const groups = {};
    for (const s of recents) { const g = s.group || 'Older'; (groups[g] = groups[g] || []).push(s); }
    const order = ['Today', 'Previous 7 days', 'Older'];
    const out = [];
    if (pinned.length) out.push({ label: 'Pinned', items: pinned });
    for (const g of order) { if (groups[g]?.length) out.push({ label: g, items: groups[g] }); }
    return out;
  }

  renderSessionItem(s) {
    const isActive = s.id === this.state.currentSessionId;
    return (
      <div key={s.id} className={`dsb-session-item ${isActive ? 'active' : ''} ${s.is_pinned ? 'pinned' : ''}`}
        onClick={() => this.openSession(s.id)}>
        <div className="dsi-content">
          <div className="dsi-title" title={s.title || 'Draft'}>{s.title || 'Draft'}</div>
          <div className="dsi-preview">{s.preview || ''}</div>
        </div>
        <div className="dsi-actions">
          <button className="dsi-action-btn" onClick={(e) => this.togglePin(s.id, e)} title={s.is_pinned ? 'Unpin' : 'Pin'}>
            <i className={`ti ${s.is_pinned ? 'ti-pin-filled' : 'ti-pin'}`} />
          </button>
          <button className="dsi-action-btn dsi-delete-btn" onClick={(e) => this.deleteSession(s.id, e)} title="Delete">
            <i className="ti ti-trash" />
          </button>
        </div>
      </div>
    );
  }

  renderMessage(msg, idx) {
    const role = msg.role;
    if (msg.thinking) {
      return (
        <div className="drafting-message assistant thinking" key={msg.id}>
          <div className="dm-avatar"><i className="ti ti-robot" /></div>
          <div className="dm-body">
            <div className="typing-indicator"><span /><span /><span /></div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Generating draft…</div>
          </div>
        </div>
      );
    }
    const contextDocs = msg.context_documents || [];
    const approved = msg.draft_status === 'approved';
    return (
      <div className={`drafting-message ${role}`} key={msg.id || idx}>
        <div className="dm-avatar">{role === 'user' ? <i className="ti ti-user" /> : <i className="ti ti-robot" />}</div>
        <div className="dm-body">
          {msg.draft_version ? <div className="dm-version-badge">v{msg.draft_version} · {(msg.draft_status || 'draft').replace('_', ' ')}</div> : null}
          <div className={`dm-content ${role === 'assistant' ? 'dm-draft-text' : ''}`}>
            {role === 'user' ? <p>{msg.content}</p> : this.renderDraftText(msg.content)}
          </div>
          {role === 'assistant' && (
            <div className="dm-actions">
              <button className="dm-action" onClick={() => this.regenerateFromMessage(idx)} title="Regenerate"><i className="ti ti-refresh" /> Regenerate</button>
              <button className="dm-action" onClick={() => this.copyMessage(msg.content)} title="Copy"><i className="ti ti-copy" /> Copy</button>
              {approved
                ? <span className="dm-approved-badge"><i className="ti ti-check" /> Approved</span>
                : <button className="dm-action dm-approve-btn" onClick={() => this.approveDraft(msg.draft_response_id, idx)} title="Approve"><i className="ti ti-check" /> Approve</button>}
              {contextDocs.length ? (
                <button className="dm-action" onClick={() => this.setState({ lastSourceDocs: contextDocs, sourcesOpen: true })} title="Sources">
                  <i className="ti ti-books" /> {contextDocs.length} source{contextDocs.length !== 1 ? 's' : ''}
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    );
  }

  render() {
    const {
      sidebarCollapsed, templates, letters, projects, messages, activeView,
      currentLetterData, currentProjectData, emptyInput, activeInput, searchTerm,
      pickerOpen, pickerTab, pickerProjectId, pickerSearch, pickerUploadProjectId,
      uploadStatus, sourcesOpen, lastSourceDocs, profile,
    } = this.state;

    const name = profile?.name || profile?.email || 'User';
    const initials = name.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase();
    const groups = this.groupedSessions();

    const pickerLetters = letters.filter(l => {
      const mq = !pickerSearch || (l.filename || '').toLowerCase().includes(pickerSearch.toLowerCase());
      const mp = !pickerProjectId || l.project_id === pickerProjectId;
      return mq && mp;
    });

    return (
      <div className="ccm-scope">
        <div className={`drafting-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          {/* Sidebar */}
          <aside className={`drafting-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
            <div className="drafting-sidebar-inner">
              <div className="dsb-top">
                <button className="sidebar-toggle-btn" onClick={() => this.setState(s => ({ sidebarCollapsed: !s.sidebarCollapsed }))} title="Collapse sidebar">
                  <i className={`ti ${sidebarCollapsed ? 'ti-layout-sidebar-left-expand' : 'ti-layout-sidebar-left-collapse'}`} />
                </button>
                <button className="new-draft-btn" onClick={this.startNewDraft}>
                  <i className="ti ti-edit" /><span className="dsb-label">New Draft</span>
                </button>
              </div>

              <div className="dsb-search-wrap dsb-label-item">
                <div className="dsb-search">
                  <i className="ti ti-search" />
                  <input type="text" placeholder="Search drafts…" value={searchTerm} onChange={(e) => this.onSearch(e.target.value)} />
                </div>
              </div>

              <div className="dsb-session-list">
                {!groups.length ? (
                  <div className="dsb-empty"><i className="ti ti-messages-off" /><span>No drafts yet</span></div>
                ) : groups.map(g => (
                  <React.Fragment key={g.label}>
                    <div className="dsb-group-label dsb-label">{g.label}</div>
                    {g.items.map(s => this.renderSessionItem(s))}
                  </React.Fragment>
                ))}
              </div>

              <div className="dsb-profile dsb-label-item">
                <div className="dsb-profile-avatar">{initials}</div>
                <div className="dsb-profile-info dsb-label">
                  <div className="dsb-profile-name">{name}</div>
                  <div className="dsb-profile-role">{(profile?.role || '').replace(/^\w/, c => c.toUpperCase())}</div>
                </div>
              </div>
            </div>
          </aside>

          {/* Main */}
          <main className="drafting-main">
            {!activeView ? (
              <div className="drafting-empty">
                <div className="drafting-empty-inner">
                  <div className="drafting-empty-logo"><i className="ti ti-writing" /></div>
                  <h2 className="drafting-empty-greeting">What would you like to draft?</h2>
                  <p className="drafting-empty-sub">Select a letter and describe what to write — or click a template below.</p>

                  <div className="drafting-empty-composer">
                    <div className="dec-inner">
                      <button className="dec-attach-btn" onClick={this.openLetterPicker} title="Attach letter"><i className="ti ti-plus" /></button>
                      <textarea className="dec-textarea" placeholder="Ask anything…" rows="1" value={emptyInput}
                        onChange={(e) => { this.setState({ emptyInput: e.target.value }); this.autoResize(e); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendFromEmpty(); } }} />
                      <button className="dec-send-btn" onClick={this.sendFromEmpty} title="Send"><i className="ti ti-arrow-up" /></button>
                    </div>
                    <div className="dec-context-hint">
                      {currentLetterData
                        ? <span><i className="ti ti-file-text" style={{ color: 'var(--accent)' }} /> <strong>{currentLetterData.filename || 'Letter'}</strong> selected</span>
                        : <span>No letter selected — click <strong>+</strong> to attach one</span>}
                    </div>
                  </div>

                  <div className="drafting-template-chips">
                    {templates.map((t, i) => (
                      <button className="drafting-chip" key={i} onClick={() => this.useTemplate(t.prompt_text)}>
                        <i className={`ti ${t.icon || 'ti-sparkles'}`} /> {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="drafting-active">
                <div className="drafting-context-bar">
                  <div className="dcb-left">
                    <i className="ti ti-file-text" />
                    <span className="dcb-letter">{currentLetterData?.filename || '—'}</span>
                    <span className="dcb-sep">·</span>
                    <i className="ti ti-folder" />
                    <span className="dcb-project">{currentProjectData?.name || '—'}</span>
                  </div>
                  <div className="dcb-right">
                    {lastSourceDocs.length ? (
                      <button className="dcb-sources-btn" onClick={this.toggleSourcesPanel}>
                        <i className="ti ti-books" /> <span>{lastSourceDocs.length} source{lastSourceDocs.length !== 1 ? 's' : ''}</span>
                      </button>
                    ) : null}
                    <button className="dcb-close-btn" onClick={this.closeSession} title="Close session"><i className="ti ti-x" /></button>
                  </div>
                </div>

                <div className="drafting-thread" ref={this.threadRef}>
                  {!messages.length ? (
                    <div className="drafting-thread-empty"><i className="ti ti-sparkles" /><p>Send a message to start drafting</p></div>
                  ) : messages.map((m, i) => this.renderMessage(m, i))}
                </div>

                {sourcesOpen && (
                  <div className="drafting-sources-panel">
                    <div className="dsp-header">
                      <span><i className="ti ti-books" /> Source Documents</span>
                      <button onClick={this.toggleSourcesPanel}><i className="ti ti-x" /></button>
                    </div>
                    <div className="dsp-body">
                      {!lastSourceDocs.length ? (
                        <div className="dsb-empty"><i className="ti ti-books-off" /> No source documents</div>
                      ) : lastSourceDocs.map((d, i) => (
                        <div className="dsp-source-item" key={i}>
                          <i className="ti ti-file-text" />
                          <div>
                            <div className="dsp-source-name">{d.source || 'Document'}</div>
                            <div className="dsp-source-meta">{d.similarity != null ? `Relevance: ${(d.similarity * 100).toFixed(1)}%` : ''}</div>
                            {d.chunk_text ? <div className="dsp-source-preview">{d.chunk_text.substring(0, 150)}…</div> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="drafting-composer">
                  <div className="dc-wrapper">
                    <button className="dc-attach-btn" onClick={this.openLetterPicker} title="Switch letter"><i className="ti ti-plus" /></button>
                    <textarea className="dc-textarea" placeholder="Refine the draft, or ask for another…" rows="1" value={activeInput}
                      onChange={(e) => { this.setState({ activeInput: e.target.value }); this.autoResize(e); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); } }} />
                    <button className="dc-send-btn" onClick={this.sendMessage} title="Send"><i className="ti ti-arrow-up" /></button>
                  </div>
                  <div className="dc-footer">
                    <span className="text-xs text-tertiary">{currentLetterData ? `Letter: ${currentLetterData.filename || 'selected'}` : 'No letter selected'}</span>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Letter picker modal */}
        {pickerOpen && (
          <div className="lp-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) this.closeLetterPicker(); }}>
            <div className="lp-modal">
              <div className="lp-modal-header">
                <span><i className="ti ti-file-search" /> Select Letter & Project</span>
                <button onClick={this.closeLetterPicker}><i className="ti ti-x" /></button>
              </div>
              <div className="lp-modal-body" style={{ paddingTop: 10 }}>
                <div className="cat-tabs" style={{ marginBottom: 15, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                  <button className={`cat-tab ${pickerTab === 'select' ? 'active' : ''}`} onClick={() => this.setState({ pickerTab: 'select' })}>Select Existing</button>
                  <button className={`cat-tab ${pickerTab === 'upload' ? 'active' : ''}`} onClick={() => this.setState({ pickerTab: 'upload' })}>Upload New</button>
                </div>

                {pickerTab === 'select' ? (
                  <div>
                    <div className="lp-field">
                      <label>Project</label>
                      <select className="filter-select" value={pickerProjectId} onChange={(e) => this.setState({ pickerProjectId: e.target.value })}>
                        <option value="">All Projects</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="lp-field" style={{ marginTop: 10 }}>
                      <label>Search letters</label>
                      <input type="text" className="form-input" placeholder="Filter by filename…" value={pickerSearch} onChange={(e) => this.setState({ pickerSearch: e.target.value })} />
                    </div>
                    <div className="lp-letter-list" style={{ marginTop: 10 }}>
                      {!pickerLetters.length ? (
                        <div className="dsb-empty"><i className="ti ti-mail-off" /> No letters found</div>
                      ) : pickerLetters.map(l => {
                        const sel = l.id === this.state.currentLetterId;
                        return (
                          <div key={l.id} className={`lp-letter-item ${sel ? 'selected' : ''}`} onClick={() => this.selectLetter(l.id)}>
                            <div className="lp-letter-icon"><i className="ti ti-file-text" /></div>
                            <div className="lp-letter-info">
                              <div className="lp-letter-name">{l.filename || 'Letter'}</div>
                              <div className="lp-letter-meta">
                                <span className={`status-pill ${l.status}`} style={{ fontSize: 9 }}>{(l.status || '').replace('_', ' ')}</span>
                                {l.category ? <span className="text-xs text-tertiary">{l.category.replace(/_/g, ' ')}</span> : null}
                              </div>
                            </div>
                            {sel ? <i className="ti ti-check lp-check" /> : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="lp-field">
                      <label>Project Scope</label>
                      <select className="filter-select" style={{ width: '100%' }} value={pickerUploadProjectId} onChange={(e) => this.setState({ pickerUploadProjectId: e.target.value })}>
                        <option value="">All Projects / Global</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="upload-zone" style={{ marginTop: 15 }} onClick={() => this.fileInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); this.onPickerFile(e.dataTransfer.files[0]); }}>
                      <div className="upload-zone-icon"><i className="ti ti-mail" /></div>
                      <div className="upload-zone-title">Drop your letter here, or click to browse</div>
                      <div className="upload-zone-hint">PDF, DOCX, JPG, PNG · Max 20 MB</div>
                      <input ref={this.fileInputRef} type="file" accept=".pdf,.docx,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={(e) => this.onPickerFile(e.target.files[0])} />
                    </div>
                    {uploadStatus && (
                      <div style={{ marginTop: 15 }}>
                        <div className={uploadStatus.type === 'error' ? 'upload-error' : 'upload-success'}>
                          <i className={`ti ${uploadStatus.type === 'error' ? 'ti-alert-circle' : uploadStatus.type === 'loading' ? 'ti-loader' : 'ti-check-circle'}`} /> {uploadStatus.msg}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <Snackbar
          open={this.state.snackOpen}
          autoHideDuration={4000}
          onClose={() => this.setState({ snackOpen: false })}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert
            onClose={() => this.setState({ snackOpen: false })}
            severity={this.state.snackSeverity}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {this.state.snackMsg}
          </Alert>
        </Snackbar>

        <Dialog
          open={this.state.deleteDialogOpen}
          onClose={() => this.setState({ deleteDialogOpen: false, deleteSessionId: null })}
        >
          <DialogTitle>Delete this drafting conversation?</DialogTitle>
          <DialogContent>This cannot be undone.</DialogContent>
          <DialogActions>
            <Button onClick={() => this.setState({ deleteDialogOpen: false, deleteSessionId: null })}>Cancel</Button>
            <Button color="error" variant="contained" onClick={this.confirmDeleteSession}>Delete</Button>
          </DialogActions>
        </Dialog>
      </div>
    );
  }
}

export default AiDrafting;
