// Status badge chip mapping numeric/string status → colored MUI Chip.
import React from 'react';
import Chip from '@mui/material/Chip';

const MAP = {
  1: { label: 'Active', color: '#22C55E', bg: '#F0FDF4', border: '#BBF7D0' },
  active: { label: 'Active', color: '#22C55E', bg: '#F0FDF4', border: '#BBF7D0' },
  0: { label: 'Inactive', color: '#9CA3AF', bg: '#F9FAFB', border: '#E5E7EB' },
  inactive: { label: 'Inactive', color: '#9CA3AF', bg: '#F9FAFB', border: '#E5E7EB' },
  9: { label: 'Deleted', color: '#EF4444', bg: '#FEF2F2', border: '#FECACA' },
  deleted: { label: 'Deleted', color: '#EF4444', bg: '#FEF2F2', border: '#FECACA' },
};

export default function StatusBadge({ status, label, sx, ...rest }) {
  const key = typeof status === 'string' ? status.toLowerCase() : status;
  const cfg = MAP[key] || { label: label || String(status ?? '—'), color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB' };
  return (
    <Chip
      size="small"
      label={label || cfg.label}
      sx={{
        height: 26,
        fontSize: 12,
        fontWeight: 600,
        color: cfg.color,
        backgroundColor: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: '999px',
        ...sx,
      }}
      {...rest}
    />
  );
}
