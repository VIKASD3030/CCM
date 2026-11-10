/**
 * CCM UI kit — small presentational components and helpers shared by the
 * redesigned CCM pages (dashboard, projects, letters, drafting, review,
 * knowledge base). Styles live in ./ccm-ui.css (all classes prefixed `cx-`).
 */
import React from 'react';
import { Search, Menu, X } from 'lucide-react';
import CCM from '../ccm-api';
import './ccm-ui.css';

// ── Navigation ──────────────────────────────────────────────────────────
export const go = (path) => { window.location.hash = path; };

export const ROUTES = {
  dashboard: '/master/dashboard',
  projects: '/ccm/projects',
  project: (id, tab) => `/ccm/project?id=${encodeURIComponent(id)}${tab ? `&tab=${tab}` : ''}`,
  letters: '/ccm/letters',
  lettersFor: (project) => `/ccm/letters?project=${encodeURIComponent(project)}`,
  // A stored letter is identified by project + file on the CCM public API.
  drafting: (project, file) => {
    if (!project) return '/master/ai-drafting';
    const q = `?project=${encodeURIComponent(project)}${file ? `&file=${encodeURIComponent(file)}` : ''}`;
    return `/master/ai-drafting${q}`;
  },
  review: (project) => `/ccm/review${project ? `?project=${encodeURIComponent(project)}` : ''}`,
  knowledge: '/ccm/knowledge',
};

const readQueryParam = (name) => new URLSearchParams((window.location.hash.split('?')[1]) || '').get(name);

export function useQueryParam(name) {
  const [value, setValue] = React.useState(() => readQueryParam(name));
  React.useEffect(() => {
    const onHash = () => setValue(readQueryParam(name));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [name]);
  return value;
}

// ── Domain helpers ──────────────────────────────────────────────────────
export const FOLDERS = [
  { key: 'contract_volume', label: 'Contract volumes', short: 'Contract vols', hint: 'Conditions, specs, amendments', tag: 'C', tone: 'blue' },
  { key: 'outgoing_letter', label: 'Outgoing letters', short: 'Outgoing', hint: 'Letters we sent', tag: 'O', tone: 'warn' },
  { key: 'incoming_letter', label: 'Incoming letters', short: 'Incoming', hint: 'Letters we received', tag: 'I', tone: 'gray' },
];
export const folderOf = (key) => FOLDERS.find((f) => f.key === key);

const CLOSED = ['approved', 'sent', 'archived'];
export const isOpenLetter = (l) => !CLOSED.includes(l.status);

export const URGENCY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };
export function urgencyTone(u) {
  const v = (u || '').toLowerCase();
  if (v === 'high' || v === 'critical') return 'bad';
  if (v === 'medium') return 'warn';
  return 'gray';
}

const STATUS = {
  new: ['New', 'warn'],
  classified: ['Classified', 'gray'],
  drafted: ['Drafted', 'ok'],
  pending_review: ['In review', 'blue'],
  approved: ['Approved', 'ok'],
  sent: ['Sent', 'ok'],
  rejected: ['Rejected', 'bad'],
  revised: ['Revised', 'gray'],
  archived: ['Archived', 'gray'],
  indexed: ['Indexed', 'ok'],
  processing: ['Processing', 'warn'],
  failed: ['Failed', 'bad'],
};
export function StatusChip({ status }) {
  const [label, tone] = STATUS[status] || [cap(status || 'Unknown'), 'gray'];
  return <Chip tone={tone}>{label}</Chip>;
}

/** Status of a knowledge document, with why (OCR, keyword-only, failure) on hover. */
export function DocStatus({ doc }) {
  const keywordOnly = doc.status === 'indexed' && (doc.status_detail || '').startsWith('Indexed for keyword');
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      {keywordOnly
        ? <Chip tone="warn" title={doc.status_detail}>Keyword only</Chip>
        : <span title={doc.status_detail || undefined}><StatusChip status={doc.status} /></span>}
      {doc.ocr_pages > 0 && <Chip tone="blue" title="These pages had no text layer and were read with OCR">OCR · {doc.ocr_pages} p</Chip>}
    </span>
  );
}

