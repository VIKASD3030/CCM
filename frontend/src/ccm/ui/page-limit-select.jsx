/**
 * "Pages" dropdown for the AI Drafting option row, beside Tone and Length:
 * how many pages of the attached letter the AI analyses (see page-limit.js).
 */
import React from 'react';
import MenuSelect from './menu-select';
import { MAX_PAGES, PAGE_LIMITS, PAGE_LIMIT_SUPPORTED } from '../page-limit';

export default function PageLimitSelect({ value, onChange, disabled }) {
  return (
    <MenuSelect label="Pages" heading={`Pages to analyse (max ${MAX_PAGES})`} value={value} onChange={onChange}
      options={PAGE_LIMITS} disabled={disabled}
      note={PAGE_LIMIT_SUPPORTED ? undefined : 'Preview only: not applied to drafts yet.'} />
  );
}
