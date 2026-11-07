/**
 * CCM API console: a test bench for the CCM public API (/api/v1), the contract
 * the Paris team's backend implements. Locally it talks to their mock server
 * through the Vite dev proxy (see vite.config.js and ccm-public-api.js).
 *
 * Endpoints tab: send any documented request with an editable, prefilled body.
 * Workflows tab: end-to-end checks with pass/fail per step.
 * Call log tab: every request and response, including job polls.
 */
import React from 'react';
import {
  Check, Copy, Download, ExternalLink, Loader2, Minus, Play, RefreshCw, RotateCcw, Send, Trash2, X,
} from 'lucide-react';
import {
  ccmApi, configure, getSettings, onCall, waitForJob, API_BASE,
} from '../ccm-public-api';
import { ENDPOINTS, GROUPS } from '../api-console/endpoints';
import { WORKFLOWS } from '../api-console/workflows';
import { flagSegments, inspectDocx, openBlob, saveBlob } from '../api-console/helpers';
import { Btn, Card, Chip, PageTop, toast } from '../ui/kit';
import '../ui/api-console.css';

const LOG_LIMIT = 200;
const MOCK_URL_FOR_CURL = 'http://127.0.0.1:5058';

const DEFAULT_CTX = {
  project: 'sample-project',
  file: 'letter-001',
  user: 'demo-user',
  jobId: '',
  version: '',
  volume: 'conditions',
  draftJobId: '',
  draftFor: '',
  draftText: '',
};

const CONTEXT_FIELDS = [
  { key: 'project', label: 'Project ID', list: 'cxa-projects' },
  { key: 'file', label: 'Letter file', list: 'cxa-letters' },
  { key: 'user', label: 'User (actor label)' },
  { key: 'jobId', label: 'Job ID' },
  { key: 'version', label: 'Rule version' },
  { key: 'volume', label: 'Contract volume', list: 'cxa-volumes' },
];

function statusTone(status) {
  if (!status) return 'bad';
  if (status < 300) return 'ok';
  if (status < 500) return 'warn';
  return 'bad';
}

function jobTone(status) {
  return { completed: 'ok', failed: 'bad', running: 'blue', queued: 'gray' }[status] || 'gray';
}

function resolvePath(endpoint, ctx) {
  return endpoint.path
    .replace('{project}', ctx.project || '{project}')
    .replace('{file}', ctx.file || '{file}')
    .replace('{jobId}', ctx.jobId || '{jobId}')
    .replace('{version}', ctx.version || '{version}')
    .replace('{volume}', ctx.volume || '{volume}')
    .replace('?user=', `?user=${ctx.user || ''}`);
}

function shortPath(url) {
  return url.startsWith(API_BASE) ? url.slice(API_BASE.length) : url;
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function toCurl(response) {
  const { method, url, headers, body } = response.request;
  const parts = [`curl -X ${method} '${MOCK_URL_FOR_CURL}${url}'`, `-H 'Authorization: Bearer <token>'`];
  Object.entries(headers).forEach(([key, value]) => {
    if (key === 'Authorization' || key === 'Accept') return;
    parts.push(`-H '${key}: ${value}'`);
  });
  if (body !== undefined && headers['Content-Type'] === 'application/json') {
    parts.push(`-d '${JSON.stringify(body).replace(/'/g, "'\\''")}'`);
  } else if (body !== undefined) {
    Object.entries(body).forEach(([key, value]) => {
      [].concat(value).forEach((v) => parts.push(`-F '${key}=${String(v).startsWith('<file ') ? '@<path>' : v}'`));
    });
  }
  return parts.join(' \\\n  ');
}

function copyText(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => toast('Copied', 'success'), () => toast('Copy failed', 'error'));
  }
}

// ── Response display ──────────────────────────────────────────────────────

