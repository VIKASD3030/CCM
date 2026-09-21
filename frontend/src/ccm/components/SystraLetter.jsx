/**
 * SystraLetter — deterministic renderer for an official SYSTRA MVA Consulting
 * correspondence letter, laid out to match the reference letter
 * "Letter to TGTS_MPR_Nov '25_007".
 *
 * The LLM produces ONLY the structured `letter_data` (recipient, subject, body
 * paragraphs, …). Everything visual is fixed here + in systra-letter.css:
 *
 *   TOP-RIGHT  SYSTRA wordmark
 *   ROW        Our Ref No.: …            Date: …
 *   BLOCK      To / recipient (bold)
 *   GRID       Subject: / Project: / Ref:   (label column + wrapping value)
 *              Respected Sir,
 *              body paragraphs (left aligned)
 *              With highest regards, / Sincerely,
 *              <signature space>
 *              Signatory (bold) / For, SYSTRA …
 *              Encl: …
 *   FOOTER     red SYSTRA brand device  +  company name / offices / contact
 *              (pinned to the bottom of the A4 page)
 */
import React from 'react';
import './systra-letter.css';

const FALLBACK_BRANDING = {
  company_name: 'SYSTRA MVA CONSULTING (INDIA) PRIVATE LIMITED',
  offices: [
    'Project office | Sanali Spazio • 10th Floor • Plot no.19 • Software units layout • Madhapur • Hyderabad • India • 500081',
    'Registered office | Eros Corporate Tower • 15th Floor • Nehru Place • New Delhi • India • 110 019',
    'Corporate office | L & T Business Park • Tower 2 • 4th floor • North & South Wing • 12/4, Mathura Road, Faridabad • India • 121 003',
  ],
  contact_information:
    'Tel: (+91) 129 668 5600 | Web: www.systra.in | Mail: contact.india@systra.com | CIN: U74210DL2005PTC140217',
  brand_red: '#d22328',
  top_logo_path: null,
  bottom_logo_path: null,
};

const FALLBACK_SIGNATORY = {
  name: 'Mumtaz Afzal',
  designation_line_1: 'Vice President & Head',
  designation_line_2: 'Digital Transformation',
  for_company: 'For, SYSTRA MVA Consulting India Pvt Ltd',
};

/** Official SYSTRA wordmark (public/systra_logo.svg) — inlined so it always
 *  rasterises for html2canvas/PDF and prints reliably. */
