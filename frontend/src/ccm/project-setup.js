/**
 * Project setup helpers for the CCM public API (/api/v1):
 * readiness labels, error text, job running and the TOML builder used by the
 * New project wizard. Reference: ccm_public_api/docs/api.md and configuration.md.
 */
import { unwrap, waitForJob, jobResult, CcmApiError } from './ccm-public-api';

export const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

/** Readable text for readiness blockers and warnings. */
export const READINESS_TEXT = {
  rules_not_applied: 'Rules are saved but not applied yet',
  invalid_configuration: 'The configuration is invalid',
  incoming_parties_missing: 'No incoming parties are configured',
  history_unreadable: 'Correspondence folders cannot be read',
  contract_missing: 'No contract documents are configured',
  contract_volumes_missing: 'Some contract volumes have not been imported',
  contract_unreadable: 'A contract volume cannot be read',
  models_not_configured: 'AI models are not configured on the server (ask the operator)',
  history_empty: 'No letters imported yet',
  history_dates_missing: 'Some letters have no date',
  contract_grounding_disabled: 'Contract grounding is turned off',
};
export const readinessText = (code) => READINESS_TEXT[code] || code.replace(/_/g, ' ');

/** One-line message for a failed response, thrown CcmApiError or failed job. */
export function errorText(err) {
  if (!err) return 'Unknown error';
  if (err.job?.error) return `${err.job.error.message || err.job.error.code} (${err.job.error.code})`;
  const response = err instanceof CcmApiError ? err.response : err.request && 'ok' in err ? err : null;
  const body = response?.data?.error;
  if (body) {
    const details = (body.details || []).map((d) => (d.field ? `${d.field}: ${d.message}` : d.message));
    return [body.message || body.code, ...details].join(' · ');
  }
  if (response?.networkError) return response.networkError;
  if (response?.hint) return response.hint;
  return err.message || `HTTP ${response?.status}`;
}

/** Runs a job request (202 receipt) to completion and returns its result; throws on failure. */
export async function runJob(receiptResponse, options) {
  const receipt = unwrap(receiptResponse);
  const poll = await waitForJob(receipt, { timeoutMs: 15 * 60 * 1000, intervalMs: 1500, ...options });
  return jobResult(poll);
}

/* ─── TOML builder ──────────────────────────────────────────────────────── */

// JSON strings are valid TOML basic strings.
const str = (s) => JSON.stringify(String(s ?? ''));
const arr = (items) => `[${items.map(str).join(', ')}]`;
const list = (text) => String(text || '').split(',').map((s) => s.trim()).filter(Boolean);
const unique = (items) => [...new Set(items.filter(Boolean))];

export const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^[-_]+|-+$/g, '').slice(0, 64);

export function emptyParty(owner = false) {
  return { key: '', role: '', display_name: '', legal_name: '', ref_prefixes: '', is_owner: owner };
}

export function defaultForm() {
  return {
    project_id: '',
    contract_id: '',
    name: '',
    contract_type: 'Construction',
    region: '',
    governing_law: '',
    phase: 'Construction',
    data_dir: '',
    parties: [
      { key: 'engineer', role: 'Engineer', display_name: '', legal_name: '', ref_prefixes: '', is_owner: true },
      { key: 'contractor', role: 'Contractor', display_name: '', legal_name: '', ref_prefixes: '', is_owner: false },
    ],
    volumes: [{ stem: 'conditions', title: 'Conditions of Contract', page_start: 1 }],
  };
}

/** Problems that would make the API reject the form, as [{field, message}]. */
export function validateForm(form) {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });
  if (!ID_PATTERN.test(form.project_id)) add('project_id', 'Use the ID the operator assigned: lowercase letters, digits, - or _.');
  if (!form.contract_id.trim()) add('contract_id', 'Required.');
  if (!form.name.trim()) add('name', 'Required.');
  const dir = form.data_dir.trim();
  if (!dir) add('data_dir', 'Required.');
  else if (/^([a-z]:|[\\/])/i.test(dir) || dir.split(/[\\/]/).includes('..')) add('data_dir', 'Use a relative path without "..".');
  if (form.parties.length < 2) add('parties', 'Add at least two parties.');
  if (form.parties.filter((p) => p.is_owner).length !== 1) add('parties', 'Exactly one party must be the owner (the reply author).');
  const keys = form.parties.map((p) => p.key);
  form.parties.forEach((p, i) => {
    if (!ID_PATTERN.test(p.key)) add(`parties.${i}.key`, 'Key: lowercase letters, digits, - or _.');
    if (!p.display_name.trim()) add(`parties.${i}.display_name`, 'Name is required.');
  });
  if (new Set(keys).size !== keys.length) add('parties', 'Party keys must be unique.');
  form.volumes.forEach((v, i) => {
    if (!ID_PATTERN.test(v.stem)) add(`volumes.${i}.stem`, 'File name: lowercase letters, digits, - or _.');
    if (!v.title.trim()) add(`volumes.${i}.title`, 'Title is required.');
  });
  if (new Set(form.volumes.map((v) => v.stem)).size !== form.volumes.length) add('volumes', 'Volume file names must be unique.');
  return errors;
}

/**
 * Builds the full project TOML from the wizard form. Identity, parties, paths
 * and volumes come from the form; extraction, classification and drafting
 * guidance start from the defaults in ccm_public_api/examples/project.toml
 * and can be edited in the next wizard step or later in the Rules tab.
 */
