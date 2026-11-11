/**
 * AI Drafting on the CCM public API: draft → save → edit → review → export.
 *   left:   the incoming letter (text, attachments, original, optional analysis)
 *   centre: generate options, the editable reply, review flags, export
 *   right:  contract clauses and earlier letters the draft used, warnings
 * URL: #/master/ai-drafting?project=<id>&file=<letter file>
 * Without a letter it shows the start screen (drafting-start.jsx).
 *
 * The API keeps one saved draft per project + letter + user. The generation
 * job is linked to it (source_job_id) so review/export use the same evidence.
 */
import React from 'react';
import {
  ccmApi, unwrap, waitForJob, jobResult,
} from '../ccm-public-api';
import { errorText, readinessText, runJob } from '../project-setup';
import {
  cacheDraftResult, currentUser, loadDraftResult, replyState, toUtf16Range, useProjects,
} from '../session';
import {
  DEFAULT_OPTIONS, LENGTHS, LETTER_TYPES, TONES, charCount, clearDraftHandoff, composeInstructions, letterTypeOf,
  parseInstructions, peekDraftHandoff, switchTask, taskOf, textBudget,
} from '../draft-options';
import MenuSelect from '../ui/menu-select';
import DraftingStart from './drafting-start';
import DraftsHistory from './drafts-history';
import LetterReply from './letter-reply';
import {
  flagSegments, historyCutoff, openBlob, saveBlob, toExternalId,
} from '../api-console/helpers';
import {
  PageTop, Btn, Card, Chip, Empty, Skeleton, Modal, go, ROUTES, toast, useQueryParam, fmtDate, fmtDateTime, humanize,
} from '../ui/kit';

const QUICK_INSTRUCTIONS = [
  'Request the supporting records before accepting anything',
  'Acknowledge receipt only; reserve the Engineer\'s position',
  'Keep it short: three paragraphs',
  'Propose a meeting to resolve the issue',
];

const FLAG_TONE = { red: 'bad', amber: 'warn' };

/* ─── Left column ───────────────────────────────────────────────────────── */