function SystraWordmark() {
  return (
    <svg viewBox="0 0 424.6 80.7" role="img" aria-label="SYSTRA" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="#d22328"
        d="M183.6 3.3V1.7c0-.3-.2-.5-.5-.5h-22c-.6 0-.8.1-1.2.5-2.8 3-4.8 6.9-4.8 12.1 0 4.7 1.3 8.9 4.9 12.9 8.3 9.3 26.3 14.4 33.3 20.2 2.6 2.2 4.2 4.6 4.2 7.4 0 6.3-4.4 11-17.8 11-7.8 0-14.4-1.5-23-3.2-.4-.1-.4.1-.4.3v13.3c0 .4.1.5.4.6 7.6 2.6 16.8 4.3 25.3 4.3 20.8 0 34.8-10.9 34.8-27.1 0-7.4-3-13.1-8.3-17.9-7.7-7-20.6-11.5-28-16-2.5-1.5-5.7-4-5.7-8.2.1-3.4 2.2-6.8 8.8-8.1zm95 76c-1.5.3-6.7 1.3-13.5 1.3-20.2 0-30.2-9.1-30.2-29.3V16.4h-22.7c-.3 0-.5-.1-.6-.5l-2.5-14.3c0-.3.1-.5.4-.5h69.1c.3 0 .5.2.5.5V16c0 .3-.2.5-.5.5h-24.8v35.3c0 10 5 14.1 16.2 14.1 4.6 0 7.5-.3 8.6-.5.3 0 .5.1.5.4v13c0 .3-.1.5-.5.5zm65.2-78.1C342.1.9 336.2 0 328.6 0c-18.7 0-34.1 7.7-34.1 29.8V79c0 .3.2.5.5.5h18c.3 0 .5-.2.5-.5V30.5c0-9.7 5.3-15.5 19.6-15.5 4.3 0 9 .4 10.8.6.3 0 .5-.1.5-.4V1.8c-.2-.3-.3-.5-.6-.6zm72.3 29.7C412.5 10.5 402.8 0 384.1 0s-28.4 10.5-32 30.9c0 0-8.4 47.8-8.5 48.1-.1.4.2.5.4.5h17.9c.4 0 .5-.1.5-.5.1-.3 3.2-18.4 3.2-18.4h27c.3 0 .5-.1.6-.5l2.5-14.3c0-.3-.1-.5-.4-.5h-27l2.6-14.5c1.7-9.6 4.2-15.8 13.2-15.8s11.5 6.2 13.2 15.8c0 0 8.4 47.8 8.5 48.1.1.3.2.5.5.5h17.9c.2 0 .5-.1.4-.5 0-.3-8.5-48-8.5-48zM116.7 79.5c.3 0 .5-.2.5-.5V57.1c14.6-2.8 21.6-12.9 24.6-30l4.4-25.5c0-.3-.1-.5-.4-.5h-17.5c-.4 0-.5.1-.5.5l-4.5 25.5c-1.7 9.6-6.2 16-15.2 16s-13.5-6.4-15.2-16L88.4 1.6c-.1-.3-.2-.5-.6-.5H70.2c-.3 0-.4.2-.4.5l4.4 25.5c3 17.1 9.9 27.2 24.6 30V79c0 .3.2.5.5.5h17.4zM37.2 38.8c-12.4-5.9-17.5-9-17.5-14.3 0-6.1 4.1-9.4 15.7-9.4 6.2 0 14.5 1 21.4 2.5.3.1.4 0 .4-.3V4.1c0-.3-.1-.5-.4-.6C48.9 1.3 42.2 0 33.1 0 12 0 0 10.3 0 24.7 0 31 2.1 36.1 6.4 40.6 14.8 49.3 33.1 55 39 60.7c2.7 2.6 3.5 4.9 3.5 7.3 0 6-4.5 8.6-9.8 9.6-.3.1-.8.1-1.2.2V79c0 .3.2.5.5.5h24.3c.6 0 .8-.1 1.2-.5 2.8-3.1 4.6-8.6 4.6-12.7 0-9.9-4.9-18-24.9-27.5z"
      />
    </svg>
  );
}

/** SYSTRA red brand device used in the footer — horizontal bar + ring, bleeds
 *  off the left page edge. Pure vector so it prints / rasterises cleanly. */
function SystraBrandMark({ color }) {
  const c = color || '#d22328';
  return (
    <svg viewBox="0 0 150 40" role="presentation" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="14.5" width="96" height="11" rx="5.5" fill={c} />
      <circle cx="66" cy="20" r="17.5" fill={c} />
      <circle cx="66" cy="20" r="7.6" fill="#fff" />
    </svg>
  );
}

function TopLogo({ path }) {
  if (path) return <img src={path} alt="SYSTRA MVA Consulting" />;
  return <SystraWordmark />;
}

function OfficeLine({ text }) {
  const i = text.indexOf('|');
  if (i === -1) return <div className="systra-office">{text}</div>;
  return (
    <div className="systra-office">
      <strong>{text.slice(0, i).trim()}</strong>
      {' | '}
      {text.slice(i + 1).trim()}
    </div>
  );
}

