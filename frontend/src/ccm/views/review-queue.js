/**
 * Review queue — wireframe 07. Pending drafts on the left; the selected reply
 * with changes since the previous version, reviewer notes and the decision
 * in the middle; verification, what approval does and the audit trail right.
 */
import React from 'react';
import CCM from '../ccm-api';
import {
  PageTop, Btn, Card, Chip, Empty, FlagChip, Skeleton, StatusChip, go, ROUTES, toast, useQueryParam,
  letterRef, letterSubject, timeAgo, fmtDateTime, humanize,
} from '../ui/kit';
import { DraftPaper, Verification } from './ai-drafting';

const TABS = [
  { key: 'pending_review', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

/** Word-level diff (LCS). Returns [{type: 'same'|'add'|'del', text}]. */
function diffWords(before, after) {
  const a = (before || '').split(/(\s+)/);
  const b = (after || '').split(/(\s+)/);
  if (a.length * b.length > 6000000) return [{ type: 'same', text: after }];
  const n = a.length; const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out = [];
  const push = (type, text) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text; else out.push({ type, text });
  };
  let i = 0; let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { push('same', a[i]); i += 1; j += 1; } else if (dp[i + 1][j] >= dp[i][j + 1]) { push('del', a[i]); i += 1; } else { push('add', b[j]); j += 1; }
  }
  while (i < n) { push('del', a[i]); i += 1; }
  while (j < m) { push('add', b[j]); j += 1; }
  return out;
}

const bodyText = (d) => (d?.letter_data?.body || []).join('\n\n') || d?.draft_text || '';

