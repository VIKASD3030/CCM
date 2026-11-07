/**
 * Projects: one card per project assigned to our CCM API token, with its
 * readiness. "New project" opens a two-step wizard: details form → review the
 * generated TOML → POST /projects. Setup continues in the project workspace.
 */
import React from 'react';
import { ccmApi, unwrap } from '../ccm-public-api';
import {
  ID_PATTERN, buildProjectToml, defaultForm, emptyParty, errorText, readinessText, slug, validateForm,
} from '../project-setup';
import {
  PageTop, Btn, Chip, Empty, Skeleton, Modal, go, ROUTES, toast,
} from '../ui/kit';

export function projectStatus(p) {
  if (!p.readiness) return ['Checking…', 'gray'];
  if (p.readiness.error) return ['Unavailable', 'bad'];
  if (p.readiness.ready) return ['Ready', 'ok'];
  return [readinessText(p.readiness.blockers[0] || 'not_ready'), 'warn'];
}

/* ─── Wizard ────────────────────────────────────────────────────────────── */

function Field({ label, error, hint, children }) {
  return (
    <div className="cx-field cx-grow">
      <label>{label}</label>
      {children}
      {error ? <span className="cx-s11" style={{ color: 'var(--cx-bad)' }}>{error}</span>
        : hint ? <span className="cx-s11 cx-muted">{hint}</span> : null}
    </div>
  );
}