export default function SystraLetter({ data, innerRef }) {
  const d = data || {};
  const branding = { ...FALLBACK_BRANDING, ...(d.branding || {}) };
  const offices = branding.offices && branding.offices.length ? branding.offices : FALLBACK_BRANDING.offices;
  const signatory = { ...FALLBACK_SIGNATORY, ...(d.signatory || {}) };
  const recipient = d.recipient || {};
  const body = Array.isArray(d.body) ? d.body : (d.body ? [String(d.body)] : []);
  const closing = Array.isArray(d.closing_lines) && d.closing_lines.length
    ? d.closing_lines
    : ['This letter is submitted for your kind perusal.', 'We sincerely appreciate your continued support and cooperation.'];
  const enclosure = Array.isArray(d.enclosure) ? d.enclosure.filter(Boolean) : [];
  const addrLines = Array.isArray(recipient.address_lines) ? recipient.address_lines.filter(Boolean) : [];

  const rootStyle = branding.brand_red ? { '--systra-brand-red': branding.brand_red } : undefined;

  const metaRows = [
    ['Subject:', d.subject || '—'],
    d.project ? ['Project:', d.project] : null,
    d.reference ? ['Ref:', d.reference] : null,
  ].filter(Boolean);

  return (
    <div className="systra-letter" ref={innerRef} style={rootStyle}>
      <div className="systra-content">
        {/* ── Top-right logo ─────────────────────────────────── */}
        <div className="systra-logo-top">
          <TopLogo path={branding.top_logo_path} />
        </div>

        {/* ── Reference / Date row ───────────────────────────── */}
        <div className="systra-refdate">
          <div className="systra-ref"><strong>Our Ref No.:</strong> {d.reference_number || '—'}</div>
          <div className="systra-date"><strong>Date:</strong> {d.date || '—'}</div>
        </div>

        {/* ── Recipient ─────────────────────────────────────── */}
        <div className="systra-recipient">
          <div>To</div>
          {recipient.attention ? <div className="systra-attn">Kind Attn: {recipient.attention}</div> : null}
          {recipient.name ? <div>{recipient.name}</div> : null}
          {recipient.organization ? <div>{recipient.organization}</div> : null}
          {addrLines.map((line, i) => <div key={i}>{line}</div>)}
        </div>

        {/* ── Subject / Project / Ref ───────────────────────── */}
        <div className="systra-metadata">
          {metaRows.map(([label, value], i) => (
            <React.Fragment key={i}>
              <div className="systra-meta-label">{label}</div>
              <div className="systra-meta-value">{value}</div>
            </React.Fragment>
          ))}
        </div>

        {/* ── Salutation + body ─────────────────────────────── */}
        <div className="systra-salutation">{d.salutation || 'Respected Sir,'}</div>
        <div className="systra-body">
          <p>{d.opening_line || 'I hope this letter finds you in the best of health and spirits.'}</p>
          {body.map((para, i) => <p key={i}>{para}</p>)}
          <div className="systra-closing">
            {closing.map((line, i) => <div key={i}>{line}</div>)}
          </div>
        </div>

        {/* ── Sign-off + signature ──────────────────────────── */}
        <div className="systra-signoff">
          <div>With highest regards,</div>
          <div>Sincerely,</div>
          <div className="systra-sign-space" aria-hidden="true" />
          <div className="systra-signatory">
            <div className="systra-signatory-name">{signatory.name}</div>
            <div>{signatory.designation_line_1}</div>
            {signatory.designation_line_2 ? <div>{signatory.designation_line_2}</div> : null}
          </div>
          <div className="systra-for-company">{signatory.for_company}</div>
        </div>

        {/* ── Enclosure ─────────────────────────────────────── */}
        <div className="systra-enclosure">
          {enclosure.length === 0 ? (
            <div>Encl: Nil</div>
          ) : enclosure.length === 1 ? (
            <div>Encl: 1. {enclosure[0]}</div>
          ) : (
            <>
              <div>Encl:</div>
              <ol>{enclosure.map((e, i) => <li key={i}>{e}</li>)}</ol>
            </>
          )}
        </div>
      </div>

      {/* ── Footer : red brand device + company information ── */}
      <footer className="systra-footer">
        <div className="systra-brand-mark">
          {branding.bottom_logo_path
            ? <img src={branding.bottom_logo_path} alt="" aria-hidden="true" />
            : <SystraBrandMark color={branding.brand_red} />}
        </div>
        <div className="systra-company-info">
          <div className="systra-company-name">{branding.company_name}</div>
          {offices.map((line, i) => <OfficeLine key={i} text={line} />)}
          <div className="systra-contact">{branding.contact_information}</div>
        </div>
      </footer>
    </div>
  );
}
