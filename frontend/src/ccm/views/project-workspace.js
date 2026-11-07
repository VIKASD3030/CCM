/**
 * Project workspace for the CCM public API (/api/v1). Tabs:
 *  - Setup:     checklist, readiness, plan + Apply / Deactivate
 *  - Contracts: configured volumes, import a PDF or TXT per volume
 *  - Letters:   import PDFs into a folder, list stored letters
 *  - Rules:     edit/validate/save the TOML, versions, AI recommendations
 */
import React from 'react';
import { ccmApi, unwrap } from '../ccm-public-api';
import { errorText, readinessText, runJob } from '../project-setup';
import {
  PageTop, Btn, Card, Chip, Empty, Skeleton, Modal, go, ROUTES, toast, useQueryParam, fmtDate, fmtDateTime,
} from '../ui/kit';
import { Dropzone } from '../ui/modals';

const TABS = [
  { key: 'setup', label: 'Setup' },
  { key: 'contracts', label: 'Contracts' },
  { key: 'letters', label: 'Letters' },
  { key: 'rules', label: 'Rules' },
];

const isPending = (p) => p && p.revision !== p.applied_revision;

function Check({ ok, warn, children, action }) {
  return (
    <div className="cx-check" style={{ fontSize: 13, justifyContent: 'space-between' }}>
      <span className="cx-check" style={{ fontSize: 13 }}>
        <span className={`cx-dot ${ok ? 'ok' : warn ? 'warn' : 'off'}`} />{children}
      </span>
      {action}
    </div>
  );
}

/* ─── Setup tab ─────────────────────────────────────────────────────────── */

