/**
 * AI Drafting start screen (prototype frames "06a · Start"): the first screen
 * after sign-in and whenever no letter is open.
 *   - Project picker in the header
 *   - Composer: the user's words, attach the letter to reply to, tone, length
 * Tone, length and the user's words go into the draft request's `instructions`,
 * kept within the API's 4,000 characters (see draft-options.js). Send hands the
 * choices to the drafting workspace, which generates the reply.
 *
 * The CCM public API saves, reviews and exports replies only for stored
 * letters, so the letter is attached from the project's letters or uploaded as
 * a PDF first; pasted letter text alone is not enough.
 */
import React from 'react';
import { ccmApi } from '../ccm-public-api';
import { errorText, readinessText, runJob } from '../project-setup';
import { currentUser, rememberProject, replyState, useProjects } from '../session';
import {
  DEFAULT_OPTIONS, LENGTHS, TONES, charCount, setDraftHandoff, textBudget,
} from '../draft-options';
import MenuSelect from '../ui/menu-select';
import SavedPromptsMenu from '../ui/saved-prompts-menu';
import { Dropzone } from '../ui/modals';
import {
  PageTop, Btn, Chip, Empty, Skeleton, Modal, go, ROUTES, toast, useQueryParam, fmtDate,
} from '../ui/kit';
import paperclipIcon from '../ui/icons/paperclip.svg';
import sendIcon from '../ui/icons/send-arrow.svg';

const INCOMING_RE = /^(incoming|inbound|received|in)([-_].*)?$/i;

/* ─── Attach the letter being replied to ─────────────────────────────────── */