function IncomingLetter({ project, letter }) {
  const [analysis, setAnalysis] = React.useState(null);
  const [busy, setBusy] = React.useState('');

  const openOriginal = async () => {
    setBusy('original');
    const r = await ccmApi.letters.original(project, letter.file);
    setBusy('');
    if (r.ok && r.blob) openBlob(r.blob); else toast(`Couldn't open the original: ${errorText(r)}`, 'error');
  };

  const analyse = async () => {
    setBusy('analyse');
    try {
      setAnalysis(await runJob(await ccmApi.letters.analyze(project, letter.file)));
    } catch (e) {
      toast(`Analysis failed: ${errorText(e)}`, 'error');
    } finally {
      setBusy('');
    }
  };

  const a = analysis?.analysis;
  const assessments = (a?.business_assessments || []).filter((b) => b.applies);
  return (
    <Card title="Incoming letter" right={<button type="button" className="cx-link" onClick={() => go(ROUTES.drafting(project))}>Change</button>}>
      <div className="cx-kv"><span>From</span><b>{letter.sender || '—'}</b></div>
      <div className="cx-kv"><span>Ref</span><b style={{ textAlign: 'right', overflowWrap: 'anywhere' }}>{letter.reference || letter.file}</b></div>
      <div className="cx-kv"><span>Dated</span><b>{letter.date ? fmtDate(letter.date) : '—'}</b></div>
      <div className="cx-toolbar" style={{ gap: 6 }}>
        {letter.is_incoming ? <Chip tone="blue">Incoming</Chip> : <Chip tone="gray">{letter.is_outgoing ? 'Outgoing' : 'Other'}</Chip>}
        {letter.sender_party && <Chip tone="gray">{letter.sender_party}</Chip>}
        {(letter.milestones || []).map((m) => <Chip key={m} tone="warn">{m}</Chip>)}
      </div>
      {letter.reply && (
        <div className="cx-banner info">
          <span className="cx-s12">Already answered by <b>{letter.reply.ref || letter.reply.file}</b>{letter.reply.date ? ` on ${fmtDate(letter.reply.date)}` : ''}. The reply is shown above; a new draft should stay consistent with it.</span>
        </div>
      )}
      <div className="cx-toolbar" style={{ gap: 6 }}>
        {letter.original_available && <Btn size="sm" onClick={openOriginal} disabled={!!busy}>{busy === 'original' ? 'Opening…' : 'Open original ↗'}</Btn>}
        <Btn size="sm" onClick={analyse} disabled={!!busy}>{busy === 'analyse' ? 'Analysing…' : analysis ? 'Analyse again' : 'Analyse letter'}</Btn>
      </div>

      {a && (
        <>
          <hr className="cx-hr" />
          <div className="cx-toolbar" style={{ gap: 6 }}>
            {a.category && <Chip tone="blue">{humanize(a.category)}</Chip>}
            {a.urgency && <Chip tone={a.urgency === 'high' ? 'bad' : a.urgency === 'low' ? 'gray' : 'warn'}>{humanize(a.urgency)} urgency</Chip>}
            {a.project_category && <Chip tone="gray">{humanize(a.project_category)}</Chip>}
            {a.risk_category && <Chip tone="warn">Risk: {humanize(a.risk_category)}</Chip>}
          </div>
          {a.intent && <div><div className="cx-eyebrow">Intent</div><div className="cx-s12">{a.intent}</div></div>}
          {a.requested_action && <div><div className="cx-eyebrow">Requested action</div><div className="cx-s12">{a.requested_action}</div></div>}
          {assessments.map((b) => (
            <div key={b.rule_id} className="cx-banner" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
              <b className="cx-s12">Rule: {humanize(b.rule_id)}</b>
              {b.reason && <span className="cx-s12">{b.reason}</span>}
              {b.response_timeline && <span className="cx-s11"><b>Timeline:</b> {b.response_timeline}</span>}
              {b.approval_authority && <span className="cx-s11"><b>Approval:</b> {b.approval_authority}</span>}
              {(b.obligations || []).map((o) => <span key={o} className="cx-s11">• {o}</span>)}
            </div>
          ))}
          {(analysis.warnings || []).length > 0 && <span className="cx-s11 cx-muted">{analysis.warnings.join(' · ')}</span>}
        </>
      )}

      <hr className="cx-hr" />
      <div className="cx-letter-text">{letter.text || <span className="cx-muted">No extracted text.</span>}</div>
      {(letter.attachments || []).length > 0 && (
        <div>
          <div className="cx-eyebrow" style={{ marginBottom: 6 }}>Attachments ({letter.attachments.length})</div>
          {letter.attachments.map((x, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className="cx-s12">{x.subject || x.file || `Attachment ${i + 1}`}{x.date ? ` · ${fmtDate(x.date)}` : ''}</div>
          ))}
        </div>
      )}
      {(letter.prior_references || []).length > 0 && (
        <div>
          <div className="cx-eyebrow" style={{ marginBottom: 6 }}>Letters it refers to</div>
          <div className="cx-toolbar" style={{ gap: 6 }}>
            {letter.prior_references.map((p) => <Chip key={p.reference} tone={p.file ? 'blue' : 'gray'} title={p.file ? `Stored as ${p.file}` : 'Not found in this project'}>{p.reference}</Chip>)}
          </div>
        </div>
      )}
    </Card>
  );
}

/* ─── Right column ──────────────────────────────────────────────────────── */

function ClauseModal({ clause, onClose }) {
  return (
    <Modal title={clause.citation || (clause.clause ? `Clause ${clause.clause}` : 'Contract passage')} onClose={onClose}>
      <div className="cx-toolbar" style={{ gap: 6 }}>
        {clause.volume && <Chip tone="blue">{clause.volume}</Chip>}
        {clause.page_contract != null && <Chip tone="gray">Page {clause.page_contract}</Chip>}
        {clause.matched_in_letter && <Chip tone="warn">Named in the letter</Chip>}
        {(clause.also_in || []).length > 0 && <Chip tone="warn">Same number also in {clause.also_in.join(', ')}</Chip>}
      </div>
      <div className="cx-letter-text" style={{ maxHeight: 420, fontSize: 13 }}>{clause.excerpt}</div>
      <span className="cx-s11 cx-muted">Excerpt supplied to drafting. Check quoted wording against the signed contract before issuing.</span>
    </Modal>
  );
}

