/**
 * Project workspace — Figma frame 04. The project's three folders (contract
 * volumes, outgoing letters, incoming letters), their indexing health,
 * drafting readiness and the project brief that every draft prompt includes.
 */
import React from 'react';
import CCM from '../ccm-api';
import {
  PageTop, Btn, Card, Chip, Empty, Skeleton, Modal, StatusChip, DocStatus, openOriginal, go, ROUTES, toast, useQueryParam,
  FOLDERS, folderOf, timeAgo, fmtDate, fmtDateTime, letterRef, letterSubject, urgencyTone, cap, isOpenLetter,
} from '../ui/kit';
import { UploadDocumentsModal, Dropzone } from '../ui/modals';

const TABS = [{ key: 'overview', label: 'Overview' }, ...FOLDERS, { key: 'brief', label: 'Project brief' }];

function IndexHealth({ project }) {
  const f = project.folders;
  const contractChunks = f._chunks || 0;
  const pct = contractChunks ? Math.round((100 * (f._chunks_with_clause || 0)) / contractChunks) : null;
  const failed = FOLDERS.reduce((n, x) => n + (f[x.key]?.failed || 0), 0);
  return (
    <Card title="Index health">
      {FOLDERS.map((x) => {
        const { total = 0, indexed = 0 } = f[x.key] || {};
        const [text, color] = !total ? ['Empty', 'var(--cx-muted)']
          : indexed < total ? [`${indexed} of ${total} indexed`, 'var(--cx-warn)'] : [`${indexed} indexed`, 'var(--cx-ok)'];
        return <div className="cx-kv" key={x.key} style={{ fontSize: 13 }}><span style={{ color: 'var(--cx-ink)' }}>{x.label}</span><span style={{ color, fontWeight: 500, fontSize: 12 }}>{text}</span></div>;
      })}
      <hr className="cx-hr" />
      <div className="cx-kv"><span>Clauses detected</span><b>{f.contract_volume?.clauses || 0}</b></div>
      <div className="cx-kv"><span>Contract chunks with a clause number</span><b>{pct == null ? '—' : `${pct}%`}</b></div>
      <div className="cx-kv"><span>Files that failed to index</span><b style={{ color: failed ? 'var(--cx-bad)' : undefined }}>{failed}</b></div>
    </Card>
  );
}

function Readiness({ project, onOpenBrief }) {
  return (
    <Card title="Drafting readiness" right={<b>{project.readiness?.percent || 0}%</b>}>
      {(project.readiness?.checks || []).map((c) => (
        <div className="cx-check" key={c.key} style={{ fontSize: 13 }}>
          <span className={`cx-dot ${c.ok ? 'ok' : 'off'}`} />{c.label}
        </div>
      ))}
      <Btn block onClick={onOpenBrief}>Open project brief</Btn>
    </Card>
  );
}

