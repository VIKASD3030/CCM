/**
 * Drafts history slide-over (prototype frame "06b · Drafts history").
 * Lists the current user's saved drafts across projects from the CCM public API
 * (GET /projects/{p}/drafts?user=…), grouped by when they were last saved.
 * Letter type and prompt come from the tag in each draft's saved instructions.
 */
import React from 'react';
import { ccmApi } from '../ccm-public-api';
import { errorText } from '../project-setup';
import { currentUser } from '../session';
import { LETTER_TYPES, letterTypeOf, parseInstructions } from '../draft-options';
import MenuSelect from '../ui/menu-select';
import { Skeleton, go, ROUTES } from '../ui/kit';

const STATUSES = [
  { id: 'draft', label: 'Draft', hint: 'Not exported yet' },
  { id: 'exported', label: 'Exported', hint: 'DOCX downloaded' },
];

const DAY = 24 * 60 * 60 * 1000;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

function groupOf(iso) {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return 'Earlier';
  const today = startOfDay(new Date());
  const day = startOfDay(t);
  if (day >= today) return 'Today';
  if (day >= today - DAY) return 'Yesterday';
  if (day >= today - 6 * DAY) return 'Last 7 days';
  return 'Earlier';
}
const GROUP_ORDER = ['Today', 'Yesterday', 'Last 7 days', 'Earlier'];

function timeLabel(iso, group) {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '';
  if (group === 'Today' || group === 'Yesterday') return t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  if (group === 'Last 7 days') return t.toLocaleDateString([], { weekday: 'short' });
  return t.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export default function DraftsHistory({ projects, initialProject = '', onClose }) {
  const user = currentUser();
  const [project, setProject] = React.useState(initialProject);
  const [type, setType] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [q, setQ] = React.useState('');
  const [drafts, setDrafts] = React.useState(null);
  const [errors, setErrors] = React.useState([]);

  // Close on Escape.
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  React.useEffect(() => {
    if (!projects) return;
    const ids = project ? [project] : projects.map((p) => p.project_id);
    let live = true;
    setDrafts(null);
    Promise.all(ids.map((id) => ccmApi.savedDrafts.list(id, user).then((r) => ({ id, r })))).then((results) => {
      if (!live) return;
      const all = [];
      const failed = [];
      results.forEach(({ id, r }) => {
        if (!r.ok) { failed.push(`${id}: ${errorText(r)}`); return; }
        (r.data.drafts || []).forEach((d) => {
          const { options } = parseInstructions(d.instructions);
          all.push({ ...d, project_id: id, options });
        });
      });
      all.sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
      setDrafts(all);
      setErrors(failed);
    });
    return () => { live = false; };
  }, [projects, project, user]);

  const name = (id) => (projects || []).find((p) => p.project_id === id)?.name || id;
  const needle = q.trim().toLowerCase();
  const rows = (drafts || [])
    .filter((d) => !type || d.options.type === type)
    .filter((d) => !status || (status === 'exported' ? !!d.exported : !d.exported))
    .filter((d) => !needle || [d.subject, d.ref, d.file, d.options.prompt, letterTypeOf(d.options.type)?.label]
      .filter(Boolean).join(' ').toLowerCase().includes(needle));

  const groups = GROUP_ORDER
    .map((g) => ({ name: g, items: rows.filter((d) => groupOf(d.updated) === g) }))
    .filter((g) => g.items.length);

  const open = (d) => { onClose(); go(ROUTES.drafting(d.project_id, d.file)); };

  return (
    <>
      <div className="cx-hist-scrim" onMouseDown={onClose} />
      <aside className="cx-hist" role="dialog" aria-modal="true" aria-label="Drafts history">
        <div className="cx-hist-head">
          <div className="cx-hist-title">
            <b>Drafts history</b>
            <button type="button" className="cx-hist-close" onClick={onClose} aria-label="Close">✕</button>
          </div>
          <input className="cx-input" value={q} onChange={(e) => setQ(e.target.value)} autoFocus
            placeholder="Search drafts by subject, ref or letter type" aria-label="Search drafts" />
          <div className="cx-hist-filters">
            <MenuSelect label="Project" heading="Project" allLabel="All" value={project} onChange={setProject}
              options={(projects || []).map((p) => ({ id: p.project_id, label: p.name || p.project_id }))} />
            <MenuSelect label="Letter type" heading="Letter type" allLabel="All" value={type} onChange={setType} menuWidth={280}
              options={LETTER_TYPES.map((t) => ({ id: t.id, label: t.label }))} />
            <MenuSelect label="Status" heading="Status" allLabel="All" value={status} onChange={setStatus} align="right" options={STATUSES} />
          </div>
        </div>
        <div className="cx-hist-list">
          {errors.length > 0 && <div className="cx-banner bad" style={{ marginTop: 12 }}><span className="cx-s12">Some projects couldn&apos;t be loaded: {errors.join(' · ')}</span></div>}
          {!drafts ? <div style={{ paddingTop: 16 }}><Skeleton h={86} /><div style={{ height: 8 }} /><Skeleton h={86} /></div>
            : groups.length === 0 ? (
              <div className="cx-hist-group" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400, fontSize: 13 }}>
                {drafts.length ? 'No drafts match these filters.' : `No saved drafts yet for ${user}.`}
              </div>
            ) : groups.map((g) => (
              <React.Fragment key={g.name}>
                <div className="cx-hist-group">{g.name}</div>
                {g.items.map((d) => {
                  const typeLabel = letterTypeOf(d.options.type)?.label;
                  return (
                    <button key={`${d.project_id}/${d.file}`} type="button" className="cx-hist-card" onClick={() => open(d)}>
                      <div className="cx-hist-row">
                        <b title={d.options.prompt || d.subject}>{d.options.prompt || d.subject || `Reply to ${d.ref || d.file}`}</b>
                        <span className="cx-hist-time">{timeLabel(d.updated, g.name)}</span>
                      </div>
                      <div className="cx-hist-sub">Reply to {d.ref || d.file}{typeLabel ? ` · ${typeLabel}` : ''}</div>
                      <div className="cx-hist-chips">
                        <span className="cx-hist-chip project">{name(d.project_id)}</span>
                        {d.exported ? <span className="cx-hist-chip exported">Exported</span> : <span className="cx-hist-chip draft">Draft</span>}
                      </div>
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
        </div>
      </aside>
    </>
  );
}