function Sources({ result, linked }) {
  const [openClause, setOpenClause] = React.useState(null);
  if (!result) {
    return (
      <Card title="Sources used">
        <span className="cx-s12 cx-muted">
          {linked
            ? 'This draft is linked to its generation evidence on the server, but this browser no longer has the details. Review and export still use it.'
            : 'Contract clauses and earlier letters used by a draft appear here.'}
        </span>
      </Card>
    );
  }
  const clauses = result.clause_references || [];
  const history = result.history_used || [];
  return (
    <>
      <Card title="Contract clauses" right={<Chip tone="gray">{clauses.length}</Chip>}>
        {clauses.length === 0 ? <span className="cx-s12 cx-muted">No contract passages were used.</span> : clauses.map((c) => (
          <div className="cx-src" key={c.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div className="cx-src-body"><div className="cx-src-title" title={c.citation}>{c.citation || c.clause || c.id}</div>
                <div className="cx-s11 cx-muted cx-ellipsis">{[c.volume, c.page_contract != null ? `p.${c.page_contract}` : null].filter(Boolean).join(' · ')}</div></div>
              {c.matched_in_letter && <Chip tone="warn" title="The incoming letter names this clause">Cited</Chip>}
            </div>
            <div className="cx-s11 cx-muted" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.excerpt}</div>
            <button type="button" className="cx-link" style={{ textAlign: 'left' }} onClick={() => setOpenClause(c)}>Full excerpt</button>
          </div>
        ))}
      </Card>
      <Card title="Earlier letters" right={<Chip tone="gray">{history.length}</Chip>}>
        {history.length === 0 ? <span className="cx-s12 cx-muted">No earlier correspondence was used.</span> : history.map((h) => (
          <div className="cx-src" key={h.file} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div className="cx-src-body"><div className="cx-src-title">{h.ref || h.file}</div>
                <div className="cx-s11 cx-muted cx-ellipsis">{[h.date ? fmtDate(h.date) : null, h.sender].filter(Boolean).join(' · ')}</div></div>
              {h.is_prior_reply && <Chip tone="ok" title="Our own earlier letter">Our reply</Chip>}
            </div>
            {h.subject && <div className="cx-s12">{h.subject}</div>}
            {h.snippet && <div className="cx-s11 cx-muted" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{h.snippet}</div>}
          </div>
        ))}
        {result.provenance?.history_as_of && <span className="cx-s11 cx-muted">Correspondence up to {fmtDate(result.provenance.history_as_of)}.</span>}
      </Card>
      {(result.warnings || []).length > 0 && (
        <Card title="Warnings">
          {result.warnings.map((w) => <div key={w} className="cx-check"><span className="cx-dot warn" />{w}</div>)}
        </Card>
      )}
      {openClause && <ClauseModal clause={openClause} onClose={() => setOpenClause(null)} />}
    </>
  );
}

/* ─── Centre: review flags ──────────────────────────────────────────────── */

function FlagList({ review, stale, onPick }) {
  if (!review) return <span className="cx-s12 cx-muted">Run Review to check the draft against the contract and correspondence.</span>;
  const { flags } = review;
  const red = flags.filter((f) => f.level === 'red').length;
  return (
    <>
      <div className="cx-toolbar" style={{ gap: 6 }}>
        {flags.length === 0 ? <Chip tone="ok">No issues found</Chip> : (
          <>
            {red > 0 && <Chip tone="bad">{red} must fix</Chip>}
            {flags.length - red > 0 && <Chip tone="warn">{flags.length - red} to check</Chip>}
          </>
        )}
        {stale && <Chip tone="gray">Text changed since this check. Review again.</Chip>}
        <span className="cx-spacer" />
        {review.checked_against && <span className="cx-s11 cx-muted">Checked against: {review.checked_against}</span>}
      </div>
      {flags.map((f) => (
        <button key={f.id} type="button" className="cx-src" style={{ border: 0, textAlign: 'left', font: 'inherit', cursor: stale ? 'default' : 'pointer', flexDirection: 'column', alignItems: 'stretch', gap: 4 }}
          onClick={() => !stale && onPick(f)} title={stale ? undefined : 'Select this text in the editor'}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Chip tone={FLAG_TONE[f.level] || 'gray'}>{f.level === 'red' ? 'Fix' : 'Check'}</Chip>
            <b className="cx-s12">{f.title}</b>
            <span className="cx-spacer" />
            <span className="cx-s11 cx-muted">{humanize(f.kind)}</span>
          </div>
          <span className="cx-s12" style={{ fontStyle: 'italic' }}>“{f.text}”</span>
          {f.detail && <span className="cx-s12 cx-muted">{f.detail}</span>}
          {f.action && <span className="cx-s12"><b>Action:</b> {f.action}</span>}
        </button>
      ))}
      {(review.warnings || []).length > 0 && <span className="cx-s11 cx-muted">{review.warnings.join(' · ')}</span>}
    </>
  );
}

