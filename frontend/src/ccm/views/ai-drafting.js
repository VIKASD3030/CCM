/**
 * AI Drafting workspace — wireframe 06.
 *   left:   the incoming letter, its classification and detected references
 *   centre: the SYSTRA reply (versions, regenerate, copy, PDF) + revise bar
 *   right:  the project sources the draft used and the verification checks
 * Without ?letter=… it shows the letters that are ready to draft.
 */
import React from 'react';
import CCM from '../ccm-api';
import SystraLetter from '../components/SystraLetter';
import {
  PageTop, Btn, Card, Chip, Empty, Skeleton, StatusChip, ProjectSelect, Modal, go, ROUTES, toast, useQueryParam,
  folderOf, letterRef, letterSubject, letterFrom, urgencyTone, humanize, cap, timeAgo, fmtDate, fmtDateTime,
  detectReferences, waitForJob, ensureCcmProject, isOpenLetter, openOriginal,
} from '../ui/kit';
import { UploadLetterModal } from '../ui/modals';

const REVISE_PROMPTS = [
  'Make the tone more formal',
  'Shorten to three paragraphs',
  'Ask for the supporting documents',
  'Propose a meeting to resolve this',
  'Reserve our rights under the contract',
];

const CLAUSE_IN_TEXT = /(?:Sub-?Clause|Clause|Cl\.?)\s+(\d{1,2}(?:\.\d{1,2}){0,3})/gi;

/** Citation chips for one paragraph: each clause it names, with the source
 *  that backs it, or a warning when no source does. */
function ParagraphCites({ text, verification }) {
  const clauses = [...new Set([...(text || '').matchAll(CLAUSE_IN_TEXT)].map((m) => m[1]))];
  if (!clauses.length) return null;
  const cited = verification?.clauses_cited || [];
  const unverified = new Set(verification?.unverified_clauses || []);
  return (
    <div className="cx-toolbar" style={{ gap: 6, marginTop: 6 }}>
      {clauses.map((c) => {
        const hit = cited.find((x) => x.clause === c && x.found);
        if (hit) return <Chip key={c} tone="blue">{hit.source_id} · Cl {c}</Chip>;
        if (unverified.has(c)) return <Chip key={c} tone="warn">Cl {c} · not in sources</Chip>;
        return <Chip key={c} tone="gray">Cl {c}</Chip>;
      })}
    </div>
  );
}

/** Readable on-screen view of the reply (wireframe 06). The branded A4 letter
 *  is rendered separately, off-screen, for the PDF. */
export function DraftPaper({ data }) {
  const rec = data.recipient || {};
  const sig = data.signatory || {};
  const v = data.verification;
  return (
    <div style={{ padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: 13, fontSize: 12.5, lineHeight: 1.6 }}>
      <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid var(--cx-line)' }}>
        <span className="cx-s11 cx-muted">SYSTRA MVA Consulting (India) Pvt Ltd</span>
        <span className="cx-spacer" />
        <b style={{ color: 'var(--cx-red)', fontSize: 15, letterSpacing: '.04em' }}>SYSTRA</b>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <span>Our Ref No.: {data.reference_number}</span><span className="cx-spacer" /><span>Date: {data.date}</span>
      </div>
      <div>
        To,<br />
        {rec.attention && <>Kind Attn: {rec.attention}<br /></>}
        {[rec.name, rec.organization, ...(rec.address_lines || [])].filter(Boolean).map((line, i) => <React.Fragment key={i}>{line}<br /></React.Fragment>)}
      </div>
      <b style={{ fontSize: 13 }}>Subject: {data.subject}</b>
      {data.project && <span>Project: {data.project}</span>}
      {data.reference && <span>Ref: {data.reference}</span>}
      <div>{data.salutation}</div>
      {data.opening_line && <div>{data.opening_line}</div>}
      {(data.body || []).map((p, i) => (
        <div key={i}>{p}<ParagraphCites text={p} verification={v} /></div>
      ))}
      {(data.closing_lines || []).map((l, i) => <div key={`c${i}`}>{l}</div>)}
      <div>With highest regards,</div>
      <div>
        <b>{sig.name}</b><br />
        <span className="cx-muted">{[sig.designation_line_1, sig.designation_line_2].filter(Boolean).join(', ')}</span><br />
        <span className="cx-muted">{sig.for_company}</span>
      </div>
      {(data.enclosure || []).length > 0 && <div className="cx-s12">Encl: {data.enclosure.join('; ')}</div>}
    </div>
  );
}

