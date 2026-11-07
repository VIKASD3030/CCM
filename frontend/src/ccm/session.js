/**
 * Shared state for the drafting screens on the CCM public API:
 * the current user label, the selected project and a local cache of draft
 * generation results (the API keeps finished jobs for only one hour).
 */
import React from 'react';
import { getSession } from '../authentication/cookie';
import { ccmApi } from './ccm-public-api';
import { errorText } from './project-setup';

/**
 * The `user` label the API stores drafts under (an attribution label, not auth).
 * The login stores the user's email in the UserName cookie.
 */
export function currentUser() {
  return getSession('UserName') || getSession('UserId') || 'local-user';
}

/* ─── Safe localStorage ─────────────────────────────────────────────────── */

function readStore(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function writeStore(key, value) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage full or blocked */ }
}

/* ─── Current project ───────────────────────────────────────────────────── */

const PROJECT_KEY = 'ccm.project';
export const rememberedProject = () => readStore(PROJECT_KEY, '');
export const rememberProject = (id) => writeStore(PROJECT_KEY, id || '');

/** Loads the projects assigned to our token. Returns { projects, error }. */
export function useProjects() {
  const [state, setState] = React.useState({ projects: null, error: null });
  React.useEffect(() => {
    let live = true;
    ccmApi.projects.list().then((r) => {
      if (!live) return;
      setState(r.ok ? { projects: r.data.projects || [], error: null } : { projects: [], error: errorText(r) });
    });
    return () => { live = false; };
  }, []);
  return state;
}

/** Picks the project to show: the one asked for, else the last used, else the first. */
export function pickProject(projects, wanted) {
  if (!projects || !projects.length) return '';
  const ids = projects.map((p) => p.project_id);
  if (wanted && ids.includes(wanted)) return wanted;
  const last = rememberedProject();
  return ids.includes(last) ? last : ids[0];
}

export function ProjectPicker({ projects, value, onChange }) {
  return (
    <select className="cx-select inline" value={value} onChange={(e) => { rememberProject(e.target.value); onChange(e.target.value); }} aria-label="Project">
      {(projects || []).map((p) => <option key={p.project_id} value={p.project_id}>{p.name || p.project_id}</option>)}
    </select>
  );
}

/* ─── Draft results cache ───────────────────────────────────────────────── */

const RESULTS_KEY = 'ccm.draftResults';
const MAX_RESULTS = 25;

/** Keeps a completed DraftReply result so sources survive the job's one-hour expiry. */
export function cacheDraftResult(jobId, result) {
  const all = readStore(RESULTS_KEY, []).filter((x) => x.jobId !== jobId);
  all.unshift({ jobId, at: Date.now(), result });
  writeStore(RESULTS_KEY, all.slice(0, MAX_RESULTS));
}

/** The generation result for a job: local cache first, then the API while the job is retained. */
export async function loadDraftResult(project, jobId) {
  if (!jobId) return null;
  const hit = readStore(RESULTS_KEY, []).find((x) => x.jobId === jobId);
  if (hit) return hit.result;
  const r = await ccmApi.jobs.draftReply(project, jobId);
  if (r.ok && r.data.status === 'completed' && r.data.result) {
    cacheDraftResult(jobId, r.data.result);
    return r.data.result;
  }
  return null;
}

/* ─── Letter helpers ────────────────────────────────────────────────────── */

export const REPLY_STATE = {
  open: ['Open', 'warn'],
  drafting: ['Drafting', 'blue'],
  exported: ['Exported', 'ok'],
  replied: ['Replied', 'ok'],
};
export const replyState = (letter) => REPLY_STATE[letter?.reply_state?.key] || [letter?.reply_state?.key || '—', 'gray'];

/** Code-point offsets (API) → UTF-16 offsets (textarea selection). */
export function toUtf16Range(text, start, end) {
  const chars = Array.from(text || '');
  const s = chars.slice(0, start).join('').length;
  const e = s + chars.slice(start, end).join('').length;
  return [s, e];
}
