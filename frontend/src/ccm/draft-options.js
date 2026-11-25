/**
 * Drafting options for the AI Drafting screens:
 *   - Letter type: the letter categories from the CCM prompt library
 *     (draft-categories.js). Each has a hidden system prompt and a list of tasks.
 *   - Tone and Length: from the Figma prototype ("CCM – AI Drafting").
 *
 * The CCM public API has no fields for these, so everything travels in the
 * draft request's `instructions` (at most 4,000 characters), laid out as:
 *
 *   <category system prompt>                  (only when a category is chosen)
 *
 *   Tone: <tone guidance>
 *   Length: <length guidance>
 *
 *   Task — <task name>:                       ("Instructions:" when no task)
 *   <the user's text: the task, edited, plus their own words>
 *
 * The same text is saved with the draft; parseInstructions() reads it back.
 */
import { LETTER_CATEGORIES } from './draft-categories';

/** Letter types are the prompt library's categories; `prompts` are its tasks. */
export const LETTER_TYPES = LETTER_CATEGORIES.map((c) => ({
  id: c.id, label: c.label, covers: c.covers, systemPrompt: c.systemPrompt, prompts: c.tasks,
}));

export const TONES = [
  { id: 'formal', label: 'Formal', hint: 'Default', guidance: 'Use a formal, professional tone.' },
  { id: 'firm', label: 'Firm', hint: 'Holds position', guidance: 'Use a firm tone that holds our position and does not concede entitlement.' },
  { id: 'conciliatory', label: 'Conciliatory', hint: 'Keeps it warm', guidance: 'Use a conciliatory tone that keeps the relationship constructive.' },
  { id: 'neutral', label: 'Neutral', hint: 'Facts only', guidance: 'Use a neutral tone and state facts only, without argument.' },
];

export const LENGTHS = [
  { id: 'brief', label: 'Brief', hint: '~100 words', guidance: 'Keep the reply brief, about 100 words.' },
  { id: 'standard', label: 'Standard', hint: '~200 words', guidance: 'Keep the reply to a standard length, about 200 words.' },
  { id: 'detailed', label: 'Detailed', hint: '~350+ words', guidance: 'Write a detailed reply of 350 words or more.' },
];

export const DEFAULT_OPTIONS = { type: '', tone: 'formal', length: 'standard', prompt: '' };

export const letterTypeOf = (id) => LETTER_TYPES.find((t) => t.id === id) || null;
export const toneOf = (id) => TONES.find((t) => t.id === id) || TONES[0];
export const lengthOf = (id) => LENGTHS.find((l) => l.id === id) || LENGTHS[1];
export const taskOf = (typeId, title) => letterTypeOf(typeId)?.prompts.find((p) => p.title === title) || null;

/** The draft-replies API rejects `instructions` longer than this. */
export const MAX_INSTRUCTIONS = 4000;

/** Characters counted the way the API counts them (code points, not UTF-16 units). */
export const charCount = (s) => [...String(s || '')].length;

const taskHeading = (title) => (title ? `Task — ${title}:` : 'Instructions:');

/** Everything sent except the user's text, ending where that text starts. */
function frame({ type, tone, length, prompt }) {
  const t = letterTypeOf(type);
  const parts = [];
  if (t) parts.push(t.systemPrompt);
  parts.push(`Tone: ${toneOf(tone).guidance}\nLength: ${lengthOf(length).guidance}`);
  return { head: parts.join('\n\n'), heading: taskHeading(t && prompt ? prompt : '') };
}

/** How many characters the user's text may use with these options. */
export function textBudget(options) {
  const { head, heading } = frame(options);
  return MAX_INSTRUCTIONS - charCount(`${head}\n\n${heading}\n`);
}

/**
 * Builds the `instructions` sent with a draft request (see the layout at the
 * top of this file). Never longer than MAX_INSTRUCTIONS: text over the budget
 * is cut, though the screens stop the user before that happens.
 */
export function composeInstructions(options, text) {
  const { head, heading } = frame(options);
  const body = [...String(text || '').trim()].slice(0, Math.max(0, textBudget(options))).join('');
  return body ? `${head}\n\n${heading}\n${body}` : head;
}

/**
 * The box's text after switching from one task to another (either may be null).
 * The old task's text is removed only if the user left it unchanged; their own
 * words are kept after the new task.
 */
export function switchTask(text, oldTask, newTask) {
  let own = String(text || '');
  if (oldTask && own.startsWith(oldTask.text)) own = own.slice(oldTask.text.length);
  own = own.trim();
  if (!newTask) return own;
  return own ? `${newTask.text}\n\n${own}` : newTask.text;
}

/** Reads the options and the user's text back from saved instructions. */
export function parseInstructions(instructions) {
  const raw = String(instructions || '');
  const options = { ...DEFAULT_OPTIONS };
  let rest = raw;
  const t = LETTER_TYPES.find((x) => rest.startsWith(`${x.systemPrompt}\n\n`) || rest === x.systemPrompt);
  if (t) { options.type = t.id; rest = rest.slice(t.systemPrompt.length).replace(/^\n\n/, ''); }
  const m = /^Tone: ([^\n]*)\nLength: ([^\n]*)(?:\n\n(?:Task — (.*):|Instructions:)\n([\s\S]*))?$/.exec(rest);
  if (!m) {
    // Drafts saved before the prompt library: "[Letter type: … | Tone: … | …]\n<guidance>\n\n<text>"
    const old = /^\[([^\]\n]*)\]\n[^\n]*(?:\n\n([\s\S]*))?$/.exec(raw);
    if (!old) return { options, text: raw };
    const f = Object.fromEntries(old[1].split(' | ').map((p) => [p.slice(0, p.indexOf(': ')), p.slice(p.indexOf(': ') + 2)]));
    options.tone = TONES.find((x) => x.label === f.Tone)?.id || options.tone;
    options.length = LENGTHS.find((x) => x.label === f.Length)?.id || options.length;
    return { options, text: old[2] || '' };
  }
  options.tone = TONES.find((x) => x.guidance === m[1])?.id || options.tone;
  options.length = LENGTHS.find((x) => x.guidance === m[2])?.id || options.length;
  if (m[3] && taskOf(options.type, m[3])) options.prompt = m[3];
  return { options, text: m[4] || '' };
}

/* ─── Hand-off from the start screen to the drafting workspace ──────────── */

const HANDOFF_KEY = 'ccm.newDraft';

/** Remembers what the user chose on the start screen for the next workspace load. */
export function setDraftHandoff(data) {
  try { window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ ...data, at: Date.now() })); } catch (e) { /* storage blocked */ }
}

/**
 * The hand-off for this project + letter if it is recent, else null. It is not
 * removed here (React may render twice in development); call clearDraftHandoff()
 * once it has been used.
 */
export function peekDraftHandoff(project, file) {
  try {
    const raw = window.sessionStorage.getItem(HANDOFF_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.project !== project || data.file !== file || Date.now() - data.at > 10 * 60 * 1000) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function clearDraftHandoff() {
  try { window.sessionStorage.removeItem(HANDOFF_KEY); } catch (e) { /* storage blocked */ }
}
