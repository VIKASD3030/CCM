/**
 * Client for the CCM public API (`/api/v1`): the contract the Paris team's
 * backend implements, also served by their mock (ccm_public_api/mock_server.py).
 * Reference: ccm_public_api/docs/api.md.
 *
 * Calls use relative `/api/v1` paths so they go through the Vite dev proxy
 * (see vite.config.js). The proxy forwards to CCM_PUBLIC_API_URL and adds the
 * business-unit token, so the token is never part of the browser bundle.
 * A token set with `configure({ token })` is sent instead (used to test rotation).
 *
 * Every call resolves to a response record and never throws for HTTP errors,
 * so test screens can show failures. Use `unwrap()` to get data or throw.
 */

export const API_BASE = '/api/v1';

const settings = { token: '', scenario: '' };
const listeners = new Set();

/** token: bearer token override ('' = let the proxy add it). scenario: mock-only X-Mock-Scenario ('' | 'failed' | 'busy'). */
export function configure(next) {
  Object.assign(settings, next);
}

export function getSettings() {
  return { ...settings };
}

/** Subscribe to every request/response (including job polls). Returns an unsubscribe function. */
export function onCall(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export class CcmApiError extends Error {
  constructor(response) {
    const err = response.data && response.data.error;
    super(err ? `${err.code}: ${err.message}` : (response.networkError || `HTTP ${response.status}`));
    this.name = 'CcmApiError';
    this.status = response.status;
    this.code = err ? err.code : `http_${response.status}`;
    this.details = (err && err.details) || [];
    this.response = response;
  }
}

/** Returns the JSON body of a successful response, or throws CcmApiError. */
export function unwrap(response) {
  if (!response.ok) throw new CcmApiError(response);
  return response.data;
}

/** 32 lowercase hex characters; matches the API's external-ID pattern. */
export function newIdempotencyKey() {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const enc = encodeURIComponent;

function queryString(params) {
  if (!params) return '';
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
  });
  const text = qs.toString();
  return text ? `?${text}` : '';
}

function describeForm(form) {
  const out = {};
  form.forEach((value, key) => {
    const shown = value instanceof File ? `<file ${value.name}, ${value.size} bytes>` : value;
    out[key] = key in out ? [].concat(out[key], shown) : shown;
  });
  return out;
}

function filenameFrom(disposition) {
  if (!disposition) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (star) return decodeURIComponent(star[1]);
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain ? plain[1] : null;
}

const SHOWN_HEADERS = ['content-type', 'location', 'retry-after', 'content-disposition', 'cache-control', 'x-ccm-mock'];

/**
 * Low-level request. `path` is relative to /api/v1 (e.g. '/projects').
 * Options: json (object body), form (FormData), params (query object),
 * job (adds Idempotency-Key), idempotencyKey (reuse a key), token, scenario, headers.
 */