function JsonBlock({ value }) {
  if (value === undefined || value === null) return <div className="cxa-muted">(empty body)</div>;
  return <pre className="cxa-pre">{JSON.stringify(value, null, 2)}</pre>;
}

/** Draft text with review flags highlighted using code-point offsets. */
function FlaggedText({ text, flags }) {
  const segments = flagSegments(text, flags);
  return (
    <div className="cxa-flagged">
      {segments.map((seg, i) => (seg.flag ? (
        <mark key={i} className={`cxa-flag ${seg.flag.level}`} title={`${seg.flag.id} ${seg.flag.kind}: ${seg.flag.title}\n${seg.flag.detail}\n${seg.flag.action}`}>
          {seg.text}
        </mark>
      ) : <span key={i}>{seg.text}</span>))}
    </div>
  );
}

function BinaryCard({ response }) {
  const [docx, setDocx] = React.useState(null);
  const isDocx = response.contentType.includes('wordprocessingml');
  const isPdf = response.contentType.includes('pdf');
  React.useEffect(() => {
    let alive = true;
    if (isDocx && response.blob) inspectDocx(response.blob).then((info) => { if (alive) setDocx(info); });
    return () => { alive = false; };
  }, [response, isDocx]);
  return (
    <div className="cxa-file">
      <div>
        <b>{response.filename || 'download'}</b>
        <div className="cxa-muted">{response.contentType} · {formatBytes(response.blob.size)}</div>
        {docx && (
          <div className="cxa-checks">
            <Chip tone={docx.isZip && docx.hasDocument ? 'ok' : 'bad'}>{docx.isZip && docx.hasDocument ? 'Valid DOCX' : 'Not a valid DOCX'}</Chip>
            <Chip tone={docx.hasComments ? 'blue' : 'gray'}>{docx.hasComments ? 'Has Word comments' : 'No Word comments'}</Chip>
          </div>
        )}
      </div>
      <span className="cx-spacer" />
      {isPdf && <Btn size="sm" onClick={() => openBlob(response.blob)}><ExternalLink size={14} /> Open</Btn>}
      <Btn size="sm" variant="primary" onClick={() => saveBlob(response.blob, response.filename)}><Download size={14} /> Download</Btn>
    </div>
  );
}

