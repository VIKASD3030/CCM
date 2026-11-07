/**
 * End-to-end checks against the CCM public API. Each workflow is a list of
 * steps run in order; a step throws to fail, and later steps are skipped.
 *
 * t.step(name, fn): fn returns { detail, response } (response is shown in the console)
 * t.expect(condition, message): throws when condition is false
 */
import { ccmApi, unwrap, waitForJob, jobResult, newIdempotencyKey } from '../ccm-public-api';
import { buildDraftReplyRequest, currentRevision } from './endpoints';
import { SAMPLE_CONTRACT_TEXT, flagOffsetsMatch, inspectDocx, randomSuffix, samplePdfFile } from './helpers';

/** Expects an HTTP error with a given status and error.code. */
function expectError(t, response, status, code) {
  const actual = response.data && response.data.error ? response.data.error.code : '(no error body)';
  t.expect(response.status === status, `Expected HTTP ${status}, got ${response.status} (${actual}).`);
  if (code) t.expect(actual === code, `Expected error code ${code}, got ${actual}.`);
  return `HTTP ${status} ${actual}`;
}

async function runJob(receiptResponse) {
  const receipt = unwrap(receiptResponse);
  const poll = await waitForJob(receipt);
  return { receipt, poll, result: jobResult(poll) };
}

const draftReviewExport = {
  id: 'draft',
  title: 'Draft → save → edit → review → export',
  description: 'The same flow as the mock\'s client.py: generate a reply for the selected letter, keep its evidence across edits, review it and download both DOCX styles.',
  async run(t, ctx) {
    const { project, file } = ctx;
    const user = ctx.user || 'demo-user';
    let draft;
    let draftJobId;
    let edited;

    await t.step('Project is ready', async () => {
      const response = await ccmApi.projects.get(project);
      const info = unwrap(response);
      t.expect(info.readiness && info.readiness.ready,
        `Not ready: ${(info.readiness && info.readiness.blockers.join(', ')) || 'no readiness'}. Run Apply first.`);
      return { detail: `${info.name}, author ${info.author_party}`, response };
    });

    await t.step('Get stored letter', async () => {
      const response = await ccmApi.letters.get(project, file);
      const letter = unwrap(response);
      t.expect(letter.text && letter.text.trim(), 'Letter has no text.');
      return { detail: `${letter.reference || file}: ${letter.subject || ''}`, response };
    });

    await t.step('Generate draft reply (job)', async () => {
      const body = await buildDraftReplyRequest(project, file, 'Request the missing supporting records without accepting the claim.');
      const { receipt, poll, result } = await runJob(await ccmApi.draftReplies.create(project, body));
      t.expect(/^[0-9a-f]{32}$/.test(receipt.id), 'Job id is not 32 lowercase hex characters.');
      t.expect(result.draft && result.draft.format === 'text/markdown', 'draft.format is not text/markdown.');
      t.expect(flagOffsetsMatch(result.draft.text, result.review_flags), 'review_flags offsets do not match draft.text (code points).');
      draft = result.draft.text;
      draftJobId = receipt.id;
      t.learn({ draftJobId, draftFor: `${project}/${file}`, draftText: draft, jobId: receipt.id });
      return { detail: `job ${receipt.id}, ${result.review_flags.length} flag(s), ${result.clause_references.length} clause(s)`, response: poll };
    });

    await t.step('Save draft with source_job_id', async () => {
      const response = await ccmApi.savedDrafts.save(project, file, { user, text: draft, source_job_id: draftJobId });
      const saved = unwrap(response);
      t.expect(saved.source_job_id === draftJobId, 'Saved draft is not linked to the generation job.');
      return { detail: `saved ${saved.updated}`, response };
    });

    await t.step('Edit draft without source_job_id keeps the link', async () => {
      edited = `${draft}\n\nPlease provide the supporting records for review.`;
      const response = await ccmApi.savedDrafts.save(project, file, { user, text: edited });
      const saved = unwrap(response);
      t.expect(saved.source_job_id === draftJobId, 'Editing lost the linked generation evidence.');
      t.learn({ draftText: edited });
      return { detail: 'evidence preserved', response };
    });

    await t.step('Get saved draft', async () => {
      const response = await ccmApi.savedDrafts.get(project, file, user);
      const saved = unwrap(response);
      t.expect(saved.text === edited, 'Saved text differs from the edit.');
      return { detail: `exported: ${saved.exported || '(not yet)'}`, response };
    });

    await t.step('Review edited draft (job)', async () => {
      const { poll, result } = await runJob(await ccmApi.letters.review(project, file, { user, text: edited }));
      t.expect(result.review_offset_unit === 'unicode_code_points', 'review_offset_unit is not unicode_code_points.');
      t.expect(flagOffsetsMatch(edited, result.review_flags), 'review flag offsets do not match the submitted text.');
      return { detail: `${result.review_flags.length} flag(s), checked against ${result.checked_against}`, response: poll };
    });

    for (const annotate of [false, true]) {
      await t.step(`Export DOCX (${annotate ? 'native comments' : 'review-notes table'})`, async () => {
        const response = await ccmApi.letters.exportDocx(project, file, { text: edited, user, annotate });
        t.expect(response.ok, `HTTP ${response.status}`);
        t.expect(response.contentType.includes('wordprocessingml'), `Content type is ${response.contentType}, not DOCX.`);
        const docx = await inspectDocx(response.blob);
        t.expect(docx.isZip && docx.hasDocument, 'Download is not a valid DOCX.');
        if (annotate) t.expect(docx.hasComments, 'DOCX is missing native comments (word/comments.xml).');
        return { detail: `${response.filename}, ${docx.size} bytes${annotate ? ', comments present' : ''}`, response };
      });
    }

    await t.step('Saved draft is marked exported', async () => {
      const response = await ccmApi.savedDrafts.get(project, file, user);
      const saved = unwrap(response);
      t.expect(saved.exported, 'exported timestamp is empty after export with user.');
      return { detail: `exported ${saved.exported}`, response };
    });

    await t.step('Letter list shows reply state "exported"', async () => {
      const response = await ccmApi.letters.list(project, { user });
      const row = unwrap(response).letters.find((l) => l.file === file);
      t.expect(row, 'Letter not in the list.');
      t.expect(row.reply_state.key === 'exported', `reply_state is ${row.reply_state.key}.`);
      return { detail: 'exported', response };
    });
  },
};

