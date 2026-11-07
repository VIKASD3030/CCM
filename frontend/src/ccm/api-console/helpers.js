/** Test helpers for the CCM API console: sample files, DOCX checks, dates, flag offsets. */

/** Same contract text the mock seeds, so re-importing it into sample-project is "skipped". */
export const SAMPLE_CONTRACT_TEXT =
  'Clause 8.4 Programme\nThe Contractor shall submit an updated programme with supporting records.';

/** A valid one-page PDF built in the browser (ASCII only, so string length = byte length). */
export function samplePdfFile(name = 'console-letter.pdf', label = 'Synthetic correspondence - API console test') {
  const content = `BT /F1 12 Tf 50 750 Td (${label.replace(/[()\\]/g, '')}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((obj, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new File([new TextEncoder().encode(out)], name, { type: 'application/pdf' });
}

export function sampleContractTxtFile(name = 'conditions.txt', text = SAMPLE_CONTRACT_TEXT) {
  return new File([text], name, { type: 'text/plain' });
}

/**
 * Checks a DOCX blob without unzipping: ZIP entry names are stored uncompressed,
 * so the part names can be found in the raw bytes.
 */
export async function inspectDocx(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b; // "PK"
  let raw = '';
  for (let i = 0; i < bytes.length; i += 1) raw += String.fromCharCode(bytes[i]);
  return {
    isZip,
    size: bytes.length,
    hasDocument: raw.includes('word/document.xml'),
    hasComments: raw.includes('word/comments.xml'),
  };
}

/** Local date as YYYY-MM-DD. */
export function todayIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** history_as_of must not precede the incoming letter's date. */
export function historyCutoff(letterDate) {
  const today = todayIso();
  return letterDate && /^\d{4}-\d{2}-\d{2}$/.test(letterDate) && letterDate > today ? letterDate : today;
}

/** Turns any stored-letter identifier into a valid external_id ([A-Za-z0-9][A-Za-z0-9._:-]{0,127}). */
export function toExternalId(value, fallback = 'letter') {
  const cleaned = String(value || '').replace(/[^A-Za-z0-9._:-]/g, '-').replace(/^[^A-Za-z0-9]+/, '');
  return (cleaned || fallback).slice(0, 128);
}

export function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * Splits text into plain and flagged segments. Flag offsets are Unicode code
 * points (not UTF-16 units), so index into Array.from(text) as the API docs say.
 */
export function flagSegments(text, flags) {
  const chars = Array.from(text || '');
  const sorted = [...(flags || [])].filter((f) => Number.isInteger(f.start) && Number.isInteger(f.end))
    .sort((a, b) => a.start - b.start);
  const segments = [];
  let pos = 0;
  sorted.forEach((flag) => {
    if (flag.start < pos || flag.end > chars.length || flag.end <= flag.start) return; // overlapping or out of range
    if (flag.start > pos) segments.push({ text: chars.slice(pos, flag.start).join('') });
    segments.push({ text: chars.slice(flag.start, flag.end).join(''), flag });
    pos = flag.end;
  });
  if (pos < chars.length) segments.push({ text: chars.slice(pos).join('') });
  return segments;
}

/** True when every flag's `text` matches the code-point slice of the draft text. */
export function flagOffsetsMatch(text, flags) {
  const chars = Array.from(text || '');
  return (flags || []).every((f) => chars.slice(f.start, f.end).join('') === f.text);
}

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'download';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function openBlob(blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