function ResponseView({ response, polls = [], pollError, submittedText }) {
  if (!response) return null;
  const finalJob = polls.length ? polls[polls.length - 1].data : null;
  const shown = finalJob || response.data;
  const result = finalJob && finalJob.result;
  const draft = result && result.draft;
  const reviewFlags = result && !draft && result.review_flags;
  const error = response.data && response.data.error;
  return (
    <div className="cxa-response">
      <div className="cxa-status">
        <Chip tone={statusTone(response.status)}>{response.status || 'No response'} {response.statusText}</Chip>
        <span className="cxa-muted">{response.request.method} {shortPath(response.request.url)} · {response.durationMs} ms</span>
        {response.headers['x-ccm-mock'] && <Chip tone="gray">mock</Chip>}
        {error && <Chip tone="bad">{error.code}</Chip>}
      </div>
      {(response.networkError || response.hint) && (
        <div className="cxa-banner bad">{response.networkError || response.hint}</div>
      )}
      {error && error.details && error.details.length > 0 && (
        <ul className="cxa-details">
          {error.details.map((d, i) => <li key={i}><code>{d.field || '(request)'}</code> {d.message}</li>)}
        </ul>
      )}

      {polls.length > 0 && (
        <div className="cxa-polls">
          <span className="cxa-muted">Job polls:</span>
          {polls.map((p, i) => (
            <Chip key={i} tone={p.ok ? jobTone(p.data && p.data.status) : 'bad'}>
              {p.ok ? p.data.status : `HTTP ${p.status}`}
            </Chip>
          ))}
          {finalJob && finalJob.status === 'failed' && finalJob.error && (
            <span className="cxa-bad-text">{finalJob.error.code}: {finalJob.error.message}</span>
          )}
        </div>
      )}
      {pollError && <div className="cxa-banner bad">Polling stopped: {pollError}</div>}

      {draft && (
        <div className="cxa-section">
          <h4>Draft text ({(result.review_flags || []).length} flag(s) highlighted)</h4>
          <FlaggedText text={draft.text} flags={result.review_flags} />
        </div>
      )}
      {reviewFlags && submittedText && (
        <div className="cxa-section">
          <h4>Submitted text ({reviewFlags.length} flag(s) highlighted)</h4>
          <FlaggedText text={submittedText} flags={reviewFlags} />
        </div>
      )}

      {response.blob ? <BinaryCard response={response} /> : (
        <div className="cxa-section">
          <h4>{finalJob ? 'Final job' : 'Response body'}</h4>
          {response.text && !response.data ? <pre className="cxa-pre">{response.text.slice(0, 4000)}</pre> : <JsonBlock value={shown} />}
          {finalJob && (
            <details className="cxa-more">
              <summary>202 receipt</summary>
              <JsonBlock value={response.data} />
            </details>
          )}
        </div>
      )}

      <details className="cxa-more">
        <summary>Response headers</summary>
        <table className="cxa-kv"><tbody>
          {Object.entries(response.headers).map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}
        </tbody></table>
      </details>
      <details className="cxa-more">
        <summary>Request</summary>
        <table className="cxa-kv"><tbody>
          <tr><td>URL</td><td>{response.request.method} {response.request.url}</td></tr>
          {Object.entries(response.request.headers).map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}
        </tbody></table>
        {response.request.body !== undefined && <JsonBlock value={response.request.body} />}
        <Btn size="sm" onClick={() => copyText(toCurl(response))}><Copy size={14} /> Copy as curl</Btn>
      </details>
    </div>
  );
}

// ── Endpoints tab ─────────────────────────────────────────────────────────

function MethodTag({ method }) {
  return <span className={`cxa-method ${method.toLowerCase()}`}>{method}</span>;
}

