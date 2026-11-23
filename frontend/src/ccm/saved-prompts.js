/**
 * The user's saved prompts for AI Drafting: reusable instruction text.
 *
 * The CCM public API has no endpoint for these, so they are kept in this
 * browser's localStorage, one list per signed-in user. They don't follow the
 * user to another browser or device (see gaps.md).
 */
const KEY = (user) => `ccm.savedPrompts.${String(user || 'anonymous').toLowerCase()}`;
export const MAX_SAVED_PROMPTS = 50;

export function listPrompts(user) {
  try {
    const list = JSON.parse(window.localStorage.getItem(KEY(user)) || '[]');
    return Array.isArray(list) ? list.filter((p) => p && typeof p.text === 'string') : [];
  } catch (e) {
    return [];
  }
}

function write(user, list) {
  try {
    window.localStorage.setItem(KEY(user), JSON.stringify(list));
    return true;
  } catch (e) {
    return false;
  }
}

/** Saves text as a prompt (newest first). Returns the new list, or null if it couldn't be stored. */
export function savePrompt(user, text) {
  const clean = String(text || '').trim();
  if (!clean) return listPrompts(user);
  const rest = listPrompts(user).filter((p) => p.text !== clean);
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const list = [{ id, text: clean, created: new Date().toISOString() }, ...rest].slice(0, MAX_SAVED_PROMPTS);
  return write(user, list) ? list : null;
}

export function removePrompt(user, id) {
  const list = listPrompts(user).filter((p) => p.id !== id);
  write(user, list);
  return list;
}
