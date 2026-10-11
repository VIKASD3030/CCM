/**
 * CCM API Client (React port of the original vanilla frontend/js/api.js).
 *
 * Talks to the core CCM backend under /api/*. Auth token is the same JWT the
 * MASTER app stores on login: cookie `token<UserId>` (see authentication/cookie.js).
 * Base URL comes from VITE_API_URL (config.apiUrl), same as base-controller.
 */
import config from '../config/config';
import { getSession } from '../authentication/cookie';

const BASE_URL = config.apiUrl || '';

function authHeader() {
  const userId = getSession('UserId');
  const token = getSession('token' + userId);
  return token ? { Authorization: 'Bearer ' + token } : {};
}

async function request(url, options = {}) {
  try {
    const headers = { ...(options.headers || {}), ...authHeader() };
    const response = await fetch(`${BASE_URL}${url}`, { ...options, headers });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
    }
    // 204 No Content
    if (response.status === 204) return null;
    return await response.json();
  } catch (error) {
    if (error.name === 'TypeError' && String(error.message).includes('fetch')) {
      throw new Error('Cannot connect to server. Is the backend running?');
    }
    throw error;
  }
}

function upload(url, file, extraFields = {}) {
  const formData = new FormData();
  formData.append('file', file);
  for (const [key, value] of Object.entries(extraFields)) {
    if (value !== null && value !== undefined) formData.append(key, value);
  }
  return request(url, { method: 'POST', body: formData });
}

function postForm(url, data = {}) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && value !== undefined) formData.append(key, String(value));
  }
  return request(url, { method: 'POST', body: formData });
}

function putForm(url, data = {}) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && value !== undefined) formData.append(key, String(value));
  }
  return request(url, { method: 'PUT', body: formData });
}

/** Fetch a protected file (needs the auth header, so a plain link won't do). */
async function blob(url) {
  const response = await fetch(`${BASE_URL}${url}`, { headers: authHeader() });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
  }
  return response.blob();
}

