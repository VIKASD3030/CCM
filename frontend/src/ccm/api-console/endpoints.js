/**
 * Catalog of every endpoint in the CCM public API reference (docs/api.md).
 * Each entry knows how to build a valid default request from the console
 * context and how to call it through the typed client.
 *
 * input: 'json'  → editor holds the JSON body
 *        'query' → editor holds query parameters
 *        'form'  → editor holds multipart text fields; files come from `files`
 *        'none'  → no editor
 * kind:  'job'    → 202 receipt, console polls status_url
 *        'binary' → file download (DOCX / PDF)
 */
import { ccmApi, unwrap } from '../ccm-public-api';
import {
  SAMPLE_CONTRACT_TEXT, historyCutoff, randomSuffix, sampleContractTxtFile, samplePdfFile, toExternalId,
} from './helpers';

/** Fetches the current rules revision (64-hex SHA-256) for expected_revision fields. */
export async function currentRevision(project) {
  return unwrap(await ccmApi.rules.get(project)).revision;
}

async function currentToml(project) {
  return unwrap(await ccmApi.rules.get(project)).configuration_toml;
}

/** Builds a valid draft-reply request from a stored letter, as client.py does. */
export async function buildDraftReplyRequest(project, file, instructions = '') {
  const letter = unwrap(await ccmApi.letters.get(project, file));
  const info = unwrap(await ccmApi.projects.get(project));
  const recipient = (info.parties || []).find((p) => p.key !== info.author_party);
  return {
    correspondence: { external_id: toExternalId(file), content: { text: letter.text } },
    attachments: (letter.attachments || []).map((item, i) => ({
      external_id: `attachment-${i + 1}`,
      content: { text: item.text },
    })),
    reply_to_party: (letter.sender_party && letter.sender_party !== info.author_party && letter.sender_party)
      || (recipient ? recipient.key : 'contractor'),
    history_as_of: historyCutoff(letter.date),
    instructions,
  };
}

/** source_job_id only links when the draft job was generated for this same project + letter. */
function linkedJob(ctx) {
  return ctx.draftJobId && ctx.draftFor === `${ctx.project}/${ctx.file}` ? ctx.draftJobId : undefined;
}

function draftText(ctx) {
  return ctx.draftText
    || 'Dear Sir or Madam,\n\nPlease provide the updated programme by [Response date].\n\nYours faithfully,\nExample Engineer';
}

const withoutUndefined = (obj) => JSON.parse(JSON.stringify(obj));

export const GROUPS = [
  'Token', 'Projects', 'Rules', 'Contracts', 'Draft replies', 'Stored letters', 'Saved drafts', 'Imports', 'Jobs', 'Audit',
];