/** Open a protected original file (scan, contract PDF) in a new tab, at a page. */
export async function openOriginal(path, { page } = {}) {
  const tab = window.open('', '_blank');
  try {
    const blob = await CCM.blob(path);
    const url = URL.createObjectURL(blob);
    const target = blob.type === 'application/pdf' && page ? `${url}#page=${page}` : url;
    if (tab) tab.location.href = target; else window.open(target, '_blank');
  } catch (e) {
    if (tab) tab.close();
    toast(`Couldn't open the original: ${e.message}`, 'error');
  }
}

/** Verification result of a draft: n flags, clean, or not checked (older drafts). */
export function FlagChip({ issues }) {
  if (issues == null) return <Chip tone="gray">Not checked</Chip>;
  if (!issues) return <Chip tone="ok">Clean</Chip>;
  return <Chip tone="warn">{issues} flag{issues > 1 ? 's' : ''}</Chip>;
}

export const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '');
export const humanize = (s) => cap(String(s || '').replace(/_/g, ' '));

export function letterSubject(letter) {
  if (!letter) return '';
  if (letter.subject) return letter.subject.slice(0, 140);
  const m = /^\s*(?:Sub(?:ject)?|Re)\s*[:.-]\s*(.+)$/im.exec(letter.raw_text || '');
  if (m) return m[1].trim().replace(/\s+/g, ' ').slice(0, 140);
  if (letter.intent) return letter.intent.split(/(?<=\.)\s/)[0].slice(0, 140);
  return (letter.filename || '').replace(/\.[^.]+$/, '');
}

export function letterRef(letter) {
  if (!letter) return '';
  if (letter.ref_no) return letter.ref_no;
  const m = /\b(?:Our\s+|Your\s+)?Ref(?:erence)?\.?\s*(?:No\.?)?\s*[:\-]\s*([A-Z0-9][\w/.\-]{3,40})/i.exec(letter.raw_text || '');
  if (m) return m[1];
  const nums = letter.key_entities?.contract_numbers;
  if (Array.isArray(nums) && nums[0]) return String(nums[0]);
  return `RL-${String(letter.id || '').slice(0, 4).toUpperCase()}`;
}

export function letterFrom(letter) {
  const names = letter?.key_entities?.names;
  return Array.isArray(names) && names.length ? names[0] : null;
}

const CLAUSE_RE = /(?:Sub-?Clause|Clause|Cl\.?)\s+(\d{1,2}(?:\.\d{1,2}){0,3})/gi;
const LETTER_REF_RE = /\b([A-Z]{2,}[A-Z0-9]*(?:\/[A-Z0-9-]+){2,})\b/g;
export function detectReferences(text) {
  const clauses = [...new Set([...(text || '').matchAll(CLAUSE_RE)].map((m) => m[1]))];
  const refs = [...new Set([...(text || '').matchAll(LETTER_REF_RE)].map((m) => m[1]))];
  return { clauses, refs };
}

export function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** A calendar date (YYYY-MM-DD) without timezone shifts. */
export function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Poll a background job until it completes. Resolves with the job. */
export async function waitForJob(jobId, { timeoutMs = 120000, intervalMs = 1500 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, intervalMs));
    // eslint-disable-next-line no-await-in-loop
    const res = await CCM.jobs.get(jobId);
    const job = res.job || res;
    if (job.status === 'completed') return job;
    if (job.status === 'failed') throw new Error(job.error_message || 'The job failed');
  }
  throw new Error('This is taking longer than expected. Check back in a minute.');
}

// ── Toasts ──────────────────────────────────────────────────────────────
const toastListeners = new Set();
export function toast(message, type = 'info') {
  toastListeners.forEach((fn) => fn({ id: Date.now() + Math.random(), message, type }));
}
export function ToastHost() {
  const [items, setItems] = React.useState([]);
  React.useEffect(() => {
    const fn = (t) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), 4500);
    };
    toastListeners.add(fn);
    return () => toastListeners.delete(fn);
  }, []);
  return (
    <div className="cx-toasts" role="status" aria-live="polite">
      {items.map((t) => <div key={t.id} className={`cx-toast ${t.type}`}>{t.message}</div>)}
    </div>
  );
}