const CCM = {
  BASE_URL,
  request,
  blob,
  upload,
  postForm,
  putForm,

  // ─── Knowledge Base ───────────────────────────────
  knowledge: {
    upload(file, category) { return upload('/api/knowledge/upload', file, { category }); },
    uploadToFolder(file, projectId, documentType) {
      return upload('/api/knowledge/upload', file, { project_id: projectId, document_type: documentType });
    },
    list(params = {}) {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => { if (v !== null && v !== undefined && v !== '') qs.set(k, v); });
      const q = qs.toString();
      return request(`/api/knowledge/documents${q ? '?' + q : ''}`);
    },
    delete(id) { return request(`/api/knowledge/documents/${id}`, { method: 'DELETE' }); },
    reindex(id) { return request(`/api/knowledge/documents/${id}/reindex`, { method: 'POST' }); },
    chunk(id) { return request(`/api/knowledge/chunks/${id}`); },
    importZip(file, projectId, documentType) {
      return upload('/api/knowledge/import-zip', file, { project_id: projectId, document_type: documentType });
    },
    filePath(id) { return `/api/knowledge/documents/${id}/file`; },
    stats() { return request('/api/knowledge/stats'); },
    search(query, topK = 5, category = null, projectId = null, documentType = null) {
      const data = { query, top_k: topK };
      if (category) data.category = category;
      if (projectId) data.project_id = projectId;
      if (documentType) data.document_type = documentType;
      return postForm('/api/knowledge/search', data);
    },
  },

  // ─── Projects ─────────────────────────────────────
  projects: {
    list() { return request('/api/projects'); },
    get(id) { return request(`/api/projects/${id}`); },
    create(name, sharepointSiteId = null, extra = {}) { return postForm('/api/projects', { name, sharepoint_site_id: sharepointSiteId, ...extra }); },
    update(id, data) { return putForm(`/api/projects/${id}`, data); },
    delete(id) { return request(`/api/projects/${id}`, { method: 'DELETE' }); },
    syncLogs(id) { return request(`/api/projects/${id}/sync-logs`); },
    sync(id) { return postForm(`/api/projects/${id}/sync`); },
    linkMaster(masterId) { return postForm(`/api/projects/link-master/${masterId}`); },
    stats(id) { return request(`/api/projects/${id}/stats`); },
  },

  // ─── Letters ──────────────────────────────────────
  letters: {
    upload(file, projectId = null) {
      const extra = {};
      if (projectId) extra.project_id = projectId;
      return upload('/api/letters/upload', file, extra);
    },
    list(status = null, category = null, projectId = null, limit = 200) {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (category) params.set('category', category);
      if (projectId) params.set('project_id', projectId);
      if (limit) params.set('limit', limit);
      const qs = params.toString();
      return request(`/api/letters${qs ? '?' + qs : ''}`);
    },
    get(id) { return request(`/api/letters/${id}`); },
    reclassify(id, category, urgency) { return putForm(`/api/letters/${id}/reclassify`, { category, urgency }); },
    thread(id) { return request(`/api/letters/${id}/thread`); },
    filePath(id) { return `/api/letters/${id}/file`; },
    assignProject(id, projectId) { return putForm(`/api/letters/${id}/project`, { project_id: projectId }); },
  },

  // ─── Drafts ───────────────────────────────────────
  drafts: {
    generate(letterId, instructions = '', sessionId = '') {
      return postForm(`/api/drafts/generate/${letterId}`, { instructions, session_id: sessionId });
    },
    get(id) { return request(`/api/drafts/${id}`); },
    update(id, draftText) { return putForm(`/api/drafts/${id}`, { draft_text: draftText }); },
    regenerate(id, feedback) { return postForm(`/api/drafts/${id}/regenerate`, { feedback }); },
    forLetter(letterId) { return request(`/api/drafts/letter/${letterId}`); },
  },

  // ─── Review ───────────────────────────────────────
  review: {
    approve(draftId, reviewerNotes = '') { return postForm(`/api/review/${draftId}/approve`, { reviewer_notes: reviewerNotes }); },
    reject(draftId, feedback) { return postForm(`/api/review/${draftId}/reject`, { feedback }); },
    send(draftId) { return postForm(`/api/review/${draftId}/send`); },
    archive(letterId) { return postForm(`/api/review/archive/${letterId}`); },
    dashboardStats() { return request('/api/review/dashboard/stats'); },
    queue(status = 'pending_review') { return request(`/api/review/queue?status=${encodeURIComponent(status)}`); },
  },

  // ─── Auth / Users ──────────────────────────────────
  auth: {
    me() { return request('/api/auth/me'); },
  },

  // ─── Jobs ─────────────────────────────────────────
  jobs: {
    get(jobId) { return request(`/api/jobs/${jobId}`); },
  },

  // ─── Health ───────────────────────────────────────
  health() { return request('/health'); },

  // ─── Drafting Sessions ────────────────────────────
  draftingSessions: {
    templates() { return request('/api/drafting-sessions/templates'); },
    list() { return request('/api/drafting-sessions'); },
    search(q) { return request(`/api/drafting-sessions/search?q=${encodeURIComponent(q)}`); },
    get(sessionId) { return request(`/api/drafting-sessions/${sessionId}`); },
    create(letterId, projectId, title) {
      return postForm('/api/drafting-sessions', {
        letter_id: letterId || '',
        project_id: projectId || '',
        title: title || '',
      });
    },
    togglePin(sessionId) { return request(`/api/drafting-sessions/${sessionId}/pin`, { method: 'PATCH' }); },
    rename(sessionId, title) { return postForm(`/api/drafting-sessions/${sessionId}/title`, { title }); },
    delete(sessionId) { return request(`/api/drafting-sessions/${sessionId}`, { method: 'DELETE' }); },
    addMessage(sessionId, role, content, draftResponseId) {
      return postForm(`/api/drafting-sessions/${sessionId}/messages`, {
        role,
        content,
        draft_response_id: draftResponseId || '',
      });
    },
  },
};

export default CCM;
