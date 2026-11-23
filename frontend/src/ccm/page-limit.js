/**
 * Page limit for AI Drafting: how many pages of the attached letter the AI
 * reads when it drafts the reply (at most MAX_PAGES).
 *
 * The CCM public API has no field for this yet, so the dropdown is shown on the
 * reply screens and the choice is carried from the start screen to the
 * workspace, but nothing is sent. To connect it when the endpoint exists:
 *   1. set PAGE_LIMIT_SUPPORTED to true;
 *   2. make pageLimitRequest() return the field the API expects
 *      (for example `{ pages: '1-25' }` or `{ max_pages: 25 }`).
 * The draft request in views/ai-drafting.js already spreads pageLimitRequest()
 * into its body, so nothing else needs to change.
 */
export const MAX_PAGES = 500;
export const PAGE_LIMIT_SUPPORTED = false;

const STEPS = [1, 3, 5, 10, 25, 50, 100, 250, MAX_PAGES];

export const PAGE_LIMITS = STEPS.map((n) => ({
  id: String(n),
  label: n === 1 ? 'First page' : n === MAX_PAGES ? `Up to ${MAX_PAGES}` : `First ${n}`,
  hint: n === 1 ? 'Page 1' : `Pages 1–${n}`,
}));

/** Same as the API's default import range (1-10). */
export const DEFAULT_PAGE_LIMIT = '10';

export const pageLimitOf = (id) => PAGE_LIMITS.find((p) => p.id === String(id))
  || PAGE_LIMITS.find((p) => p.id === DEFAULT_PAGE_LIMIT);

/** Number of pages for a choice, never more than MAX_PAGES. */
export const pageCount = (id) => Math.min(MAX_PAGES, Number(pageLimitOf(id).id));

/** The choice as a page range, in the API's import format ("1" or "1-25"). */
export const pageRange = (id) => {
  const n = pageCount(id);
  return n === 1 ? '1' : `1-${n}`;
};

/** Fields to add to the draft-replies request body. Empty until the API supports it. */
export function pageLimitRequest(id) {
  if (!PAGE_LIMIT_SUPPORTED) return {};
  return { pages: pageRange(id) };
}