// ── Components ──────────────────────────────────────────────────────────
export function Chip({ tone = 'gray', children, title }) {
  return <span className={`cx-chip ${tone}`} title={title}>{children}</span>;
}

export function Btn({ variant, size, block, className = '', children, ...rest }) {
  const cls = ['cx-btn', variant, size, block ? 'block' : '', className].filter(Boolean).join(' ');
  return <button type="button" className={cls} {...rest}>{children}</button>;
}

export function Card({ title, right, children, className = '', style }) {
  return (
    <section className={`cx-card ${className}`} style={style}>
      {(title || right) && (
        <div className="cx-card-head">
          {title && <h3>{title}</h3>}
          <span className="cx-spacer" />
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ label, value, note, tone }) {
  const color = { bad: 'var(--cx-bad)', warn: 'var(--cx-warn)', ok: 'var(--cx-ok)' }[tone] || 'var(--cx-muted)';
  return (
    <div className="cx-kpi">
      <span className="cx-kpi-label">{label}</span>
      <span className="cx-kpi-value">{value}</span>
      <span className="cx-kpi-note" style={{ color }}>{note}</span>
    </div>
  );
}

export function Empty({ title, children, action }) {
  return (
    <div className="cx-empty">
      <b>{title}</b>
      {children && <span className="cx-s12">{children}</span>}
      {action}
    </div>
  );
}

export function Skeleton({ h = 16, w = '100%', style }) {
  return <div className="cx-skel" style={{ height: h, width: w, ...style }} />;
}

export function Modal({ title, onClose, children, size }) {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="cx-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={`cx-modal ${size || ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="cx-modal-head">
          <h2>{title}</h2>
          <button type="button" className="cx-modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Page header bar: breadcrumb + title on the left, search + actions on the right. */
export function PageTop({ crumbs = [], title, actions, onSearch, searchPlaceholder = 'Search letters, clauses, projects', search = true }) {
  const [q, setQ] = React.useState('');
  const submit = (e) => {
    e.preventDefault();
    if (onSearch) onSearch(q);
    else if (q.trim()) go(`${ROUTES.letters}?q=${encodeURIComponent(q.trim())}`);
  };
  return (
    <header className="cx-top">
      <Btn className="cx-burger" variant="ghost" size="sm" aria-label="Open menu"
        onClick={() => window.dispatchEvent(new Event('cx-toggle-sidebar'))}>
        <Menu size={18} />
      </Btn>
      <div style={{ minWidth: 0 }}>
        <div className="cx-crumb">
          {crumbs.map((c, i) => (
            <React.Fragment key={i}>
              {i > 0 && ' / '}
              {c.to ? <a onClick={() => go(c.to)}>{c.label}</a> : c.label}
            </React.Fragment>
          ))}
        </div>
        <h1>{title}</h1>
      </div>
      <span className="cx-spacer" />
      {search && (
        <form className="cx-search" onSubmit={submit} role="search">
          <Search />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} aria-label="Search" />
        </form>
      )}
      {actions && <div className="cx-top-actions">{actions}</div>}
    </header>
  );
}

export function ProgressBar({ percent, tone }) {
  return <div className="cx-bar"><i className={tone || ''} style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} /></div>;
}

/** Project picker over the /api/projects list (CCM + unlinked Master projects). */
export function ProjectSelect({ projects, value, onChange, placeholder = 'Select a project', className = 'cx-select', id }) {
  return (
    <select id={id} className={className} value={value || ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {projects.map((p) => (
        <option key={p.id} value={p.id}>{p.name}{p.source === 'master' ? ' (Master)' : ''}</option>
      ))}
    </select>
  );
}

/** Resolve a project id to a CCM project, creating the workspace for a Master project. */
export async function ensureCcmProject(projectId) {
  if (projectId && String(projectId).startsWith('master-')) {
    const res = await CCM.projects.linkMaster(String(projectId).slice('master-'.length));
    return res.project.id;
  }
  return projectId;
}