export async function send(method, path, options = {}) {
  const { json, form, params, job, idempotencyKey, headers = {} } = options;
  const url = API_BASE + path + queryString(params);
  const requestHeaders = { Accept: 'application/json', ...headers };
  const token = options.token !== undefined ? options.token : settings.token;
  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  const scenario = options.scenario !== undefined ? options.scenario : settings.scenario;
  if (job && scenario) requestHeaders['X-Mock-Scenario'] = scenario;
  if (job) requestHeaders['Idempotency-Key'] = idempotencyKey || newIdempotencyKey();

  let body;
  if (json !== undefined) {
    body = JSON.stringify(json);
    requestHeaders['Content-Type'] = 'application/json';
  } else if (form) {
    body = form; // the browser sets the multipart boundary
  }

  const shownRequestHeaders = { ...requestHeaders };
  shownRequestHeaders.Authorization = token ? 'Bearer ••••••• (console override)' : '(added by dev proxy)';

  const result = {
    id: newIdempotencyKey().slice(0, 12),
    at: new Date().toISOString(),
    ok: false,
    status: 0,
    statusText: '',
    durationMs: 0,
    request: {
      method,
      url,
      headers: shownRequestHeaders,
      body: json !== undefined ? json : form ? describeForm(form) : undefined,
    },
    headers: {},
    contentType: '',
    data: null,
    text: null,
    blob: null,
    filename: null,
    networkError: null,
    hint: null,
  };

  const started = performance.now();
  try {
    const response = await fetch(url, { method, headers: requestHeaders, body });
    result.ok = response.ok;
    result.status = response.status;
    result.statusText = response.statusText;
    SHOWN_HEADERS.forEach((name) => {
      const value = response.headers.get(name);
      if (value !== null) result.headers[name] = value;
    });
    result.contentType = response.headers.get('content-type') || '';
    if (response.status !== 204) {
      if (result.contentType.includes('application/json')) {
        result.data = await response.json().catch(() => null);
      } else if (result.contentType.includes('text/html')) {
        result.text = await response.text();
        result.hint = 'Got an HTML page instead of the API. Check the /api/v1 proxy in vite.config.js and restart Vite.';
      } else if (!response.ok) {
        result.text = await response.text();
        if (response.status >= 500 && !result.text) {
          result.hint = 'The dev proxy could not reach the API. Is mock_server.py running on CCM_PUBLIC_API_URL?';
        }
      } else {
        result.blob = await response.blob();
        result.filename = filenameFrom(response.headers.get('content-disposition'));
      }
    }
  } catch (error) {
    result.networkError = `Cannot reach the dev server: ${error.message}`;
  }
  result.durationMs = Math.round(performance.now() - started);
  listeners.forEach((listener) => {
    try { listener(result); } catch (e) { /* a broken listener must not break the call */ }
  });
  return result;
}

/** Turns a status_url (absolute or /api/v1/...) into a path for send(). */
export function apiPathOf(statusUrl) {
  let path = statusUrl;
  // The real server may return an absolute URL on its own host. Keep only the
  // path so the poll still goes through our proxy to the configured server,
  // never to a host taken from a response.
  if (/^https?:\/\//i.test(statusUrl)) {
    const parsed = new URL(statusUrl);
    path = parsed.pathname + parsed.search;
  }
  const at = path.indexOf(`${API_BASE}/`);
  if (at < 0) throw new Error(`Unexpected polling URL: ${statusUrl}`);
  return path.slice(at + API_BASE.length);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Polls a 202 receipt's status_url until the job is completed or failed.
 * Resolves to the last poll response; its data is the job ({status, result?, error?}).
 * Throws CcmApiError if a poll returns an HTTP error, Error on timeout.
 */
export async function waitForJob(receipt, { intervalMs = 800, timeoutMs = 120000, onPoll } = {}) {
  const path = apiPathOf(receipt.status_url);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await send('GET', path);
    if (onPoll) onPoll(response);
    if (response.status === 429) {
      await sleep(1000 * (Number(response.headers['retry-after']) || 5));
      continue;
    }
    const job = unwrap(response);
    if (job.status === 'completed' || job.status === 'failed') return response;
    if (job.status !== 'queued' && job.status !== 'running') {
      throw new Error(`Unexpected job status: ${job.status}`);
    }
    await sleep(intervalMs);
  }
  throw new Error('Job polling timed out.');
}

/** Returns a completed job's result, or throws with the job's error code. */
export function jobResult(pollResponse) {
  const job = unwrap(pollResponse);
  if (job.status === 'failed') {
    const err = new Error(`Job failed: ${job.error ? `${job.error.code}: ${job.error.message}` : 'unknown error'}`);
    err.code = job.error && job.error.code;
    err.job = job;
    throw err;
  }
  return job.result;
}

const P = (project) => `/projects/${enc(project)}`;
const L = (project, file) => `${P(project)}/letters/${enc(file)}`;

/**
 * One method per documented endpoint. Request bodies are passed as the
 * documented JSON objects; `opts` is forwarded to send() (e.g. idempotencyKey, scenario, token).
 */
