/**
 * Upload dialogs shared by several pages:
 *  - UploadDocumentsModal: files into a project folder (wireframe 08)
 *  - UploadLetterModal: a new incoming client letter
 */
import React from 'react';
import CCM from '../ccm-api';
import {
  Btn, Chip, Modal, FOLDERS, folderOf, ProjectSelect, ensureCcmProject, toast,
} from './kit';

const ACCEPT = '.pdf,.docx,.txt,.jpg,.jpeg,.png,.zip';
const isZip = (f) => /\.zip$/i.test(f.name);
const fmtSize = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

const VOLUME_RE = /vol(?:ume)?[\s._-]*([ivx]{1,4}|\d{1,2})\b/i;
const AMENDMENT_RE = /amend(?:ment)?[\s._-]*0*(\d{1,2})/i;
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/** "Detected: Volume I, Amendment 1" from a contract file name, or null. */
function detectedFromName(name) {
  const parts = [];
  const v = VOLUME_RE.exec(name);
  if (v) parts.push(`Volume ${/^\d+$/.test(v[1]) ? (ROMAN[+v[1]] || v[1]) : v[1].toUpperCase()}`);
  const a = AMENDMENT_RE.exec(name);
  if (a) parts.push(`Amendment ${+a[1]}`);
  return parts.length ? `Detected: ${parts.join(', ')}` : null;
}

