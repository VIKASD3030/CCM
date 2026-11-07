/**
 * Drafts: the current user's saved replies in the selected project (CCM public API),
 * newest first, split into in-progress and exported. Opening one goes to AI Drafting,
 * where it is reviewed and exported. Approval and issuing happen outside CCM.
 */
import React from 'react';
import { ccmApi } from '../ccm-public-api';
import { errorText } from '../project-setup';
import { ProjectPicker, currentUser, pickProject, useProjects } from '../session';
import {
  PageTop, Btn, Chip, Empty, Skeleton, go, ROUTES, useQueryParam, fmtDateTime, timeAgo,
} from '../ui/kit';

const TABS = [
  { key: 'progress', label: 'In progress', match: (d) => !d.exported },
  { key: 'exported', label: 'Exported', match: (d) => !!d.exported },
];

export default function ReviewQueue() {
  const wantedProject = useQueryParam('project');
  const { projects, error: projectsError } = useProjects();
  const [project, setProject] = React.useState('');
  const [tab, setTab] = React.useState('progress');
  const [drafts, setDrafts] = React.useState(null);
  const [error, setError] = React.useState(null);
  const user = currentUser();

  React.useEffect(() => { if (projects) setProject(pickProject(projects, wantedProject)); }, [projects, wantedProject]);

  React.useEffect(() => {
    if (!project) return;
    setDrafts(null);
    ccmApi.savedDrafts.list(project, user).then((r) => {
      if (r.ok) { setDrafts(r.data.drafts || []); setError(null); } else { setError(errorText(r)); setDrafts([]); }
    });
  }, [project, user]);

  const rows = (drafts || []).filter(TABS.find((t) => t.key === tab).match);

  return (
    <>
      <PageTop crumbs={[{ label: 'Home', to: ROUTES.dashboard }]} title="My drafts" />
      <div className="cx-content">
        {projectsError && <div className="cx-banner bad"><span className="cx-s12">{projectsError}</span></div>}
        {project && (
          <>
            <div className="cx-toolbar">
              <ProjectPicker projects={projects} value={project} onChange={setProject} />
              <div className="cx-tabs" role="tablist">
                {TABS.map((t) => (
                  <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`cx-tab ${tab === t.key ? 'on' : ''}`} onClick={() => setTab(t.key)}>
                    {t.label}{drafts && <span className="n">{drafts.filter(t.match).length}</span>}
                  </button>
                ))}
              </div>
              <span className="cx-spacer" />
              <span className="cx-s12 cx-muted">Drafts saved as {user}</span>
            </div>
            {error && <div className="cx-banner bad"><b>Couldn&apos;t load drafts.</b><span className="cx-s12">{error}</span></div>}
            {!drafts ? <Skeleton h={240} /> : rows.length === 0 ? (
              <div className="cx-table-wrap">
                <Empty title={tab === 'progress' ? 'No drafts in progress' : 'Nothing exported yet'}
                  action={<Btn variant="primary" onClick={() => go(ROUTES.drafting(project))}>Draft a reply</Btn>} />
              </div>
            ) : (
              <div className="cx-table-wrap">
                <table className="cx-table">
                  <thead><tr><th>Reply to</th><th>Subject</th><th>Last saved</th><th>Status</th><th /></tr></thead>
                  <tbody>
                    {rows.map((d) => (
                      <tr key={d.file} className="clickable" onClick={() => go(ROUTES.drafting(project, d.file))}>
                        <td className="cx-s12" style={{ whiteSpace: 'nowrap' }}>{d.ref || d.file}</td>
                        <td><div className="cx-ellipsis" style={{ maxWidth: 380 }} title={d.subject}>{d.subject || <span className="cx-muted">—</span>}</div></td>
                        <td style={{ whiteSpace: 'nowrap' }} title={fmtDateTime(d.updated)}>{timeAgo(d.updated)}</td>
                        <td>
                          {d.exported ? <Chip tone="ok" title={fmtDateTime(d.exported)}>Exported</Chip> : <Chip tone="blue">Draft</Chip>}
                          {!d.source_job_id && <Chip tone="gray" title="Not linked to a generation job">No evidence</Chip>}
                        </td>
                        <td style={{ textAlign: 'right' }}><Btn size="sm" onClick={(e) => { e.stopPropagation(); go(ROUTES.drafting(project, d.file)); }}>Open</Btn></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <span className="cx-s11 cx-muted">
              Review checks and DOCX export happen on each draft. Approval and issuing the letter stay with your team; CCM does not send letters.
            </span>
          </>
        )}
      </div>
    </>
  );
}
