// Status badge chip mapping numeric/string status → colored MUI Chip.
import React from 'react';
import Chip from '@mui/material/Chip';

const MAP = {
  1: { label: 'Active', color: 'success' },
  active: { label: 'Active', color: 'success' },
  0: { label: 'Inactive', color: 'default' },
  inactive: { label: 'Inactive', color: 'default' },
  9: { label: 'Deleted', color: 'error' },
  deleted: { label: 'Deleted', color: 'error' },
};

export default function StatusBadge({ status, label, ...rest }) {
  const key = typeof status === 'string' ? status.toLowerCase() : status;
  const cfg = MAP[key] || { label: label || String(status ?? '—'), color: 'default' };
  return <Chip size="small" variant="outlined" label={label || cfg.label} color={cfg.color} {...rest} />;
}