function EndpointPanel({ endpoint, ctx, draftSubmissions }) {
  const [editor, setEditor] = React.useState('');
  const [editorError, setEditorError] = React.useState('');
  const [defaultsError, setDefaultsError] = React.useState('');
  const [loadingDefaults, setLoadingDefaults] = React.useState(false);
  const [files, setFiles] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [autoPoll, setAutoPoll] = React.useState(true);
  const [response, setResponse] = React.useState(null);
  const [polls, setPolls] = React.useState([]);
  const [pollError, setPollError] = React.useState('');
  const [submittedText, setSubmittedText] = React.useState('');
  const ctxRef = React.useRef(ctx);
  ctxRef.current = ctx;

  const loadDefaults = React.useCallback(async () => {
    setDefaultsError('');
    setEditorError('');
    if (endpoint.input === 'none' || !endpoint.defaults) {
      setEditor('');
      return;
    }
    setLoadingDefaults(true);
    try {
      const value = await endpoint.defaults(ctxRef.current);
      setEditor(JSON.stringify(value, null, 2));
    } catch (error) {
      setEditor('{}');
      setDefaultsError(`Could not build the default request: ${error.message}`);
    } finally {
      setLoadingDefaults(false);
    }
  }, [endpoint]);

  React.useEffect(() => {
    setResponse(null);
    setPolls([]);
    setPollError('');
    setFiles(endpoint.files ? endpoint.files.sample() : []);
    loadDefaults();
  }, [endpoint, loadDefaults]);

  const send = async () => {
    let parsed;
    if (endpoint.input !== 'none') {
      try {
        parsed = editor.trim() ? JSON.parse(editor) : {};
      } catch (error) {
        setEditorError(`Invalid JSON: ${error.message}`);
        return;
      }
    }
    if (endpoint.files && files.length === 0) {
      setEditorError('Choose a file first.');
      return;
    }
    setEditorError('');
    setBusy(true);
    setPolls([]);
    setPollError('');
    setSubmittedText(parsed && typeof parsed.text === 'string' ? parsed.text : '');
    const callCtx = ctxRef.current;
    try {
      const result = await endpoint.run(callCtx, parsed, files, {});
      setResponse(result);
      if (endpoint.kind === 'job' && result.status === 202 && result.data && result.data.status_url) {
        if (endpoint.id === 'draftReplies.create') {
          draftSubmissions.current[result.data.id] = `${callCtx.project}/${callCtx.file}`;
        }
        if (autoPoll) {
          try {
            await waitForJob(result.data, { onPoll: (p) => setPolls((prev) => [...prev, p]) });
          } catch (error) {
            setPollError(error.message);
          }
        }
      }
    } catch (error) {
      setEditorError(error.message);
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      send();
    }
  };

  const editorLabel = { json: 'JSON body', query: 'Query parameters (JSON)', form: 'Form fields (JSON)' }[endpoint.input];

  return (
    <div className="cxa-panel">
      <div className="cxa-endpoint-head">
        <MethodTag method={endpoint.method} />
        <code className="cxa-path">{API_BASE}{resolvePath(endpoint, ctx)}</code>
        {endpoint.kind === 'job' && <Chip tone="blue">job · 202 + poll</Chip>}
        {endpoint.kind === 'binary' && <Chip tone="gray">file download</Chip>}
      </div>
      <h3 className="cxa-title">{endpoint.title}</h3>
      <p className="cxa-doc">{endpoint.doc}</p>
      {endpoint.danger && <div className="cxa-banner warn">{endpoint.danger}</div>}

      {endpoint.input !== 'none' && (
        <div className="cx-field">
          <div className="cxa-editor-head">
            <label htmlFor="cxa-editor">{editorLabel}</label>
            <span className="cx-spacer" />
            <Btn size="sm" variant="ghost" onClick={loadDefaults} disabled={loadingDefaults}>
              <RotateCcw size={13} /> {loadingDefaults ? 'Loading…' : 'Reset to default'}
            </Btn>
          </div>
          <textarea id="cxa-editor" className="cx-textarea cxa-editor" spellCheck={false} value={editor}
            onChange={(e) => setEditor(e.target.value)} onKeyDown={onKeyDown}
            rows={Math.min(22, Math.max(4, editor.split('\n').length + 1))} />
          {defaultsError && <div className="cxa-banner warn">{defaultsError}</div>}
        </div>
      )}

      {endpoint.files && (
        <div className="cx-field">
          <label>{endpoint.files.label}</label>
          <div className="cxa-files">
            <input type="file" accept={endpoint.files.accept} multiple={endpoint.files.multiple}
              onChange={(e) => setFiles(Array.from(e.target.files || []))} />
            <Btn size="sm" onClick={() => setFiles(endpoint.files.sample())}>Use generated sample</Btn>
            <span className="cxa-muted">
              {files.length ? files.map((f) => `${f.name} (${formatBytes(f.size)})`).join(', ') : 'No file chosen'}
            </span>
          </div>
        </div>
      )}

      {editorError && <div className="cxa-banner bad">{editorError}</div>}

      <div className="cxa-actions">
        <Btn variant="primary" onClick={send} disabled={busy || loadingDefaults}>
          {busy ? <Loader2 size={14} className="cxa-spin" /> : <Send size={14} />} Send
        </Btn>
        {endpoint.kind === 'job' && (
          <label className="cxa-check">
            <input type="checkbox" checked={autoPoll} onChange={(e) => setAutoPoll(e.target.checked)} /> Poll until finished
          </label>
        )}
        <span className="cxa-muted">Ctrl+Enter sends from the editor</span>
      </div>

      <ResponseView response={response} polls={polls} pollError={pollError} submittedText={submittedText} />
    </div>
  );
}

