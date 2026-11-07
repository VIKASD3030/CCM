/**
 * Letters: the selected project's stored correspondence from the CCM public API,
 * with reply state for the current user. Opening an incoming letter goes to
 * AI Drafting. Letters are imported on the project's Letters tab.
 */
import React from 'react';
import { ccmApi } from '../ccm-public-api';
import { errorText } from '../project-setup';
import {
  ProjectPicker, currentUser, pickProject, replyState, useProjects,
} from '../session';
import {
  PageTop, Btn, Chip, Empty, Skeleton, go, ROUTES, useQueryParam, fmtDate,
} from '../ui/kit';

const STATES = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'drafting', label: 'Drafting' },
  { key: 'exported', label: 'Exported' },
  { key: 'replied', label: 'Replied' },
];
const PAGE_SIZE = 50;

export default function Letters() {
  const wantedProject = useQueryParam('project');
  const initialQ = useQueryParam('q') || '';
  const { projects, error: projectsError } = useProjects();
  const [project, setProject] = React.useState('');
  const [state, setState] = React.useState('all');
  const [direction, setDirection] = React.useState('incoming');
  const [q, setQ] = React.useState(initialQ);
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState(null);
  const user = currentUser();

  React.useEffect(() => setQ(initialQ), [initialQ]);
  React.useEffect(() => { if (projects) setProject(pickProject(projects, wantedProject)); }, [projects, wantedProject]);
  React.useEffect(() => setPage(1), [project, state, direction, q]);

  const load = React.useCallback(async () => {
    if (!project) return;
    const r = await ccmApi.letters.list(project, {
      q: q.trim(), state, direction, user, page, page_size: PAGE_SIZE, sort: 'date', descending: true,
    });
    if (r.ok) { setData(r.data); setError(null); } else { setError(errorText(r)); setData(null); }
  }, [project, q, state, direction, user, page]);
  React.useEffect(() => {
    setData(null);
    const t = setTimeout(load, q ? 300 : 0); // wait for typing to pause
    return () => clearTimeout(t);
  }, [load, q]);

  const open = (l) => go(ROUTES.drafting(project, l.file));
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <>
      <PageTop crumbs={[{ label: 'Home', to: ROUTES.dashboard }]} title="Letters" onSearch={setQ}
        actions={project && <Btn onClick={() => go(ROUTES.project(project, 'letters'))}>Import letters</Btn>} />
      <div className="cx-content">
        {projectsError && <div className="cx-banner bad"><b>Couldn&apos;t load projects.</b><span className="cx-s12">{projectsError}</span></div>}
        {projects && projects.length === 0 && !projectsError && (
          <Empty title="No projects yet" action={<Btn variant="primary" onClick={() => go(ROUTES.projects)}>Set up a project</Btn>} />
        )}

        {project && (
          <>
            <div className="cx-toolbar">
              <ProjectPicker projects={projects} value={project} onChange={setProject} />
              <div className="cx-tabs" role="tablist">
                {STATES.map((s) => (
                  <button key={s.key} type="button" role="tab" aria-selected={state === s.key} className={`cx-tab ${state === s.key ? 'on' : ''}`} onClick={() => setState(s.key)}>
                    {s.label}
                    {data?.counts && s.key !== 'all' && data.counts[s.key] != null && <span className="n">{data.counts[s.key]}</span>}
                  </button>
                ))}
              </div>
              <span className="cx-spacer" />
              <input className="cx-input" style={{ width: 240, maxWidth: '100%' }} value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Search subject, reference, sender" aria-label="Search letters" />
              <select className="cx-select inline" value={direction} onChange={(e) => setDirection(e.target.value)} aria-label="Direction">
                <option value="incoming">Incoming</option><option value="outgoing">Outgoing</option><option value="other">Other</option><option value="all">All directions</option>
              </select>
            </div>

            {error && <div className="cx-banner bad"><b>Couldn&apos;t load letters.</b><span className="cx-s12">{error}</span></div>}

            {!data ? (!error && <Skeleton h={320} />) : data.letters.length === 0 ? (
              <div className="cx-table-wrap">
                <Empty title={data.total === 0 && !q && state === 'all' ? 'No letters in this project yet' : 'No letters match these filters'}
                  action={<Btn onClick={() => go(ROUTES.project(project, 'letters'))}>Import letters</Btn>} />
              </div>
            ) : (
              <>
                <div className="cx-table-wrap">
                  <table className="cx-table">
                    <thead><tr><th>Reference</th><th>From / subject</th><th>Date</th><th>Reply</th><th /></tr></thead>
                    <tbody>
                      {data.letters.map((l) => {
                        const [label, tone] = replyState(l);
                        return (
                          <tr key={l.file} className="clickable" onClick={() => open(l)}>
                            <td className="cx-s12" style={{ whiteSpace: 'nowrap' }}>
                              {l.reference || <span className="cx-muted">{l.file}</span>}
                              {l.milestones?.length > 0 && <div>{l.milestones.slice(0, 2).map((m) => <Chip key={m} tone="warn">{m}</Chip>)}</div>}
                            </td>
                            <td>
                              <div className="cx-ellipsis" style={{ maxWidth: 420 }} title={l.subject}>{l.subject || <span className="cx-muted">No subject</span>}</div>
                              <div className="cx-s11 cx-muted">{l.sender || 'Unknown sender'}</div>
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>{l.date ? fmtDate(l.date) : '—'}</td>
                            <td>
                              {l.is_incoming ? <Chip tone={tone}>{label}</Chip> : <Chip tone="gray">{l.is_outgoing ? 'Outgoing' : 'Other'}</Chip>}
                              {l.reply_state?.reply_reference && <div className="cx-s11 cx-muted">{l.reply_state.reply_reference}</div>}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <Btn size="sm" onClick={(e) => { e.stopPropagation(); open(l); }}>
                                {!l.is_incoming ? 'View' : l.reply_state?.key === 'open' ? 'Draft reply' : 'Open'}
                              </Btn>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="cx-toolbar">
                  <span className="cx-s12 cx-muted">{data.total} letter{data.total === 1 ? '' : 's'}</span>
                  <span className="cx-spacer" />
                  {pages > 1 && (
                    <>
                      <Btn size="sm" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>Previous</Btn>
                      <span className="cx-s12">Page {page} of {pages}</span>
                      <Btn size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= pages}>Next</Btn>
                    </>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