export function buildProjectToml(form) {
  const dir = form.data_dir.trim().replace(/\\/g, '/').replace(/\/+$/, '');
  const owner = form.parties.find((p) => p.is_owner) || form.parties[0];
  const others = form.parties.filter((p) => p !== owner);
  const out = [];
  const line = (s = '') => out.push(s);

  line('# Generated by the CCM New project wizard. Edit freely, then save and Apply.');
  line('[project]');
  line(`id = ${str(form.contract_id.trim())}`);
  line(`name = ${str(form.name.trim())}`);
  line(`aliases = ${arr([form.contract_id.trim()])}`);
  ['contract_type', 'region', 'governing_law', 'phase'].forEach((k) => line(`${k} = ${str(form[k].trim())}`));
  line();
  line('[corpus]');
  // One upload folder per direction. The server still decides each letter's
  // direction from its letterhead and the parties below.
  line('dirs = [');
  line(`  { path = ${str(`${dir}/letters/incoming`)}, folder = "incoming" },`);
  line(`  { path = ${str(`${dir}/letters/outgoing`)}, folder = "outgoing" },`);
  line(']');
  line(`out_dir = ${str(`${dir}/sidecars`)}`);
  line(`originals = ${arr([`${dir}/originals`])}`);

  form.parties.forEach((p) => {
    const display = p.display_name.trim();
    const legal = p.legal_name.trim() || display;
    line();
    line('[[parties]]');
    line(`key = ${str(p.key)}`);
    line(`role = ${str(p.role.trim())}`);
    line(`display_name = ${str(display)}`);
    line(`legal_name = ${str(legal)}`);
    line(`letterhead_any = ${arr(unique([display, legal]))}`);
    line(`ref_prefixes = ${arr(list(p.ref_prefixes))}`);
    if (p.is_owner) line('is_owner = true');
  });

  line();
  line('[direction]');
  line(`incoming_from = ${arr(others.map((p) => p.key))}`);
  line(`outgoing_from = ${arr([owner.key])}`);
  line('on_conflict = "trust_letterhead"');

  line(`
[documents]
letter_test = "any_marker"
letter_markers = ["Subject", "Dear"]
min_chars = 100
kind_handling = "letters_only"

[deduplication]
key = "both"
keep = "first_alphabetical"

[fields.reference]
labels = ["Our Ref", "Ref", "Reference"]
label_separator_optional = true
value_rule = "party_prefixes"
search_lines = 25
max_length = 128

[fields.prior_references]
enabled = true
block_start_labels = ["References", "Reference"]
block_end_labels = ["Dear"]
extra_patterns = []
boilerplate_patterns = []
boilerplate_handling = "tag"

[fields.date]
labels = ["Date", "Dated"]
search_order = ["labelled_in_letterhead", "bare_in_letterhead"]
search_lines = 30
ambiguity_strategy = "day_first"
plausible_years = [1900, 2100]

[fields.date.review]
unresolved = "empty"

[fields.subject]
labels = ["Subject", "Sub"]
label_separator_optional = true
end_labels = ["Ref", "Reference", "Dear"]
max_chars = 400

[fields.attention]
labels = ["Attention", "Kind Attention", "Attn"]
label_separator_optional = true

[classification]
categories = [{ id = "delay", description = "Delay notices and extension requests" }]
risk_categories = [{ id = "schedule", description = "Potential impact on completion dates" }]

[[business_rules]]
id = "delay-evidence"
criteria = "The letter requests additional time or reports delay."
response_timeline = "Use only the response period supported by the contract."
escalation_criteria = "Refer unsupported time or cost commitments for review."
approval_authority = "Authorized project representative"
obligations = ["Request the programme impact and supporting records if missing."]
prior_correspondence = ["Check related notices and previous replies."]`);

  line();
  line('[contract_documents]');
  line(`enabled = ${form.volumes.length > 0}`);
  line(`ocr_dir = ${str(`${dir}/contracts`)}`);
  const vols = form.volumes.map((v) => {
    const start = Number(v.page_start) > 0 ? Math.floor(Number(v.page_start)) : 1;
    return `  { file = ${str(`${v.stem}.txt`)}, title = ${str(v.title.trim())}, page_start = ${start} },`;
  });
  line(vols.length ? `volumes = [\n${vols.join('\n')}\n]` : 'volumes = []');
  line(String.raw`citation_pattern = '\b(?:Clause|Cl)\.?\s*(\d+(?:\.\d+)*)\b'`);
  line('resolution_key = "number_only"');
  line(`clause_numbering_priority = ${arr(form.volumes.slice(0, 1).map((v) => v.stem))}`);
  line('max_cited_clauses = 4');
  line('semantic_clauses = 6');

  line(`
[interpretation]
guidance = "Use the supplied contract passages. Flag missing or conflicting provisions for review."

[drafting]
tone = "Professional and factual"
template_preferences = "Use reference, date, recipient, subject, references, salutation, body, closing and signatory."
disclaimer = ""
reservations = ["Do not imply approval of additional time or cost without supporting authority."]
required_references = ["Identify the incoming letter and relevant retrieved contract clauses."]
`);
  line('[context]');
  line(`system_prompt = ${str(`Assist {{parties.${owner.key}.display_name}} with correspondence for {{project.name}}. Use only supplied facts and flag missing information.`)}`);
  line('apply_to = ["classification", "routing", "drafting"]');
  return `${out.join('\n')}\n`;
}