function EndpointsTab({ ctx, filter, draftSubmissions }) {
  const [selectedId, setSelectedId] = React.useState('projects.get');
  const needle = filter.trim().toLowerCase();
  const visible = ENDPOINTS.filter((e) => !needle
    || `${e.title} ${e.path} ${e.method} ${e.group}`.toLowerCase().includes(needle));
  const selected = ENDPOINTS.find((e) => e.id === selectedId) || ENDPOINTS[0];
  return (
    <div className="cxa-split">
      <nav className="cxa-list" aria-label="Endpoints">
        {GROUPS.map((group) => {
          const items = visible.filter((e) => e.group === group);
          if (!items.length) return null;
          return (
            <div key={group}>
              <div className="cxa-group">{group}</div>
              {items.map((e) => (
                <button key={e.id} type="button" className={`cxa-item ${e.id === selected.id ? 'on' : ''}`}
                  onClick={() => setSelectedId(e.id)}>
                  <MethodTag method={e.method} />
                  <span>{e.title}</span>
                </button>
              ))}
            </div>
          );
        })}
        {!visible.length && <div className="cxa-muted cxa-pad">No endpoint matches "{filter}".</div>}
      </nav>
      <EndpointPanel key={selected.id} endpoint={selected} ctx={ctx} draftSubmissions={draftSubmissions} />
    </div>
  );
}

// ── Workflows tab ─────────────────────────────────────────────────────────

class StopWorkflow extends Error {}

function StepIcon({ status }) {
  if (status === 'pass') return <Check size={15} className="cxa-ok-text" />;
  if (status === 'fail') return <X size={15} className="cxa-bad-text" />;
  if (status === 'running') return <Loader2 size={15} className="cxa-spin" />;
  return <Minus size={15} className="cxa-muted" />;
}

function WorkflowCard({ workflow, run, disabled }) {
  const [open, setOpen] = React.useState(null);
  const passed = run && run.steps.filter((s) => s.status === 'pass').length;
  const failed = run && run.steps.some((s) => s.status === 'fail');
  return (
    <Card
      title={workflow.title}
      right={(
        <>
          {run && !run.running && (
            <Chip tone={failed ? 'bad' : 'ok'}>{failed ? 'Failed' : 'Passed'} · {passed}/{run.steps.length} steps · {run.ms} ms</Chip>
          )}
          <Btn size="sm" variant="primary" disabled={disabled} onClick={run.onRun}>
            {run && run.running ? <Loader2 size={14} className="cxa-spin" /> : <Play size={14} />} Run
          </Btn>
        </>
      )}
    >
      <p className="cxa-doc">{workflow.description}</p>
      {run && (
        <ol className="cxa-steps">
          {run.steps.map((step, i) => (
            <li key={i} className={step.status}>
              <button type="button" className="cxa-step" onClick={() => setOpen(open === i ? null : i)} disabled={!step.response}>
                <StepIcon status={step.status} />
                <span className="cxa-step-name">{step.name}</span>
                <span className="cxa-step-detail">{step.detail}</span>
                {step.ms !== undefined && <span className="cxa-muted">{step.ms} ms</span>}
              </button>
              {open === i && step.response && <ResponseView response={step.response} />}
            </li>
          ))}
          {run.stopped && <li className="cxa-muted cxa-pad">Stopped after the failed step.</li>}
        </ol>
      )}
    </Card>
  );
}

