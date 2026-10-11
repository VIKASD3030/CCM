/**
 * Letters inbox — wireframe 05. Every incoming client letter with its
 * classification. Letters without a project are blocked from drafting until
 * one is confirmed, so replies only use that project's records.
 */
import React from 'react';
import CCM from '../ccm-api';
import {
  PageTop, Btn, Chip, Empty, Skeleton, StatusChip, ProjectSelect, go, ROUTES, toast, useQueryParam,
  letterRef, letterSubject, letterFrom, urgencyTone, humanize, cap, timeAgo, fmtDate, fmtDateTime, ensureCcmProject,
} from '../ui/kit';
import { UploadLetterModal } from '../ui/modals';

const TABS = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'new', label: 'New', match: (l) => l.status === 'new' },
  { key: 'classified', label: 'Classified', match: (l) => l.status === 'classified' },
  { key: 'drafted', label: 'Drafted', match: (l) => ['drafted', 'pending_review'].includes(l.status) },
  { key: 'approved', label: 'Approved', match: (l) => ['approved', 'sent'].includes(l.status) },
];

function AssignBanner({ letter, projects, onAssigned }) {
  const suggested = projects.find((p) => p.id === letter.suggested_project_id);
  const [projectId, setProjectId] = React.useState(suggested ? suggested.id : '');
  const [busy, setBusy] = React.useState(false);
  const assign = async () => {
    setBusy(true);
    try {
      const pid = await ensureCcmProject(projectId);
      await CCM.letters.assignProject(letter.id, pid);
      toast(`${letterRef(letter)} assigned`, 'success');
      onAssigned();
    } catch (e) {
      toast(`Couldn't assign: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="cx-banner" id={`assign-${letter.id}`}>
      <b>Draft is blocked until the project is confirmed.</b>
      {suggested ? (
        <span className="cx-s12">
          {letterRef(letter)}: CCM suggests <b>{suggested.name}</b>
          {letter.routing_confidence != null ? ` (${Math.round(letter.routing_confidence * 100)}% sure)` : ''}.
          {letter.routing_reason ? ` ${letter.routing_reason}` : ''}
        </span>
      ) : (
        <span className="cx-s12">{letterRef(letter)} could not be matched to a project. Confirm one so replies only use that project's records.</span>
      )}
      <span className="cx-spacer" />
      <ProjectSelect projects={projects} value={projectId} onChange={setProjectId} className="cx-select inline" placeholder="Choose project" />
      <Btn variant="primary" onClick={assign} disabled={!projectId || busy}>{busy ? 'Saving…' : 'Confirm'}</Btn>
    </div>
  );
}

export default function Letters() {
  const initialQ = useQueryParam('q') || '';
  const [letters, setLetters] = React.useState(null);
  const [projects, setProjects] = React.useState([]);
  const [error, setError] = React.useState(null);
  const [tab, setTab] = React.useState('all');
  const [projectFilter, setProjectFilter] = React.useState('');
  const [urgency, setUrgency] = React.useState('');
  const [q, setQ] = React.useState(initialQ);
  const [uploading, setUploading] = React.useState(false);

  React.useEffect(() => setQ(initialQ), [initialQ]);

  const load = React.useCallback(async () => {
    try {
      const [l, p] = await Promise.all([CCM.letters.list(null, null, null, 200), CCM.projects.list()]);
      setLetters(l.letters || []);
      setProjects(p.projects || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  // New letters are classified in the background; refresh for a few minutes
  // after upload until that's done (a failed classification stops polling).
  const classifying = (letters || []).some((l) => l.status === 'new' && !l.category
    && Date.now() - new Date(l.received_at).getTime() < 3 * 60000);
  React.useEffect(() => {
    if (!classifying) return undefined;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [classifying, load]);

  const projectName = (id) => projects.find((p) => p.id === id)?.name;
  const base = (letters || [])
    .filter((l) => !projectFilter || (projectFilter === 'none' ? !l.project_id : l.project_id === projectFilter))
    .filter((l) => !urgency || (l.urgency || '').toLowerCase() === urgency)
    .filter((l) => {
      if (!q.trim()) return true;
      const hay = `${l.filename} ${letterSubject(l)} ${letterRef(l)} ${l.intent || ''} ${l.raw_text || ''}`.toLowerCase();
      return hay.includes(q.trim().toLowerCase());
    });
  const rows = base.filter(TABS.find((t) => t.key === tab).match);
  const unassigned = (letters || []).filter((l) => !l.project_id && !['approved', 'sent', 'archived'].includes(l.status));

  const action = (l) => {
    if (!l.project_id) {
      return (
        <Btn size="sm" onClick={(e) => {
          e.stopPropagation();
          document.getElementById(`assign-${l.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }}>Assign</Btn>
      );
    }
    const label = ['new', 'classified'].includes(l.status) ? 'Draft' : ['approved', 'sent'].includes(l.status) ? 'View' : 'Open';
    return <Btn size="sm" onClick={(e) => { e.stopPropagation(); go(ROUTES.drafting(l.id)); }}>{label}</Btn>;
  };

  return (
    <>
      <PageTop crumbs={[{ label: 'Home', to: ROUTES.dashboard }]} title="Letters" onSearch={setQ}
        actions={<Btn variant="primary" onClick={() => setUploading(true)}>Upload letter</Btn>} />
      <div className="cx-content">
        <div className="cx-toolbar">
          <div className="cx-tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`cx-tab ${tab === t.key ? 'on' : ''}`} onClick={() => setTab(t.key)}>
                {t.label}<span className="n">{base.filter(t.match).length}</span>
              </button>
            ))}
          </div>
          <span className="cx-spacer" />
          {q && <Chip tone="blue">Search: “{q}” <button type="button" className="cx-link" onClick={() => setQ('')} aria-label="Clear search">×</button></Chip>}
          <select className="cx-select inline" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} aria-label="Project">
            <option value="">Project: All</option>
            <option value="none">Unassigned</option>
            {projects.filter((p) => p.source === 'ccm').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="cx-select inline" value={urgency} onChange={(e) => setUrgency(e.target.value)} aria-label="Urgency">
            <option value="">Urgency: All</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
          </select>
        </div>

        {error && <div className="cx-banner bad"><b>Couldn't load letters.</b><span className="cx-s12">{error}</span></div>}

        {!letters ? <Skeleton h={320} /> : rows.length === 0 ? (
          <div className="cx-table-wrap"><Empty title={letters.length ? 'No letters match these filters' : 'No letters yet'}
            action={<Btn variant="primary" onClick={() => setUploading(true)}>Upload letter</Btn>}>
            Upload a client letter to classify it and draft a reply.
          </Empty></div>
        ) : (
          <div className="cx-table-wrap">
            <table className="cx-table">
              <thead><tr><th>Ref</th><th>From / subject</th><th>Project</th><th>Category</th><th>Urgency</th><th>Received</th><th>Status</th><th /></tr></thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id} className={l.project_id ? 'clickable' : ''} onClick={() => l.project_id && go(ROUTES.drafting(l.id))}>
                    <td className="cx-s12" style={{ whiteSpace: 'nowrap' }}>{letterRef(l)}</td>
                    <td>
                      <div className="cx-ellipsis" style={{ maxWidth: 250 }}>{[letterFrom(l), letterSubject(l)].filter(Boolean).join(' · ')}</div>
                      {(l.letter_date || l.ocr_pages > 0) && (
                        <div className="cx-s11 cx-muted">
                          {l.letter_date ? `Dated ${fmtDate(l.letter_date)}` : ''}
                          {l.letter_date && l.ocr_pages > 0 ? ' · ' : ''}
                          {l.ocr_pages > 0 ? `Scanned, read with OCR (${l.ocr_pages} p)` : ''}
                        </div>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{l.project_id ? (projectName(l.project_id) || 'Project') : <b style={{ color: 'var(--cx-warn)' }}>Unassigned</b>}</td>
                    <td>{l.category ? (
                      <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
                        <Chip tone="blue" title={l.posture ? `Posture: ${humanize(l.posture)}` : undefined}>{humanize(l.domain_category || l.category)}</Chip>
                        {(l.kd_tags || []).slice(0, 2).map((t) => <Chip key={t} tone="gray">{t}</Chip>)}
                      </span>
                    ) : (
                      <span className="cx-s12 cx-muted">
                        {Date.now() - new Date(l.received_at).getTime() < 3 * 60000 ? 'Classifying…' : 'Not classified'}
                      </span>
                    )}</td>
                    <td>{l.urgency ? <Chip tone={urgencyTone(l.urgency)}>{cap(l.urgency)}</Chip> : '–'}</td>
                    <td style={{ whiteSpace: 'nowrap' }} title={fmtDateTime(l.received_at)}>{timeAgo(l.received_at)}</td>
                    <td>
                      <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
                        <StatusChip status={l.status} />
                        {l.answered_by && (
                          <Chip tone="ok" title={`Answered by ${l.answered_by.ref_no}${l.answered_by.doc_date ? ` · ${fmtDate(l.answered_by.doc_date)}` : ''}`}>
                            Answered
                          </Chip>
                        )}
                      </span>
                    </td>
                    <td>{action(l)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {unassigned.map((l) => (
          <AssignBanner key={l.id} letter={l} projects={projects} onAssigned={load} />
        ))}
      </div>
      {uploading && (
        <UploadLetterModal projects={projects} initialProjectId={projectFilter && projectFilter !== 'none' ? projectFilter : ''}
          onClose={() => setUploading(false)} onUploaded={() => { setUploading(false); load(); }} />
      )}
    </>
  );
}