function SetupTab({ project, volumes, letterTotal, onTab, onChanged }) {
  const [plan, setPlan] = React.useState(null);
  const [planError, setPlanError] = React.useState(null);
  const [embedLetters, setEmbedLetters] = React.useState(false);
  const [embedClauses, setEmbedClauses] = React.useState(false);
  const [busy, setBusy] = React.useState('');
  const [confirmDeactivate, setConfirmDeactivate] = React.useState(false);

  const loadPlan = React.useCallback(async () => {
    const r = await ccmApi.rules.plan(project.project_id);
    if (r.ok) { setPlan(r.data); setPlanError(null); } else setPlanError(errorText(r));
  }, [project.project_id]);
  React.useEffect(() => { loadPlan(); }, [loadPlan, project.revision]);

  const imported = volumes ? volumes.filter((v) => v.text_available).length : 0;
  const applied = !!project.applied_revision && !isPending(project);
  const r = project.readiness || { ready: false, blockers: [], warnings: [] };

  const apply = async () => {
    setBusy('apply');
    try {
      const result = await runJob(await ccmApi.rules.apply(project.project_id, {
        expected_revision: project.revision, embed_letters: embedLetters, embed_clauses: embedClauses,
      }));
      toast(result.readiness?.ready ? 'Rules applied. The project is ready for drafting.' : 'Rules applied. Check the remaining blockers.', 'success');
      onChanged();
    } catch (e) {
      toast(`Apply failed: ${errorText(e)}`, 'error');
    } finally {
      setBusy('');
    }
  };

  const deactivate = async () => {
    setConfirmDeactivate(false);
    setBusy('deactivate');
    const res = await ccmApi.rules.deactivate(project.project_id, { expected_revision: project.revision });
    setBusy('');
    if (res.ok) { toast('Project deactivated. Apply again to reactivate it.', 'success'); onChanged(); } else toast(errorText(res), 'error');
  };

  return (
    <div className="cx-row stack-md" style={{ gap: 24, alignItems: 'flex-start' }}>
      <div className="cx-col cx-grow" style={{ gap: 16 }}>
        <Card title="Setup checklist">
          <Check ok>Project created with configuration</Check>
          <Check ok={volumes && volumes.length > 0 && imported === volumes.length} warn={imported > 0}
            action={<Btn size="sm" variant="ghost" onClick={() => onTab('contracts')}>Contracts</Btn>}>
            Contract volumes imported: {volumes ? `${imported} of ${volumes.length}` : '…'}
          </Check>
          <Check ok={letterTotal > 0} action={<Btn size="sm" variant="ghost" onClick={() => onTab('letters')}>Letters</Btn>}>
            Letters imported: {letterTotal ?? '…'}
            {plan && letterTotal > 0 && <span className="cx-muted"> ({plan.incoming} incoming · {plan.outgoing} outgoing)</span>}
          </Check>
          {plan && plan.incoming > 0 && plan.outgoing === 0 && (
            <span className="cx-s11 cx-muted" style={{ paddingLeft: 26 }}>
              No outgoing letters yet. Import your side&apos;s earlier letters so drafts stay consistent with them.
            </span>
          )}
          <Check ok={applied} action={<Btn size="sm" variant="ghost" onClick={() => onTab('rules')}>Rules</Btn>}>
            {applied ? 'Rules applied' : project.applied_revision ? 'Rule changes not applied yet' : 'Rules not applied yet'}
          </Check>
          <hr className="cx-hr" />
          <Check ok={r.ready}><b>{r.ready ? 'Ready for drafting' : 'Not ready for drafting'}</b></Check>
        </Card>

        <Card title="Apply rules" right={applied ? <Chip tone="ok">Active</Chip> : <Chip tone="warn">Pending</Chip>}>
          <span className="cx-s12 cx-muted">
            Apply activates the saved configuration and rebuilds the project&apos;s indexes. Run it after you import contracts or
            change the rules. Importing letters does not need Apply.
          </span>
          {planError && <div className="cx-banner bad"><span className="cx-s12">{planError}</span></div>}
          {plan ? (
            <>
              <div className="cx-kv"><span>Letters</span><b>{plan.letters} ({plan.incoming} in · {plan.outgoing} out · {plan.unknown_sender} unknown sender)</b></div>
              <div className="cx-kv"><span>Contract volumes</span><b>{plan.volumes}</b></div>
              <div className="cx-kv"><span>Clauses found</span><b>{plan.clauses}</b></div>
              {plan.embeddings_enabled ? (
                <>
                  <label className="cx-check" style={{ cursor: 'pointer' }}>
                    <input type="checkbox" checked={embedClauses} onChange={(e) => setEmbedClauses(e.target.checked)} />
                    Build clause search index ({plan.clause_embed_todo} to embed, ~{plan.clause_embed_tokens} tokens)
                  </label>
                  <label className="cx-check" style={{ cursor: 'pointer' }}>
                    <input type="checkbox" checked={embedLetters} onChange={(e) => setEmbedLetters(e.target.checked)} />
                    Build letter search index ({plan.letters_embedded} done, ~{plan.letter_embed_tokens} tokens)
                  </label>
                  <span className="cx-s11 cx-muted">Search indexes use the server&apos;s AI service and may cost money. Token counts are estimates.</span>
                </>
              ) : <span className="cx-s12 cx-muted">Semantic search indexes are not enabled on this server.</span>}
            </>
          ) : !planError && <Skeleton h={60} />}
          <div className="cx-toolbar">
            <Btn onClick={() => setConfirmDeactivate(true)} disabled={!!busy || !project.applied_revision}>Deactivate</Btn>
            <span className="cx-spacer" />
            <Btn variant="primary" onClick={apply} disabled={!!busy}>{busy === 'apply' ? 'Applying…' : 'Apply'}</Btn>
          </div>
        </Card>
      </div>

      <div className="cx-col" style={{ width: 340, flex: 'none', gap: 20 }}>
        <Card title="Readiness" right={<Chip tone={r.ready ? 'ok' : 'warn'}>{r.ready ? 'Ready' : 'Not ready'}</Chip>}>
          {r.blockers.length === 0 && r.warnings.length === 0 && <span className="cx-s12 cx-muted">No issues.</span>}
          {r.blockers.map((b) => <Check key={b}><span style={{ color: 'var(--cx-bad)' }}>{readinessText(b)}</span></Check>)}
          {r.warnings.map((w) => <Check key={w} warn>{readinessText(w)}</Check>)}
          <span className="cx-s11 cx-muted">Readiness checks the setup only. It doesn&apos;t test the server&apos;s AI or OCR services.</span>
        </Card>
        <Card title="Project">
          <div className="cx-kv"><span>Project ID</span><b>{project.project_id}</b></div>
          <div className="cx-kv"><span>Contract ID</span><b>{project.contract_id || '—'}</b></div>
          {Object.entries(project.metadata || {}).filter(([, v]) => v).map(([k, v]) => (
            <div className="cx-kv" key={k}><span>{k.replace(/_/g, ' ')}</span><b>{v}</b></div>
          ))}
          <hr className="cx-hr" />
          {(project.parties || []).map((p) => (
            <div className="cx-kv" key={p.key}><span>{p.role || p.key}</span><b>{p.label}{p.key === project.author_party ? ' (owner)' : ''}</b></div>
          ))}
        </Card>
      </div>

      {confirmDeactivate && (
        <Modal title="Deactivate project?" size="sm" onClose={() => setConfirmDeactivate(false)}>
          <span>Drafting, analysis, review and DOCX export stop for this project until you Apply again.</span>
          <div className="cx-toolbar"><span className="cx-spacer" /><Btn onClick={() => setConfirmDeactivate(false)}>Cancel</Btn><Btn variant="primary" onClick={deactivate}>Deactivate</Btn></div>
        </Modal>
      )}
    </div>
  );
}

