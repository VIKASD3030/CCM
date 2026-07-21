/**
 * Dashboard — React port of the original vanilla CCM dashboard (frontend/js/app.js).
 * Same data sources: review dashboard stats, knowledge stats, letters, project sync.
 */
import React from 'react';
import CCM from '../ccm-api';
import '../ccm.css';

const iconMetrics = [
  { key: 'total', icon: 'ti-inbox', color: '#534AB7', bg: '#EEEDFE', label: 'Total Letters' },
  { key: 'drafts', icon: 'ti-writing', color: '#3B82F6', bg: '#E6F1FB', label: 'Drafts Generated' },
  { key: 'pending', icon: 'ti-clock-hour-4', color: '#633806', bg: '#FAEEDA', label: 'Pending Review' },
  { key: 'kb', icon: 'ti-book-2', color: '#27500A', bg: '#EAF3DE', label: 'KB Documents' },
];

const statusMap = {
  received: 'received', classified: 'classified', drafted: 'drafted',
  approved: 'approved', sent: 'sent', rejected: 'rejected', pending_review: 'pending',
};

const activityIconMap = {
  uploaded: { icon: 'ti-upload', color: '#3B82F6', bg: '#E6F1FB' },
  draft: { icon: 'ti-writing', color: '#534AB7', bg: '#EEEDFE' },
  approved: { icon: 'ti-check', color: '#27500A', bg: '#EAF3DE' },
  received: { icon: 'ti-mail', color: '#633806', bg: '#FAEEDA' },
};

