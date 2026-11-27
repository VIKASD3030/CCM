/**
 * "Pages" box for the AI Drafting option row, before the saved-prompts icon:
 * which pages of the incoming letter the AI should analyse. Takes a page
 * number, a range or a list ("3", "1-5", "1-3, 8"), up to MAX_PAGE. Empty means
 * the whole letter. See pagesError() / composeInstructions() in draft-options.js.
 */
import React from 'react';
import { MAX_PAGE, pagesError } from '../draft-options';

export default function PagesInput({ value, onChange, disabled }) {
  const error = pagesError(value);
  return (
    <label className={`cx-pages ${error ? 'bad' : ''}`}
      title={error || `Pages of the letter for the AI to analyse, e.g. 3, 1-5 or 1-3, 8 (up to ${MAX_PAGE}). Leave empty for all pages.`}>
      <span className="cx-ms-label">Pages</span>
      <input value={value} disabled={disabled} placeholder="All" maxLength={60} inputMode="numeric"
        aria-label="Pages to analyse" aria-invalid={!!error}
        onChange={(e) => onChange(e.target.value.replace(/[^\d,\-\s]/g, ''))} />
    </label>
  );
}