export const ENDPOINTS = [
  // ── Token ────────────────────────────────────────────────────────────
  {
    id: 'auth.rotate', group: 'Token', method: 'POST', path: '/auth/rotate', title: 'Rotate token',
    doc: 'Returns a new token once. The old one works for 5 more minutes. After rotating, paste the new token into "Token override", or restart the mock to reset it.',
    input: 'json', defaults: async () => ({}),
    run: (ctx, body) => ccmApi.auth.rotate({ json: body }),
    danger: 'This changes the token the dev proxy sends. Calls without a token override fail after 5 minutes until the mock restarts.',
  },

  // ── Projects ─────────────────────────────────────────────────────────
  {
    id: 'projects.list', group: 'Projects', method: 'GET', path: '/projects', title: 'List projects',
    doc: 'Assigned projects only, without readiness.', input: 'none',
    run: () => ccmApi.projects.list(),
  },
  {
    id: 'projects.create', group: 'Projects', method: 'POST', path: '/projects', title: 'Create project',
    doc: 'Registers the configuration only (201). Then import contracts, Apply rules and check readiness. The default copies sample-project\'s TOML.',
    input: 'json',
    defaults: async (ctx) => ({
      project_id: `console-${randomSuffix()}`,
      configuration_toml: await currentToml(ctx.project || 'sample-project'),
    }),
    run: (ctx, body) => ccmApi.projects.create(body),
  },
  {
    id: 'projects.get', group: 'Projects', method: 'GET', path: '/projects/{project}', title: 'Get project + readiness',
    doc: 'Includes readiness.ready, blockers and warnings.', needs: ['project'], input: 'none',
    run: (ctx) => ccmApi.projects.get(ctx.project),
  },

  // ── Rules ────────────────────────────────────────────────────────────
  {
    id: 'rules.get', group: 'Rules', method: 'GET', path: '/projects/{project}/rules', title: 'Get rules (TOML)',
    doc: 'Returns configuration_toml and the current revision used as expected_revision.', needs: ['project'], input: 'none',
    run: (ctx) => ccmApi.rules.get(ctx.project),
  },
  {
    id: 'rules.save', group: 'Rules', method: 'PUT', path: '/projects/{project}/rules', title: 'Save rules',
    doc: 'Replaces the whole TOML. A changed file makes rules pending: Apply before drafting. A stale revision returns 409.',
    needs: ['project'], input: 'json',
    defaults: async (ctx) => {
      const rules = unwrap(await ccmApi.rules.get(ctx.project));
      return {
        configuration_toml: `${rules.configuration_toml.replace(/\n+$/, '')}\n# Edited from the API console ${new Date().toISOString()}\n`,
        expected_revision: rules.revision,
      };
    },
    run: (ctx, body) => ccmApi.rules.save(ctx.project, body),
  },
  {
    id: 'rules.validate', group: 'Rules', method: 'POST', path: '/projects/{project}/rules/validate', title: 'Validate rules',
    doc: 'Checks TOML without saving. Try deleting is_owner to see invalid_configuration.', needs: ['project'], input: 'json',
    defaults: async (ctx) => ({ configuration_toml: await currentToml(ctx.project) }),
    run: (ctx, body) => ccmApi.rules.validate(ctx.project, body),
  },
  {
    id: 'rules.versions', group: 'Rules', method: 'GET', path: '/projects/{project}/rules/versions', title: 'List rule versions',
    doc: 'Archived predecessors, newest first. Empty until a changed Save.', needs: ['project'], input: 'none',
    run: (ctx) => ccmApi.rules.versions(ctx.project),
  },
  {
    id: 'rules.version', group: 'Rules', method: 'GET', path: '/projects/{project}/rules/versions/{version}', title: 'Get rule version',
    doc: 'Rules plus version. To restore: save this TOML with the current revision, then Apply.', needs: ['project', 'version'], input: 'none',
    run: (ctx) => ccmApi.rules.version(ctx.project, ctx.version),
  },
  {
    id: 'rules.plan', group: 'Rules', method: 'GET', path: '/projects/{project}/rules/plan', title: 'Rules plan',
    doc: 'Corpus counts and embedding estimates; no external calls.', needs: ['project'], input: 'none',
    run: (ctx) => ccmApi.rules.plan(ctx.project),
  },
  {
    id: 'rules.apply', group: 'Rules', method: 'POST', path: '/projects/{project}/rules/apply', title: 'Apply rules',
    doc: 'Job. Result is the Project; afterwards readiness.ready should be true.', needs: ['project'], input: 'json', kind: 'job',
    defaults: async (ctx) => ({ expected_revision: await currentRevision(ctx.project), embed_letters: false, embed_clauses: false }),
    run: (ctx, body, files, opts) => ccmApi.rules.apply(ctx.project, body, opts),
  },
  {
    id: 'rules.deactivate', group: 'Rules', method: 'POST', path: '/projects/{project}/rules/deactivate', title: 'Deactivate rules',
    doc: 'Blocks generation, analysis, review and export until Apply.', needs: ['project'], input: 'json',
    defaults: async (ctx) => ({ expected_revision: await currentRevision(ctx.project) }),
    run: (ctx, body) => ccmApi.rules.deactivate(ctx.project, body),
  },
  {
    id: 'rules.recommend', group: 'Rules', method: 'POST', path: '/projects/{project}/rules/recommendations', title: 'Recommend rules',
    doc: 'Job. Unsaved proposal from sampled sources. Omit volumes/files to sample automatically; [] excludes that kind.',
    needs: ['project'], input: 'json', kind: 'job',
    defaults: async (ctx) => ({ expected_revision: await currentRevision(ctx.project), instructions: '' }),
    run: (ctx, body, files, opts) => ccmApi.rules.recommend(ctx.project, body, opts),
  },

  // ── Contracts ────────────────────────────────────────────────────────
  {
    id: 'contracts.list', group: 'Contracts', method: 'GET', path: '/projects/{project}/contracts', title: 'List contract volumes',
    doc: 'Configured volumes and whether text/original are available.', needs: ['project'], input: 'none',
    run: (ctx) => ccmApi.contracts.list(ctx.project),
  },
  {
    id: 'contracts.importText', group: 'Contracts', method: 'POST', path: '/projects/{project}/contracts/{volume}/import', title: 'Import contract (JSON text)',
    doc: 'Job. Identical text is "skipped"; different text for an imported volume returns 409 document_conflict. Use \\f between pages.',
    needs: ['project', 'volume'], input: 'json', kind: 'job',
    defaults: async (ctx) => ({ expected_revision: await currentRevision(ctx.project), text: SAMPLE_CONTRACT_TEXT }),
    run: (ctx, body, files, opts) => ccmApi.contracts.importText(ctx.project, ctx.volume, body, opts),
  },
  {
    id: 'contracts.importFile', group: 'Contracts', method: 'POST', path: '/projects/{project}/contracts/{volume}/import', title: 'Import contract (file upload)',
    doc: 'Job. Multipart with expected_revision and one PDF or UTF-8 TXT file.',
    needs: ['project', 'volume'], input: 'form', kind: 'job',
    files: { accept: '.pdf,.txt', multiple: false, label: 'Contract file', sample: () => [sampleContractTxtFile()] },
    defaults: async (ctx) => ({ expected_revision: await currentRevision(ctx.project) }),
    run: (ctx, fields, files, opts) => ccmApi.contracts.importFile(ctx.project, ctx.volume, fields.expected_revision, files[0], opts),
  },

  // ── Draft replies ────────────────────────────────────────────────────
  {
    id: 'draftReplies.create', group: 'Draft replies', method: 'POST', path: '/projects/{project}/draft-replies', title: 'Generate draft reply',
    doc: 'Job. Built from the stored letter\'s text. The completed job id becomes source_job_id for save/review/export.',
    needs: ['project', 'file'], input: 'json', kind: 'job',
    defaults: (ctx) => buildDraftReplyRequest(ctx.project, ctx.file, 'Request the missing supporting records without accepting the claim.'),
    run: (ctx, body, files, opts) => ccmApi.draftReplies.create(ctx.project, body, opts),
  },
  {
    id: 'jobs.draftReply', group: 'Draft replies', method: 'GET', path: '/projects/{project}/draft-replies/{jobId}', title: 'Poll draft reply job',
    doc: 'queued → running → completed (result: DraftReply) or failed. 200 even on failure.', needs: ['project', 'jobId'], input: 'none',
    run: (ctx) => ccmApi.jobs.draftReply(ctx.project, ctx.jobId),
  },

  // ── Stored letters ───────────────────────────────────────────────────
  {
    id: 'letters.list', group: 'Stored letters', method: 'GET', path: '/projects/{project}/letters', title: 'List letters',
    doc: 'Search, filter, sort and paginate. counts are incoming state totals.', needs: ['project'], input: 'query',
    defaults: async (ctx) => ({ q: '', direction: 'all', state: 'all', sort: 'date', descending: true, page: 1, page_size: 100, user: ctx.user }),
    run: (ctx, params) => ccmApi.letters.list(ctx.project, params),
  },
  {
    id: 'letters.get', group: 'Stored letters', method: 'GET', path: '/projects/{project}/letters/{file}', title: 'Get letter',
    doc: 'Full text, attachments, prior references and detected reply.', needs: ['project', 'file'], input: 'none',
    run: (ctx) => ccmApi.letters.get(ctx.project, ctx.file),
  },
  {
    id: 'letters.original', group: 'Stored letters', method: 'GET', path: '/projects/{project}/letters/{file}/original', title: 'Download original',
    doc: 'Original PDF/image.', needs: ['project', 'file'], input: 'none', kind: 'binary',
    run: (ctx) => ccmApi.letters.original(ctx.project, ctx.file),
  },
  {
    id: 'letters.analyze', group: 'Stored letters', method: 'POST', path: '/projects/{project}/letters/{file}/analysis', title: 'Analyze letter',
    doc: 'Job. Classification, extraction, routing, history and clauses.', needs: ['project', 'file'], input: 'none', kind: 'job',
    run: (ctx, body, files, opts) => ccmApi.letters.analyze(ctx.project, ctx.file, opts),
  },
  {
    id: 'letters.review', group: 'Stored letters', method: 'POST', path: '/projects/{project}/letters/{file}/review', title: 'Review draft text',
    doc: 'Job. Returns review_flags with code-point offsets. source_job_id is filled when you generated a draft for this letter.',
    needs: ['project', 'file', 'user'], input: 'json', kind: 'job',
    defaults: async (ctx) => withoutUndefined({ text: draftText(ctx), user: ctx.user, source_job_id: linkedJob(ctx) }),
    run: (ctx, body, files, opts) => ccmApi.letters.review(ctx.project, ctx.file, body, opts),
  },
  {
    id: 'letters.export', group: 'Stored letters', method: 'POST', path: '/projects/{project}/letters/{file}/export', title: 'Export DOCX',
    doc: 'Downloads DOCX. annotate: true = native Word comments, false = review-notes table. With user, also saves the draft as exported.',
    needs: ['project', 'file', 'user'], input: 'json', kind: 'binary',
    defaults: async (ctx) => withoutUndefined({ text: draftText(ctx), annotate: false, user: ctx.user, source_job_id: linkedJob(ctx) }),
    run: (ctx, body) => ccmApi.letters.exportDocx(ctx.project, ctx.file, body),
  },

  // ── Saved drafts ─────────────────────────────────────────────────────
  {
    id: 'savedDrafts.list', group: 'Saved drafts', method: 'GET', path: '/projects/{project}/drafts?user=', title: 'List saved drafts',
    doc: 'This user\'s drafts, newest first.', needs: ['project', 'user'], input: 'none',
    run: (ctx) => ccmApi.savedDrafts.list(ctx.project, ctx.user),
  },
  {
    id: 'savedDrafts.get', group: 'Saved drafts', method: 'GET', path: '/projects/{project}/letters/{file}/draft?user=', title: 'Get saved draft',
    doc: 'SavedDraft or 404 draft_not_found.', needs: ['project', 'file', 'user'], input: 'none',
    run: (ctx) => ccmApi.savedDrafts.get(ctx.project, ctx.file, ctx.user),
  },
  {
    id: 'savedDrafts.save', group: 'Saved drafts', method: 'PUT', path: '/projects/{project}/letters/{file}/draft', title: 'Save draft',
    doc: 'One draft per project/letter/user. Include source_job_id once to keep generation evidence across later edits.',
    needs: ['project', 'file', 'user'], input: 'json',
    defaults: async (ctx) => withoutUndefined({ user: ctx.user, text: draftText(ctx), source_job_id: linkedJob(ctx) }),
    run: (ctx, body) => ccmApi.savedDrafts.save(ctx.project, ctx.file, body),
  },
  {
    id: 'savedDrafts.remove', group: 'Saved drafts', method: 'DELETE', path: '/projects/{project}/letters/{file}/draft?user=', title: 'Delete saved draft',
    doc: '204, also when already absent.', needs: ['project', 'file', 'user'], input: 'none',
    run: (ctx) => ccmApi.savedDrafts.remove(ctx.project, ctx.file, ctx.user),
  },

  // ── Imports ──────────────────────────────────────────────────────────
  {
    id: 'imports.options', group: 'Imports', method: 'GET', path: '/projects/{project}/import-options', title: 'Import options',
    doc: 'Folder keys, OCR availability, upload limit, default pages.', needs: ['project'], input: 'none',
    run: (ctx) => ccmApi.imports.options(ctx.project),
  },
  {
    id: 'imports.upload', group: 'Imports', method: 'POST', path: '/projects/{project}/imports', title: 'Import letter PDFs',
    doc: 'Job. Multipart folder + optional pages + one or more PDFs. Existing names are skipped. Check per-file rows.',
    needs: ['project'], input: 'form', kind: 'job',
    files: { accept: '.pdf', multiple: true, label: 'Letter PDFs', sample: () => [samplePdfFile(`console-${randomSuffix()}.pdf`)] },
    defaults: async (ctx) => {
      const options = unwrap(await ccmApi.imports.options(ctx.project));
      return { folder: (options.folders[0] && options.folders[0].key) || '', pages: options.default_pages || '1-10' };
    },
    run: (ctx, fields, files, opts) => ccmApi.imports.upload(ctx.project, { ...fields, files }, opts),
  },

  // ── Jobs ─────────────────────────────────────────────────────────────
  {
    id: 'jobs.operation', group: 'Jobs', method: 'GET', path: '/projects/{project}/operations/{jobId}', title: 'Poll operation job',
    doc: 'For apply, imports, recommendations, analysis and review jobs.', needs: ['project', 'jobId'], input: 'none',
    run: (ctx) => ccmApi.jobs.operation(ctx.project, ctx.jobId),
  },

  // ── Audit ────────────────────────────────────────────────────────────
  {
    id: 'audit.get', group: 'Audit', method: 'GET', path: '/audit', title: 'Audit log',
    doc: 'Latest 1–1000 entries plus export stats per project.', input: 'query',
    defaults: async () => ({ limit: 200 }),
    run: (ctx, params) => ccmApi.audit.get(params),
  },
];