class Dashboard extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      error: false,
      projects: [],
      currentProjectId: '',
      metrics: { total: 0, drafts: 0, pending: 0, kb: 0 },
      pipeline: [],
      letters: [],
      sync: [],
      activity: [],
    };
  }

  componentDidMount() {
    this.loadAll();
  }

  async loadProjects() {
    try {
      const data = await CCM.projects.list();
      const projects = data.projects || [];
      this.setState({ projects });
      return projects;
    } catch {
      this.setState({ projects: [] });
      return [];
    }
  }

  loadAll = async () => {
    this.setState({ loading: true, error: false });
    const projects = await this.loadProjects();
    const { currentProjectId } = this.state;
    const isMasterProject = currentProjectId && String(currentProjectId).startsWith('master-');

    try {
      const statsPromise = isMasterProject
        ? Promise.resolve({ total_letters: 0, total_drafts: 0, pending_review: 0, letters_by_status: {}, drafts_by_status: {}, recent_activity: [] })
        : CCM.review.dashboardStats();
      const kbStatsPromise = isMasterProject
        ? Promise.resolve({ total_documents: 0 })
        : CCM.knowledge.stats();

      const [stats, kbStats] = await Promise.all([statsPromise, kbStatsPromise]);

      const metrics = {
        total: stats.total_letters || 0,
        drafts: stats.total_drafts || 0,
        pending: stats.pending_review || 0,
        kb: kbStats.total_documents || 0,
      };

      const pipeline = [
        { label: 'Received', count: stats.total_letters || 0 },
        { label: 'Classified', count: (stats.letters_by_status && stats.letters_by_status.classified) || 0 },
        { label: 'Drafted', count: stats.total_drafts || 0 },
        { label: 'Approved', count: (stats.drafts_by_status && stats.drafts_by_status.approved) || 0 },
        { label: 'Sent', count: (stats.letters_by_status && stats.letters_by_status.sent) || 0 },
      ];

      const lettersRes = isMasterProject
        ? { letters: [] }
        : await CCM.letters.list();
      const letters = (lettersRes.letters || []).slice(0, 5);

      let sync = [];
      if (projects.length) {
        const syncData = await Promise.all(projects.map(p => {
          if (String(p.id).startsWith('master-')) return Promise.resolve(null);
          return CCM.projects.stats(p.id).catch(() => null);
        }));
        sync = projects.map((p, i) => ({ project: p, stats: syncData[i] }));
      }

      const activity = (stats.recent_activity || []).slice(0, 5);

      this.setState({ loading: false, metrics, pipeline, letters, sync, activity });
    } catch (e) {
      console.error('Dashboard error:', e);
      this.setState({ loading: false, error: true });
    }
  };

  setProject = (e) => {
    const projectId = e.target.value;
    this.setState({ currentProjectId: projectId }, () => this.loadAll());
  };

  fmtDate(d) {
    return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
  }

  render() {
    const { loading, error, projects, currentProjectId, metrics, pipeline, letters, sync, activity } = this.state;

    if (error) {
      return (
        <div className="ccm-scope">
          <div className="empty-state" style={{ padding: 48 }}>
            <div className="empty-state-icon"><i className="ti ti-alert-circle" /></div>
            <div className="empty-state-title">Failed to load dashboard</div>
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={this.loadAll}>Retry</button>
          </div>
        </div>
      );
    }

    return (
      <div className="ccm-scope ccm-dashboard">
        <div className="dash-toolbar">
          <div className="project-selector">
            <i className="ti ti-folder" />
            <select className="filter-select" value={currentProjectId} onChange={this.setProject}>
              <option value="">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        {/* Metrics */}
        <div className="stat-row">
          {iconMetrics.map(m => (
            <div className="stat-card" key={m.key}>
              <div className="stat-icon" style={{ background: m.bg, color: m.color }}>
                <i className={`ti ${m.icon}`} />
              </div>
              <div className="stat-body">
                <div className="stat-label">{m.label}</div>
                <div className="stat-value">{loading ? '…' : metrics[m.key]}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Pipeline */}
        <div className="pipeline-card">
          <div className="card-header" style={{ marginBottom: 0, borderBottom: 'none' }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Pipeline</span>
          </div>
          <div className="pipeline-strip">
            {loading ? (
              <div className="skeleton" style={{ flex: 1, height: 52, borderRadius: 8 }} />
            ) : pipeline.map(s => (
              <div className="pipeline-segment" key={s.label}>
                <div className="pipeline-seg-count">{s.count}</div>
                <div className="pipeline-seg-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="dash-grid">
          {/* Recent letters */}
          <div className="card">
            <div className="card-header">
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Recent letters</span>
              <button className="btn btn-ghost btn-sm" onClick={() => { window.location.hash = '/master/ai-drafting'; }}>
                <i className="ti ti-writing" /> Draft
              </button>
            </div>
            <div>
              {loading ? (
                <div className="loading-overlay"><div className="spinner" /><span>Loading…</span></div>
              ) : !letters.length ? (
                <div className="empty-state" style={{ padding: 24 }}>
                  <div className="empty-state-icon"><i className="ti ti-mail-off" /></div>
                  <div className="empty-state-title">No letters yet</div>
                </div>
              ) : letters.map(l => (
                <div key={l.id} className="dash-letter-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{l.sender || 'Unknown'}</div>
                    <div className="truncate text-muted" style={{ maxWidth: 200, fontSize: 12 }}>{l.filename || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{this.fmtDate(l.received_at)}</div>
                  </div>
                  <span className={`status-pill ${statusMap[l.status] || 'received'}`}>{(l.status || '').replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sync status */}
          <div className="card">
            <div className="card-header">
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Sync Status</span>
            </div>
            <div>
              {loading ? (
                <div className="loading-overlay"><div className="spinner" /></div>
              ) : !sync.length ? (
                <div className="empty-state" style={{ padding: 16 }}><div className="empty-state-body">No projects configured</div></div>
              ) : sync.map(({ project, stats }) => {
                const lastSync = stats?.last_sync;
                const statusClass = lastSync?.status === 'success' ? 'connected' : (lastSync?.status === 'failed' ? 'error' : '');
                return (
                  <div key={project.id} className="dash-sync-row">
                    <div className={`status-dot ${statusClass}`} style={{ width: 8, height: 8 }} />
                    <div style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{project.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {lastSync?.last_synced_at ? new Date(lastSync.last_synced_at).toLocaleString() : 'Never synced'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {lastSync?.files_synced !== undefined ? `${lastSync.files_synced} files` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent activity */}
          <div className="card">
            <div className="card-header">
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Recent activity</span>
            </div>
            <div>
              {loading ? (
                <div className="loading-overlay"><div className="spinner" /></div>
              ) : !activity.length ? (
                <div className="empty-state" style={{ padding: 16 }}>
                  <div className="empty-state-icon"><i className="ti ti-activity" /></div>
                  <div className="empty-state-body">No activity yet</div>
                </div>
              ) : (
                <div className="timeline">
                  {activity.map((a, i) => {
                    let style = activityIconMap.received;
                    for (const [k, v] of Object.entries(activityIconMap)) { if (a.action.includes(k)) { style = v; break; } }
                    const time = a.timestamp ? new Date(a.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                    return (
                      <div className="timeline-entry" key={i}>
                        <div className="timeline-dot" style={{ background: style.bg, color: style.color }}>
                          <i className={`ti ${style.icon}`} style={{ fontSize: 13 }} />
                        </div>
                        <div className="timeline-body">
                          <div className="timeline-action">{a.action.replace(/_/g, ' ')}</div>
                          <div className="timeline-meta">{a.entity_type || ''} · {time}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="card quick-actions" style={{ marginTop: 12 }}>
          <button className="btn btn-secondary" onClick={() => { window.location.hash = '/master/ai-drafting'; }}>
            <i className="ti ti-writing" /> AI Drafting
          </button>
        </div>
      </div>
    );
  }
}

export default Dashboard;
