/**
 * AI Drafting home: the first screen after sign-in. The user chooses between
 * drafting a new letter and drafting a reply to a stored letter.
 */
import React from 'react';
import { FilePlus2, Reply, ArrowRight } from 'lucide-react';
import { PageTop, go, ROUTES } from '../ui/kit';

const CHOICES = [
  {
    key: 'new',
    icon: FilePlus2,
    title: 'Draft a new letter',
    text: 'Start a letter from scratch: choose the project, letter type, tone and length.',
    to: ROUTES.newLetter,
  },
  {
    key: 'reply',
    icon: Reply,
    title: 'Draft a reply to a letter',
    text: 'Pick an incoming letter or upload one, then let the AI draft the reply from the project’s records.',
    to: ROUTES.drafting(),
  },
];

export default function DraftingChoice() {
  return (
    <>
      <PageTop crumbs={[{ label: 'AI Drafting' }]} title="AI Drafting" search={false} />
      <div className="cx-start centered">
        <h2>What would you like to do?</h2>
        <p className="cx-start-sub">Choose how you want to start.</p>
        <div className="cx-choice">
          {CHOICES.map(({ key, icon: Icon, title, text, to }) => (
            <button key={key} type="button" className="cx-choice-card" onClick={() => go(to)}>
              <span className="cx-choice-icon"><Icon size={22} aria-hidden="true" /></span>
              <b>{title}</b>
              <span className="cx-choice-text">{text}</span>
              <span className="cx-choice-go">Start <ArrowRight size={14} aria-hidden="true" /></span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