const rulesLifecycle = {
  id: 'rules',
  title: 'Rules: validate → save → apply → restore',
  description: 'Edits the selected project\'s TOML, checks that pending rules block readiness, applies, then restores the previous version. Changes stay in mock memory.',
  async run(t, ctx) {
    const { project } = ctx;
    let original;
    let revision;

    await t.step('Get rules', async () => {
      const response = await ccmApi.rules.get(project);
      original = unwrap(response);
      t.expect(/^[0-9a-f]{64}$/.test(original.revision), 'revision is not a 64-character SHA-256.');
      revision = original.revision;
      return { detail: `revision ${revision.slice(0, 12)}…`, response };
    });

    await t.step('Validate current TOML', async () => {
      const response = await ccmApi.rules.validate(project, { configuration_toml: original.configuration_toml });
      t.expect(unwrap(response).valid === true, 'valid is not true.');
      return { detail: 'valid', response };
    });

    await t.step('Invalid TOML is rejected (no owner)', async () => {
      const broken = original.configuration_toml.replace(/is_owner\s*=\s*true/g, 'is_owner = false');
      const response = await ccmApi.rules.validate(project, { configuration_toml: broken });
      return { detail: expectError(t, response, 422, 'invalid_configuration'), response };
    });

    await t.step('Save edited TOML', async () => {
      const toml = `${original.configuration_toml.replace(/\n+$/, '')}\n# console rules test ${randomSuffix()}\n`;
      const response = await ccmApi.rules.save(project, { configuration_toml: toml, expected_revision: revision });
      const info = unwrap(response);
      t.expect(info.revision !== revision, 'Revision did not change after saving different text.');
      revision = info.revision;
      t.learn({ revision });
      return { detail: `new revision ${revision.slice(0, 12)}…`, response };
    });

    await t.step('Stale revision returns 409', async () => {
      const response = await ccmApi.rules.save(project, { configuration_toml: original.configuration_toml, expected_revision: original.revision });
      return { detail: expectError(t, response, 409, 'revision_conflict'), response };
    });

    await t.step('Pending rules block readiness', async () => {
      const response = await ccmApi.projects.get(project);
      const info = unwrap(response);
      t.expect(!info.readiness.ready && info.readiness.blockers.includes('rules_not_applied'), 'Expected blocker rules_not_applied.');
      return { detail: info.readiness.blockers.join(', '), response };
    });

    await t.step('Apply (job)', async () => {
      const { poll, result } = await runJob(await ccmApi.rules.apply(project, { expected_revision: revision }));
      t.expect(result.applied_revision === revision, 'applied_revision does not match.');
      return { detail: 'applied', response: poll };
    });

    let versionId;
    await t.step('Previous version is archived', async () => {
      const response = await ccmApi.rules.versions(project);
      const { versions } = unwrap(response);
      t.expect(versions.length > 0, 'No archived versions.');
      versionId = versions[0].version;
      t.learn({ version: versionId });
      return { detail: `${versions.length} version(s)`, response };
    });

    await t.step('Get archived version', async () => {
      const response = await ccmApi.rules.version(project, versionId);
      const version = unwrap(response);
      t.expect(version.revision === original.revision, 'Newest archived version is not the original TOML.');
      return { detail: version.version, response };
    });

    await t.step('Restore original TOML and apply', async () => {
      const saved = unwrap(await ccmApi.rules.save(project, { configuration_toml: original.configuration_toml, expected_revision: revision }));
      const { poll, result } = await runJob(await ccmApi.rules.apply(project, { expected_revision: saved.revision }));
      t.expect(result.readiness ? result.readiness.ready : true, 'Project not ready after restore.');
      t.learn({ revision: saved.revision });
      return { detail: `restored revision ${saved.revision.slice(0, 12)}…`, response: poll };
    });
  },
};