function DetailsStep({ form, setForm, errors }) {
  const err = (field) => errors.find((e) => e.field === field)?.message;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setParty = (i, k, v) => setForm((f) => ({
    ...f,
    parties: f.parties.map((p, j) => {
      if (k === 'is_owner') return { ...p, is_owner: j === i };
      return j === i ? { ...p, [k]: v } : p;
    }),
  }));
  const setVolume = (i, k, v) => setForm((f) => ({ ...f, volumes: f.volumes.map((x, j) => (j === i ? { ...x, [k]: v } : x)) }));

  return (
    <div className="cx-col" style={{ gap: 18 }}>
      <div className="cx-row" style={{ gap: 12 }}>
        <Field label="Project ID" error={err('project_id')} hint="The ID the operator assigned to your token. It can't be changed later.">
          <input className="cx-input" value={form.project_id} onChange={set('project_id')} placeholder="e.g. metro-line-3" autoFocus />
        </Field>
        <Field label="Contract ID" error={err('contract_id')} hint="The business contract number.">
          <input className="cx-input" value={form.contract_id} onChange={set('contract_id')} placeholder="e.g. ML3-C01" />
        </Field>
      </div>
      <Field label="Project name" error={err('name')}>
        <input className="cx-input" value={form.name} onChange={set('name')} />
      </Field>
      <div className="cx-row" style={{ gap: 12 }}>
        <Field label="Contract type"><input className="cx-input" value={form.contract_type} onChange={set('contract_type')} /></Field>
        <Field label="Phase"><input className="cx-input" value={form.phase} onChange={set('phase')} /></Field>
      </div>
      <div className="cx-row" style={{ gap: 12 }}>
        <Field label="Region"><input className="cx-input" value={form.region} onChange={set('region')} /></Field>
        <Field label="Governing law"><input className="cx-input" value={form.governing_law} onChange={set('governing_law')} /></Field>
      </div>
      <Field label="Data folder on the server" error={err('data_dir')}
        hint="Relative path inside the folder the operator gave your token. Letters, contracts and indexes go in sub-folders of it.">
        <input className="cx-input" value={form.data_dir} onChange={set('data_dir')} placeholder={`data/${form.project_id || 'my-project'}`} />
      </Field>

      <div className="cx-col" style={{ gap: 8 }}>
        <div className="cx-toolbar">
          <b>Parties</b>
          <span className="cx-s12 cx-muted">The owner writes the replies; letters from the others count as incoming.</span>
          <span className="cx-spacer" />
          <Btn size="sm" onClick={() => setForm((f) => ({ ...f, parties: [...f.parties, emptyParty()] }))}>Add party</Btn>
        </div>
        {err('parties') && <span className="cx-s11" style={{ color: 'var(--cx-bad)' }}>{err('parties')}</span>}
        <div className="cx-table-wrap">
          <table className="cx-table">
            <thead><tr><th>Owner</th><th>Key</th><th>Role</th><th>Name on letterhead</th><th>Ref prefixes</th><th /></tr></thead>
            <tbody>
              {form.parties.map((p, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <tr key={i}>
                  <td><input type="radio" name="owner" checked={p.is_owner} onChange={() => setParty(i, 'is_owner', true)} aria-label={`Party ${i + 1} is the owner`} /></td>
                  <td>
                    <input className="cx-input" value={p.key} onChange={(e) => setParty(i, 'key', slug(e.target.value))} placeholder="contractor" aria-label="Party key" />
                    {err(`parties.${i}.key`) && <div className="cx-s11" style={{ color: 'var(--cx-bad)' }}>{err(`parties.${i}.key`)}</div>}
                  </td>
                  <td><input className="cx-input" value={p.role} onChange={(e) => setParty(i, 'role', e.target.value)} placeholder="Contractor" aria-label="Party role" /></td>
                  <td>
                    <input className="cx-input" value={p.display_name} onChange={(e) => setParty(i, 'display_name', e.target.value)} placeholder="ABC Constructions Ltd" aria-label="Party name" />
                    {err(`parties.${i}.display_name`) && <div className="cx-s11" style={{ color: 'var(--cx-bad)' }}>{err(`parties.${i}.display_name`)}</div>}
                  </td>
                  <td><input className="cx-input" value={p.ref_prefixes} onChange={(e) => setParty(i, 'ref_prefixes', e.target.value)} placeholder="ABC/, ABC-" aria-label="Reference prefixes, comma separated" /></td>
                  <td>
                    <Btn size="sm" variant="ghost" disabled={form.parties.length <= 2}
                      onClick={() => setForm((f) => {
                        const parties = f.parties.filter((_, j) => j !== i);
                        if (!parties.some((x) => x.is_owner)) parties[0] = { ...parties[0], is_owner: true };
                        return { ...f, parties };
                      })}>Remove</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="cx-col" style={{ gap: 8 }}>
        <div className="cx-toolbar">
          <b>Contract volumes</b>
          <span className="cx-s12 cx-muted">In order of precedence. You upload each one after creating the project.</span>
          <span className="cx-spacer" />
          <Btn size="sm" onClick={() => setForm((f) => ({ ...f, volumes: [...f.volumes, { stem: '', title: '', page_start: 1 }] }))}>Add volume</Btn>
        </div>
        {err('volumes') && <span className="cx-s11" style={{ color: 'var(--cx-bad)' }}>{err('volumes')}</span>}
        {form.volumes.length > 0 && (
          <div className="cx-table-wrap">
            <table className="cx-table">
              <thead><tr><th>File name</th><th>Title</th><th>First printed page</th><th /></tr></thead>
              <tbody>
                {form.volumes.map((v, i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <tr key={i}>
                    <td>
                      <input className="cx-input" value={v.stem} onChange={(e) => setVolume(i, 'stem', slug(e.target.value))} placeholder="conditions" aria-label="Volume file name" />
                      {err(`volumes.${i}.stem`) && <div className="cx-s11" style={{ color: 'var(--cx-bad)' }}>{err(`volumes.${i}.stem`)}</div>}
                    </td>
                    <td>
                      <input className="cx-input" value={v.title} onChange={(e) => setVolume(i, 'title', e.target.value)} placeholder="Conditions of Contract" aria-label="Volume title" />
                      {err(`volumes.${i}.title`) && <div className="cx-s11" style={{ color: 'var(--cx-bad)' }}>{err(`volumes.${i}.title`)}</div>}
                    </td>
                    <td style={{ width: 120 }}><input className="cx-input" type="number" min={1} value={v.page_start} onChange={(e) => setVolume(i, 'page_start', e.target.value)} aria-label="First printed page" /></td>
                    <td><Btn size="sm" variant="ghost" onClick={() => setForm((f) => ({ ...f, volumes: f.volumes.filter((_, j) => j !== i) }))}>Remove</Btn></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const MAX_TOML_BYTES = 256 * 1024;

/** The [project] table's id (the contract ID), used to suggest an API project ID. */
function contractIdIn(toml) {
  const m = /^\s*\[project\]\s*$([\s\S]*?)(?=^\s*\[)/m.exec(`${toml}\n[`);
  const id = m && /^\s*id\s*=\s*["']([^"']+)["']/m.exec(m[1]);
  return id ? id[1] : '';
}

/** Step 1 when the user already has a TOML file: project ID + the file. */
function FileStep({ projectId, setProjectId, fileName, onFile, errors }) {
  const input = React.useRef(null);
  const err = (field) => errors.find((e) => e.field === field)?.message;
  return (
    <div className="cx-col" style={{ gap: 18 }}>
      <Field label="Project ID" error={err('project_id')} hint="The ID the operator assigned to your token. It can't be changed later.">
        <input className="cx-input" value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="e.g. metro-line-3" autoFocus />
      </Field>
      <div className="cx-field">
        <label>Configuration file</label>
        <div className="cx-drop" role="button" tabIndex={0}
          onClick={() => input.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.current?.click(); } }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}>
          <b>{fileName || 'Drop a .toml file here, or click to choose'}</b>
          <span className="cx-s12 cx-muted">The complete project configuration, up to 256 KiB. You can review and edit it in the next step.</span>
        </div>
        {err('toml') && <span className="cx-s11" style={{ color: 'var(--cx-bad)' }}>{err('toml')}</span>}
        <input ref={input} type="file" hidden accept=".toml,text/plain" onChange={(e) => { onFile(e.target.files[0]); e.target.value = ''; }} />
      </div>
      <span className="cx-s12 cx-muted">
        Paths in the file (corpus folders, contract OCR folder) must be inside the data folder the operator gave your token.
      </span>
    </div>
  );
}

function NewProjectWizard({ onClose, onCreated }) {
  const [mode, setMode] = React.useState('form'); // 'form' | 'file'
  const [fileName, setFileName] = React.useState('');
  const [step, setStep] = React.useState(1);
  const [form, setForm] = React.useState(defaultForm);
  const [errors, setErrors] = React.useState([]);
  const [toml, setToml] = React.useState('');
  const [tomlEdited, setTomlEdited] = React.useState(false);
  const [serverError, setServerError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  // Suggest a data folder from the project ID until the user types their own.
  const [dirTouched, setDirTouched] = React.useState(false);
  const setFormTracked = (update) => setForm((f) => {
    const next = typeof update === 'function' ? update(f) : update;
    if (next.data_dir !== f.data_dir) setDirTouched(true);
    else if (!dirTouched && next.project_id !== f.project_id) next.data_dir = next.project_id ? `data/${next.project_id}` : '';
    return next;
  });

  const readFile = async (file) => {
    if (!file) return;
    if (file.size > MAX_TOML_BYTES) { setErrors([{ field: 'toml', message: 'The file is larger than 256 KiB.' }]); return; }
    const text = await file.text();
    setToml(text);
    setTomlEdited(true);
    setFileName(file.name);
    setErrors([]);
    // Suggest a project ID from the contract ID if none is typed yet.
    if (!form.project_id) setForm((f) => ({ ...f, project_id: slug(contractIdIn(text)) }));
  };

  const switchMode = (next) => {
    setMode(next);
    setErrors([]);
    if (next === 'form' && fileName) { setToml(''); setTomlEdited(false); setFileName(''); }
  };

  const toReview = () => {
    if (mode === 'file') {
      const problems = [];
      if (!ID_PATTERN.test(form.project_id)) problems.push({ field: 'project_id', message: 'Use the ID the operator assigned: lowercase letters, digits, - or _.' });
      if (!toml.trim()) problems.push({ field: 'toml', message: 'Choose a .toml file.' });
      setErrors(problems);
      if (problems.length) return;
      setServerError(null);
      setStep(2);
      return;
    }
    const problems = validateForm(form);
    setErrors(problems);
    if (problems.length) return;
    if (!tomlEdited) setToml(buildProjectToml(form));
    setServerError(null);
    setStep(2);
  };

  const create = async () => {
    setBusy(true);
    setServerError(null);
    const response = await ccmApi.projects.create({ project_id: form.project_id, configuration_toml: toml });
    setBusy(false);
    if (response.status === 201) {
      toast(`Project ${form.project_id} created. Next: import the contract volumes.`, 'success');
      onCreated(unwrap(response));
      return;
    }
    setServerError(errorText(response));
  };

  return (
    <Modal title={step === 1 ? 'New project · 1 of 2: Details' : 'New project · 2 of 2: Review configuration'} size="lg" onClose={onClose}>
      {step === 1 && (
        <div className="cx-tabs" role="tablist" aria-label="How to configure the project">
          <button type="button" role="tab" aria-selected={mode === 'form'} className={`cx-tab ${mode === 'form' ? 'on' : ''}`} onClick={() => switchMode('form')}>Fill in a form</button>
          <button type="button" role="tab" aria-selected={mode === 'file'} className={`cx-tab ${mode === 'file' ? 'on' : ''}`} onClick={() => switchMode('file')}>Upload a TOML file</button>
        </div>
      )}
      {step === 1 ? (
        mode === 'file'
          ? <FileStep projectId={form.project_id} setProjectId={(v) => setForm((f) => ({ ...f, project_id: v }))} fileName={fileName} onFile={readFile} errors={errors} />
          : <DetailsStep form={form} setForm={setFormTracked} errors={errors} />
      ) : (
        <div className="cx-col" style={{ gap: 10 }}>
          <span className="cx-s12 cx-muted">
            {mode === 'file'
              ? 'This is the uploaded configuration. Edit it here if needed; the server checks it when you create the project.'
              : 'This is the project\'s full configuration (TOML). The extraction, classification and drafting sections start from sensible defaults. Adjust them now or later in the project\'s Rules tab.'}
          </span>
          <textarea className="cx-textarea cx-code" style={{ minHeight: 420 }} value={toml} spellCheck={false}
            onChange={(e) => { setToml(e.target.value); setTomlEdited(true); }} aria-label="Project configuration TOML" />
          {mode === 'file' && <span className="cx-s12">Project <b>{form.project_id}</b> · from {fileName}</span>}
          {tomlEdited && mode === 'form' && (
            <div className="cx-toolbar">
              <span className="cx-s12 cx-muted">You edited the TOML by hand. Changes in step 1 won&apos;t apply until you regenerate.</span>
              <span className="cx-spacer" />
              <Btn size="sm" onClick={() => { setToml(buildProjectToml(form)); setTomlEdited(false); }}>Regenerate from details</Btn>
            </div>
          )}
          {serverError && <div className="cx-banner bad"><b>The server rejected the project.</b><span className="cx-s12">{serverError}</span></div>}
        </div>
      )}
      <div className="cx-toolbar">
        {step === 2 && <Btn onClick={() => setStep(1)} disabled={busy}>Back</Btn>}
        <span className="cx-spacer" />
        <Btn onClick={onClose} disabled={busy}>Cancel</Btn>
        {step === 1
          ? <Btn variant="primary" onClick={toReview}>Review configuration</Btn>
          : <Btn variant="primary" onClick={create} disabled={busy || !toml.trim() || !ID_PATTERN.test(form.project_id)}>{busy ? 'Creating…' : 'Create project'}</Btn>}
      </div>
    </Modal>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default function Projects() {
  const [projects, setProjects] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [q, setQ] = React.useState('');
  const [status, setStatus] = React.useState('all');
  const [sort, setSort] = React.useState('readiness');
  const [creating, setCreating] = React.useState(false);

  const load = React.useCallback(async () => {
    const response = await ccmApi.projects.list();
    if (!response.ok) { setError(errorText(response)); setProjects([]); return; }
    const list = response.data.projects || [];
    setError(null);
    setProjects(list);
    // The list has no readiness; fetch each project for it.
    const details = await Promise.all(list.map(async (p) => {
      const r = await ccmApi.projects.get(p.project_id);
      return r.ok ? r.data : { ...p, readiness: { error: errorText(r), ready: false, blockers: [], warnings: [] } };
    }));
    setProjects(details);
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const list = (projects || [])
    .filter((p) => !q.trim() || `${p.name} ${p.project_id} ${p.contract_id}`.toLowerCase().includes(q.trim().toLowerCase()))
    .filter((p) => {
      if (status === 'all') return true;
      const [, tone] = projectStatus(p);
      return status === 'ready' ? tone === 'ok' : tone !== 'ok';
    })
    .sort((a, b) => (sort === 'name'
      ? (a.name || a.project_id).localeCompare(b.name || b.project_id)
      : (a.readiness?.blockers?.length ?? 99) - (b.readiness?.blockers?.length ?? 99)));

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
            <option value="all">Status: All</option><option value="ready">Status: Ready</option><option value="needs">Status: Needs setup</option>
          </select>
          <select className="cx-select inline" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
            <option value="readiness">Sort: Readiness</option><option value="name">Sort: Name</option>
          </select>
          <span className="cx-spacer" />
          {projects && <span className="cx-s12 cx-muted">{list.length} project{list.length === 1 ? '' : 's'}</span>}
        </div>

        {error && <div className="cx-banner bad"><b>Couldn&apos;t load projects.</b><span className="cx-s12">{error}</span></div>}

        {!projects ? (
          <div className="cx-grid3">{[0, 1, 2].map((i) => <div className="cx-pcard" key={i}><Skeleton h={18} w="60%" /><Skeleton h={64} /><Skeleton h={10} /></div>)}</div>
        ) : list.length === 0 ? (
          <Empty title={projects.length ? 'No projects match these filters' : 'No projects yet'}
            action={<Btn variant="primary" onClick={() => setCreating(true)}>New project</Btn>}>
            Create a project with the ID the operator assigned, then import its contract volumes and letters.
          </Empty>
        ) : (
          <div className="cx-grid3">
            {list.map((p) => {
              const [label, tone] = projectStatus(p);
              const r = p.readiness;
              return (
                <button key={p.project_id} type="button" className="cx-pcard" onClick={() => go(ROUTES.project(p.project_id))}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <div className="cx-grow">
                      <div style={{ fontSize: 16, fontWeight: 600 }}>{p.name || p.project_id}</div>
                      <div className="cx-s12 cx-muted">{[p.project_id, p.contract_id].filter(Boolean).join(' · ')}</div>
                    </div>
                    <Chip tone={tone}>{label}</Chip>
                  </div>
                  <div className="cx-s12 cx-muted">
                    {(p.parties || []).map((x) => `${x.label || x.key}${x.key === p.author_party ? ' (owner)' : ''}`).join(' · ') || '—'}
                  </div>
                  {r && !r.ready && !r.error && r.blockers.length > 1 && (
                    <div className="cx-s12" style={{ color: 'var(--cx-warn)' }}>
                      {r.blockers.slice(1).map(readinessText).join(' · ')}
                    </div>
                  )}
                  {r?.error && <div className="cx-s12" style={{ color: 'var(--cx-bad)' }}>{r.error}</div>}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {creating && (
        <NewProjectWizard onClose={() => setCreating(false)}
          onCreated={(p) => { setCreating(false); go(ROUTES.project(p.project_id, 'contracts')); }} />
      )}
    </>
  );
}