function Dropzone({ onFiles, multiple = true, title = 'Drop files here', hint = 'PDF, DOCX, JPG or PNG. Scanned pages are read with OCR.', note }) {
  const input = React.useRef(null);
  const [over, setOver] = React.useState(false);
  return (
    <div
      className={`cx-drop ${over ? 'over' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.current?.click(); } }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onFiles([...e.dataTransfer.files]); }}
    >
      <b>{title}</b>
      <span className="cx-s12 cx-muted">{hint}</span>
      {note && <span className="cx-s11 cx-muted">{note}</span>}
      <input ref={input} type="file" hidden multiple={multiple} accept={multiple ? ACCEPT : ACCEPT.replace(',.zip', '')}
        onChange={(e) => { onFiles([...e.target.files]); e.target.value = ''; }} />
    </div>
  );
}

export { Dropzone };

export function UploadDocumentsModal({ projects, initialProjectId, initialFolder = 'contract_volume', onClose, onUploaded }) {
  const [projectId, setProjectId] = React.useState(initialProjectId || '');
  const [folder, setFolder] = React.useState(initialFolder);
  // file states: queued -> uploading -> parsing (server is indexing) -> indexed | failed; or error
  const [files, setFiles] = React.useState([]); // {file, state, error, docId, clauses}
  const [busy, setBusy] = React.useState(false);
  const [uploadedPid, setUploadedPid] = React.useState(null);

  const project = projects.find((p) => p.id === projectId);
  const pending = files.filter((f) => f.state === 'queued');
  const parsing = files.some((f) => f.state === 'parsing');

  // After upload the server indexes each file in the background; follow it.
  React.useEffect(() => {
    if (!parsing || !uploadedPid) return undefined;
    const t = setInterval(async () => {
      try {
        const res = await CCM.knowledge.list({ project_id: uploadedPid, limit: 200 });
        const byId = new Map((res.documents || []).map((d) => [d.id, d]));
        setFiles((prev) => prev.map((f) => {
          const d = f.state === 'parsing' ? byId.get(f.docId) : null;
          if (!d || d.status === 'processing') return f;
          return {
            ...f,
            state: d.status === 'indexed' ? 'indexed' : 'failed',
            clauses: d.clause_count, pages: d.page_count, ocr: d.ocr_pages,
            error: d.status === 'failed' ? d.status_detail : undefined,
            keywordOnly: d.status === 'indexed' && (d.status_detail || '').startsWith('Indexed for keyword'),
          };
        }));
      } catch { /* keep polling */ }
    }, 2000);
    return () => clearInterval(t);
  }, [parsing, uploadedPid]);

  const addFiles = (list) => setFiles((prev) => [
    ...prev,
    ...list.filter((f) => !prev.some((p) => p.file.name === f.name && p.file.size === f.size))
      .map((file) => ({ file, state: 'queued' })),
  ]);

  const upload = async () => {
    if (!projectId) { toast('Choose a project first', 'error'); return; }
    setBusy(true);
    let pid;
    try {
      pid = await ensureCcmProject(projectId);
    } catch (e) {
      toast(e.message, 'error');
      setBusy(false);
      return;
    }
    setUploadedPid(pid);
    let ok = 0;
    for (let i = 0; i < files.length; i += 1) {
      if (files[i].state !== 'queued') continue;
      setFiles((prev) => prev.map((f, j) => (j === i ? { ...f, state: 'uploading' } : f)));
      try {
        // eslint-disable-next-line no-await-in-loop
        if (isZip(files[i].file)) {
          // Bulk import: every document in the archive, duplicates skipped.
          const r = await CCM.knowledge.importZip(files[i].file, pid, folder);
          ok += r.imported;
          setFiles((prev) => prev.map((f, j) => (j === i ? { ...f, state: 'imported', zip: r } : f)));
        } else {
          const res = await CCM.knowledge.uploadToFolder(files[i].file, pid, folder);
          if (res.status === 'duplicate') {
            setFiles((prev) => prev.map((f, j) => (j === i ? { ...f, state: 'duplicate' } : f)));
          } else {
            ok += 1;
            setFiles((prev) => prev.map((f, j) => (j === i ? { ...f, state: 'parsing', docId: res.document?.id } : f)));
          }
        }
      } catch (e) {
        setFiles((prev) => prev.map((f, j) => (j === i ? { ...f, state: 'error', error: e.message } : f)));
      }
    }
    setBusy(false);
    if (ok) {
      toast(`${ok} file${ok > 1 ? 's' : ''} uploaded. Indexing runs in the background.`, 'success');
      onUploaded?.(pid, folder);
    }
  };

  // Once nothing is waiting to upload, the dialog can simply be closed;
  // indexing carries on in the background.
  const finished = files.length > 0 && !busy && pending.length === 0;

  return (
    <Modal title="Upload documents" onClose={busy ? undefined : onClose}>
      <div className="cx-field">
        <label htmlFor="up-project">Project</label>
        <ProjectSelect id="up-project" projects={projects} value={projectId} onChange={setProjectId} />
      </div>
      <div className="cx-field">
        <label>Folder</label>
        <div className="cx-ftype" role="radiogroup" aria-label="Folder">
          {FOLDERS.map((f) => (
            <button key={f.key} type="button" role="radio" aria-checked={folder === f.key}
              className={`cx-ft ${folder === f.key ? 'on' : ''}`} onClick={() => setFolder(f.key)}>
              <b>{f.label}</b><span>{f.hint}</span>
            </button>
          ))}
        </div>
      </div>
      <Dropzone onFiles={addFiles} note="Have many letters? Drop a ZIP and every document inside is imported." />
      {files.map((f, i) => {
        const detected = folder === 'contract_volume' && !isZip(f.file) ? detectedFromName(f.file.name) : null;
        const indexedInfo = f.state === 'indexed'
          ? ['Duplicate check passed', f.pages ? `${f.pages} page${f.pages === 1 ? '' : 's'}` : null,
            folder === 'contract_volume' ? `${f.clauses || 0} clauses found` : null,
            f.ocr ? `OCR on ${f.ocr} page${f.ocr === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ')
          : null;
        const zipInfo = f.zip
          ? `${f.zip.imported} imported${f.zip.duplicates.length ? ` · ${f.zip.duplicates.length} duplicate${f.zip.duplicates.length === 1 ? '' : 's'} skipped` : ''}${f.zip.skipped.length ? ` · ${f.zip.skipped.length} unsupported` : ''}${f.zip.errors.length ? ` · ${f.zip.errors.length} failed` : ''}`
          : null;
        const sub = f.error
          || indexedInfo
          || zipInfo
          || (f.state === 'duplicate' ? 'Duplicate check: this exact file is already in the project' : null)
          || (isZip(f.file) ? `${fmtSize(f.file.size)} · ZIP: every document inside is imported` : null)
          || detected
          || `${fmtSize(f.file.size)} · ${folderOf(folder).label}`;
        const percent = { queued: 0, uploading: 35, parsing: 72, indexed: 100, failed: 100, error: 0, duplicate: 100, imported: 100 }[f.state];
        return (
          <div className="cx-file" key={`${f.file.name}-${i}`}>
            <div className="cx-grow">
              <div className="cx-b cx-s12" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.file.name}</div>
              <div className="cx-s11 cx-muted">{sub}</div>
            </div>
            {f.state !== 'queued' && f.state !== 'error' && (
              <div style={{ width: 120, flex: 'none' }}>
                <div className="cx-bar"><i className={f.state === 'failed' ? 'red' : ''} style={{ width: `${percent}%` }} /></div>
              </div>
            )}
            {f.state === 'queued' && (
              <>
                <Chip tone="gray">Queued</Chip>
                <button type="button" className="cx-modal-close" aria-label={`Remove ${f.file.name}`}
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}>×</button>
              </>
            )}
            {f.state === 'uploading' && <Chip tone="warn">Uploading</Chip>}
            {f.state === 'parsing' && <Chip tone="warn">{folder === 'contract_volume' ? 'Parsing clauses' : 'Indexing'}</Chip>}
            {f.state === 'indexed' && (f.keywordOnly ? <Chip tone="warn" title="Embeddings were unavailable">Keyword only</Chip> : <Chip tone="ok">Indexed</Chip>)}
            {f.state === 'duplicate' && <Chip tone="gray">Already in project</Chip>}
            {f.state === 'imported' && <Chip tone="ok">Imported</Chip>}
            {(f.state === 'failed' || f.state === 'error') && <Chip tone="bad">Failed</Chip>}
          </div>
        );
      })}
      <div className="cx-toolbar">
        <span className="cx-s11 cx-muted">
          {project ? `Files are tagged to ${project.name} → ${folderOf(folder).label}.` : 'Choose the project these files belong to.'}
        </span>
        <span className="cx-spacer" />
        {finished ? (
          <Btn variant="primary" onClick={onClose}>Done</Btn>
        ) : (
          <>
            <Btn onClick={onClose} disabled={busy}>Cancel</Btn>
            <Btn variant="primary" onClick={upload} disabled={busy || !pending.length || !projectId}>
              {busy ? 'Uploading…' : pending.length ? `Upload ${pending.length} file${pending.length === 1 ? '' : 's'}` : 'Upload files'}
            </Btn>
          </>
        )}
      </div>
    </Modal>
  );
}