function LetterPicker({ letters, projects, onUpload }) {
  const name = (id) => projects.find((p) => p.id === id)?.name;
  const ready = letters.filter(isOpenLetter);
  return (
    <Card title="Choose a letter to reply to" right={<Btn onClick={onUpload}>Upload letter</Btn>}>
      {ready.length === 0 ? (
        <Empty title="No open letters" action={<Btn variant="primary" onClick={onUpload}>Upload letter</Btn>}>Upload a client letter to start drafting a reply.</Empty>
      ) : (
        <div className="cx-table-wrap">
          <table className="cx-table">
            <thead><tr><th>Ref</th><th>Subject</th><th>Project</th><th>Urgency</th><th>Received</th><th>Status</th><th /></tr></thead>
            <tbody>
              {ready.map((l) => (
                <tr key={l.id} className="clickable" onClick={() => go(ROUTES.drafting(l.id))}>
                  <td className="cx-s12">{letterRef(l)}</td>
                  <td><div className="cx-ellipsis">{letterSubject(l)}</div></td>
                  <td>{name(l.project_id) || <Chip tone="warn">Unassigned</Chip>}</td>
                  <td>{l.urgency ? <Chip tone={urgencyTone(l.urgency)}>{cap(l.urgency)}</Chip> : '–'}</td>
                  <td>{timeAgo(l.received_at)}</td>
                  <td><StatusChip status={l.status} /></td>
                  <td><Btn size="sm" onClick={(e) => { e.stopPropagation(); go(ROUTES.drafting(l.id)); }}>Open</Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function IncomingLetter({ letter, projectName, projects, thread, onAssigned }) {
  const refs = detectReferences(letter.raw_text);
  const quoted = (letter.referenced_refs || []).slice(0, 4);
  const answeredBy = thread?.answered_by?.[0];
  const [projectId, setProjectId] = React.useState(letter.suggested_project_id || '');
  const [busy, setBusy] = React.useState(false);
  const suggested = projects.find((p) => p.id === letter.suggested_project_id);
  const assign = async () => {
    setBusy(true);
    try {
      await CCM.letters.assignProject(letter.id, await ensureCcmProject(projectId));
      toast('Project confirmed', 'success');
      onAssigned();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title="Incoming letter" right={<button type="button" className="cx-link" onClick={() => go(ROUTES.drafting())}>Change</button>}>
      <div className="cx-kv"><span>From</span><b>{letterFrom(letter) || '—'}</b></div>
      <div className="cx-kv"><span>Ref</span><b style={{ textAlign: 'right', overflowWrap: 'anywhere' }}>{letterRef(letter)}</b></div>
      {letter.letter_date && <div className="cx-kv"><span>Dated</span><b>{fmtDate(letter.letter_date)}</b></div>}
      <div className="cx-kv"><span>Received</span><b>{fmtDateTime(letter.received_at)}</b></div>
      <div className="cx-toolbar" style={{ gap: 6 }}>
        {projectName ? <Chip tone="red">{projectName}</Chip> : <Chip tone="warn">No project</Chip>}
        {letter.category && <Chip tone="blue">{humanize(letter.domain_category || letter.category)}</Chip>}
        {letter.urgency && <Chip tone={urgencyTone(letter.urgency)}>{cap(letter.urgency)}</Chip>}
        {letter.posture && <Chip tone="gray">{humanize(letter.posture)}</Chip>}
        {letter.scope && <Chip tone="gray">{humanize(letter.scope)}</Chip>}
        {(letter.kd_tags || []).map((t) => <Chip key={t} tone="warn">{t}</Chip>)}
      </div>

      {answeredBy && (
        <div className="cx-banner info" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
          <b className="cx-s12">Already answered</b>
          <span className="cx-s12">
            By {answeredBy.ref_no}{answeredBy.doc_date ? ` · ${fmtDate(answeredBy.doc_date)}` : ''}. A new draft should stay consistent with it.
          </span>
          <Btn size="sm" onClick={() => openOriginal(CCM.knowledge.filePath(answeredBy.id))}>Open that reply</Btn>
        </div>
      )}

      {letter.has_file && (
        <div>
          <Btn size="sm" block onClick={() => openOriginal(CCM.letters.filePath(letter.id))}>Open the scanned letter ↗</Btn>
          <div className="cx-s11 cx-muted" style={{ marginTop: 4 }}>
            The page itself, with the letterhead, stamps and signature that the extracted text leaves out.
            {letter.ocr_pages > 0 ? ` ${letter.ocr_pages} page${letter.ocr_pages === 1 ? '' : 's'} read with OCR.` : ''}
          </div>
        </div>
      )}

      {!letter.project_id ? (
        <div className="cx-banner" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
          <b className="cx-s12">Confirm the project before drafting.</b>
          {suggested && (
            <span className="cx-s12">
              Suggested: <b>{suggested.name}</b>{letter.routing_confidence != null ? ` (${Math.round(letter.routing_confidence * 100)}% sure)` : ''}. {letter.routing_reason}
            </span>
          )}
          <ProjectSelect projects={projects} value={projectId} onChange={setProjectId} placeholder="Choose project" />
          <Btn variant="primary" size="sm" onClick={assign} disabled={!projectId || busy}>Confirm project</Btn>
        </div>
      ) : letter.routing_reason ? (
        <div className="cx-s11 cx-muted"><b>Why this project:</b> {letter.routing_reason}</div>
      ) : null}

      {(letter.intent || letter.requested_action) && (
        <>
          <hr className="cx-hr" />
          {letter.intent && <div><div className="cx-eyebrow">Intent</div><div className="cx-s12">{letter.intent}</div></div>}
          {letter.requested_action && <div><div className="cx-eyebrow">Requested action</div><div className="cx-s12">{letter.requested_action}</div></div>}
          {letter.confidence_score != null && <div className="cx-s11 cx-muted">Classification confidence {Math.round(letter.confidence_score * 100)}%</div>}
        </>
      )}
      <hr className="cx-hr" />
      <div className="cx-letter-text">{letter.raw_text}</div>
      {(refs.clauses.length > 0 || quoted.length > 0) && (
        <div>
          <div className="cx-eyebrow" style={{ marginBottom: 6 }}>Detected references</div>
          <div className="cx-toolbar" style={{ gap: 6 }}>
            {refs.clauses.map((c) => <Chip key={c} tone="warn">Clause {c}</Chip>)}
            {quoted.map((r) => <Chip key={r} tone="warn" title={r}>{r.length > 24 ? `…${r.slice(-22)}` : r}</Chip>)}
          </div>
        </div>
      )}
    </Card>
  );
}

/** Full text of one cited passage, with its document and a jump to the original page. */
function ClauseModal({ chunkId, onClose }) {
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState(null);
  React.useEffect(() => {
    CCM.knowledge.chunk(chunkId).then(setData).catch((e) => setError(e.message));
  }, [chunkId]);
  const c = data?.chunk;
  const d = data?.document;
  const pages = c?.page_from ? (c.page_to && c.page_to !== c.page_from ? `pp.${c.page_from}-${c.page_to}` : `p.${c.page_from}`) : null;
  return (
    <Modal title={c?.clause_no ? `Clause ${c.clause_no}` : 'Passage'} onClose={onClose}>
      {error && <div className="cx-banner bad"><span className="cx-s12">{error}</span></div>}
      {!data && !error && <Skeleton h={120} />}
      {data && (
        <>
          <div className="cx-toolbar" style={{ gap: 6 }}>
            {d && <Chip tone="gray">{d.filename}</Chip>}
            {d?.volume_label && <Chip tone="blue">{d.volume_label}</Chip>}
            {pages && <Chip tone="gray">{pages}</Chip>}
            {d?.ref_no && <Chip tone="warn">{d.ref_no}</Chip>}
          </div>
          <div className="cx-letter-text" style={{ maxHeight: 360, fontSize: 13 }}>{c.text}</div>
          <div className="cx-toolbar">
            <span className="cx-s11 cx-muted">Verify quoted clauses against the cited page before issuing.</span>
            <span className="cx-spacer" />
            {d && <Btn onClick={() => openOriginal(CCM.knowledge.filePath(d.id), { page: c.page_from })}>{c.page_from ? `Open original at p.${c.page_from}` : 'Open original'}</Btn>}
          </div>
        </>
      )}
    </Modal>
  );
}

const BASIS = {
  cited: ['Cited', 'blue', 'The letter names this clause'],
  quoted: ['Quoted', 'gray', 'An earlier letter this one refers to'],
  'prior reply': ['Prior reply', 'warn', 'Our reply that already answers this letter'],
  relevant: ['Relevant', 'gray', 'Found by search'],
};

function Sources({ draft, projectName, onOpen }) {
  const [all, setAll] = React.useState(false);
  const sources = Array.isArray(draft?.context_documents) ? draft.context_documents : [];
  const shown = all ? sources : sources.slice(0, 6);
  return (
    <Card title="Sources used" right={projectName ? <Chip tone="red">Scoped: {projectName}</Chip> : null}>
      {!draft ? <span className="cx-s12 cx-muted">The project records a draft cites appear here.</span>
        : sources.length === 0 ? <span className="cx-s12 cx-muted">No project records were used. Upload contract volumes and letters to this project.</span>
          : shown.map((s, i) => {
            const folder = folderOf(s.document_type);
            const [basisLabel, basisTone, basisHint] = BASIS[s.basis || 'relevant'] || BASIS.relevant;
            const isContract = s.document_type === 'contract_volume';
            const title = s.clause_no
              ? `Clause ${s.clause_no}${s.volume_label ? ` · ${s.volume_label}` : ''}`
              : (s.ref_no || s.source);
            const where = [s.clause_no ? s.source : (s.ref_no ? s.source : null), s.page_from ? `p.${s.page_from}` : null,
              s.doc_date ? fmtDate(s.doc_date) : null].filter(Boolean).join(' · ');
            return (
              <div className="cx-src" key={s.chunk_id || i} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Chip tone={folder?.tone || 'gray'}>{s.label || `#${i + 1}`}</Chip>
                  <div className="cx-src-body">
                    <div className="cx-src-title" title={s.source}>{title}</div>
                    {where && <div className="cx-s11 cx-muted cx-ellipsis">{where}</div>}
                  </div>
                  <Chip tone={basisTone} title={basisHint}>{basisLabel}</Chip>
                </div>
                {s.also_in?.length > 0 && (
                  <Chip tone="warn" title={`Same clause number also in: ${s.also_in.join(', ')}`}>Also in {s.also_in[0]}{s.also_in.length > 1 ? ` +${s.also_in.length - 1}` : ''}</Chip>
                )}
                {s.snippet && (
                  <div className="cx-s11 cx-muted" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.snippet}</div>
                )}
                {s.chunk_id && (
                  <button type="button" className="cx-link" style={{ textAlign: 'left' }} onClick={() => onOpen(s.chunk_id)}>
                    {isContract ? 'Full clause text' : 'Full text'}
                  </button>
                )}
              </div>
            );
          })}
      {sources.length > 6 && <button type="button" className="cx-link" onClick={() => setAll((v) => !v)}>{all ? 'Show fewer' : `Show all ${sources.length} sources`}</button>}
    </Card>
  );
}

export function Verification({ draft }) {
  const v = draft?.letter_data?.verification;
  const issues = v?.issues || 0;
  return (
    <Card title="Verification" right={v ? <Chip tone={issues ? 'warn' : 'ok'}>{issues ? `${issues} to fix` : 'All passed'}</Chip> : null}>
      {!draft ? <span className="cx-s12 cx-muted">Each clause the draft cites is checked against the source text.</span>
        : !v ? <span className="cx-s12 cx-muted">This version was generated before verification was added. Regenerate to check it.</span>
          : v.checks.length === 0 ? <span className="cx-s12 cx-muted">The draft cites no contract clauses.</span>
            : v.checks.map((c, i) => (
              <div className="cx-check" key={i}><span className={`cx-dot ${c.ok ? 'ok' : 'warn'}`} />{c.label}</div>
            ))}
    </Card>
  );
}

export default function AiDrafting() {
  const letterId = useQueryParam('letter');
  const [letter, setLetter] = React.useState(null);
  const [drafts, setDrafts] = React.useState([]);
  const [version, setVersion] = React.useState(null);
  const [letters, setLetters] = React.useState(null);
  const [projects, setProjects] = React.useState([]);
  const [error, setError] = React.useState(null);
  const [working, setWorking] = React.useState(null); // 'generate' | 'revise' | null
  const [instruction, setInstruction] = React.useState('');
  const [uploading, setUploading] = React.useState(false);
  const [pdfOpen, setPdfOpen] = React.useState(false);
  const [thread, setThread] = React.useState(null);
  const [openChunk, setOpenChunk] = React.useState(null);
  const letterNode = React.useRef(null);

  React.useEffect(() => { CCM.projects.list().then((d) => setProjects(d.projects || [])).catch(() => {}); }, []);

  const loadLetter = React.useCallback(async () => {
    if (!letterId) return;
    try {
      const [l, d, t] = await Promise.all([
        CCM.letters.get(letterId), CCM.drafts.forLetter(letterId), CCM.letters.thread(letterId).catch(() => null),
      ]);
      setLetter(l.letter || l);
      setThread(t);
      const list = (d.drafts || []).sort((a, b) => (b.version || 0) - (a.version || 0));
      setDrafts(list);
      setVersion((v) => (list.some((x) => x.id === v) ? v : list[0]?.id || null));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [letterId]);

  React.useEffect(() => {
    setLetter(null); setDrafts([]); setVersion(null); setInstruction('');
    if (letterId) loadLetter();
    else CCM.letters.list(null, null, null, 200).then((d) => setLetters(d.letters || [])).catch((e) => setError(e.message));
  }, [letterId, loadLetter]);

  const draft = drafts.find((d) => d.id === version) || null;
  const projectName = projects.find((p) => p.id === letter?.project_id)?.name;

  const generate = async (text) => {
    setWorking('generate');
    try {
      const res = await CCM.drafts.generate(letterId, text || '');
      await waitForJob(res.job_id, { timeoutMs: 180000 });
      setVersion(null);
      await loadLetter();
      setInstruction('');
      toast('Draft ready', 'success');
    } catch (e) {
      toast(`Drafting failed: ${e.message}`, 'error');
    } finally {
      setWorking(null);
    }
  };

  const revise = async (text) => {
    if (!draft) { generate(text); return; }
    setWorking('revise');
    try {
      const res = await CCM.drafts.regenerate(draft.id, text || 'Regenerate with improvements.');
      setVersion(res.draft?.id || null);
      await loadLetter();
      setInstruction('');
      toast(`Version ${res.draft?.version || ''} ready`, 'success');
    } catch (e) {
      toast(`Revision failed: ${e.message}`, 'error');
    } finally {
      setWorking(null);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(draft?.draft_text || '')
      .then(() => toast('Copied to clipboard', 'success'))
      .catch(() => toast('Copy failed', 'error'));
  };

  const downloadPdf = async () => {
    if (!draft?.letter_data) return;
    // The branded A4 letter is rendered in a short-lived overlay: html2canvas
    // only captures elements that are actually on screen.
    setPdfOpen(true);
    try {
      const [{ default: JsPDF }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas')]);
      await new Promise((r) => setTimeout(r, 250));
      const el = letterNode.current;
      if (!el) throw new Error('Letter not ready');
      const canvas = await html2canvas(el, {
        scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false,
        windowWidth: el.scrollWidth, windowHeight: el.scrollHeight,
      });
      const pdf = new JsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const img = canvas.toDataURL('image/jpeg', 0.95);
      const fullH = (canvas.height * pageW) / canvas.width;
      if (fullH <= pageH * 1.02) {
        pdf.addImage(img, 'JPEG', 0, 0, pageW, Math.min(fullH, pageH));
      } else {
        for (let y = 0; y < fullH; y += pageH) {
          if (y > 0) pdf.addPage();
          pdf.addImage(img, 'JPEG', 0, -y, pageW, fullH);
        }
      }
      const ref = (draft.letter_data?.reference_number || 'SYSTRA-Letter').replace(/[^A-Za-z0-9]+/g, '-');
      pdf.save(`${ref}.pdf`);
    } catch (e) {
      toast(`PDF export failed: ${e.message}`, 'error');
    } finally {
      setPdfOpen(false);
    }
  };

  const sendForReview = () => {
    toast(`Version ${draft.version} is in the review queue`, 'success');
    go(ROUTES.review(draft.id));
  };

  // ── Letter picker ──
  if (!letterId) {
    return (
      <>
        <PageTop crumbs={[{ label: 'Home', to: ROUTES.dashboard }]} title="AI Drafting"
          actions={<Btn variant="primary" onClick={() => setUploading(true)}>Upload letter</Btn>} />
        <div className="cx-content">
          {error && <div className="cx-banner bad"><b>Couldn't load letters.</b><span className="cx-s12">{error}</span></div>}
          {!letters ? <Skeleton h={300} /> : <LetterPicker letters={letters} projects={projects} onUpload={() => setUploading(true)} />}
        </div>
        {uploading && <UploadLetterModal projects={projects} onClose={() => setUploading(false)}
          onUploaded={(l) => { setUploading(false); if (l?.id) go(ROUTES.drafting(l.id)); }} />}
      </>
    );
  }

  const ref = letter ? letterRef(letter) : '…';
  const blocked = letter && !letter.project_id;
  const canSend = draft && draft.status === 'pending_review';

  return (
    <>
      <PageTop crumbs={[{ label: 'Letters', to: ROUTES.letters }, { label: ref }]} title={`Draft reply · ${ref}`}
        actions={(
          <>
            <Btn onClick={downloadPdf} disabled={!draft}>Download PDF</Btn>
            <Btn variant="primary" onClick={sendForReview} disabled={!canSend}
              title={draft && !canSend ? `This version is ${humanize(draft.status).toLowerCase()}` : undefined}>
              Send for review
            </Btn>
          </>
        )} />
      <div className="cx-content" style={{ paddingTop: 20 }}>
        {error && <div className="cx-banner bad"><b>Couldn't load this letter.</b><span className="cx-s12">{error}</span></div>}
        {!letter ? <Skeleton h={520} /> : (
          <div className="cx-row stack-md" style={{ alignItems: 'flex-start' }}>
            <div className="cx-col" style={{ width: 320, flex: 'none' }}>
              <IncomingLetter letter={letter} projectName={projectName} projects={projects} thread={thread} onAssigned={loadLetter} />
            </div>

            <div className="cx-col cx-grow" style={{ gap: 12 }}>
              <div className="cx-toolbar" style={{ gap: 8 }}>
                {drafts.length > 0 ? (
                  <select className="cx-select inline" value={version || ''} onChange={(e) => setVersion(e.target.value)} aria-label="Version">
                    {drafts.map((d) => <option key={d.id} value={d.id}>Version {d.version} of {drafts.length}</option>)}
                  </select>
                ) : <Chip tone="gray">No draft yet</Chip>}
                {draft && <StatusChip status={draft.status} />}
                <span className="cx-spacer" />
                <Btn onClick={() => revise('')} disabled={!draft || !!working || blocked}>Regenerate</Btn>
                <Btn onClick={copy} disabled={!draft}>Copy</Btn>
              </div>

              <div className="cx-paper-wrap" style={{ position: 'relative', minHeight: 420 }}>
                {working && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.75)', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <span className="cx-spinner" /> <b>{working === 'generate' ? 'Drafting from this project’s records…' : 'Revising the draft…'}</b>
                  </div>
                )}
                {draft?.letter_data ? (
                  <DraftPaper data={draft.letter_data} />
                ) : draft ? (
                  <pre style={{ whiteSpace: 'pre-wrap', padding: 32, margin: 0, font: 'inherit' }}>{draft.draft_text}</pre>
                ) : (
                  <Empty title={blocked ? 'Confirm the project to start drafting' : 'No draft yet'}>
                    {blocked ? 'Drafts only use the records of the letter’s project.'
                      : 'CCM will read this project’s contract volumes and earlier letters, then draft a reply with the clauses cited.'}
                  </Empty>
                )}
              </div>

              <div className="cx-prompts">
                {REVISE_PROMPTS.map((p) => (
                  <button key={p} type="button" className="cx-prompt" disabled={!!working || blocked} onClick={() => setInstruction(p)}>{p}</button>
                ))}
              </div>
              <form className="cx-ins" onSubmit={(e) => { e.preventDefault(); if (!working && !blocked) revise(instruction.trim()); }}>
                <textarea rows={1} value={instruction} onChange={(e) => setInstruction(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form.requestSubmit(); } }}
                  placeholder={draft ? 'Ask AI to revise, e.g. soften tone, add Clause 8.4, shorten' : 'Optional instructions for the first draft'}
                  aria-label="Instructions" disabled={blocked} />
                <Btn variant="primary" size="sm" type="submit" disabled={!!working || blocked || (draft && !instruction.trim())}>
                  {draft ? 'Revise' : 'Generate draft'}
                </Btn>
              </form>
            </div>

            <div className="cx-col" style={{ width: 340, flex: 'none' }}>
              <Sources draft={draft} projectName={projectName} onOpen={setOpenChunk} />
              <Verification draft={draft} />
            </div>
          </div>
        )}
      </div>
      {openChunk && <ClauseModal chunkId={openChunk} onClose={() => setOpenChunk(null)} />}
      {pdfOpen && draft?.letter_data && (
        <div className="cx-scrim" style={{ alignItems: 'flex-start', overflow: 'auto', flexDirection: 'column', gap: 12 }} aria-live="polite">
          <div style={{ color: '#fff', display: 'flex', gap: 10, alignItems: 'center', alignSelf: 'center' }}><span className="cx-spinner" />Preparing PDF…</div>
          <div style={{ alignSelf: 'center' }}>
            <SystraLetter data={draft.letter_data} innerRef={(n) => { letterNode.current = n; }} />
          </div>
        </div>
      )}
    </>
  );
}