function FolderTab({ folder, docs, onUploadFiles, onDelete, onReindex }) {
  const [q, setQ] = React.useState('');
  const [status, setStatus] = React.useState('');
  const isContract = folder.key === 'contract_volume';
  const colW = isContract ? 190 : 150;
  const rows = docs
    .filter((d) => !q.trim() || `${d.filename} ${d.ref_no || ''} ${d.subject || ''}`.toLowerCase().includes(q.trim().toLowerCase()))
    .filter((d) => !status || d.status === status);
  const needsReindex = (d) => d.status === 'failed'
    || (d.status === 'indexed' && (d.status_detail || '').startsWith('Indexed for keyword'));
  return (
    <>
      <div className="cx-toolbar">
        <input className="cx-input" style={{ width: 280, maxWidth: '100%' }} value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={isContract ? 'Search contract volumes' : 'Search by reference or subject'} aria-label={`Search ${folder.label}`} />
        <select className="cx-select inline" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">Status: All</option><option value="indexed">Indexed</option><option value="processing">Processing</option><option value="failed">Failed</option>
        </select>
        <span className="cx-spacer" />
        <span className="cx-s12 cx-muted">Folder rule: only {folder.label.toLowerCase()} go here</span>
      </div>
      {rows.length > 0 ? (
        <div className="cx-table-wrap">
          <table className="cx-table">
            <thead>
              <tr>
                <th>{isContract ? 'Document' : 'Reference'}</th>
                {isContract ? <th>Volume</th> : <th>Subject</th>}
                {!isContract && <th>Date</th>}
                {isContract && <th>Pages</th>}
                {isContract && <th>Clauses</th>}
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td>
                    <div className="cx-ellipsis" style={{ maxWidth: colW }} title={d.filename}>{isContract ? d.filename : (d.ref_no || d.filename)}</div>
                    {!isContract && d.ref_no && <div className="cx-s11 cx-muted cx-ellipsis" style={{ maxWidth: colW }}>{d.filename}</div>}
                    {d.status === 'failed' && d.status_detail && (
                      <div className="cx-s11" style={{ color: 'var(--cx-bad)', maxWidth: 300 }}>{d.status_detail}</div>
                    )}
                  </td>
                  {isContract
                    ? <td style={{ whiteSpace: 'nowrap' }}>{d.volume_label || '–'}</td>
                    : <td><div className="cx-ellipsis" style={{ maxWidth: colW }} title={d.subject || ''}>{d.subject || <span className="cx-muted">–</span>}</div></td>}
                  {!isContract && <td style={{ whiteSpace: 'nowrap' }} title={fmtDateTime(d.uploaded_at)}>{d.doc_date ? fmtDate(d.doc_date) : <span className="cx-muted">{timeAgo(d.uploaded_at)}</span>}</td>}
                  {isContract && <td className="num">{d.page_count ?? '–'}</td>}
                  {isContract && <td className="num">{d.status === 'indexed' ? d.clause_count : '–'}</td>}
                  <td><DocStatus doc={d} /></td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <Btn size="sm" variant="ghost" style={{ padding: '4px 6px' }} onClick={() => openOriginal(`/api/knowledge/documents/${d.id}/file`)} aria-label={`View original of ${d.filename}`}>View</Btn>
                    {needsReindex(d) && <Btn size="sm" variant="ghost" style={{ padding: '4px 6px' }} onClick={() => onReindex(d)} aria-label={`Re-index ${d.filename}`}>Re-index</Btn>}
                    <Btn size="sm" variant="ghost" style={{ padding: '4px 6px' }} onClick={() => onDelete(d)} aria-label={`Delete ${d.filename}`}>Delete</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : docs.length > 0 ? (
        <Empty title="No documents match these filters" />
      ) : null}
      <Dropzone onFiles={onUploadFiles} title={`Drop ${folder.label.toLowerCase()} here`}
        hint={`PDF, DOCX, TXT or scanned images, or a ZIP to import many at once. Files are tagged to this project → ${folder.label}; scans are read with OCR.`} />
    </>
  );
}

function BriefTab({ project, onSaved }) {
  const [brief, setBrief] = React.useState(project.brief || '');
  const [verified, setVerified] = React.useState(!!project.brief_verified);
  const [busy, setBusy] = React.useState(false);
  const dirty = brief !== (project.brief || '') || verified !== !!project.brief_verified;
  const save = async () => {
    setBusy(true);
    try {
      await CCM.projects.update(project.id, { brief, brief_verified: verified });
      toast('Project brief saved', 'success');
      onSaved();
    } catch (e) {
      toast(`Couldn't save: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title="Project brief" right={project.brief_verified ? <Chip tone="ok">Verified</Chip> : <Chip tone="warn">Not verified</Chip>}>
      <span className="cx-s12 cx-muted">
        Key facts every reply for this project should respect: parties, contract number, key dates, notice periods,
        dispute clauses and positions already taken. It is added to the AI prompt for every draft.
      </span>
      <textarea className="cx-textarea" style={{ minHeight: 260 }} value={brief} onChange={(e) => setBrief(e.target.value)}
        placeholder={'Employer: …\nContractor: …\nContract no.: …\nCommencement date: …\nNotice period for claims: 28 days (Cl 20.1)\nPosition on EOT: …'} aria-label="Project brief" />
      <label className="cx-check" style={{ cursor: 'pointer' }}>
        <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
        I have checked these facts against the contract
      </label>
      <div className="cx-toolbar"><span className="cx-spacer" /><Btn variant="primary" onClick={save} disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save brief'}</Btn></div>
    </Card>
  );
}

function OverviewTab({ project, letters, onTab }) {
  const open = letters.filter(isOpenLetter).slice(0, 6);
  return (
    <>
      <div className="cx-fstats">
        {FOLDERS.map((f) => (
          <button key={f.key} type="button" className="cx-fstat" style={{ border: '1px solid var(--cx-line)', background: 'var(--cx-panel)', cursor: 'pointer', textAlign: 'left', font: 'inherit' }}
            onClick={() => onTab(f.key)}>
            <b>{project.folders[f.key]?.total || 0}</b><span>{f.label}</span>
          </button>
        ))}
      </div>
      <Card title="Open letters on this project" right={<Btn variant="ghost" size="sm" onClick={() => go(ROUTES.letters)}>All letters</Btn>}>
        {open.length === 0 ? <span className="cx-s12 cx-muted">No open letters on this project.</span> : (
          <div className="cx-table-wrap">
            <table className="cx-table">
              <thead><tr><th>Ref</th><th>Subject</th><th>Urgency</th><th>Received</th><th>Status</th><th /></tr></thead>
              <tbody>
                {open.map((l) => (
                  <tr key={l.id} className="clickable" onClick={() => go(ROUTES.drafting(l.id))}>
                    <td className="cx-s12">{letterRef(l)}</td>
                    <td><div className="cx-ellipsis" style={{ maxWidth: 280 }}>{letterSubject(l)}</div></td>
                    <td><Chip tone={urgencyTone(l.urgency)}>{cap(l.urgency || 'Pending')}</Chip></td>
                    <td>{timeAgo(l.received_at)}</td>
                    <td><StatusChip status={l.status} /></td>
                    <td><Btn size="sm" onClick={(e) => { e.stopPropagation(); go(ROUTES.drafting(l.id)); }}>Draft</Btn></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

export default function ProjectWorkspace() {
  const id = useQueryParam('id');
  const tabParam = useQueryParam('tab');
  const tab = TABS.some((t) => t.key === tabParam) ? tabParam : 'overview';
  const [project, setProject] = React.useState(null);
  const [docs, setDocs] = React.useState([]);
  const [letters, setLetters] = React.useState([]);
  const [projects, setProjects] = React.useState([]);
  const [lastSync, setLastSync] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(null);
  const [syncing, setSyncing] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!id) return;
    try {
      const [p, d, l] = await Promise.all([
        CCM.projects.get(id),
        CCM.knowledge.list({ project_id: id, limit: 200 }),
        CCM.letters.list(null, null, id, 200),
      ]);
      setProject(p.project);
      setDocs(d.documents || []);
      setLetters(l.letters || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [id]);

  React.useEffect(() => {
    setProject(null);
    load();
    CCM.projects.list().then((d) => setProjects(d.projects || [])).catch(() => {});
    if (id) CCM.projects.syncLogs(id).then((d) => setLastSync((d.logs || [])[0] || null)).catch(() => {});
  }, [id, load]);

  // Refresh while documents are still being indexed.
  const processing = docs.some((d) => d.status === 'processing');
  React.useEffect(() => {
    if (!processing) return undefined;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [processing, load]);

  const setTab = (key) => go(ROUTES.project(id, key));

  const uploadFiles = async (files, folderKey) => {
    let ok = 0;
    let duplicates = 0;
    for (const file of files) {
      try {
        if (/\.zip$/i.test(file.name)) {
          // eslint-disable-next-line no-await-in-loop
          const r = await CCM.knowledge.importZip(file, id, folderKey);
          ok += r.imported;
          duplicates += r.duplicates.length;
          if (r.errors.length) toast(`${r.errors.length} file(s) in ${file.name} couldn't be imported: ${r.errors[0].error}`, 'error');
        } else {
          // eslint-disable-next-line no-await-in-loop
          const r = await CCM.knowledge.uploadToFolder(file, id, folderKey);
          if (r.status === 'duplicate') duplicates += 1; else ok += 1;
        }
      } catch (e) {
        toast(`${file.name}: ${e.message}`, 'error');
      }
    }
    if (ok || duplicates) {
      toast(`${ok} file${ok === 1 ? '' : 's'} uploaded${duplicates ? `, ${duplicates} already in the project (skipped)` : ''}. Indexing runs in the background.`, 'success');
    }
    load();
  };

  const reindex = async (d) => {
    try {
      await CCM.knowledge.reindex(d.id);
      toast(`Re-indexing ${d.filename}`, 'success');
      load();
    } catch (e) {
      toast(`Couldn't re-index: ${e.message}`, 'error');
    }
  };

  const doDelete = async () => {
    const d = confirmDelete;
    setConfirmDelete(null);
    try {
      await CCM.knowledge.delete(d.id);
      toast(`${d.filename} deleted`, 'success');
      load();
    } catch (e) {
      toast(`Couldn't delete: ${e.message}`, 'error');
    }
  };

  const sync = async () => {
    setSyncing(true);
    try {
      await CCM.projects.sync(id);
      toast('SharePoint sync started. New files will appear in the folders.', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSyncing(false);
    }
  };

  if (!id) {
    return (<><PageTop crumbs={[{ label: 'Projects', to: ROUTES.projects }]} title="Project" /><div className="cx-content"><Empty title="No project selected" action={<Btn onClick={() => go(ROUTES.projects)}>Open projects</Btn>} /></div></>);
  }

  const folder = folderOf(tab);
  const count = (key) => project?.folders?.[key]?.total ?? 0;

  return (
    <>
      <PageTop crumbs={[{ label: 'Projects', to: ROUTES.projects }, { label: project?.name || '…' }]} title={project?.name || 'Loading…'}
        actions={(
          <>
            <Btn onClick={sync} disabled={!project?.sharepoint_site_id || syncing}
              title={project?.sharepoint_site_id ? 'Pull new files from the project SharePoint library' : 'No SharePoint site is linked to this project'}>
              {syncing ? 'Starting…' : 'Sync SharePoint'}
            </Btn>
            <Btn variant="primary" onClick={() => setUploadOpen(true)} disabled={!project}>Upload documents</Btn>
          </>
        )} />
      <div className="cx-content">
        {error && <div className="cx-banner bad"><b>Couldn't load this project.</b><span className="cx-s12">{error}</span></div>}
        {!project ? <Skeleton h={320} /> : (
          <>
            <div className="cx-toolbar" style={{ gap: 8 }}>
              {project.client_name && <Chip tone="gray">{project.client_name}</Chip>}
              <Chip tone="ok">{cap(project.status)}</Chip>
              {project.master_id != null && <Chip tone="blue">Master link: {project.project_code || `#${project.master_id}`}</Chip>}
              <span className="cx-spacer" />
              <span className="cx-s12 cx-muted">
                {lastSync ? `Last sync: ${fmtDateTime(lastSync.last_synced_at)} (${lastSync.sync_status})` : project.sharepoint_site_id ? 'Not synced yet' : 'Manual uploads'}
              </span>
            </div>

            <div className="cx-row stack-md" style={{ gap: 24, alignItems: 'flex-start' }}>
              <div className="cx-col cx-grow" style={{ gap: 16 }}>
                <div className="cx-tabs" role="tablist">
                  {TABS.map((t) => (
                    <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`cx-tab ${tab === t.key ? 'on' : ''}`} onClick={() => setTab(t.key)}>
                      {t.label}{folderOf(t.key) && <span className="n">{count(t.key)}</span>}
                    </button>
                  ))}
                </div>
                {tab === 'overview' && <OverviewTab project={project} letters={letters} onTab={setTab} />}
                {tab === 'brief' && <BriefTab key={project.id} project={project} onSaved={load} />}
                {folder && (
                  <FolderTab folder={folder} docs={docs.filter((d) => d.document_type === folder.key)}
                    onUploadFiles={(files) => uploadFiles(files, folder.key)} onDelete={setConfirmDelete} onReindex={reindex} />
                )}
              </div>
              <div className="cx-col" style={{ width: 320, flex: 'none', gap: 20 }}>
                <IndexHealth project={project} />
                <Readiness project={project} onOpenBrief={() => setTab('brief')} />
              </div>
            </div>
          </>
        )}
      </div>
      {uploadOpen && (
        <UploadDocumentsModal projects={projects.length ? projects : project ? [project] : []} initialProjectId={id}
          initialFolder={folder?.key || 'contract_volume'} onClose={() => { setUploadOpen(false); load(); }}
          onUploaded={() => load()} />
      )}
      {confirmDelete && (
        <Modal title="Delete document?" size="sm" onClose={() => setConfirmDelete(null)}>
          <span>{confirmDelete.filename} and its indexed text will be removed from this project. Drafts can no longer cite it.</span>
          <div className="cx-toolbar"><span className="cx-spacer" /><Btn onClick={() => setConfirmDelete(null)}>Cancel</Btn><Btn variant="primary" onClick={doDelete}>Delete</Btn></div>
        </Modal>
      )}
    </>
  );
}