function AttachLetterModal({ project, onPick, onClose }) {
  const user = currentUser();
  const [q, setQ] = React.useState('');
  const [letters, setLetters] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [uploading, setUploading] = React.useState(false);

  React.useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      const r = await ccmApi.letters.list(project, { direction: 'incoming', q: q.trim(), user, page_size: 50, sort: 'date', descending: true });
      if (!live) return;
      if (r.ok) { setLetters(r.data.letters); setError(null); } else { setLetters([]); setError(errorText(r)); }
    }, q ? 300 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [project, q, user]);

  const upload = async (files) => {
    const file = files.find((f) => /\.pdf$/i.test(f.name));
    if (!file) { toast('Choose a PDF of the letter.', 'error'); return; }
    setUploading(true);
    try {
      const opts = await ccmApi.imports.options(project);
      if (!opts.ok) throw new Error(errorText(opts));
      const folder = (opts.data.folders.find((f) => INCOMING_RE.test(f.key)) || opts.data.folders[0])?.key;
      if (!folder) throw new Error('This project has no import folder. Check its configuration.');
      const result = await runJob(await ccmApi.imports.upload(project, { folder, files: [file] }));
      const row = result.rows?.[0];
      if (!row || row.state === 'failed') throw new Error(row?.detail || 'The letter could not be imported.');
      const l = await ccmApi.letters.get(project, row.stem);
      toast(row.state === 'skipped' ? 'This letter was already in the project.' : 'Letter imported.', 'success');
      onPick(l.ok ? l.data : { file: row.stem, reference: '', subject: file.name });
    } catch (e) {
      toast(`Upload failed: ${errorText(e)}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal title="Attach the letter you're replying to" size="lg" onClose={onClose}>
      <input className="cx-input" value={q} onChange={(e) => setQ(e.target.value)} autoFocus
        placeholder="Search incoming letters by subject, reference or sender" aria-label="Search letters" />
      {error && <div className="cx-banner bad"><span className="cx-s12">{error}</span></div>}
      {!letters ? <Skeleton h={160} /> : letters.length === 0 ? (
        <Empty title={q ? 'No letters match' : 'No incoming letters in this project yet'}>Upload the letter as a PDF below.</Empty>
      ) : (
        <div className="cx-table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
          <table className="cx-table">
            <thead><tr><th>Reference</th><th>Subject</th><th>Date</th><th>Reply</th></tr></thead>
            <tbody>
              {letters.map((l) => {
                const [label, tone] = replyState(l);
                return (
                  <tr key={l.file} className="clickable" onClick={() => onPick(l)}>
                    <td className="cx-s12" style={{ whiteSpace: 'nowrap' }}>{l.reference || l.file}</td>
                    <td><div className="cx-ellipsis" style={{ maxWidth: 360 }} title={l.subject}>{l.subject || '—'}</div><div className="cx-s11 cx-muted">{l.sender}</div></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{l.date ? fmtDate(l.date) : '—'}</td>
                    <td><Chip tone={tone}>{label}</Chip></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {uploading ? (
        <div className="cx-drop"><b>Importing the letter…</b><span className="cx-s12 cx-muted">Reading the PDF can take a little while.</span></div>
      ) : (
        <Dropzone onFiles={upload} multiple={false} title="Or upload the letter (PDF)"
          hint="It is imported into this project's incoming letters, then attached." />
      )}
    </Modal>
  );
}

/* ─── Start screen ──────────────────────────────────────────────────────── */

export default function DraftingStart() {
  const wantedProject = useQueryParam('project');
  const { projects, error: projectsError } = useProjects();
  const [project, setProject] = React.useState('');
  const [info, setInfo] = React.useState(null); // project with readiness
  const [letter, setLetter] = React.useState(null);
  const [options, setOptions] = React.useState(DEFAULT_OPTIONS);
  const [text, setText] = React.useState('');
  const [attaching, setAttaching] = React.useState(false);
  const box = React.useRef(null);

  // Only a project named in the URL is preselected; otherwise the user picks one.
  React.useEffect(() => {
    if (projects && wantedProject && projects.some((p) => p.project_id === wantedProject)) setProject(wantedProject);
  }, [projects, wantedProject]);

  React.useEffect(() => {
    setInfo(null);
    if (!project) return undefined;
    let live = true;
    ccmApi.projects.get(project).then((r) => { if (live) setInfo(r.ok ? r.data : null); });
    return () => { live = false; };
  }, [project]);

  // Grow the instructions box with its text.
  React.useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  const chooseProject = (id) => { setProject(id); setLetter(null); rememberProject(id); };

  const editText = (value) => setText(value);

  const ready = info?.readiness?.ready;
  const budget = textBudget(options);
  const used = charCount(text.trim());
  const over = used > budget;
  const missing = !project ? 'Select a project first.' : !letter ? 'Attach the letter you are replying to.'
    : info && !ready ? 'This project is not ready for drafting.'
      : over ? `Shorten your text by ${used - budget} characters (the instructions limit is 4,000).` : '';

  const send = () => {
    if (missing) { toast(missing, 'error'); return; }
    setDraftHandoff({ project, file: letter.file, ...options, text: text.trim() });
    go(ROUTES.drafting(project, letter.file));
  };

  const projectOptions = (projects || []).map((p) => ({ id: p.project_id, label: p.name || p.project_id, hint: p.project_id }));

  return (
    <>
      <PageTop crumbs={[{ label: 'AI Drafting', to: ROUTES.draftingHome }, { label: 'Reply' }]} title="Draft a reply" search={false}
        actions={(
          <>
            <MenuSelect variant="project" label="Project" heading="Project" value={project} onChange={chooseProject}
              options={projectOptions} align="right" menuWidth={280} disabled={!projects} />
          </>
        )} />
      <div className="cx-start centered">
        {projectsError && <div className="cx-banner bad"><b>Couldn&apos;t load projects.</b><span className="cx-s12">{projectsError}</span></div>}
        <h2>Which letter are we replying to?</h2>
        <p className="cx-start-sub">
          Attach the letter, choose the tone and length, and add any instructions. Drafts only use the selected project&apos;s records.
        </p>

        {info && !ready && (
          <div className="cx-banner" style={{ width: 820, maxWidth: '100%' }}>
            <span className="cx-s12"><b>{info.name || project} isn&apos;t ready for drafting:</b> {(info.readiness?.blockers || []).map(readinessText).join(' · ')}</span>
            <span className="cx-spacer" />
            <Btn size="sm" onClick={() => go(ROUTES.project(project, 'setup'))}>Open setup</Btn>
          </div>
        )}

        <div className="cx-composer">
          <textarea ref={box} rows={2} value={text} onChange={(e) => editText(e.target.value)}
            placeholder="Describe the reply you need (optional) & mention the pages to analyze"
            aria-label="Describe the reply you need"
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }} />
          <div className="cx-composer-bar">
            <button type="button" className="cx-attach" onClick={() => setAttaching(true)} disabled={!project}
              title={project ? 'Attach the letter you are replying to' : 'Select a project first'} aria-label="Attach letter">
              <img src={paperclipIcon} alt="" />
            </button>
            <span className={`cx-attached ${letter ? 'on' : ''}`} title={letter ? `${letter.reference || letter.file} · ${letter.subject || ''}` : undefined}>
              {letter ? (letter.reference || letter.file) : 'No letter attached'}
              {letter && <button type="button" className="cx-link" onClick={() => setLetter(null)} aria-label="Remove attached letter">✕</button>}
            </span>
            <MenuSelect label="Tone" heading="Tone of letter" value={options.tone} onChange={(id) => setOptions((o) => ({ ...o, tone: id }))} options={TONES} />
            <MenuSelect label="Length" heading="Response length" value={options.length} onChange={(id) => setOptions((o) => ({ ...o, length: id }))} options={LENGTHS} />
            <SavedPromptsMenu text={text} onInsert={(p) => { setText((t) => (t.trim() ? `${t.trimEnd()}\n\n${p}` : p)); box.current?.focus(); }} />
            <span className="cx-spacer" />
            <button type="button" className="cx-send" onClick={send} disabled={!!missing} title={missing || 'Draft the reply (Ctrl+Enter)'} aria-label="Draft the reply">
              <img src={sendIcon} alt="" />
            </button>
          </div>
          <div className="cx-composer-foot">
            <span className="cx-composer-note">
              {letter?.subject ? <>Replying to: {letter.subject}{letter.sender ? ` · from ${letter.sender}` : ''}</> : null}
            </span>
            <span className="cx-spacer" />
            <span className={`cx-count ${over ? 'over' : ''}`} title="Your text, within the 4,000-character instructions limit (the tone and length guidance uses the rest)">
              {used} / {budget}
            </span>
          </div>
        </div>

      </div>

      {attaching && (
        <AttachLetterModal project={project} onClose={() => setAttaching(false)}
          onPick={(l) => { setLetter(l); setAttaching(false); }} />
      )}
    </>
  );
}