export default function ReviewQueue() {
  const draftParam = useQueryParam('draft');
  const [status, setStatus] = React.useState('pending_review');
  const [items, setItems] = React.useState(null);
  const [counts, setCounts] = React.useState({});
  const [selected, setSelected] = React.useState(draftParam);
  const [versions, setVersions] = React.useState([]);
  const [compare, setCompare] = React.useState(true);
  const [notes, setNotes] = React.useState('');
  const [busy, setBusy] = React.useState(null);
  const [error, setError] = React.useState(null);

  const load = React.useCallback(async () => {
    try {
      const [cur, ...rest] = await Promise.all([
        CCM.review.queue(status),
        ...TABS.filter((t) => t.key !== status).map((t) => CCM.review.queue(t.key)),
      ]);
      const list = cur.items || [];
      setItems(list);
      const c = { [status]: list.length };
      TABS.filter((t) => t.key !== status).forEach((t, i) => { c[t.key] = rest[i]?.items?.length || 0; });
      setCounts(c);
      setSelected((s) => (list.some((x) => x.draft.id === s) ? s : list[0]?.draft.id || null));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [status]);
  React.useEffect(() => { setItems(null); load(); }, [load]);
  React.useEffect(() => { if (draftParam) setSelected(draftParam); }, [draftParam]);

  const item = items?.find((x) => x.draft.id === selected) || null;

  React.useEffect(() => {
    setNotes(''); setVersions([]);
    if (!item) return;
    CCM.drafts.forLetter(item.letter.id)
      .then((d) => setVersions((d.drafts || []).sort((a, b) => a.version - b.version)))
      .catch(() => {});
  }, [item?.draft.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const draft = item?.draft;
  const previous = draft ? versions.filter((v) => v.version < draft.version).pop() : null;
  const ref = item ? letterRef(item.letter) : '';

  const act = async (kind) => {
    setBusy(kind);
    try {
      if (kind === 'approve') {
        await CCM.review.approve(draft.id, notes);
        toast(`Reply to ${ref} approved and filed to ${item.project_name || 'the project'} → Outgoing letters`, 'success');
      } else if (kind === 'reject') {
        await CCM.review.reject(draft.id, notes);
        toast(`Reply to ${ref} rejected`, 'success');
      } else {
        const res = await CCM.drafts.regenerate(draft.id, notes);
        toast(`Version ${res.draft?.version} generated with your notes`, 'success');
        setSelected(res.draft?.id || null);
      }
      await load();
    } catch (e) {
      toast(`${humanize(kind)} failed: ${e.message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const pending = draft?.status === 'pending_review';

  return (
    <>
      <PageTop crumbs={[{ label: 'Home', to: ROUTES.dashboard }]} title="Review queue" />
      <div className="cx-content">
        {error && <div className="cx-banner bad"><b>Couldn't load the review queue.</b><span className="cx-s12">{error}</span></div>}
        <div className="cx-row stack-md" style={{ alignItems: 'flex-start' }}>
          <div className="cx-col" style={{ width: 360, flex: 'none' }}>
            <div className="cx-tabs" role="tablist">
              {TABS.map((t) => (
                <button key={t.key} type="button" role="tab" aria-selected={status === t.key} className={`cx-tab ${status === t.key ? 'on' : ''}`}
                  onClick={() => setStatus(t.key)}>
                  {t.label}{counts[t.key] != null && <span className="n">{counts[t.key]}</span>}
                </button>
              ))}
            </div>
            <div className="cx-card" style={{ padding: 8, gap: 2 }}>
              {!items ? <Skeleton h={160} /> : items.length === 0 ? (
                <Empty title={status === 'pending_review' ? 'Nothing waiting for review' : `No ${humanize(status).toLowerCase()} drafts`} />
              ) : items.map((q) => (
                <button key={q.draft.id} type="button" className={`cx-qitem ${q.draft.id === selected ? 'on' : ''}`} onClick={() => setSelected(q.draft.id)}>
                  <div className="cx-grow">
                    <div className="cx-b">Reply to {letterRef(q.letter)}</div>
                    <div className="cx-s12 cx-muted">v{q.draft.version} · {q.project_name || 'No project'} · {timeAgo(q.draft.created_at)}</div>
                  </div>
                  <FlagChip issues={q.issues} />
                </button>
              ))}
            </div>
          </div>

          <div className="cx-col cx-grow">
            {!item ? (items && <Card><Empty title="Select a draft to review" /></Card>) : (
              <Card title={`Reply to ${ref} · ${humanize(item.letter.category || 'letter')}`}
                right={<><Chip tone="gray">v{draft.version}</Chip><StatusChip status={draft.status} /></>}>
                <div className="cx-toolbar" style={{ gap: 10 }}>
                  {previous && (
                    <Btn size="sm" onClick={() => setCompare((v) => !v)}>{compare ? 'Show full letter' : `Compare with v${previous.version}`}</Btn>
                  )}
                  <Btn size="sm" onClick={() => go(ROUTES.drafting(item.letter.id))}>Open in AI Drafting</Btn>
                  <span className="cx-spacer" />
                  <span className="cx-s12 cx-muted">{letterSubject(item.letter)}</span>
                </div>

                {previous && compare ? (
                  <div className="cx-paper-wrap" style={{ padding: '22px 30px' }}>
                    <b style={{ display: 'block', marginBottom: 10 }}>Subject: {draft.letter_data?.subject}</b>
                    <div className="cx-diff">
                      {diffWords(bodyText(previous), bodyText(draft)).map((p, i) => (
                        p.type === 'same' ? <span key={i}>{p.text}</span>
                          : <span key={i} className={p.type === 'add' ? 'cx-add' : 'cx-del'}>{p.text}</span>
                      ))}
                    </div>
                    <div className="cx-s11 cx-muted" style={{ marginTop: 12 }}>Highlighted text changed since v{previous.version}.{draft.feedback ? ` Instruction used: “${draft.feedback}”` : ''}</div>
                  </div>
                ) : draft.letter_data ? (
                  <div className="cx-paper-wrap" style={{ maxHeight: 560 }}><DraftPaper data={draft.letter_data} /></div>
                ) : (
                  <pre className="cx-paper-wrap" style={{ whiteSpace: 'pre-wrap', padding: 24, margin: 0, font: 'inherit' }}>{draft.draft_text}</pre>
                )}

                {pending ? (
                  <>
                    <div className="cx-field">
                      <label htmlFor="rv-notes">Reviewer notes</label>
                      <textarea id="rv-notes" className="cx-textarea" value={notes} onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add a note for the drafter (required to reject or request changes)" />
                    </div>
                    <div className="cx-toolbar">
                      <Btn onClick={() => act('reject')} disabled={!!busy || !notes.trim()}>{busy === 'reject' ? 'Rejecting…' : 'Reject'}</Btn>
                      <Btn onClick={() => act('changes')} disabled={!!busy || !notes.trim()}
                        title="Generates a new version using your notes">{busy === 'changes' ? 'Generating…' : 'Request changes'}</Btn>
                      <span className="cx-spacer" />
                      <Btn variant="primary" onClick={() => act('approve')} disabled={!!busy}>{busy === 'approve' ? 'Approving…' : 'Approve'}</Btn>
                    </div>
                  </>
                ) : draft.reviewer_notes ? (
                  <div className="cx-banner info"><b className="cx-s12">Reviewer notes</b><span className="cx-s12">{draft.reviewer_notes}</span></div>
                ) : null}
              </Card>
            )}
          </div>

          <div className="cx-col" style={{ width: 300, flex: 'none' }}>
            <Verification draft={draft} />
            <Card title="On approval">
              <span className="cx-s12 cx-muted">
                The approved reply is filed to {item?.project_name || 'the project'} → Outgoing letters, and the client's letter to
                Incoming letters, so future drafts can cite them.
              </span>
              <div className="cx-toolbar" style={{ gap: 6 }}>
                {item?.project_name && <Chip tone="red">{item.project_name}</Chip>}
                <Chip tone="warn">Outgoing letters</Chip>
                <Chip tone="gray">Incoming letters</Chip>
              </div>
            </Card>
            {draft && (
              <Card title="Audit trail">
                <div className="cx-kv"><span>Letter received</span><b>{fmtDateTime(item.letter.received_at)}</b></div>
                <div className="cx-kv"><span>Draft generated</span><b>{fmtDateTime(draft.created_at)}</b></div>
                <div className="cx-kv"><span>Versions</span><b>{versions.length || draft.version}</b></div>
                <div className="cx-kv"><span>Sources cited</span><b>{Array.isArray(draft.context_documents) ? draft.context_documents.length : 0}</b></div>
                {draft.updated_at && draft.status !== 'pending_review' && <div className="cx-kv"><span>{humanize(draft.status)}</span><b>{fmtDateTime(draft.updated_at)}</b></div>}
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
