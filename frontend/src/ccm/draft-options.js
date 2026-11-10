/**
 * Drafting options from the AI Drafting prototype (Figma "CCM – AI Drafting"):
 * letter types with their suggested prompts, tone and length.
 *
 * The CCM public API has no fields for these, so they travel in the draft's
 * `instructions` (sent to the AI and saved with the draft). The first line is a
 * tag that parseInstructions() reads back, e.g. for the Drafts history:
 *   [Letter type: Payment Delay | Tone: Firm | Length: Standard | Prompt: Final Demand — Outstanding Payment]
 */

export const LETTER_TYPES = [
  {
    id: 'eot',
    label: 'Extension of Time (EOT)',
    prompts: [
      { title: 'EOT Claim — Delayed Site Access', text: 'Draft an Extension of Time claim citing delayed site access as the cause of delay. Include impact on programme, entitlement under the contract, and the requested extension period.' },
      { title: 'EOT Notification — Weather Delays', text: 'Write an EOT notification for abnormal weather conditions causing delays to the construction programme. Reference the relevant contract clause and supporting meteorological data.' },
      { title: 'EOT Submission — Programme Analysis', text: 'Prepare an EOT submission with a detailed programme analysis showing the critical path impact. Include as-built vs. baseline programme comparison and delay event identification.' },
      { title: 'EOT Follow-Up — Rejection Response', text: 'Draft a follow-up response to the client’s earlier rejection of our EOT claim. Address each rejection point with supporting evidence and contractual justification.' },
    ],
  },
  {
    id: 'payment-delay',
    label: 'Payment Delay',
    prompts: [
      { title: 'Payment Reminder — Overdue Invoice', text: 'Draft a formal payment reminder letter for an overdue invoice. State the invoice number, amount due, original due date, and request immediate payment.' },
      { title: 'Payment Delay Notice — Contract Clause', text: 'Write a formal payment delay notice citing the relevant contract clause regarding late payment. Reference the outstanding amount, days overdue, and applicable interest provisions.' },
      { title: 'Payment Escalation — Persistent Delays', text: 'Prepare an escalation letter for persistently delayed payments. Address it to senior management, summarizing the payment history, cumulative delays, and impact on project operations.' },
      { title: 'Final Demand — Outstanding Payment', text: 'Draft a final demand letter for outstanding payment. State the total amount owed, deadline for payment, and consequences of non-payment including suspension of works or dispute resolution.' },
    ],
  },
  {
    id: 'drawing-issue',
    label: 'Drawing Issue',
    prompts: [
      { title: 'RFI — Unclear Structural Details', text: 'Write a Request for Information regarding unclear details in the structural drawings. Specify the drawing numbers, sheet references, and the exact information needed to proceed with construction.' },
      { title: 'Drawing Discrepancy Report', text: 'Draft a letter reporting discrepancies found between the issued drawings and actual site conditions. Include photo references, affected areas, and request revised drawings or clarification.' },
      { title: 'Drawing Revision Request — MME Conflicts', text: 'Request revised drawings to resolve MME coordination conflicts. Identify the clashing systems, affected zones, and propose a resolution approach for the designer to confirm.' },
      { title: 'Drawing Revision Impact Notice', text: 'Formal notice that a recent drawing revision impacts the construction sequence and programme. Detail the changes, affected work packages, and request a programme adjustment or cost impact assessment.' },
    ],
  },
  {
    id: 'variation-order',
    label: 'Variation Order',
    prompts: [
      { title: 'VO Submission — Cost Impact', text: 'Draft a Variation Order submission with a detailed cost impact analysis. Include the scope of additional work, rate build-up, daywork sheets, and total claimed amount.' },
      { title: 'VECP Proposal — Cost Savings', text: 'Write a Value Engineering Change Proposal (VECP) suggesting a cost-saving alternative while maintaining quality and functionality. Quantify the savings and describe the technical merit.' },
      { title: 'Contra-Charge VO — Contractor Fault', text: 'Prepare a contra-charge Variation Order for changes necessitated by contractor-caused issues. Document the root cause, the additional work required, and the cost to be charged back.' },
      { title: 'VO Instruction Acknowledgment', text: 'Draft a letter acknowledging receipt of a Variation Order instruction from the engineer. Confirm understanding of the scope, request any missing details, and note any reservations regarding cost or programme.' },
    ],
  },
  {
    id: 'site-instruction',
    label: 'Site Instruction',
    prompts: [
      { title: 'Instruction Acknowledgment', text: 'Draft an acknowledgment of a site instruction received from the engineer. Confirm receipt, understanding of the required actions, and the planned implementation timeline.' },
      { title: 'Compliance Confirmation', text: 'Write a response confirming compliance with a site instruction issued. Detail the actions taken, resources deployed, and any outcomes or observations during execution.' },
      { title: 'Formal Objection to Instruction', text: 'Formal objection to a site instruction citing contractual grounds. State the specific clause relied upon, explain why the instruction is considered beyond the contractor’s obligations, and request withdrawal or amendment.' },
      { title: 'Clarification Request', text: 'Request clarification on an ambiguous site instruction. Quote the instruction verbatim, identify the unclear portions, and ask for specific guidance to avoid misinterpretation.' },
    ],
  },
  {
    id: 'rfi',
    label: 'Request for Information (RFI)',
    prompts: [
      { title: 'RFI — Specification Clarification', text: 'Draft an RFI seeking clarification on a specific clause in the technical specifications. Reference the clause number, state the ambiguity, and request a definitive interpretation to proceed.' },
      { title: 'RFI — Material Substitution', text: 'Write an RFI regarding approval for a material substitution. Describe the proposed alternative, explain the technical equivalence or superiority, and request formal approval before procurement.' },
      { title: 'RFI — Trade Sequencing', text: 'Prepare an RFI on sequencing dependencies between trades. Identify the conflicting activities, explain the construction logic issue, and request the engineer’s direction on the preferred sequence.' },
      { title: 'RFI — Geotechnical Data', text: 'Submit an RFI reporting a discrepancy between the geotechnical data in the contract documents and actual ground conditions encountered. Request additional investigation or revised foundation recommendations.' },
    ],
  },
  {
    id: 'nec-notice',
    label: 'NEC Notice',
    prompts: [
      { title: 'Early Warning — Anticipated Delay', text: 'Draft an early warning notice under NEC4 for an anticipated delay event. Describe the matter, its potential impact on completion, and propose mitigation measures.' },
      { title: 'CE Notification — Compensation Event', text: 'Write a Compensation Event notification under NEC4. Identify the event, the relevant compensation event clause, and provide a preliminary assessment of time and cost impact.' },
      { title: 'Contractor Default Notice', text: 'Prepare a formal notification of contractor default under the contract. Specify the nature of the default, reference the relevant clause, and state the required corrective actions and timeframe.' },
      { title: 'Termination Warning — Breach', text: 'Draft a warning notice of potential termination for breach of contract. Detail the breaches identified, the cure period allowed, and the consequences if the breach is not remedied within the specified time.' },
    ],
  },
  {
    id: 'claim',
    label: 'Claim',
    prompts: [
      { title: 'Claim Submission — Entitlement', text: 'Draft a formal claim submission with a detailed entitlement analysis. Identify the cause of the claim, the contractual basis, the events timeline, and the relief sought.' },
      { title: 'Claim Notification — Preliminary Quantum', text: 'Write a claim notification letter providing preliminary quantum estimation. State the cause, contractual basis, estimated financial impact, and confirm that detailed quantification will follow.' },
      { title: 'Claim Report — Schedule Impact', text: 'Prepare a detailed claim report focusing on schedule impact analysis. Include as-built programme, delay analysis methodology, critical path assessment, and the claimed extension of time.' },
      { title: 'Claim Response — Rejection', text: 'Draft a claim response letter rejecting an unsubstantiated claim. Address each element of the claim, provide counter-evidence, and explain why the claimed entitlement does not arise under the contract.' },
    ],
  },
  {
    id: 'general',
    label: 'General Correspondence',
    prompts: [
      { title: 'Meeting Minutes Follow-Up', text: 'Draft a formal follow-up letter summarizing meeting minutes. List key decisions made, action items with responsible parties and deadlines, and confirm agreement on next steps.' },
      { title: 'Stakeholder Update', text: 'Write a stakeholder update letter on project progress. Cover completed milestones, current activities, upcoming works, and any risks or issues requiring stakeholder awareness.' },
      { title: 'Section Handover Letter', text: 'Prepare a handover letter for a completed section of works. Confirm completion, list outstanding minor items, attach relevant certificates, and request formal acceptance.' },
      { title: 'General Inquiry — Engineer', text: 'Draft a general inquiry letter to the engineer. State the subject clearly, provide relevant background, ask specific questions, and request a timely response to avoid programme impact.' },
    ],
  },
];

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

