/**
 * "Already answered" panel for an incoming letter that has a detected reply,
 * matching the CCM backend's own letter view: who answered and when, then the
 * incoming letter and the reply side by side, with links to both originals.
 *
 * Data: GET /letters/{file} returns `reply: {file, ref, date}` (file is null when
 * the reply was detected but isn't stored in the project). The reply is itself a
 * stored letter, so its text comes from GET /letters/{reply.file} and its PDF
 * from GET /letters/{reply.file}/original.
 */
import React from 'react';
import { ccmApi } from '../ccm-public-api';
import { errorText } from '../project-setup';
import { openBlob } from '../api-console/helpers';
import { Skeleton, toast, fmtDate } from '../ui/kit';

export default function LetterReply({ project, letter }) {
  const reply = letter?.reply;
  const [data, setData] = React.useState(null); // the reply letter
  const [error, setError] = React.useState(null);
  const [open, setOpen] = React.useState(true);
  const [busy, setBusy] = React.useState('');

  React.useEffect(() => {
    setData(null);
    setError(null);
    if (!reply?.file) return undefined;
    let live = true;
    ccmApi.letters.get(project, reply.file).then((r) => {
      if (!live) return;
      if (r.ok) setData(r.data); else setError(errorText(r));
    });
    return () => { live = false; };
  }, [project, reply?.file]);

  if (!reply) return null;

  const openPdf = async (file, which) => {
    setBusy(which);
    const r = await ccmApi.letters.original(project, file);
    setBusy('');
    if (r.ok && r.blob) openBlob(r.blob); else toast(`Couldn't open the ${which} PDF: ${errorText(r)}`, 'error');
  };

  const ref = reply.ref || data?.reference || reply.file || 'a stored reply';
  const date = reply.date || data?.date;
  const incomingRef = letter.reference || letter.file;

  return (
    <section className="cx-card cx-reply" aria-label="Already answered">
      <div className="cx-reply-head">
        <span className="cx-reply-eyebrow">Already answered</span>
        <span className="cx-spacer" />
        <button type="button" className="cx-link" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Hide letters' : 'Show letters'}
        </button>
      </div>
      <div className="cx-s12">
        Answered by <b className="cx-mono">{ref}</b>
        {data?.sender ? ` · ${data.sender}` : ''}
        {date ? ` · ${fmtDate(date)}` : ''}
      </div>
      {data?.subject && <div className="cx-s12 cx-muted">{data.subject}</div>}

      {open && (
        <div className="cx-reply-cols">
          <div className="cx-reply-col">
            <div className="cx-reply-col-head">
              Incoming <b className="cx-mono">{incomingRef}</b>
              {letter.original_available && (
                <button type="button" className="cx-link" onClick={() => openPdf(letter.file, 'incoming')} disabled={!!busy}>
                  {busy === 'incoming' ? 'Opening…' : 'PDF ↗'}
                </button>
              )}
            </div>
            <pre className="cx-reply-text">{letter.text || 'No extracted text.'}</pre>
          </div>
          <div className="cx-reply-col">
            <div className="cx-reply-col-head">
              Reply <b className="cx-mono">{ref}</b>
              {data?.original_available && (
                <button type="button" className="cx-link" onClick={() => openPdf(reply.file, 'reply')} disabled={!!busy}>
                  {busy === 'reply' ? 'Opening…' : 'PDF ↗'}
                </button>
              )}
            </div>
            {!reply.file ? (
              <div className="cx-banner info">
                <span className="cx-s12">The reply was found from its reference, but its file isn&apos;t stored in this project, so its text can&apos;t be shown. Import the reply into the project&apos;s outgoing letters to see it here.</span>
              </div>
            ) : error ? (
              <div className="cx-banner bad"><span className="cx-s12">Couldn&apos;t load the reply: {error}</span></div>
            ) : !data ? <Skeleton h={300} /> : (
              <pre className="cx-reply-text">{data.text || 'No extracted text.'}</pre>
            )}
          </div>
        </div>
      )}
      <span className="cx-s11 cx-muted">
        Matched through the reference the reply quotes. If this is the wrong letter, the two references are too close to tell
        apart; report it to the CCM operator so the matching rule can be tightened.
      </span>
    </section>
  );
}