const newProjectSetup = {
  id: 'setup',
  title: 'New project: create → import contract → apply → import letter',
  description: 'Creates a fresh project from sample-project\'s TOML and takes it to ready. The project lives in mock memory until restart.',
  async run(t) {
    const project = `console-${randomSuffix()}`;
    let revision;
    let volume;
    let stem;

    await t.step(`Create project ${project}`, async () => {
      const toml = unwrap(await ccmApi.rules.get('sample-project')).configuration_toml;
      const response = await ccmApi.projects.create({ project_id: project, configuration_toml: toml });
      t.expect(response.status === 201, `Expected 201, got ${response.status}.`);
      t.expect(response.headers.location, 'Missing Location header.');
      revision = unwrap(response).revision;
      t.learn({ project, revision });
      return { detail: response.headers.location, response };
    });

    await t.step('Same id again returns 409', async () => {
      const toml = unwrap(await ccmApi.rules.get(project)).configuration_toml;
      const response = await ccmApi.projects.create({ project_id: project, configuration_toml: toml });
      return { detail: expectError(t, response, 409, 'project_exists'), response };
    });

    await t.step('New project is not ready', async () => {
      const response = await ccmApi.projects.get(project);
      const info = unwrap(response);
      t.expect(!info.readiness.ready, 'A new project should not be ready.');
      return { detail: info.readiness.blockers.join(', '), response };
    });

    await t.step('List contract volumes', async () => {
      const response = await ccmApi.contracts.list(project);
      const { volumes } = unwrap(response);
      t.expect(volumes.length > 0, 'No configured volumes.');
      volume = volumes[0].id;
      t.learn({ volume });
      return { detail: volumes.map((v) => `${v.id} (text: ${v.text_available})`).join(', '), response };
    });

    await t.step('Import contract text (job)', async () => {
      const { poll, result } = await runJob(await ccmApi.contracts.importText(project, volume, { expected_revision: revision, text: SAMPLE_CONTRACT_TEXT }));
      t.expect(result.state === 'imported', `state is ${result.state}.`);
      return { detail: `${result.characters} characters, apply_required: ${result.apply_required}`, response: poll };
    });

    await t.step('Re-import identical text is skipped', async () => {
      const { poll, result } = await runJob(await ccmApi.contracts.importText(project, volume, { expected_revision: revision, text: SAMPLE_CONTRACT_TEXT }));
      t.expect(result.state === 'skipped', `state is ${result.state}.`);
      return { detail: 'skipped', response: poll };
    });

    await t.step('Apply (job) → ready', async () => {
      const { poll, result } = await runJob(await ccmApi.rules.apply(project, { expected_revision: revision }));
      t.expect(result.readiness && result.readiness.ready, `Not ready: ${result.readiness && result.readiness.blockers.join(', ')}`);
      return { detail: `warnings: ${result.readiness.warnings.join(', ') || 'none'}`, response: poll };
    });

    let folder;
    await t.step('Import options', async () => {
      const response = await ccmApi.imports.options(project);
      const options = unwrap(response);
      t.expect(options.folders.length > 0, 'No import folders.');
      folder = options.folders[0].key;
      return { detail: `folder ${folder}, max ${options.max_upload_mb} MiB, pages ${options.default_pages}`, response };
    });

    await t.step('Import a generated PDF (job)', async () => {
      stem = `console-letter-${randomSuffix()}`;
      const { poll, result } = await runJob(await ccmApi.imports.upload(project, { folder, files: [samplePdfFile(`${stem}.pdf`)] }));
      t.expect(result.imported === 1 && result.failed === 0, `imported ${result.imported}, failed ${result.failed}.`);
      t.learn({ file: stem });
      return { detail: result.rows.map((r) => `${r.name}: ${r.state}`).join(', '), response: poll };
    });

    await t.step('Imported letter is listed', async () => {
      const response = await ccmApi.letters.list(project);
      const list = unwrap(response);
      t.expect(list.letters.some((l) => l.file === stem), 'Imported letter not found.');
      return { detail: `${list.total} letter(s)`, response };
    });

    await t.step('Analyze imported letter (job)', async () => {
      const { poll, result } = await runJob(await ccmApi.letters.analyze(project, stem));
      return { detail: `category ${result.analysis.category}, routed to ${result.routing.predicted_project_id}`, response: poll };
    });
  },
};