export const ccmApi = {
  auth: {
    rotate: (opts) => send('POST', '/auth/rotate', { json: {}, ...opts }),
  },

  projects: {
    list: (opts) => send('GET', '/projects', opts),
    create: (body, opts) => send('POST', '/projects', { json: body, ...opts }),
    get: (project, opts) => send('GET', P(project), opts),
  },

  rules: {
    get: (project, opts) => send('GET', `${P(project)}/rules`, opts),
    save: (project, body, opts) => send('PUT', `${P(project)}/rules`, { json: body, ...opts }),
    validate: (project, body, opts) => send('POST', `${P(project)}/rules/validate`, { json: body, ...opts }),
    versions: (project, opts) => send('GET', `${P(project)}/rules/versions`, opts),
    version: (project, version, opts) => send('GET', `${P(project)}/rules/versions/${enc(version)}`, opts),
    plan: (project, opts) => send('GET', `${P(project)}/rules/plan`, opts),
    apply: (project, body, opts) => send('POST', `${P(project)}/rules/apply`, { json: body, job: true, ...opts }),
    deactivate: (project, body, opts) => send('POST', `${P(project)}/rules/deactivate`, { json: body, ...opts }),
    recommend: (project, body, opts) => send('POST', `${P(project)}/rules/recommendations`, { json: body, job: true, ...opts }),
  },

  contracts: {
    list: (project, opts) => send('GET', `${P(project)}/contracts`, opts),
    importText: (project, volume, body, opts) =>
      send('POST', `${P(project)}/contracts/${enc(volume)}/import`, { json: body, job: true, ...opts }),
    importFile: (project, volume, expectedRevision, file, opts) => {
      const form = new FormData();
      form.append('expected_revision', expectedRevision);
      form.append('file', file);
      return send('POST', `${P(project)}/contracts/${enc(volume)}/import`, { form, job: true, ...opts });
    },
  },

  jobs: {
    operation: (project, id, opts) => send('GET', `${P(project)}/operations/${enc(id)}`, opts),
    draftReply: (project, id, opts) => send('GET', `${P(project)}/draft-replies/${enc(id)}`, opts),
  },

  draftReplies: {
    create: (project, body, opts) => send('POST', `${P(project)}/draft-replies`, { json: body, job: true, ...opts }),
  },

  letters: {
    list: (project, params, opts) => send('GET', `${P(project)}/letters`, { params, ...opts }),
    get: (project, file, opts) => send('GET', L(project, file), opts),
    original: (project, file, opts) => send('GET', `${L(project, file)}/original`, opts),
    analyze: (project, file, opts) => send('POST', `${L(project, file)}/analysis`, { json: {}, job: true, ...opts }),
    review: (project, file, body, opts) => send('POST', `${L(project, file)}/review`, { json: body, job: true, ...opts }),
    exportDocx: (project, file, body, opts) => send('POST', `${L(project, file)}/export`, { json: body, ...opts }),
  },

  savedDrafts: {
    list: (project, user, opts) => send('GET', `${P(project)}/drafts`, { params: { user }, ...opts }),
    get: (project, file, user, opts) => send('GET', `${L(project, file)}/draft`, { params: { user }, ...opts }),
    save: (project, file, body, opts) => send('PUT', `${L(project, file)}/draft`, { json: body, ...opts }),
    remove: (project, file, user, opts) => send('DELETE', `${L(project, file)}/draft`, { params: { user }, ...opts }),
  },

  imports: {
    options: (project, opts) => send('GET', `${P(project)}/import-options`, opts),
    upload: (project, { folder, pages, files }, opts) => {
      const form = new FormData();
      form.append('folder', folder);
      if (pages) form.append('pages', pages);
      files.forEach((file) => form.append('files', file));
      return send('POST', `${P(project)}/imports`, { form, job: true, ...opts });
    },
  },

  audit: {
    get: (params, opts) => send('GET', '/audit', { params, ...opts }),
  },
};

export default ccmApi;