/** The API allows 4,000 characters of instructions; the tag and guidance take the rest. */
export const MAX_INSTRUCTION_TEXT = 3400;

/**
 * Builds the `instructions` sent with a draft request: a tag line (read back by
 * parseInstructions), one line of guidance for the AI, then the user's text.
 */
export function composeInstructions({ type, tone, length, prompt }, text) {
  const t = letterTypeOf(type);
  const tn = toneOf(tone);
  const ln = lengthOf(length);
  const tag = [
    t ? `Letter type: ${t.label}` : null,
    `Tone: ${tn.label}`,
    `Length: ${ln.label}`,
    prompt ? `Prompt: ${prompt}` : null,
  ].filter(Boolean).join(' | ');
  const guidance = [t ? `This is a ${t.label} letter.` : null, tn.guidance, ln.guidance].filter(Boolean).join(' ');
  const body = String(text || '').trim().slice(0, MAX_INSTRUCTION_TEXT);
  return `[${tag}]\n${guidance}${body ? `\n\n${body}` : ''}`;
}

/** Reads options and the user's own text back from saved instructions. */
export function parseInstructions(instructions) {
  const raw = String(instructions || '');
  const m = /^\[([^\]\n]*)\]\n[^\n]*(?:\n\n([\s\S]*))?$/.exec(raw);
  if (!m) return { options: { ...DEFAULT_OPTIONS }, text: raw };
  const fields = {};
  m[1].split(' | ').forEach((part) => {
    const i = part.indexOf(': ');
    if (i > 0) fields[part.slice(0, i)] = part.slice(i + 2);
  });
  const byLabel = (list, label) => list.find((x) => x.label === label)?.id;
  return {
    options: {
      type: byLabel(LETTER_TYPES, fields['Letter type']) || '',
      tone: byLabel(TONES, fields.Tone) || DEFAULT_OPTIONS.tone,
      length: byLabel(LENGTHS, fields.Length) || DEFAULT_OPTIONS.length,
      prompt: fields.Prompt || '',
    },
    text: m[2] || '',
  };
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