const errorHandling = {
  id: 'errors',
  title: 'Error handling and retries',
  description: 'Checks the documented error codes, mock scenarios (failed / busy) and Idempotency-Key behaviour on the selected project.',
  async run(t, ctx) {
    const { project } = ctx;

    await t.step('Unknown project → 404', async () => {
      const response = await ccmApi.projects.get(`missing-${randomSuffix()}`);
      return { detail: expectError(t, response, 404, 'project_not_found'), response };
    });

    await t.step('Wrong token → 401', async () => {
      const response = await ccmApi.projects.list({ token: 'wrong-token' });
      return { detail: expectError(t, response, 401, 'unauthorized'), response };
    });

    await t.step('Unknown letter → 404', async () => {
      const response = await ccmApi.letters.get(project, `missing-${randomSuffix()}`);
      return { detail: expectError(t, response, 404, 'letter_not_found'), response };
    });

    await t.step('Unknown body field → 422', async () => {
      const response = await ccmApi.rules.validate(project, { configuration_toml: 'x', surprise: true });
      return { detail: expectError(t, response, 422, 'invalid_request'), response };
    });

    await t.step('Missing Idempotency-Key → 400', async () => {
      const revision = await currentRevision(project);
      const response = await ccmApi.rules.apply(project, { expected_revision: revision }, { job: false });
      return { detail: expectError(t, response, 400, 'invalid_idempotency_key'), response };
    });

    await t.step('Same key + same body returns the same job', async () => {
      const revision = await currentRevision(project);
      const key = newIdempotencyKey();
      const first = unwrap(await ccmApi.rules.apply(project, { expected_revision: revision }, { idempotencyKey: key }));
      const secondResponse = await ccmApi.rules.apply(project, { expected_revision: revision }, { idempotencyKey: key });
      const second = unwrap(secondResponse);
      t.expect(first.id === second.id, 'A retry with the same key created a new job.');
      await waitForJob(first);
      return { detail: `job ${first.id}`, response: secondResponse };
    });

    await t.step('Same key + different body → 409', async () => {
      const revision = await currentRevision(project);
      const key = newIdempotencyKey();
      await waitForJob(unwrap(await ccmApi.rules.apply(project, { expected_revision: revision }, { idempotencyKey: key })));
      const response = await ccmApi.rules.apply(project, { expected_revision: revision, embed_letters: true }, { idempotencyKey: key });
      return { detail: expectError(t, response, 409, 'idempotency_conflict'), response };
    });

    await t.step('Scenario "busy" → 429 with Retry-After', async () => {
      const revision = await currentRevision(project);
      const response = await ccmApi.rules.apply(project, { expected_revision: revision }, { scenario: 'busy' });
      const detail = expectError(t, response, 429, 'busy');
      t.expect(response.headers['retry-after'] === '5', `Retry-After is ${response.headers['retry-after']}.`);
      return { detail: `${detail}, Retry-After 5`, response };
    });

    await t.step('Scenario "failed" → job failed with HTTP 200', async () => {
      const revision = await currentRevision(project);
      const receipt = unwrap(await ccmApi.rules.apply(project, { expected_revision: revision }, { scenario: 'failed' }));
      const poll = await waitForJob(receipt);
      t.expect(poll.status === 200, `Poll returned HTTP ${poll.status}.`);
      t.expect(poll.data.status === 'failed' && poll.data.error && poll.data.error.code, 'Job did not fail with an error code.');
      return { detail: `failed: ${poll.data.error.code}`, response: poll };
    });

    await t.step('Unknown job → 404', async () => {
      const response = await ccmApi.jobs.operation(project, '0'.repeat(32));
      return { detail: expectError(t, response, 404, 'job_not_found'), response };
    });
  },
};

export const WORKFLOWS = [draftReviewExport, rulesLifecycle, newProjectSetup, errorHandling];