function WorkflowsTab({ ctxRef, setCtx }) {
  const [runs, setRuns] = React.useState({});
  const [running, setRunning] = React.useState(null);

  const runWorkflow = React.useCallback(async (workflow) => {
    const started = performance.now();
    const steps = [];
    const publish = (extra = {}) => setRuns((prev) => ({
      ...prev,
      [workflow.id]: { ...(prev[workflow.id] || {}), steps: [...steps], ...extra },
    }));
    publish({ running: true, stopped: false });

    const t = {
      expect(condition, message) {
        if (!condition) throw new Error(message);
      },
      learn(patch) {
        ctxRef.current = { ...ctxRef.current, ...patch };
        setCtx((prev) => ({ ...prev, ...patch }));
      },
      async step(name, fn) {
        const step = { name, status: 'running' };
        steps.push(step);
        publish();
        const stepStart = performance.now();
        try {
          const out = (await fn()) || {};
          Object.assign(step, { status: 'pass', detail: out.detail, response: out.response });
        } catch (error) {
          const job = error.job ? ` (job ${error.job.id})` : '';
          Object.assign(step, { status: 'fail', detail: `${error.message}${job}`, response: error.response });
          throw new StopWorkflow(error.message);
        } finally {
          step.ms = Math.round(performance.now() - stepStart);
          publish();
        }
      },
    };

    // Workflows decide their own mock scenario per call; don't let the console setting leak in.
    const saved = getSettings();
    configure({ scenario: '' });
    let stopped = false;
    try {
      await workflow.run(t, { ...ctxRef.current });
    } catch (error) {
      stopped = true;
      if (!(error instanceof StopWorkflow)) {
        steps.push({ name: 'Unexpected error', status: 'fail', detail: error.message });
      }
    } finally {
      configure({ scenario: saved.scenario });
      publish({ running: false, stopped, ms: Math.round(performance.now() - started) });
    }
    return !stopped;
  }, [ctxRef, setCtx]);

  const runOne = async (workflow) => {
    setRunning(workflow.id);
    await runWorkflow(workflow);
    setRunning(null);
  };

  const runAll = async () => {
    setRunning('all');
    let failures = 0;
    for (const workflow of WORKFLOWS) {
      if (!(await runWorkflow(workflow))) failures += 1;
    }
    setRunning(null);
    toast(failures ? `${failures} workflow(s) failed` : 'All workflows passed', failures ? 'error' : 'success');
  };

  return (
    <div className="cxa-stack">
      <div className="cxa-actions">
        <Btn variant="primary" onClick={runAll} disabled={!!running}>
          {running === 'all' ? <Loader2 size={14} className="cxa-spin" /> : <Play size={14} />} Run all workflows
        </Btn>
        <span className="cxa-muted">
          Uses project, letter and user from the context bar. Click a finished step to see its response.
        </span>
      </div>
      {WORKFLOWS.map((workflow) => (
        <WorkflowCard
          key={workflow.id}
          workflow={workflow}
          disabled={!!running}
          run={{
            steps: [],
            ...(runs[workflow.id] || {}),
            running: running === workflow.id || (runs[workflow.id] && runs[workflow.id].running),
            onRun: () => runOne(workflow),
          }}
        />
      ))}
    </div>
  );
}

// ── Call log tab ──────────────────────────────────────────────────────────

