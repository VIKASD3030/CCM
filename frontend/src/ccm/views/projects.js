/**
 * Projects — Figma frame 03. One card per project with its three folder
 * counts and drafting readiness. Master-module projects appear too; opening
 * one creates its CCM workspace.
 */
import React from 'react';
import CCM from '../ccm-api';
import {
  PageTop, Btn, Chip, Empty, Skeleton, ProgressBar, Modal, go, ROUTES, toast, FOLDERS, ensureCcmProject,
} from '../ui/kit';

const NEEDS = {
  contract_volume: 'Needs contract volumes',
  outgoing_letter: 'Needs outgoing letters',
  incoming_letter: 'Needs incoming letters',
  brief: 'Brief not verified',
};

export function projectStatus(p) {
  if (p.source === 'master') return ['Not set up', 'gray'];
  const total = FOLDERS.reduce((n, f) => n + (p.folders?.[f.key]?.total || 0), 0);
  if (!total) return ['No documents yet', 'bad'];
  const missing = (p.readiness?.checks || []).find((c) => !c.ok);
  return missing ? [NEEDS[missing.key] || missing.label, 'warn'] : ['Ready', 'ok'];
}

function NewProjectModal({ onClose, onCreated }) {
  const [form, setForm] = React.useState({ name: '', client_name: '', project_code: '', sharepoint: '' });
  const [busy, setBusy] = React.useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      const res = await CCM.projects.create(form.name.trim(), form.sharepoint.trim() || null, {
        client_name: form.client_name.trim() || null,
        project_code: form.project_code.trim() || null,
      });
      onCreated(res.project);
    } catch (err) {
      toast(`Couldn't create the project: ${err.message}`, 'error');
      setBusy(false);
    }
  };
  return (
    <Modal title="New project" size="sm" onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="cx-field"><label htmlFor="np-name">Project name</label><input id="np-name" className="cx-input" value={form.name} onChange={set('name')} autoFocus required /></div>
        <div className="cx-row" style={{ gap: 12 }}>
          <div className="cx-field cx-grow"><label htmlFor="np-client">Client</label><input id="np-client" className="cx-input" value={form.client_name} onChange={set('client_name')} /></div>
          <div className="cx-field cx-grow"><label htmlFor="np-code">Project code</label><input id="np-code" className="cx-input" value={form.project_code} onChange={set('project_code')} /></div>
        </div>
        <div className="cx-field"><label htmlFor="np-sp">SharePoint site ID (optional)</label><input id="np-sp" className="cx-input" value={form.sharepoint} onChange={set('sharepoint')} placeholder="contoso.sharepoint.com,abc…,def…" /></div>
        <div className="cx-toolbar"><span className="cx-spacer" /><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" type="submit" disabled={busy || !form.name.trim()}>{busy ? 'Creating…' : 'Create project'}</Btn></div>
      </form>
    </Modal>
  );
}

export default function Projects() {
  const [projects, setProjects] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [q, setQ] = React.useState('');
  const [status, setStatus] = React.useState('all');
  const [sort, setSort] = React.useState('readiness');
  const [creating, setCreating] = React.useState(false);
  const [opening, setOpening] = React.useState(null);

  const load = React.useCallback(() => {
    CCM.projects.list().then((d) => { setProjects(d.projects || []); setError(null); }).catch((e) => setError(e.message));
  }, []);
  React.useEffect(load, [load]);

  const open = async (p) => {
    setOpening(p.id);
    try {
      const id = await ensureCcmProject(p.id);
      go(ROUTES.project(id));
    } catch (e) {
      toast(`Couldn't open the project: ${e.message}`, 'error');
      setOpening(null);
    }
  };

  const list = (projects || [])
    .filter((p) => !q.trim() || `${p.name} ${p.client_name || ''} ${p.project_code || ''}`.toLowerCase().includes(q.trim().toLowerCase()))
    .filter((p) => {
      if (status === 'all') return true;
      const [, tone] = projectStatus(p);
      return status === 'ready' ? tone === 'ok' : tone !== 'ok';
    })
    .sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name)
      : sort === 'recent' ? new Date(b.created_at || 0) - new Date(a.created_at || 0)
        : (b.readiness?.percent || 0) - (a.readiness?.percent || 0)));

  return (
    <>
      <PageTop crumbs={[{ label: 'Home', to: ROUTES.dashboard }]} title="Projects"
        actions={<Btn variant="primary" onClick={() => setCreating(true)}>New project</Btn>}
        onSearch={setQ} searchPlaceholder="Filter projects" />
      <div className="cx-content">
        <div className="cx-toolbar">
          <input className="cx-input" style={{ width: 300, maxWidth: '100%' }} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Filter projects" aria-label="Filter projects" />
          <select className="cx-select inline" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="all">Status: All</option><option value="ready">Status: Ready</option><option value="needs">Status: Needs work</option>
          </select>
          <select className="cx-select inline" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
            <option value="readiness">Sort: Readiness</option><option value="recent">Sort: Recently created</option><option value="name">Sort: Name</option>
          </select>
          <span className="cx-spacer" />
          {projects && <span className="cx-s12 cx-muted">{list.length} project{list.length === 1 ? '' : 's'}</span>}
        </div>

        {error && <div className="cx-banner bad"><b>Couldn't load projects.</b><span className="cx-s12">{error}</span></div>}

        {!projects ? (
          <div className="cx-grid3">{[0, 1, 2].map((i) => <div className="cx-pcard" key={i}><Skeleton h={18} w="60%" /><Skeleton h={64} /><Skeleton h={10} /></div>)}</div>
        ) : list.length === 0 ? (
          <Empty title={projects.length ? 'No projects match these filters' : 'No projects yet'}
            action={<Btn variant="primary" onClick={() => setCreating(true)}>New project</Btn>}>
            Create a project, then upload its contract volumes and letters.
          </Empty>
        ) : (
          <div className="cx-grid3">
            {list.map((p) => {
              const [label, tone] = projectStatus(p);
              const pct = p.readiness?.percent || 0;
              return (
                <button key={p.id} type="button" className="cx-pcard" onClick={() => open(p)} disabled={opening === p.id}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <div className="cx-grow">
                      <div style={{ fontSize: 16, fontWeight: 600 }}>{p.name}</div>
                      <div className="cx-s12 cx-muted">{[p.client_name, p.project_code].filter(Boolean).join(' · ') || (p.source === 'master' ? 'Master project' : 'CCM project')}</div>
                    </div>
                    <Chip tone={tone}>{opening === p.id ? 'Opening…' : label}</Chip>
                  </div>
                  <div className="cx-fstats">
                    {FOLDERS.map((f) => (
                      <div className="cx-fstat" key={f.key}>
                        <b>{p.folders?.[f.key]?.total ?? 0}</b><span>{f.label}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div className="cx-kv"><span>Drafting readiness</span><b>{pct}%</b></div>
                    <ProgressBar percent={pct} tone={pct >= 75 ? '' : 'warn'} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {creating && <NewProjectModal onClose={() => setCreating(false)} onCreated={(p) => { setCreating(false); go(ROUTES.project(p.id)); }} />}
    </>
  );
}