/* ─── Contracts tab ─────────────────────────────────────────────────────── */

function ContractsTab({ project, contracts, onChanged }) {
  const [busy, setBusy] = React.useState(null);
  const input = React.useRef(null);
  const target = React.useRef(null);

  const pick = (volume) => { target.current = volume; input.current?.click(); };
  const upload = async (file) => {
    const volume = target.current;
    if (!file || !volume) return;
    if (!/\.(pdf|txt)$/i.test(file.name)) { toast('Use a PDF or a UTF-8 TXT file.', 'error'); return; }
    setBusy(volume.id);
    try {
      const result = await runJob(await ccmApi.contracts.importFile(project.project_id, volume.id, contracts.revision, file));
      toast(result.state === 'skipped'
        ? `${volume.title}: identical file already imported (skipped).`
        : `${volume.title}: imported ${result.pages ?? '?'} pages, ${result.characters} characters.${result.apply_required ? ' Apply the rules to use it.' : ''}`, 'success');
      onChanged();
    } catch (e) {
      toast(`${volume.title}: ${errorText(e)}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  if (!contracts) return <Skeleton h={160} />;
  return (
    <>
      <span className="cx-s12 cx-muted">
        Volumes come from the project configuration (Rules tab), listed in order of precedence. Each volume can be imported once;
        for an amendment, add a new volume in the rules. Importing makes the rules pending until you Apply.
      </span>
      {contracts.volumes.length === 0 ? (
        <Empty title="No contract volumes configured">Add volumes under <code>contract_documents.volumes</code> in the Rules tab.</Empty>
      ) : (
        <div className="cx-table-wrap">
          <table className="cx-table">
            <thead><tr><th>Volume</th><th>File</th><th>First printed page</th><th>Status</th><th /></tr></thead>
            <tbody>
              {contracts.volumes.map((v) => (
                <tr key={v.id}>
                  <td><b>{v.title}</b><div className="cx-s11 cx-muted">{v.id}</div></td>
                  <td className="cx-s12">{v.file}</td>
                  <td className="num">{v.page_start ?? '—'}</td>
                  <td>{v.text_available ? <Chip tone="ok">Imported</Chip> : <Chip tone="warn">Missing</Chip>}</td>
                  <td style={{ textAlign: 'right' }}>
                    {!v.text_available && (
                      <Btn size="sm" variant="primary" onClick={() => pick(v)} disabled={!!busy}>
                        {busy === v.id ? 'Importing…' : 'Upload PDF / TXT'}
                      </Btn>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <input ref={input} type="file" hidden accept=".pdf,.txt" onChange={(e) => { upload(e.target.files[0]); e.target.value = ''; }} />
    </>
  );
}

/* ─── Letters tab ───────────────────────────────────────────────────────── */

const INCOMING_RE = /^(incoming|inbound|received|in)([-_].*)?$/i;
const OUTGOING_RE = /^(outgoing|outbound|sent|out|replies)([-_].*)?$/i;

/** Label and hint for an import folder key from the project configuration. */
function folderInfo(key) {
  if (INCOMING_RE.test(key)) return { title: 'Incoming letters', hint: 'Letters received from the other parties.', order: 0 };
  if (OUTGOING_RE.test(key)) return { title: 'Outgoing letters', hint: 'Letters your side has sent, including earlier replies. Drafting uses them to stay consistent.', order: 1 };
  return { title: `Folder: ${key}`, hint: 'A folder from the project configuration.', order: 2 };
}

const OUTGOING_SNIPPET = `[corpus]
dirs = [
  { path = "<data folder>/letters/incoming", folder = "incoming" },
  { path = "<data folder>/letters/outgoing", folder = "outgoing" },
]`;

function LettersTab({ project, onChanged }) {
  const [options, setOptions] = React.useState(null);
  const [optionsError, setOptionsError] = React.useState(null);
  const [pages, setPages] = React.useState('');
  const [busy, setBusy] = React.useState(''); // folder key being imported
  const [lastImport, setLastImport] = React.useState(null);
  const [letters, setLetters] = React.useState(null);
  const [q, setQ] = React.useState('');
  const [direction, setDirection] = React.useState('all');

  React.useEffect(() => {
    ccmApi.imports.options(project.project_id).then((r) => {
      if (!r.ok) { setOptionsError(errorText(r)); return; }
      setOptions(r.data);
    });
  }, [project.project_id, project.revision]);

  const folders = (options?.folders || []).map((f) => ({ key: f.key, ...folderInfo(f.key) })).sort((a, b) => a.order - b.order);
  const hasOutgoing = folders.some((f) => OUTGOING_RE.test(f.key));

  const loadLetters = React.useCallback(async () => {
    const r = await ccmApi.letters.list(project.project_id, { q, direction, page_size: 100 });
    setLetters(r.ok ? r.data : { error: errorText(r) });
  }, [project.project_id, q, direction]);
  React.useEffect(() => {
    const t = setTimeout(loadLetters, 300); // wait for typing to pause
    return () => clearTimeout(t);
  }, [loadLetters]);

  const upload = async (folder, files) => {
    const pdfs = files.filter((f) => /\.pdf$/i.test(f.name));
    if (pdfs.length < files.length) toast(`${files.length - pdfs.length} file(s) skipped: only PDFs can be imported.`, 'error');
    if (!pdfs.length) return;
    const tooBig = pdfs.reduce((n, f) => n + f.size, 0) > (options?.max_upload_mb || 200) * 1048576;
    if (tooBig) { toast(`The files exceed the ${options.max_upload_mb} MiB upload limit. Import them in smaller batches.`, 'error'); return; }
    setBusy(folder.key);
    try {
      const result = await runJob(await ccmApi.imports.upload(project.project_id, { folder: folder.key, pages: pages.trim(), files: pdfs }));
      setLastImport({ ...result, title: folder.title });
      toast(`${folder.title}: ${result.imported} imported, ${result.skipped} skipped, ${result.failed} failed.`, result.failed ? 'error' : 'success');
      loadLetters();
      onChanged();
    } catch (e) {
      toast(`Import failed: ${errorText(e)}`, 'error');
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <Card title="Import letters"
        right={options && (
          <div className="cx-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <label htmlFor="imp-pages" style={{ whiteSpace: 'nowrap' }}>Pages to read</label>
            <input id="imp-pages" className="cx-input" style={{ width: 110 }} value={pages} onChange={(e) => setPages(e.target.value)} placeholder={options.default_pages} />
          </div>
        )}>
        {optionsError && <div className="cx-banner bad"><span className="cx-s12">{optionsError}</span></div>}
        {options && (
          <>
            <span className="cx-s12 cx-muted">
              Import both sides of the correspondence. CCM decides each letter&apos;s direction from its letterhead and the parties in the
              configuration, and drafting uses earlier outgoing letters to stay consistent with positions already taken.
            </span>
            {!options.ocr_configured && <div className="cx-banner"><span className="cx-s12">OCR isn&apos;t configured on the server, so scanned PDFs may import without text.</span></div>}
            <div className="cx-row stack-md" style={{ gap: 12, alignItems: 'stretch' }}>
              {folders.map((f) => (
                <div key={f.key} className="cx-col cx-grow" style={{ gap: 6 }}>
                  <b className="cx-s12">{f.title}</b>
                  {busy === f.key ? (
                    <div className="cx-drop"><b>Importing…</b><span className="cx-s12 cx-muted">OCR can take a while for large files.</span></div>
                  ) : (
                    <Dropzone onFiles={(files) => (busy ? toast('Wait for the current import to finish.', 'error') : upload(f, files))}
                      title={`Drop ${f.title.toLowerCase()} here`} hint={`${f.hint} PDF only, up to ${options.max_upload_mb} MiB per import.`} />
                  )}
                </div>
              ))}
              {!hasOutgoing && (
                <div className="cx-col cx-grow" style={{ gap: 6 }}>
                  <b className="cx-s12">Outgoing letters</b>
                  <div className="cx-banner" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                    <span className="cx-s12">This project has no outgoing folder yet. Add one to <code>corpus.dirs</code> in the Rules tab, save and Apply:</span>
                    <pre className="cx-code" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{OUTGOING_SNIPPET}</pre>
                    <span className="cx-s11">The path must be inside your data folder. Ask the operator if you&apos;re unsure.</span>
                  </div>
                </div>
              )}
            </div>
            <span className="cx-s11 cx-muted">Files with the same name are skipped. Originals are never overwritten.</span>
          </>
        )}
        {!options && !optionsError && <Skeleton h={80} />}
        {lastImport && <b className="cx-s12">Last import: {lastImport.title}</b>}
        {lastImport && (
          <div className="cx-table-wrap">
            <table className="cx-table">
              <thead><tr><th>File</th><th>Result</th><th>Pages</th><th>Characters</th><th>Detail</th></tr></thead>
              <tbody>
                {lastImport.rows.map((row) => (
                  <tr key={row.name}>
                    <td className="cx-s12">{row.name}</td>
                    <td><Chip tone={row.state === 'imported' ? 'ok' : row.state === 'failed' ? 'bad' : 'gray'}>{row.state}</Chip></td>
                    <td className="num">{row.pages ?? '—'}</td>
                    <td className="num">{row.chars ?? '—'}</td>
                    <td className="cx-s12 cx-muted">{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="cx-toolbar">
        <input className="cx-input" style={{ width: 280, maxWidth: '100%' }} value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search subject, reference, sender" aria-label="Search letters" />
        <select className="cx-select inline" value={direction} onChange={(e) => setDirection(e.target.value)} aria-label="Direction">
          <option value="all">Direction: All</option><option value="incoming">Incoming</option><option value="outgoing">Outgoing</option><option value="other">Other</option>
        </select>
        <span className="cx-spacer" />
        {letters && !letters.error && <span className="cx-s12 cx-muted">{letters.total} letter{letters.total === 1 ? '' : 's'}{letters.total > letters.letters.length ? ` (showing ${letters.letters.length})` : ''}</span>}
      </div>
      {!letters ? <Skeleton h={160} /> : letters.error ? (
        <div className="cx-banner bad"><span className="cx-s12">{letters.error}</span></div>
      ) : letters.letters.length === 0 ? (
        <Empty title={q || direction !== 'all' ? 'No letters match' : 'No letters yet'}>Import the project&apos;s correspondence above.</Empty>
      ) : (
        <div className="cx-table-wrap">
          <table className="cx-table">
            <thead><tr><th>Reference</th><th>Subject</th><th>Sender</th><th>Date</th><th>Direction</th></tr></thead>
            <tbody>
              {letters.letters.map((l) => (
                <tr key={l.file}>
                  <td><div className="cx-ellipsis" style={{ maxWidth: 180 }}>{l.reference || l.file}</div>{l.reference && <div className="cx-s11 cx-muted">{l.file}</div>}</td>
                  <td><div className="cx-ellipsis" style={{ maxWidth: 320 }} title={l.subject}>{l.subject || <span className="cx-muted">—</span>}</div></td>
                  <td className="cx-s12">{l.sender || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{l.date ? fmtDate(l.date) : '—'}</td>
                  <td>{l.is_incoming ? <Chip tone="blue">Incoming</Chip> : l.is_outgoing ? <Chip tone="gray">Outgoing</Chip> : <Chip>Other</Chip>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ─── Rules tab ─────────────────────────────────────────────────────────── */

function RulesTab({ project, onChanged }) {
  const [rules, setRules] = React.useState(null);
  const [text, setText] = React.useState('');
  const [message, setMessage] = React.useState(null); // { tone, text }
  const [busy, setBusy] = React.useState('');
  const [versions, setVersions] = React.useState(null);
  const [instructions, setInstructions] = React.useState('');
  const [proposal, setProposal] = React.useState(null);

  const load = React.useCallback(async () => {
    const [r, v] = await Promise.all([ccmApi.rules.get(project.project_id), ccmApi.rules.versions(project.project_id)]);
    if (r.ok) { setRules(r.data); setText(r.data.configuration_toml); } else setMessage({ tone: 'bad', text: errorText(r) });
    setVersions(v.ok ? v.data.versions : []);
  }, [project.project_id]);
  React.useEffect(() => { load(); }, [load]);

  const dirty = rules && text !== rules.configuration_toml;
  const fileInput = React.useRef(null);

  const loadFile = async (file) => {
    if (!file) return;
    if (file.size > 256 * 1024) { setMessage({ tone: 'bad', text: 'The file is larger than 256 KiB.' }); return; }
    setText(await file.text());
    setMessage({ tone: 'info', text: `Loaded ${file.name} into the editor. It replaces the whole configuration. Validate, Save, then Apply.` });
  };

  const validate = async () => {
    setBusy('validate');
    const r = await ccmApi.rules.validate(project.project_id, { configuration_toml: text });
    setBusy('');
    setMessage(r.ok ? { tone: 'ok', text: 'The configuration is valid.' } : { tone: 'bad', text: errorText(r) });
  };

  const save = async () => {
    setBusy('save');
    const r = await ccmApi.rules.save(project.project_id, { configuration_toml: text, expected_revision: rules.revision });
    setBusy('');
    if (r.ok) {
      setMessage({ tone: 'ok', text: 'Saved. The previous version is archived. Apply the rules on the Setup tab to activate them.' });
      await load();
      onChanged();
    } else if (r.data?.error?.code === 'revision_conflict') {
      setMessage({ tone: 'bad', text: 'Someone else changed the rules since you opened them. Copy your edits, reload, and save again.' });
    } else {
      setMessage({ tone: 'bad', text: errorText(r) });
    }
  };

  const loadVersion = async (version) => {
    const r = await ccmApi.rules.version(project.project_id, version);
    if (!r.ok) { toast(errorText(r), 'error'); return; }
    setText(r.data.configuration_toml);
    setMessage({ tone: 'info', text: `Loaded version ${version} into the editor. Save it to restore it, then Apply.` });
  };

  const recommend = async () => {
    setBusy('recommend');
    setProposal(null);
    try {
      const result = await runJob(await ccmApi.rules.recommend(project.project_id, { expected_revision: rules.revision, instructions }));
      setProposal(result);
    } catch (e) {
      toast(`Recommendation failed: ${errorText(e)}`, 'error');
    } finally {
      setBusy('');
    }
  };

  if (!rules) return message ? <div className="cx-banner bad"><span className="cx-s12">{message.text}</span></div> : <Skeleton h={320} />;

  return (
    <div className="cx-row stack-md" style={{ gap: 24, alignItems: 'flex-start' }}>
      <div className="cx-col cx-grow" style={{ gap: 12 }}>
        <div className="cx-toolbar">
          <span className="cx-s12 cx-muted">Revision {rules.revision.slice(0, 12)}…</span>
          {isPending(project) ? <Chip tone="warn">Not applied</Chip> : <Chip tone="ok">Applied</Chip>}
          {dirty && <Chip tone="blue">Unsaved changes</Chip>}
          <span className="cx-spacer" />
          <Btn onClick={() => fileInput.current?.click()} disabled={!!busy}>Load file</Btn>
          <input ref={fileInput} type="file" hidden accept=".toml,text/plain" onChange={(e) => { loadFile(e.target.files[0]); e.target.value = ''; }} />
          <Btn onClick={() => { setText(rules.configuration_toml); setMessage(null); }} disabled={!dirty || !!busy}>Discard</Btn>
          <Btn onClick={validate} disabled={!!busy}>{busy === 'validate' ? 'Checking…' : 'Validate'}</Btn>
          <Btn variant="primary" onClick={save} disabled={!dirty || !!busy}>{busy === 'save' ? 'Saving…' : 'Save'}</Btn>
        </div>
        {message && <div className={`cx-banner ${message.tone === 'bad' ? 'bad' : 'info'}`}><span className="cx-s12">{message.text}</span></div>}
        <textarea className="cx-textarea cx-code" style={{ minHeight: 560 }} value={text} spellCheck={false}
          onChange={(e) => setText(e.target.value)} aria-label="Project configuration TOML" />
      </div>

      <div className="cx-col" style={{ width: 340, flex: 'none', gap: 20 }}>
        <Card title="AI rule suggestions">
          <span className="cx-s12 cx-muted">
            Samples the contract and letters and proposes classification, business rules and drafting guidance. Nothing is saved
            until you accept and save it.
          </span>
          <textarea className="cx-textarea" value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={4000}
            placeholder="Optional guidance, e.g. focus on delay and payment claims" aria-label="Instructions for the suggestions" />
          <Btn block onClick={recommend} disabled={!!busy || dirty} title={dirty ? 'Save or discard your edits first' : undefined}>
            {busy === 'recommend' ? 'Analysing sources…' : 'Suggest rules'}
          </Btn>
        </Card>
        <Card title="Version history">
          {!versions ? <Skeleton h={40} /> : versions.length === 0 ? <span className="cx-s12 cx-muted">No earlier versions yet.</span> : (
            versions.map((v) => (
              <div className="cx-kv" key={v.version} style={{ alignItems: 'center' }}>
                <span title={`${v.bytes} bytes, saved by ${v.saved_by}`}>{fmtDateTime(v.created_at)}</span>
                <Btn size="sm" variant="ghost" onClick={() => loadVersion(v.version)}>Load</Btn>
              </div>
            ))
          )}
        </Card>
      </div>

      {proposal && (
        <Modal title="Suggested rules" size="lg" onClose={() => setProposal(null)}>
          {proposal.warnings?.length > 0 && <div className="cx-banner"><span className="cx-s12">{proposal.warnings.join(' · ')}</span></div>}
          <div className="cx-col" style={{ gap: 6 }}>
            {(proposal.reasons || []).map((r, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={i} className="cx-s12"><b>{r.section}</b>: {r.explanation} <span className="cx-muted">({(r.source_ids || []).join(', ')})</span></div>
            ))}
          </div>
          <textarea className="cx-textarea cx-code" style={{ minHeight: 360 }} readOnly value={proposal.configuration_toml} aria-label="Suggested TOML" />
          <span className="cx-s11 cx-muted">Based on sampled excerpts only. Check the suggestions against the full contract. Comments in the TOML are not kept.</span>
          <div className="cx-toolbar">
            <span className="cx-spacer" />
            <Btn onClick={() => setProposal(null)}>Close</Btn>
            <Btn variant="primary" disabled={proposal.base_revision !== rules.revision}
              title={proposal.base_revision !== rules.revision ? 'The rules changed since this suggestion was made' : undefined}
              onClick={() => {
                setText(proposal.configuration_toml);
                setProposal(null);
                setMessage({ tone: 'info', text: 'The suggestion is in the editor. Review it, then Save and Apply.' });
              }}>Use in editor</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default function ProjectWorkspace() {
  const id = useQueryParam('id');
  const tabParam = useQueryParam('tab');
  const tab = TABS.some((t) => t.key === tabParam) ? tabParam : 'setup';
  const [project, setProject] = React.useState(null);
  const [contracts, setContracts] = React.useState(null);
  const [letterTotal, setLetterTotal] = React.useState(null);
  const [error, setError] = React.useState(null);

  const load = React.useCallback(async () => {
    if (!id) return;
    const [p, c, l] = await Promise.all([
      ccmApi.projects.get(id),
      ccmApi.contracts.list(id),
      ccmApi.letters.list(id, { page_size: 1 }),
    ]);
    if (!p.ok) { setError(errorText(p)); return; }
    setProject(unwrap(p));
    setContracts(c.ok ? c.data : { revision: p.data.revision, volumes: [] });
    setLetterTotal(l.ok ? l.data.total : null);
    setError(null);
  }, [id]);

  React.useEffect(() => { setProject(null); setError(null); load(); }, [id, load]);

  const setTab = (key) => go(ROUTES.project(id, key));

  if (!id) {
    return (<><PageTop crumbs={[{ label: 'Projects', to: ROUTES.projects }]} title="Project" /><div className="cx-content"><Empty title="No project selected" action={<Btn onClick={() => go(ROUTES.projects)}>Open projects</Btn>} /></div></>);
  }

  const missing = contracts ? contracts.volumes.filter((v) => !v.text_available).length : 0;

  return (
    <>
      <PageTop crumbs={[{ label: 'Projects', to: ROUTES.projects }, { label: project?.name || id }]} title={project?.name || (error ? id : 'Loading…')}
        actions={project && (project.readiness?.ready ? <Chip tone="ok">Ready for drafting</Chip> : <Chip tone="warn">Setup incomplete</Chip>)} />
      <div className="cx-content">
        {error && <div className="cx-banner bad"><b>Couldn&apos;t load this project.</b><span className="cx-s12">{error}</span></div>}
        {!project ? (!error && <Skeleton h={320} />) : (
          <>
            {isPending(project) && tab !== 'setup' && (
              <div className="cx-banner">
                <span className="cx-s12">The rules have changes that aren&apos;t applied yet. Drafting stays blocked until you Apply.</span>
                <span className="cx-spacer" />
                <Btn size="sm" onClick={() => setTab('setup')}>Go to Apply</Btn>
              </div>
            )}
            <div className="cx-tabs" role="tablist">
              {TABS.map((t) => (
                <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`cx-tab ${tab === t.key ? 'on' : ''}`} onClick={() => setTab(t.key)}>
                  {t.label}
                  {t.key === 'contracts' && missing > 0 && <span className="n">{missing}</span>}
                  {t.key === 'letters' && letterTotal != null && <span className="n">{letterTotal}</span>}
                </button>
              ))}
            </div>
            {tab === 'setup' && <SetupTab project={project} volumes={contracts?.volumes} letterTotal={letterTotal} onTab={setTab} onChanged={load} />}
            {tab === 'contracts' && <ContractsTab project={project} contracts={contracts} onChanged={load} />}
            {tab === 'letters' && <LettersTab project={project} onChanged={load} />}
            {tab === 'rules' && <RulesTab key={project.project_id} project={project} onChanged={load} />}
          </>
        )}
      </div>
    </>
  );
}