function LogTab({ log, onClear }) {
  const [selected, setSelected] = React.useState(null);
  const current = log.find((r) => r.id === selected);
  return (
    <div className="cxa-stack">
      <div className="cxa-actions">
        <span className="cxa-muted">{log.length} call(s), newest first (last {LOG_LIMIT} kept)</span>
        <span className="cx-spacer" />
        <Btn size="sm" onClick={onClear} disabled={!log.length}><Trash2 size={14} /> Clear</Btn>
      </div>
      <div className="cxa-table-wrap">
        <table className="cxa-table">
          <thead><tr><th>Time</th><th>Method</th><th>Path</th><th>Status</th><th>Job</th><th>ms</th></tr></thead>
          <tbody>
            {log.map((r) => (
              <tr key={r.id} className={r.id === selected ? 'on' : ''} onClick={() => setSelected(r.id === selected ? null : r.id)}>
                <td>{new Date(r.at).toLocaleTimeString()}</td>
                <td><MethodTag method={r.request.method} /></td>
                <td className="cxa-mono">{shortPath(r.request.url)}</td>
                <td><Chip tone={statusTone(r.status)}>{r.status || 'ERR'}</Chip></td>
                <td>{r.data && r.data.kind && <Chip tone={jobTone(r.data.status)}>{r.data.status}</Chip>}</td>
                <td>{r.durationMs}</td>
              </tr>
            ))}
            {!log.length && <tr><td colSpan={6} className="cxa-muted cxa-pad">No calls yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {current && <Card title="Call details"><ResponseView response={current} /></Card>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function ApiConsole() {
  const [ctx, setCtx] = React.useState(DEFAULT_CTX);
  const ctxRef = React.useRef(ctx);
  ctxRef.current = ctx;
  const [settings, setSettings] = React.useState(getSettings());
  const [tab, setTab] = React.useState('endpoints');
  const [filter, setFilter] = React.useState('');
  const [log, setLog] = React.useState([]);
  const [connection, setConnection] = React.useState({ state: 'checking' });
  const [lists, setLists] = React.useState({ projects: [], letters: [], volumes: [] });
  const draftSubmissions = React.useRef({});

  // Learn IDs from every response so follow-up requests are prefilled.
  React.useEffect(() => onCall((response) => {
    setLog((prev) => [response, ...prev].slice(0, LOG_LIMIT));
    const data = response.data;
    if (!response.ok || !data || typeof data !== 'object') return;
    const patch = {};
    if (data.status_url && data.id) patch.jobId = data.id;
    if (data.kind === 'draft_reply' && data.status === 'completed' && data.result && data.result.draft) {
      patch.draftJobId = data.id;
      patch.draftText = data.result.draft.text;
      patch.draftFor = draftSubmissions.current[data.id] || '';
    }
    if (Array.isArray(data.versions) && data.versions.length) patch.version = data.versions[0].version;
    if (Object.keys(patch).length) setCtx((prev) => ({ ...prev, ...patch }));
    if (Array.isArray(data.projects)) setLists((prev) => ({ ...prev, projects: data.projects.map((p) => p.project_id) }));
    if (Array.isArray(data.letters) && data.project_id === ctxRef.current.project) {
      setLists((prev) => ({ ...prev, letters: data.letters.map((l) => l.file) }));
    }
    if (Array.isArray(data.volumes) && data.project_id === ctxRef.current.project) {
      setLists((prev) => ({ ...prev, volumes: data.volumes.map((v) => v.id) }));
    }
  }), []);

  const checkConnection = React.useCallback(async () => {
    setConnection({ state: 'checking' });
    const response = await ccmApi.projects.list();
    if (response.ok) {
      setConnection({ state: 'ok', mock: !!response.headers['x-ccm-mock'] });
    } else {
      const code = response.data && response.data.error ? response.data.error.code : `HTTP ${response.status}`;
      setConnection({ state: 'error', message: response.networkError || response.hint || code });
    }
  }, []);

  React.useEffect(() => { checkConnection(); }, [checkConnection]);

  // Refresh letter and volume suggestions when the project changes.
  React.useEffect(() => {
    if (!ctx.project || connection.state !== 'ok') return undefined;
    const timer = setTimeout(() => {
      ccmApi.letters.list(ctx.project);
      ccmApi.contracts.list(ctx.project);
    }, 500);
    return () => clearTimeout(timer);
  }, [ctx.project, connection.state]);

  const updateSettings = (patch) => {
    configure(patch);
    setSettings(getSettings());
  };

  const connectionChip = {
    checking: <Chip tone="gray">Checking connection…</Chip>,
    ok: <Chip tone="ok">Connected{connection.mock ? ' · mock server' : ''}</Chip>,
    error: <Chip tone="bad" title={connection.message}>Not connected: {connection.message}</Chip>,
  }[connection.state];

  return (
    <>
      <PageTop
        crumbs={[{ label: 'CCM' }, { label: 'Developer' }]}
        title="CCM API Console"
        onSearch={(q) => { setFilter(q); setTab('endpoints'); }}
        searchPlaceholder="Filter endpoints"
        actions={(
          <>
            {connectionChip}
            <Btn size="sm" onClick={checkConnection}><RefreshCw size={14} /> Recheck</Btn>
          </>
        )}
      />
      <div className="cx-content">
        {connection.state === 'error' && (
          <div className="cxa-banner bad">
            Can't reach the CCM API through the dev proxy. Start the mock with <code>python mock_server.py</code> in
            the ccm_public_api folder, make sure Vite was restarted after the proxy change, then press Recheck.
          </div>
        )}

        <Card title="Context" right={<span className="cxa-muted">Used to fill paths and default bodies. IDs from responses are picked up automatically.</span>}>
          <div className="cxa-context">
            {CONTEXT_FIELDS.map((field) => (
              <div className="cx-field" key={field.key}>
                <label htmlFor={`cxa-${field.key}`}>{field.label}</label>
                <input id={`cxa-${field.key}`} className="cx-input" list={field.list} value={ctx[field.key]}
                  onChange={(e) => {
                    const value = field.key === 'user' ? e.target.value : e.target.value.trim();
                    setCtx((prev) => ({ ...prev, [field.key]: value }));
                  }} />
              </div>
            ))}
            <div className="cx-field">
              <label htmlFor="cxa-scenario">Mock scenario (job requests)</label>
              <select id="cxa-scenario" className="cx-select" value={settings.scenario}
                onChange={(e) => updateSettings({ scenario: e.target.value })}>
                <option value="">Normal</option>
                <option value="failed">failed: job ends with an error</option>
                <option value="busy">busy: HTTP 429 + Retry-After</option>
              </select>
            </div>
            <div className="cx-field">
              <label htmlFor="cxa-token">Token override</label>
              <input id="cxa-token" className="cx-input" type="password" autoComplete="off"
                placeholder="Empty = dev proxy adds the token" value={settings.token}
                onChange={(e) => updateSettings({ token: e.target.value.trim() })} />
            </div>
          </div>
          {ctx.draftJobId && (
            <div className="cxa-muted cxa-linked">
              Last generated draft: job <code>{ctx.draftJobId}</code> for <code>{ctx.draftFor || 'unknown letter'}</code>.
              Save/review/export for that letter include it as source_job_id.
            </div>
          )}
          <datalist id="cxa-projects">{lists.projects.map((p) => <option key={p} value={p} />)}</datalist>
          <datalist id="cxa-letters">{lists.letters.map((f) => <option key={f} value={f} />)}</datalist>
          <datalist id="cxa-volumes">{lists.volumes.map((v) => <option key={v} value={v} />)}</datalist>
        </Card>

        <div className="cxa-tabs" role="tablist">
          {[['endpoints', `Endpoints (${ENDPOINTS.length})`], ['workflows', `Workflows (${WORKFLOWS.length})`], ['log', `Call log (${log.length})`]].map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key}
              className={`cxa-tab ${tab === key ? 'on' : ''}`} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
          {filter && tab === 'endpoints' && (
            <Btn size="sm" variant="ghost" onClick={() => setFilter('')}>Clear filter "{filter}"</Btn>
          )}
        </div>

        {/* Tabs stay mounted so a running workflow or request keeps its state when you switch. */}
        <div hidden={tab !== 'endpoints'}><EndpointsTab ctx={ctx} filter={filter} draftSubmissions={draftSubmissions} /></div>
        <div hidden={tab !== 'workflows'}><WorkflowsTab ctxRef={ctxRef} setCtx={setCtx} /></div>
        <div hidden={tab !== 'log'}><LogTab log={log} onClear={() => setLog([])} /></div>
      </div>
    </>
  );
}
