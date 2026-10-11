/**
 * Dashboard — Figma frame 02. KPI row, letters that need a reply, the review
 * queue and how well each project's folders are filled.
 */
import React from 'react';
import CCM from '../ccm-api';
import {
  PageTop, Btn, Card, Chip, Kpi, FlagChip, Empty, Skeleton, ProgressBar, go, ROUTES,
  isOpenLetter, URGENCY_RANK, urgencyTone, letterRef, letterSubject, timeAgo, cap, FOLDERS,
} from '../ui/kit';
import { UploadLetterModal } from '../ui/modals';

export default function Dashboard() {
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [uploading, setUploading] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const [stats, letters, projects, queue] = await Promise.all([
        CCM.review.dashboardStats(),
        CCM.letters.list(null, null, null, 200),
        CCM.projects.list(),
        CCM.review.queue(),
      ]);
      setData({ stats, letters: letters.letters || [], projects: projects.projects || [], queue: queue.items || [] });
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const projectName = (id) => data?.projects.find((p) => p.id === id)?.name;

  const openLetters = (data?.letters || [])
    .filter(isOpenLetter)
    .sort((a, b) => (URGENCY_RANK[(a.urgency || 'low').toLowerCase()] ?? 9) - (URGENCY_RANK[(b.urgency || 'low').toLowerCase()] ?? 9)
      || new Date(a.received_at) - new Date(b.received_at))
    .slice(0, 6);

  const s = data?.stats || {};
  const staleReviews = (data?.queue || []).filter((q) => Date.now() - new Date(q.draft.created_at) > 86400000).length;
  const ccmProjects = (data?.projects || []).filter((p) => p.source === 'ccm' && p.folders)
    .sort((a, b) => (b.readiness?.percent || 0) - (a.readiness?.percent || 0)).slice(0, 4);

  return (
    <>
      <PageTop crumbs={[{ label: 'Home' }]} title="Dashboard"
        actions={<Btn variant="primary" onClick={() => setUploading(true)}>Upload letter</Btn>} />
      <div className="cx-content">
        {error && <div className="cx-banner bad"><b>Couldn't load the dashboard.</b><span className="cx-s12">{error}</span><span className="cx-spacer" /><Btn size="sm" onClick={load}>Retry</Btn></div>}

        <div className="cx-kpis">
          {!data ? [0, 1, 2, 3].map((i) => <div className="cx-kpi" key={i}><Skeleton h={12} w="50%" /><Skeleton h={30} w="40%" /><Skeleton h={12} w="60%" /></div>) : (
            <>
              <Kpi label="Open letters" value={s.open_letters ?? 0}
                note={`${s.open_high_urgency || 0} high urgency`} tone={s.open_high_urgency ? 'bad' : 'ok'} />
              <Kpi label="Drafts awaiting review" value={s.pending_review ?? 0}
                note={staleReviews ? `${staleReviews} older than 24h` : 'All recent'} tone={staleReviews ? 'warn' : 'ok'} />
              <Kpi label="Avg. turnaround" value={s.avg_turnaround_days != null ? `${s.avg_turnaround_days} days` : '—'}
                note={s.avg_turnaround_days != null ? 'From receipt to approval' : 'No approved replies yet'} />
              <Kpi label="Replies overdue" value={s.overdue_letters ?? 0}
                note={`Open more than ${s.reply_sla_days || 7} days`} tone={s.overdue_letters ? 'bad' : 'ok'} />
            </>
          )}
        </div>

        <div className="cx-row stack-md" style={{ gap: 24, alignItems: 'flex-start' }}>
          <Card title="Incoming letters needing a reply" className="cx-grow"
            right={<Btn variant="ghost" onClick={() => go(ROUTES.letters)}>View all</Btn>}>
            {!data ? <Skeleton h={180} /> : openLetters.length === 0 ? (
              <Empty title="No letters waiting for a reply"
                action={<Btn onClick={() => setUploading(true)}>Upload a letter</Btn>}>
                New client letters appear here until their reply is approved.
              </Empty>
            ) : (
              <div className="cx-table-wrap">
                <table className="cx-table">
                  <thead><tr><th>Ref</th><th>Subject</th><th>Project</th><th>Urgency</th><th>Received</th><th /></tr></thead>
                  <tbody>
                    {openLetters.map((l) => (
                      <tr key={l.id} className="clickable" onClick={() => go(ROUTES.drafting(l.id))}>
                        <td className="cx-s12"><div className="cx-ellipsis" style={{ maxWidth: 110 }} title={letterRef(l)}>{letterRef(l)}</div></td>
                        <td><div className="cx-ellipsis" style={{ maxWidth: 190 }} title={letterSubject(l)}>{letterSubject(l)}</div></td>
                        <td>{projectName(l.project_id) ? <div className="cx-ellipsis" style={{ maxWidth: 110 }}>{projectName(l.project_id)}</div> : <Chip tone="warn">Unassigned</Chip>}</td>
                        <td><Chip tone={urgencyTone(l.urgency)}>{cap(l.urgency || 'Pending')}</Chip></td>
                        <td style={{ whiteSpace: 'nowrap' }}>{timeAgo(l.received_at)}</td>
                        <td><Btn size="sm" onClick={(e) => { e.stopPropagation(); go(ROUTES.drafting(l.id)); }}>Draft</Btn></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="cx-col" style={{ width: 380, flex: 'none', gap: 24 }}>
            <Card title="Awaiting review" right={data?.queue.length ? <Btn variant="ghost" size="sm" onClick={() => go(ROUTES.review())}>Open queue</Btn> : null}>
              {!data ? <Skeleton h={120} /> : data.queue.length === 0 ? (
                <span className="cx-s12 cx-muted">Nothing to review right now.</span>
              ) : data.queue.slice(0, 4).map((q) => (
                <button key={q.draft.id} type="button" className="cx-qitem" style={{ padding: '4px 0' }} onClick={() => go(ROUTES.review(q.draft.id))}>
                  <div className="cx-grow">
                    <div style={{ fontWeight: 500 }}>Reply to {letterRef(q.letter)}</div>
                    <div className="cx-s12 cx-muted">v{q.draft.version} · {q.project_name || 'No project'}</div>
                  </div>
                  <FlagChip issues={q.issues} />
                </button>
              ))}
            </Card>

            <Card title="Project knowledge coverage">
              {!data ? <Skeleton h={140} /> : ccmProjects.length === 0 ? (
                <Empty title="No project folders yet" action={<Btn onClick={() => go(ROUTES.projects)}>Open projects</Btn>}>
                  Upload contract volumes and letters to a project.
                </Empty>
              ) : ccmProjects.map((p) => (
                <button key={p.id} type="button" className="cx-qitem" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6, padding: '2px 0' }}
                  onClick={() => go(ROUTES.project(p.id))}>
                  <span style={{ fontWeight: 500 }}>{p.name}</span>
                  <span style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {FOLDERS.map((f) => {
                      const n = p.folders[f.key]?.indexed || 0;
                      return (
                        <span key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <ProgressBar percent={n > 0 ? 100 : 0} tone="red" />
                          <span className="cx-s11 cx-muted">{f.short} {n}</span>
                        </span>
                      );
                    })}
                  </span>
                </button>
              ))}
            </Card>
          </div>
        </div>
      </div>
      {uploading && (
        <UploadLetterModal projects={data?.projects || []} onClose={() => setUploading(false)}
          onUploaded={() => { setUploading(false); load(); }} />
      )}
    </>
  );
}
