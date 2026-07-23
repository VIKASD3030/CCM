/**
 * AiDrafting — React port of the original vanilla CCM AI Drafting panel
 * (frontend/js/drafting.js). ChatGPT-style drafting with full session
 * persistence via the /api/drafting-sessions API. Behavior preserved 1:1.
 */
import React from 'react';
import {
  Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Box, Typography, TextField, IconButton, Avatar, Chip, Tooltip, Drawer, Divider,
  CircularProgress, Backdrop, Stack, InputAdornment, Tab, Tabs, LinearProgress,
} from '@mui/material';
import {
  Add as AddIcon, Search as SearchIcon, Send as SendIcon, AttachFile as AttachIcon,
  ContentCopy as CopyIcon, Refresh as RefreshIcon, Check as CheckIcon, Close as CloseIcon,
  MoreVert as MoreIcon, AutoAwesome as SparkleIcon, PushPin as PinIcon, Delete as DeleteIcon,
  Description as DocIcon, Folder as FolderIcon, SmartToy as RobotIcon, Person as PersonIcon,
  MenuBook as BookIcon, Upload as UploadIcon, ExpandMore as ExpandIcon,
  ChevronLeft as CollapseIcon, ChevronRight as ExpandSidebarIcon,
  Menu as MenuIcon,
} from '@mui/icons-material';
import CCM from '../ccm-api';
import { AppBreadcrumbs } from '../../components/ui';
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
      activeView: false,
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
    if (!text) return <Typography sx={{ color: '#9CA3AF', fontStyle: 'italic' }}>No content</Typography>;
    return text.split('\n').map((p, i) => p.trim()
      ? <Typography key={i} sx={{ fontSize: 14, lineHeight: 1.7, color: '#374151', mb: 0.5 }}>{p}</Typography>
      : <Box key={i} sx={{ height: 8 }} />
    );
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
      <Box
        key={s.id}
        onClick={() => this.openSession(s.id)}
        sx={{
          display: 'flex', alignItems: 'center', px: 2, py: 1.25, mx: 1, mb: 0.25, borderRadius: '10px',
          cursor: 'pointer', position: 'relative', transition: 'all 0.15s ease',
          bgcolor: isActive ? '#EFF6FF' : 'transparent',
          borderLeft: isActive ? '3px solid #2563EB' : '3px solid transparent',
          '&:hover': { bgcolor: isActive ? '#EFF6FF' : '#F8FAFC' },
          '&:hover .session-actions': { opacity: 1 },
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.title || 'Draft'}>
            {s.title || 'Draft'}
          </Typography>
          <Typography sx={{ fontSize: 12, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mt: 0.25 }}>
            {s.preview || ''}
          </Typography>
        </Box>
        <Box className="session-actions" sx={{ display: 'flex', gap: 0.25, opacity: isActive ? 1 : 0, transition: 'opacity 0.15s' }}>
          <IconButton size="small" onClick={(e) => this.togglePin(s.id, e)} title={s.is_pinned ? 'Unpin' : 'Pin'}
            sx={{ color: s.is_pinned ? '#2563EB' : '#9CA3AF', '&:hover': { color: '#2563EB', bgcolor: '#EFF6FF' }, p: 0.5 }}>
            <PinIcon sx={{ fontSize: 15 }} />
          </IconButton>
          <IconButton size="small" onClick={(e) => this.deleteSession(s.id, e)} title="Delete"
            sx={{ color: '#9CA3AF', '&:hover': { color: '#EF4444', bgcolor: '#FEF2F2' }, p: 0.5 }}>
            <DeleteIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Box>
      </Box>
    );
  }

  renderMessage(msg, idx) {
    const role = msg.role;
    if (msg.thinking) {
      return (
        <Box key={msg.id} sx={{ display: 'flex', gap: 1.5, mb: 3, alignItems: 'flex-start' }}>
          <Avatar sx={{ width: 32, height: 32, bgcolor: '#F3F4F6', color: '#6B7280', mt: 0.25 }}>
            <RobotIcon sx={{ fontSize: 16 }} />
          </Avatar>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', py: 1.5, px: 2, bgcolor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '18px 18px 18px 4px', minWidth: 80 }}>
              {[0, 1, 2].map(i => (
                <Box key={i} sx={{
                  width: 7, height: 7, borderRadius: '50%', bgcolor: '#9CA3AF',
                  animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
                  '@keyframes pulse': {
                    '0%, 80%, 100%': { opacity: 0.3, transform: 'scale(0.85)' },
                    '40%': { opacity: 1, transform: 'scale(1.1)' },
                  },
                }} />
              ))}
            </Box>
            <Typography sx={{ fontSize: 11, color: '#9CA3AF', ml: 1 }}>Generating draft…</Typography>
          </Box>
        </Box>
      );
    }
    const contextDocs = msg.context_documents || [];
    const approved = msg.draft_status === 'approved';
    const isUser = role === 'user';

    return (
      <Box key={msg.id || idx} sx={{ display: 'flex', gap: 1.5, mb: 3, alignItems: 'flex-start', flexDirection: isUser ? 'row-reverse' : 'row' }}>
        <Avatar sx={{
          width: 32, height: 32, mt: 0.25,
          bgcolor: isUser ? '#2563EB' : '#F3F4F6',
          color: isUser ? '#FFFFFF' : '#6B7280',
        }}>
          {isUser ? <PersonIcon sx={{ fontSize: 16 }} /> : <RobotIcon sx={{ fontSize: 16 }} />}
        </Avatar>
        <Box sx={{ maxWidth: '75%', minWidth: 60 }}>
          {msg.draft_version && (
            <Chip
              size="small"
              label={`v${msg.draft_version} · ${(msg.draft_status || 'draft').replace('_', ' ')}`}
              sx={{ height: 22, fontSize: 11, mb: 0.75, bgcolor: isUser ? 'rgba(255,255,255,0.2)' : '#F3F4F6', color: isUser ? '#fff' : '#6B7280' }}
            />
          )}
          <Box sx={{
            px: 2.5, py: isUser ? 1.5 : 2,
            bgcolor: isUser ? '#2563EB' : '#FFFFFF',
            color: isUser ? '#fff' : '#374151',
            border: isUser ? 'none' : '1px solid #E5E7EB',
            borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
            boxShadow: isUser ? '0 1px 2px rgba(37,99,235,0.15)' : '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            {isUser
              ? <Typography sx={{ fontSize: 14, lineHeight: 1.6 }}>{msg.content}</Typography>
              : this.renderDraftText(msg.content)
            }
          </Box>
          {!isUser && (
            <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
              <Tooltip title="Regenerate">
                <IconButton size="small" onClick={() => this.regenerateFromMessage(idx)} sx={{ color: '#6B7280', '&:hover': { color: '#2563EB', bgcolor: '#EFF6FF' } }}>
                  <RefreshIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Copy">
                <IconButton size="small" onClick={() => this.copyMessage(msg.content)} sx={{ color: '#6B7280', '&:hover': { color: '#2563EB', bgcolor: '#EFF6FF' } }}>
                  <CopyIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              {approved
                ? (
                  <Chip
                    size="small"
                    icon={<CheckIcon sx={{ fontSize: 13, color: '#16A34A !important' }} />}
                    label="Approved"
                    sx={{ height: 24, fontSize: 11, bgcolor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}
                  />
                )
                : (
                  <Tooltip title="Approve">
                    <IconButton size="small" onClick={() => this.approveDraft(msg.draft_response_id, idx)} sx={{ color: '#6B7280', '&:hover': { color: '#16A34A', bgcolor: '#F0FDF4' } }}>
                      <CheckIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                )
              }
              {contextDocs.length ? (
                <Tooltip title={`${contextDocs.length} source${contextDocs.length !== 1 ? 's' : ''}`}>
                  <IconButton size="small" onClick={() => this.setState({ lastSourceDocs: contextDocs, sourcesOpen: true })} sx={{ color: '#6B7280', '&:hover': { color: '#2563EB', bgcolor: '#EFF6FF' } }}>
                    <BookIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              ) : null}
            </Stack>
          )}
        </Box>
      </Box>
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

    const SIDEBAR_W = sidebarCollapsed ? 64 : 280;

    return (
      <Box className="ccm-scope" sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', bgcolor: '#F8FAFC', overflow: 'hidden' }}>
        <Box sx={{ px: 3, pt: 2, pb: 0 }}>
          <AppBreadcrumbs />
        </Box>
        <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* ─── Sidebar ─── */}
          <Box sx={{
            width: SIDEBAR_W, flexShrink: 0, display: 'flex', flexDirection: 'column',
            bgcolor: '#FFFFFF', borderRight: '1px solid #E5E7EB',
            transition: 'width 0.2s ease', overflow: 'hidden',
          }}>
            {/* Sidebar top */}
            <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid #F3F4F6' }}>
              <IconButton size="small" onClick={() => this.setState(s => ({ sidebarCollapsed: !s.sidebarCollapsed }))}
                sx={{ color: '#6B7280', '&:hover': { bgcolor: '#F3F4F6' } }}>
                {sidebarCollapsed ? <ExpandSidebarIcon sx={{ fontSize: 20 }} /> : <CollapseIcon sx={{ fontSize: 20 }} />}
              </IconButton>
              {!sidebarCollapsed && (
                <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon sx={{ fontSize: 18 }} />}
                    onClick={this.startNewDraft}
                    sx={{
                      textTransform: 'none', fontWeight: 600, fontSize: 13, borderRadius: '10px',
                      bgcolor: '#2563EB', boxShadow: 'none',
                      '&:hover': { bgcolor: '#1D4ED8', boxShadow: 'none' },
                    }}
                  >
                    New Draft
                  </Button>
                </Box>
              )}
            </Box>

            {/* Search */}
            {!sidebarCollapsed && (
              <Box sx={{ px: 1.5, pt: 1.5, pb: 0.5 }}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Search drafts…"
                  value={searchTerm}
                  onChange={(e) => this.onSearch(e.target.value)}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: '#9CA3AF' }} /></InputAdornment>,
                    sx: {
                      borderRadius: '10px', fontSize: 13, bgcolor: '#F9FAFB',
                      '& fieldset': { borderColor: '#E5E7EB' },
                      '&:hover fieldset': { borderColor: '#D1D5DB' },
                      '&.Mui-focused fieldset': { borderColor: '#2563EB', borderWidth: 1 },
                    },
                  }}
                />
              </Box>
            )}

            {/* Session list */}
            <Box sx={{ flex: 1, overflow: 'auto', py: 1 }}>
              {sidebarCollapsed ? (
                /* Collapsed icons */
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, px: 0.5 }}>
                  {sessions.slice(0, 20).map(s => {
                    const isActive = s.id === this.state.currentSessionId;
                    return (
                      <Tooltip key={s.id} title={s.title || 'Draft'} placement="right">
                        <IconButton size="small" onClick={() => this.openSession(s.id)} sx={{
                          width: 40, height: 40, borderRadius: '10px',
                          bgcolor: isActive ? '#EFF6FF' : 'transparent',
                          color: isActive ? '#2563EB' : '#6B7280',
                          '&:hover': { bgcolor: isActive ? '#EFF6FF' : '#F3F4F6' },
                        }}>
                          <DocIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    );
                  })}
                </Box>
              ) : (
                !groups.length ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 6, color: '#9CA3AF' }}>
                    <DocIcon sx={{ fontSize: 32, mb: 1, opacity: 0.4 }} />
                    <Typography sx={{ fontSize: 13 }}>No drafts yet</Typography>
                  </Box>
                ) : groups.map(g => (
                  <React.Fragment key={g.label}>
                    <Typography sx={{ px: 3, pt: 2, pb: 0.75, fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {g.label}
                    </Typography>
                    {g.items.map(s => this.renderSessionItem(s))}
                  </React.Fragment>
                ))
              )}
            </Box>

            {/* Profile */}
            {!sidebarCollapsed && (
              <Box sx={{ p: 1.5, borderTop: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <Avatar sx={{ width: 36, height: 36, bgcolor: '#EEF2FF', color: '#4F46E5', fontSize: 13, fontWeight: 700 }}>
                  {initials}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</Typography>
                  <Typography sx={{ fontSize: 11, color: '#9CA3AF', textTransform: 'capitalize' }}>{(profile?.role || '').replace(/^\w/, c => c.toUpperCase())}</Typography>
                </Box>
              </Box>
            )}
          </Box>

          {/* ─── Main area ─── */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
            {!activeView ? (
              /* ─── Empty state ─── */
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
                <Box sx={{ maxWidth: 600, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Box sx={{
                    width: 64, height: 64, borderRadius: '18px',
                    background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 3,
                    boxShadow: '0 8px 24px rgba(37,99,235,0.25)',
                  }}>
                    <SparkleIcon sx={{ fontSize: 32, color: '#FFFFFF' }} />
                  </Box>
                  <Typography variant="h4" sx={{ fontSize: 24, fontWeight: 700, color: '#111827', mb: 1 }}>
                    What would you like to draft?
                  </Typography>
                  <Typography sx={{ color: '#6B7280', mb: 4, lineHeight: 1.6 }}>
                    Select a letter and describe what to write — or click a template below.
                  </Typography>

                  {/* Composer */}
                  <Box sx={{
                    width: '100%', bgcolor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)', overflow: 'hidden',
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-end', px: 1, py: 1 }}>
                      <IconButton onClick={this.openLetterPicker} title="Attach letter"
                        sx={{ color: '#9CA3AF', '&:hover': { color: '#2563EB', bgcolor: '#EFF6FF' }, mr: 0.5 }}>
                        <AttachIcon sx={{ fontSize: 20 }} />
                      </IconButton>
                      <TextField
                        multiline
                        maxRows={4}
                        fullWidth
                        placeholder="Ask anything…"
                        value={emptyInput}
                        onChange={(e) => { this.setState({ emptyInput: e.target.value }); this.autoResize(e); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendFromEmpty(); } }}
                        variant="standard"
                        InputProps={{
                          disableUnderline: true,
                          sx: { fontSize: 14, py: 0.75, color: '#111827', '& textarea': { '&::placeholder': { color: '#9CA3AF', opacity: 1 } } },
                        }}
                      />
                      <IconButton onClick={this.sendFromEmpty} title="Send" sx={{
                        bgcolor: emptyInput.trim() ? '#2563EB' : '#E5E7EB',
                        color: emptyInput.trim() ? '#FFFFFF' : '#9CA3AF',
                        width: 36, height: 36, ml: 0.5,
                        '&:hover': { bgcolor: emptyInput.trim() ? '#1D4ED8' : '#D1D5DB' },
                      }}>
                        <SendIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Box>
                    <Box sx={{ px: 2, pb: 1.5, pt: 0 }}>
                      <Typography sx={{ fontSize: 12, color: '#9CA3AF' }}>
                        {currentLetterData
                          ? <><DocIcon sx={{ fontSize: 14, color: '#2563EB', verticalAlign: 'middle', mr: 0.5 }} /><strong style={{ color: '#374151' }}>{currentLetterData.filename || 'Letter'}</strong> selected</>
                          : 'No letter selected — click + to attach one'}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Template chips */}
                  {templates.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 1, mt: 3, flexWrap: 'wrap', justifyContent: 'center' }}>
                      {templates.map((t, i) => (
                        <Chip
                          key={i}
                          variant="outlined"
                          icon={<SparkleIcon sx={{ fontSize: 14, color: '#7C3AED !important' }} />}
                          label={t.label}
                          onClick={() => this.useTemplate(t.prompt_text)}
                          sx={{
                            borderRadius: '10px', borderColor: '#E5E7EB', color: '#374151', fontSize: 13,
                            px: 0.5,
                            '&:hover': { bgcolor: '#F5F3FF', borderColor: '#7C3AED', color: '#7C3AED' },
                          }}
                        />
                      ))}
                    </Box>
                  )}
                </Box>
              </Box>
            ) : (
              /* ─── Active view ─── */
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Context bar */}
                <Box sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  px: 2.5, py: 1, bgcolor: '#FFFFFF', borderBottom: '1px solid #E5E7EB', minHeight: 48,
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
                    <DocIcon sx={{ fontSize: 18, color: '#2563EB', flexShrink: 0 }} />
                    <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {currentLetterData?.filename || '—'}
                    </Typography>
                    {currentProjectData && (
                      <>
                        <Typography sx={{ color: '#D1D5DB', mx: 0.5 }}>·</Typography>
                        <FolderIcon sx={{ fontSize: 14, color: '#9CA3AF', flexShrink: 0 }} />
                        <Typography sx={{ fontSize: 12, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {currentProjectData?.name || '—'}
                        </Typography>
                      </>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                    {lastSourceDocs.length ? (
                      <Button
                        size="small"
                        startIcon={<BookIcon sx={{ fontSize: 16 }} />}
                        onClick={this.toggleSourcesPanel}
                        sx={{ textTransform: 'none', fontSize: 12, color: '#6B7280', borderRadius: '8px', px: 1.5,
                          '&:hover': { bgcolor: '#F3F4F6' } }}
                      >
                        {lastSourceDocs.length} source{lastSourceDocs.length !== 1 ? 's' : ''}
                      </Button>
                    ) : null}
                    <IconButton size="small" onClick={this.closeSession} title="Close session"
                      sx={{ color: '#9CA3AF', '&:hover': { color: '#EF4444', bgcolor: '#FEF2F2' } }}>
                      <CloseIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Box>
                </Box>

                {/* Thread */}
                <Box ref={this.threadRef} sx={{
                  flex: 1, overflow: 'auto', px: 3, py: 3,
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                }}>
                  <Box sx={{ width: '100%', maxWidth: 800 }}>
                    {!messages.length ? (
                      <Box sx={{ textAlign: 'center', py: 8 }}>
                        <SparkleIcon sx={{ fontSize: 40, color: '#D1D5DB', mb: 1.5 }} />
                        <Typography sx={{ color: '#9CA3AF', fontSize: 14 }}>Send a message to start drafting</Typography>
                      </Box>
                    ) : messages.map((m, i) => this.renderMessage(m, i))}
                  </Box>
                </Box>

                {/* Composer */}
                <Box sx={{ bgcolor: '#FFFFFF', borderTop: '1px solid #E5E7EB', px: 3, py: 2 }}>
                  <Box sx={{ maxWidth: 800, mx: 'auto' }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-end', bgcolor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '14px', px: 1, py: 0.75, '&:focus-within': { borderColor: '#2563EB', boxShadow: '0 0 0 3px rgba(37,99,235,0.08)' }, transition: 'all 0.15s ease' }}>
                      <IconButton onClick={this.openLetterPicker} title="Switch letter"
                        sx={{ color: '#9CA3AF', '&:hover': { color: '#2563EB', bgcolor: '#EFF6FF' }, mr: 0.5 }}>
                        <AttachIcon sx={{ fontSize: 20 }} />
                      </IconButton>
                      <TextField
                        multiline
                        maxRows={4}
                        fullWidth
                        placeholder="Refine the draft, or ask for another…"
                        value={activeInput}
                        onChange={(e) => { this.setState({ activeInput: e.target.value }); this.autoResize(e); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); } }}
                        variant="standard"
                        InputProps={{
                          disableUnderline: true,
                          sx: { fontSize: 14, py: 0.5, color: '#111827', '& textarea': { '&::placeholder': { color: '#9CA3AF', opacity: 1 } } },
                        }}
                      />
                      <IconButton onClick={this.sendMessage} title="Send" disabled={this.state.isGenerating} sx={{
                        bgcolor: activeInput.trim() ? '#2563EB' : '#E5E7EB',
                        color: activeInput.trim() ? '#FFFFFF' : '#9CA3AF',
                        width: 36, height: 36, ml: 0.5,
                        '&:hover': { bgcolor: activeInput.trim() ? '#1D4ED8' : '#D1D5DB' },
                        '&.Mui-disabled': { bgcolor: '#F3F4F6', color: '#D1D5DB' },
                      }}>
                        <SendIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Box>
                    <Typography sx={{ fontSize: 11, color: '#9CA3AF', mt: 0.75, ml: 1 }}>
                      {currentLetterData ? `Letter: ${currentLetterData.filename || 'selected'}` : 'No letter selected'}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            )}

            {/* ─── Sources Drawer ─── */}
            <Drawer
              anchor="right"
              open={sourcesOpen}
              onClose={this.toggleSourcesPanel}
              variant="temporary"
              PaperProps={{ sx: { width: 360, borderRadius: '16px 0 0 16px' } }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, py: 2, borderBottom: '1px solid #E5E7EB' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BookIcon sx={{ fontSize: 20, color: '#2563EB' }} />
                  <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>Source Documents</Typography>
                </Box>
                <IconButton size="small" onClick={this.toggleSourcesPanel} sx={{ color: '#6B7280', '&:hover': { bgcolor: '#F3F4F6' } }}>
                  <CloseIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Box>
              <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                {!lastSourceDocs.length ? (
                  <Box sx={{ textAlign: 'center', py: 6, color: '#9CA3AF' }}>
                    <BookIcon sx={{ fontSize: 36, mb: 1, opacity: 0.3 }} />
                    <Typography sx={{ fontSize: 13 }}>No source documents</Typography>
                  </Box>
                ) : lastSourceDocs.map((d, i) => (
                  <Box key={i} sx={{
                    display: 'flex', gap: 1.5, p: 1.5, mb: 1, borderRadius: '10px',
                    border: '1px solid #F3F4F6', '&:hover': { bgcolor: '#F9FAFB' }, transition: 'background 0.15s',
                  }}>
                    <DocIcon sx={{ fontSize: 20, color: '#2563EB', mt: 0.25, flexShrink: 0 }} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{d.source || 'Document'}</Typography>
                      {d.similarity != null && (
                        <Typography sx={{ fontSize: 11, color: '#9CA3AF', mt: 0.25 }}>
                          Relevance: {(d.similarity * 100).toFixed(1)}%
                        </Typography>
                      )}
                      {d.chunk_text && (
                        <Typography sx={{ fontSize: 12, color: '#6B7280', mt: 0.5, lineHeight: 1.5 }}>
                          {d.chunk_text.substring(0, 150)}…
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Drawer>
          </Box>
        </Box>

        {/* ─── Letter picker dialog ─── */}
        <Dialog
          open={pickerOpen}
          onClose={this.closeLetterPicker}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { borderRadius: '16px', overflow: 'hidden' } }}
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DocIcon sx={{ color: '#2563EB' }} />
              <Typography sx={{ fontWeight: 700, fontSize: 17 }}>Select Letter & Project</Typography>
            </Box>
            <IconButton size="small" onClick={this.closeLetterPicker} sx={{ color: '#6B7280' }}>
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </DialogTitle>

          <Tabs
            value={pickerTab === 'select' ? 0 : 1}
            onChange={(_, v) => this.setState({ pickerTab: v === 0 ? 'select' : 'upload' })}
            sx={{ px: 3, borderBottom: '1px solid #E5E7EB', '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: 13.5 } }}
          >
            <Tab label="Select Existing" />
            <Tab label="Upload New" />
          </Tabs>

          <DialogContent sx={{ pt: 2, pb: 2, minHeight: 320 }}>
            {pickerTab === 'select' ? (
              <Box>
                <TextField
                  select
                  size="small"
                  fullWidth
                  label="Project"
                  value={pickerProjectId}
                  onChange={(e) => this.setState({ pickerProjectId: e.target.value })}
                  SelectProps={{ native: true }}
                  sx={{ mb: 2, '& .MuiInputBase-root': { fontSize: 13.5, borderRadius: '10px' } }}
                >
                  <option value="">All Projects</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </TextField>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Filter by filename…"
                  value={pickerSearch}
                  onChange={(e) => this.setState({ pickerSearch: e.target.value })}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: '#9CA3AF' }} /></InputAdornment>,
                    sx: { fontSize: 13.5, borderRadius: '10px' },
                  }}
                  sx={{ mb: 2 }}
                />
                <Box sx={{ maxHeight: 340, overflow: 'auto' }}>
                  {!pickerLetters.length ? (
                    <Box sx={{ textAlign: 'center', py: 5, color: '#9CA3AF' }}>
                      <DocIcon sx={{ fontSize: 32, mb: 1, opacity: 0.3 }} />
                      <Typography sx={{ fontSize: 13 }}>No letters found</Typography>
                    </Box>
                  ) : pickerLetters.map(l => {
                    const sel = l.id === this.state.currentLetterId;
                    return (
                      <Box
                        key={l.id}
                        onClick={() => this.selectLetter(l.id)}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, mb: 0.5, borderRadius: '10px',
                          cursor: 'pointer', border: sel ? '1px solid #BFDBFE' : '1px solid transparent',
                          bgcolor: sel ? '#EFF6FF' : 'transparent',
                          '&:hover': { bgcolor: sel ? '#EFF6FF' : '#F9FAFB' },
                          transition: 'all 0.12s',
                        }}
                      >
                        <DocIcon sx={{ fontSize: 20, color: '#2563EB', flexShrink: 0 }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {l.filename || 'Letter'}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
                            <Chip size="small" label={(l.status || '').replace('_', ' ')}
                              sx={{ height: 18, fontSize: 10, textTransform: 'capitalize', bgcolor: '#F3F4F6', color: '#6B7280' }} />
                            {l.category && (
                              <Typography sx={{ fontSize: 11, color: '#9CA3AF' }}>{l.category.replace(/_/g, ' ')}</Typography>
                            )}
                          </Box>
                        </Box>
                        {sel && <CheckIcon sx={{ fontSize: 18, color: '#2563EB', flexShrink: 0 }} />}
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            ) : (
              <Box>
                <TextField
                  select
                  size="small"
                  fullWidth
                  label="Project Scope"
                  value={pickerUploadProjectId}
                  onChange={(e) => this.setState({ pickerUploadProjectId: e.target.value })}
                  SelectProps={{ native: true }}
                  sx={{ mb: 2, '& .MuiInputBase-root': { fontSize: 13.5, borderRadius: '10px' } }}
                >
                  <option value="">All Projects / Global</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </TextField>
                <Box
                  onClick={() => this.fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); this.onPickerFile(e.dataTransfer.files[0]); }}
                  sx={{
                    border: '2px dashed #D1D5DB', borderRadius: '14px', py: 5, textAlign: 'center',
                    cursor: 'pointer', transition: 'all 0.15s',
                    '&:hover': { borderColor: '#2563EB', bgcolor: '#F5F8FF' },
                  }}
                >
                  <UploadIcon sx={{ fontSize: 40, color: '#9CA3AF', mb: 1 }} />
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#374151', mb: 0.5 }}>
                    Drop your letter here, or click to browse
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: '#9CA3AF' }}>
                    PDF, DOCX, JPG, PNG · Max 20 MB
                  </Typography>
                  <input ref={this.fileInputRef} type="file" accept=".pdf,.docx,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={(e) => this.onPickerFile(e.target.files[0])} />
                </Box>
                {uploadStatus && (
                  <Box sx={{ mt: 2, p: 1.5, borderRadius: '10px', bgcolor: uploadStatus.type === 'error' ? '#FEF2F2' : uploadStatus.type === 'loading' ? '#F5F8FF' : '#F0FDF4', display: 'flex', alignItems: 'center', gap: 1 }}>
                    {uploadStatus.type === 'loading' && <CircularProgress size={18} sx={{ color: '#2563EB' }} />}
                    {uploadStatus.type === 'error' && <CloseIcon sx={{ fontSize: 18, color: '#EF4444' }} />}
                    {uploadStatus.type === 'success' && <CheckIcon sx={{ fontSize: 18, color: '#16A34A' }} />}
                    <Typography sx={{ fontSize: 13, color: uploadStatus.type === 'error' ? '#DC2626' : uploadStatus.type === 'loading' ? '#2563EB' : '#16A34A' }}>
                      {uploadStatus.msg}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </DialogContent>
        </Dialog>

        {/* ─── Snackbar ─── */}
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
            sx={{ width: '100%', borderRadius: '10px' }}
          >
            {this.state.snackMsg}
          </Alert>
        </Snackbar>

        {/* ─── Delete dialog ─── */}
        <Dialog
          open={this.state.deleteDialogOpen}
          onClose={() => this.setState({ deleteDialogOpen: false, deleteSessionId: null })}
          PaperProps={{ sx: { borderRadius: '16px', p: 1 } }}
        >
          <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Delete this drafting conversation?</DialogTitle>
          <DialogContent>
            <Typography sx={{ fontSize: 14, color: '#6B7280' }}>This cannot be undone.</Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => this.setState({ deleteDialogOpen: false, deleteSessionId: null })}
              sx={{ textTransform: 'none', borderRadius: '8px', color: '#6B7280' }}>
              Cancel
            </Button>
            <Button color="error" variant="contained" onClick={this.confirmDeleteSession}
              sx={{ textTransform: 'none', borderRadius: '8px', boxShadow: 'none', '&:hover': { boxShadow: 'none' } }}>
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }
}

export default AiDrafting;