export function UploadLetterModal({ projects, initialProjectId, onClose, onUploaded }) {
  const [projectId, setProjectId] = React.useState(initialProjectId || '');
  const [file, setFile] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const pid = projectId ? await ensureCcmProject(projectId) : null;
      const res = await CCM.letters.upload(file, pid);
      toast('Letter uploaded. Classification runs in the background.', 'success');
      onUploaded?.(res.letter);
    } catch (e) {
      toast(`Upload failed: ${e.message}`, 'error');
      setBusy(false);
    }
  };

  return (
    <Modal title="Upload incoming letter" size="sm" onClose={busy ? undefined : onClose}>
      <div className="cx-field">
        <label htmlFor="ul-project">Project</label>
        <ProjectSelect id="ul-project" projects={projects} value={projectId} onChange={setProjectId}
          placeholder="Not sure yet (CCM will suggest one)" />
      </div>
      {file ? (
        <div className="cx-file">
          <div className="cx-grow">
            <div className="cx-b cx-s12">{file.name}</div>
            <div className="cx-s11 cx-muted">{fmtSize(file.size)}</div>
          </div>
          <button type="button" className="cx-modal-close" aria-label="Remove file" onClick={() => setFile(null)}>×</button>
        </div>
      ) : (
        <Dropzone multiple={false} title="Drop the client's letter here" onFiles={(list) => setFile(list[0] || null)} />
      )}
      <div className="cx-toolbar">
        <span className="cx-spacer" />
        <Btn onClick={onClose} disabled={busy}>Cancel</Btn>
        <Btn variant="primary" onClick={submit} disabled={!file || busy}>{busy ? 'Uploading…' : 'Upload letter'}</Btn>
      </div>
    </Modal>
  );
}