function HighlightedText({ text, flags }) {
  return (
    <div className="cx-letter-text" style={{ maxHeight: 'none', fontSize: 13, color: 'var(--cx-ink)', padding: 20 }}>
      {flagSegments(text, flags).map((s, i) => (s.flag
        // eslint-disable-next-line react/no-array-index-key
        ? <mark key={i} className={`cx-flag ${s.flag.level}`} title={`${s.flag.title}: ${s.flag.detail || ''}`}>{s.text}</mark>
        // eslint-disable-next-line react/no-array-index-key
        : <React.Fragment key={i}>{s.text}</React.Fragment>))}
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default function AiDrafting() {
  const project = useQueryParam('project');
  const file = useQueryParam('file');
  if (!project || !file) return <DraftingStart />;
  return <DraftingWorkspace key={`${project}/${file}`} project={project} file={file} />;
}

function DraftingWorkspace({ project, file }) {
  const user = currentUser();
  const [info, setInfo] = React.useState(null);
  const [letter, setLetter] = React.useState(null);
  const [saved, setSaved] = React.useState(null); // SavedDraft or null
  const [result, setResult] = React.useState(null); // DraftReply of the linked job
  const [text, setText] = React.useState('');
  const [review, setReview] = React.useState(null); // { flags, forText, checked_against, warnings }
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState('');
  const [view, setView] = React.useState('edit'); // 'edit' | 'flags'
  const [replyTo, setReplyTo] = React.useState('');
  const [historyAsOf, setHistoryAsOf] = React.useState('');
  const [instructions, setInstructions] = React.useState('');
  const [confirmRegenerate, setConfirmRegenerate] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [options, setOptions] = React.useState(DEFAULT_OPTIONS); // letter type, tone, length, prompt
  const [history, setHistory] = React.useState(false);
  const [autoStart, setAutoStart] = React.useState(false); // came from the start screen's Send
  const autoDone = React.useRef(false);
  const { projects } = useProjects();
  const editor = React.useRef(null);

  const load = React.useCallback(async () => {
    const [p, l, d] = await Promise.all([
      ccmApi.projects.get(project), ccmApi.letters.get(project, file), ccmApi.savedDrafts.get(project, file, user),
    ]);
    if (!p.ok) { setError(errorText(p)); return; }
    if (!l.ok) { setError(errorText(l)); return; }
    const projectInfo = p.data;
    const letterData = l.data;
    setInfo(projectInfo);
    setLetter(letterData);
    const others = (projectInfo.parties || []).filter((x) => x.key !== projectInfo.author_party);
    setReplyTo(others.some((x) => x.key === letterData.sender_party) ? letterData.sender_party : (others[0]?.key || ''));
    setHistoryAsOf(historyCutoff(letterData.date));
    const draft = d.ok ? d.data : null;
    setSaved(draft);
    setText(draft ? draft.text : '');
    const handoff = peekDraftHandoff(project, file);
    if (handoff) {
      setOptions({
        type: handoff.type || '', tone: handoff.tone || DEFAULT_OPTIONS.tone,
        length: handoff.length || DEFAULT_OPTIONS.length, prompt: handoff.prompt || '',
      });
      setInstructions(handoff.text || '');
      setAutoStart(true);
    } else {
      const parsed = parseInstructions(draft?.instructions);
      setOptions(parsed.options);
      setInstructions(parsed.text);
    }
    if (draft?.source_job_id) {
      const r = await loadDraftResult(project, draft.source_job_id);
      setResult(r);
      if (r && r.draft?.text === draft.text) setReview({ flags: r.review_flags || [], forText: r.draft.text, checked_against: 'generation' });
    }
    setError(null);
  }, [project, file, user]);
  React.useEffect(() => { load(); }, [load]);

  const dirty = saved ? text !== saved.text : !!text;
  const others = (info?.parties || []).filter((x) => x.key !== info?.author_party);
  const ready = info?.readiness?.ready;
  const canDraft = ready && letter?.is_incoming && (letter?.text || '').trim();
  const stale = review && review.forText !== text;

  // Warn before leaving with unsaved edits.
  React.useEffect(() => {
    if (!dirty) return undefined;
    const onLeave = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [dirty]);

  const generate = async () => {
    setConfirmRegenerate(false);
    setBusy('generate');
    const composed = composeInstructions(options, instructions);
    try {
      const attachments = (letter.attachments || []).filter((x) => (x.text || '').trim()).slice(0, 8)
        .map((x, i) => ({ external_id: toExternalId(x.file || `attachment-${i + 1}`, `attachment-${i + 1}`), content: { text: x.text } }));
      const ids = new Set();
      attachments.forEach((x, i) => { if (ids.has(x.external_id)) x.external_id = `attachment-${i + 1}`; ids.add(x.external_id); });
      const receiptResponse = await ccmApi.draftReplies.create(project, {
        correspondence: { external_id: toExternalId(file), content: { text: letter.text } },
        attachments,
        reply_to_party: replyTo,
        history_as_of: historyAsOf,
        instructions: composed,
      });
      const receipt = unwrap(receiptResponse);
      const draftResult = jobResult(await waitForJob(receipt, { timeoutMs: 15 * 60 * 1000, intervalMs: 2000 }));
      cacheDraftResult(receipt.id, draftResult);
      // Save straight away: the job expires an hour after it finishes.
      const s = unwrap(await ccmApi.savedDrafts.save(project, file, {
        user, text: draftResult.draft.text, source_job_id: receipt.id, instructions: composed,
      }));
      setSaved(s);
      setResult(draftResult);
      setText(draftResult.draft.text);
      setReview({ flags: draftResult.review_flags || [], forText: draftResult.draft.text, checked_against: 'generation' });
      setView('edit');
      toast('Draft ready and saved', 'success');
    } catch (e) {
      toast(`Drafting failed: ${errorText(e)}`, 'error');
    } finally {
      setBusy('');
    }
  };

  // Coming from the start screen: generate straight away, or confirm first if a
  // saved draft would be replaced.
  React.useEffect(() => {
    if (!autoStart || autoDone.current || !letter || !replyTo || !historyAsOf) return;
    autoDone.current = true;
    setAutoStart(false);
    clearDraftHandoff();
    if (!canDraft) { toast('This letter can\'t be drafted yet. Check the project setup and the letter text.', 'error'); return; }
    if (saved) setConfirmRegenerate(true); else generate();
  }, [autoStart, letter, replyTo, historyAsOf, canDraft, saved]); // eslint-disable-line react-hooks/exhaustive-deps

  // Same rules as the start screen: a task stays chosen while its [bracketed]
  // details are edited, and switching keeps the user's own words.
  const task = taskOf(options.type, options.prompt);
  const editInstructions = (value) => {
    setInstructions(value);
    if (!value.trim() && options.prompt) setOptions((o) => ({ ...o, prompt: '' }));
  };
  const chooseType = (id) => {
    if (id === options.type) return;
    setInstructions((t) => switchTask(t, task, null));
    setOptions((o) => ({ ...o, type: id, prompt: '' }));
  };
  const pickTask = (x) => {
    const next = x.title === options.prompt ? null : x;
    setInstructions((t) => switchTask(t, task, next));
    setOptions((o) => ({ ...o, prompt: next ? next.title : '' }));
  };
  const budget = textBudget(options);
  const used = charCount(instructions.trim());
  const overBudget = used > budget;

  const save = async () => {
    setBusy('save');
    const r = await ccmApi.savedDrafts.save(project, file, { user, text });
    setBusy('');
    if (r.ok) { setSaved(r.data); toast('Draft saved', 'success'); } else toast(`Couldn't save: ${errorText(r)}`, 'error');
  };

  const runReview = async () => {
    if (!text.trim()) return;
    setBusy('review');
    try {
      const reviewed = text;
      const res = await runJob(await ccmApi.letters.review(project, file, { text: reviewed, user }));
      setReview({ flags: res.review_flags || [], forText: reviewed, checked_against: res.checked_against, warnings: res.warnings });
      setView('flags');
      const n = (res.review_flags || []).length;
      toast(n ? `Review found ${n} item${n === 1 ? '' : 's'} to check` : 'Review found no issues', n ? 'info' : 'success');
    } catch (e) {
      toast(`Review failed: ${errorText(e)}`, 'error');
    } finally {
      setBusy('');
    }
  };

  const exportDocx = async (annotate) => {
    if (!text.trim()) return;
    setBusy(annotate ? 'export-comments' : 'export');
    const r = await ccmApi.letters.exportDocx(project, file, { text, annotate, user });
    setBusy('');
    if (!r.ok || !r.blob) { toast(`Export failed: ${errorText(r)}`, 'error'); return; }
    const name = r.filename || `${(letter.reference || file).replace(/[^A-Za-z0-9._-]+/g, '-')}-reply.docx`;
    saveBlob(r.blob, name);
    // Export with a user also saves the text and marks the draft exported.
    const d = await ccmApi.savedDrafts.get(project, file, user);
    if (d.ok) setSaved(d.data);
    toast(`Downloaded ${name}`, 'success');
  };

  const remove = async () => {
    setConfirmDelete(false);
    setBusy('delete');
    const r = await ccmApi.savedDrafts.remove(project, file, user);
    setBusy('');
    if (r.ok) {
      setSaved(null); setText(''); setResult(null); setReview(null);
      toast('Draft deleted', 'success');
    } else toast(errorText(r), 'error');
  };

  const pickFlag = (flag) => {
    setView('edit');
    requestAnimationFrame(() => {
      const el = editor.current;
      if (!el) return;
      const [s, e] = toUtf16Range(text, flag.start, flag.end);
      el.focus();
      el.setSelectionRange(s, e);
      // Scroll the selection into view: put it near the top of the box.
      const before = text.slice(0, s).split('\n').length;
      el.scrollTop = Math.max(0, (before - 3) * 20);
    });
  };

  const ref = letter ? (letter.reference || file) : '…';
  const [stateLabel, stateTone] = saved?.exported ? ['Exported', 'ok'] : saved ? ['Saved draft', 'blue'] : replyState(letter);

  return (
    <>
      <PageTop crumbs={[{ label: 'Letters', to: ROUTES.lettersFor(project) }, { label: ref }]} title={`Draft reply · ${ref}`}
        actions={(
          <>
            <Btn onClick={() => go(ROUTES.drafting(project))}>New draft</Btn>
            <Btn onClick={() => setHistory(true)}>Drafts history</Btn>
            <Btn onClick={() => exportDocx(false)} disabled={!text.trim() || !!busy}
              title="DOCX with a table of review notes at the end">{busy === 'export' ? 'Exporting…' : 'Export DOCX'}</Btn>
            <Btn variant="primary" onClick={() => exportDocx(true)} disabled={!text.trim() || !!busy}
              title="DOCX with review findings as Word comments">{busy === 'export-comments' ? 'Exporting…' : 'Export with comments'}</Btn>
          </>
        )} />
      <div className="cx-content" style={{ paddingTop: 20 }}>
        {error && <div className="cx-banner bad"><b>Couldn&apos;t load this letter.</b><span className="cx-s12">{error}</span></div>}
        {info && !ready && (
          <div className="cx-banner">
            <b>This project isn&apos;t ready for drafting.</b>
            <span className="cx-s12">{(info.readiness?.blockers || []).map(readinessText).join(' · ')}</span>
            <span className="cx-spacer" />
            <Btn size="sm" onClick={() => go(ROUTES.project(project, 'setup'))}>Open project setup</Btn>
          </div>
        )}
        {letter && <LetterReply project={project} letter={letter} />}
        {!letter ? (!error && <Skeleton h={520} />) : (
          <div className="cx-row stack-md" style={{ alignItems: 'flex-start' }}>
            <div className="cx-col" style={{ width: 330, flex: 'none' }}>
              <IncomingLetter project={project} letter={letter} />
            </div>

            <div className="cx-col cx-grow" style={{ gap: 12 }}>
              <Card title="Reply"
                right={(
                  <>
                    <Chip tone={stateTone}>{stateLabel}</Chip>
                    {saved?.updated && <span className="cx-s11 cx-muted">Saved {fmtDateTime(saved.updated)}</span>}
                  </>
                )}>
                {!letter.is_incoming && <div className="cx-banner info"><span className="cx-s12">This is not an incoming letter. Replies are drafted to letters from the other parties.</span></div>}

                <div className="cx-row" style={{ gap: 12, flexWrap: 'wrap' }}>
                  <div className="cx-field" style={{ minWidth: 180 }}>
                    <label htmlFor="dr-to">Reply to</label>
                    <select id="dr-to" className="cx-select" value={replyTo} onChange={(e) => setReplyTo(e.target.value)}>
                      {others.map((p) => <option key={p.key} value={p.key}>{p.label || p.key}</option>)}
                    </select>
                  </div>
                  <div className="cx-field" style={{ minWidth: 160 }}>
                    <label htmlFor="dr-asof">Use letters up to</label>
                    <input id="dr-asof" type="date" className="cx-input" value={historyAsOf} min={letter.date || undefined}
                      onChange={(e) => setHistoryAsOf(e.target.value)} />
                  </div>
                  <div className="cx-field cx-grow" style={{ minWidth: 240 }}>
                    <label htmlFor="dr-ins">Instructions for the AI</label>
                    <textarea id="dr-ins" className="cx-textarea" rows={2} value={instructions} onChange={(e) => editInstructions(e.target.value)}
                      placeholder={options.type ? 'Pick a task below, then add your own words' : 'Optional, e.g. ask for the programme impact and do not accept any delay'} />
                    <div className="cx-composer-foot">
                      {/\[[A-Z][A-Z0-9 /&,.'-]*\]/.test(instructions) && <span className="cx-s11 cx-warn-text">Replace the [bracketed] details with this letter&apos;s facts.</span>}
                      <span className="cx-spacer" />
                      <span className={`cx-count ${overBudget ? 'over' : ''}`} title="Your text, within the 4,000-character instructions limit (the letter type's guidance uses the rest)">{used} / {budget}</span>
                    </div>
                  </div>
                </div>
                <div className="cx-composer-bar">
                  <MenuSelect label="Letter type" heading="Letter category" value={options.type} menuWidth={300} disabled={!!busy}
                    onChange={chooseType}
                    options={LETTER_TYPES.map((x) => ({ id: x.id, label: x.label }))} />
                  <MenuSelect label="Tone" heading="Tone of letter" value={options.tone} options={TONES} disabled={!!busy}
                    onChange={(id) => setOptions((o) => ({ ...o, tone: id }))} />
                  <MenuSelect label="Length" heading="Response length" value={options.length} options={LENGTHS} disabled={!!busy}
                    onChange={(id) => setOptions((o) => ({ ...o, length: id }))} />
                </div>
                <div className="cx-prompts">
                  {letterTypeOf(options.type)
                    ? letterTypeOf(options.type).prompts.map((x) => (
                      <button key={x.title} type="button" className={`cx-prompt ${options.prompt === x.title ? 'on' : ''}`} disabled={!!busy} title={x.text}
                        aria-pressed={options.prompt === x.title} onClick={() => pickTask(x)}>{x.title}</button>
                    ))
                    : QUICK_INSTRUCTIONS.map((x) => (
                      <button key={x} type="button" className="cx-prompt" disabled={!!busy} onClick={() => editInstructions(x)}>{x}</button>
                    ))}
                </div>
                <div className="cx-toolbar">
                  <span className="cx-s11 cx-muted">Generating takes about a minute. The draft is saved under {user}.</span>
                  <span className="cx-spacer" />
                  {overBudget && <span className="cx-s11" style={{ color: 'var(--cx-red)' }}>Shorten the instructions by {used - budget} characters.</span>}
                  <Btn variant="primary" disabled={!canDraft || !replyTo || !historyAsOf || !!busy || overBudget}
                    onClick={() => (saved ? setConfirmRegenerate(true) : generate())}>
                    {busy === 'generate' ? 'Drafting…' : saved ? 'Regenerate' : 'Generate draft'}
                  </Btn>
                </div>
              </Card>

              <div className="cx-toolbar" style={{ gap: 8 }}>
                <div className="cx-tabs" role="tablist">
                  <button type="button" role="tab" aria-selected={view === 'edit'} className={`cx-tab ${view === 'edit' ? 'on' : ''}`} onClick={() => setView('edit')}>Edit</button>
                  <button type="button" role="tab" aria-selected={view === 'flags'} className={`cx-tab ${view === 'flags' ? 'on' : ''}`} onClick={() => setView('flags')} disabled={!review || stale}
                    title={stale ? 'Review again to see highlights for the current text' : undefined}>
                    Highlights{review && !stale && review.flags.length > 0 && <span className="n">{review.flags.length}</span>}
                  </button>
                </div>
                {dirty && <Chip tone="blue">Unsaved changes</Chip>}
                <span className="cx-spacer" />
                <Btn onClick={() => setConfirmDelete(true)} disabled={!saved || !!busy}>Delete draft</Btn>
                <Btn onClick={save} disabled={!dirty || !!busy}>{busy === 'save' ? 'Saving…' : 'Save'}</Btn>
                <Btn onClick={runReview} disabled={!text.trim() || !!busy || !ready}>{busy === 'review' ? 'Reviewing…' : 'Review'}</Btn>
              </div>

              <div className="cx-paper-wrap" style={{ position: 'relative', minHeight: 420 }}>
                {busy === 'generate' && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.8)', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <span className="cx-spinner" /> <b>Drafting from this project&apos;s contract and correspondence…</b>
                  </div>
                )}
                {view === 'flags' && review && !stale ? <HighlightedText text={text} flags={review.flags} /> : (text || saved) ? (
                  <textarea ref={editor} className="cx-textarea cx-draft-editor" value={text} onChange={(e) => setText(e.target.value)}
                    spellCheck aria-label="Draft reply" />
                ) : (
                  <Empty title={canDraft ? 'No draft yet' : 'Drafting is not available'}>
                    {canDraft ? 'Choose who the reply is to and click Generate draft. CCM uses this project’s contract and earlier letters and cites the clauses it relies on.'
                      : !ready ? 'Finish the project setup first.' : 'Pick an incoming letter with extracted text.'}
                  </Empty>
                )}
              </div>

              <Card title="Review">
                <FlagList review={review} stale={stale} onPick={pickFlag} />
              </Card>
              <span className="cx-s11 cx-muted">
                CCM does not send letters. Check the review findings, get the reply approved, then issue the exported DOCX through your usual process.
              </span>
            </div>

            <div className="cx-col" style={{ width: 340, flex: 'none' }}>
              <Sources result={result} linked={!!saved?.source_job_id} />
            </div>
          </div>
        )}
      </div>

      {confirmRegenerate && (
        <Modal title="Replace the saved draft?" size="sm" onClose={() => setConfirmRegenerate(false)}>
          <span>A new draft replaces your saved text{dirty ? ' and your unsaved edits' : ''}. Its sources replace the current ones.</span>
          <div className="cx-toolbar"><span className="cx-spacer" /><Btn onClick={() => setConfirmRegenerate(false)}>Cancel</Btn><Btn variant="primary" onClick={generate}>Regenerate</Btn></div>
        </Modal>
      )}
      {history && <DraftsHistory projects={projects} initialProject={project} onClose={() => setHistory(false)} />}
      {confirmDelete && (
        <Modal title="Delete this draft?" size="sm" onClose={() => setConfirmDelete(false)}>
          <span>Your saved reply to {ref} and its link to the generation evidence are removed. This can&apos;t be undone.</span>
          <div className="cx-toolbar"><span className="cx-spacer" /><Btn onClick={() => setConfirmDelete(false)}>Cancel</Btn><Btn variant="primary" onClick={remove}>Delete</Btn></div>
        </Modal>
      )}
    </>
  );
}
