// Global MUI component overrides — the visual DNA of the CCM design system.
// Keeps buttons, cards, dialogs, tables, chips consistent everywhere.

import { tokens } from './palette';
import { radii } from './shape';

const components = {
  MuiCssBaseline: {
    styleOverrides: {
      body: {
        backgroundColor: tokens.background,
        color: tokens.textPrimary,
      },
      '*::-webkit-scrollbar': { width: 10, height: 10 },
      '*::-webkit-scrollbar-thumb': {
        backgroundColor: '#CBD5E1',
        borderRadius: 8,
      },
      '*::-webkit-scrollbar-thumb:hover': { backgroundColor: '#94A3B8' },
    },
  },

  MuiPaper: {
    styleOverrides: {
      root: { backgroundImage: 'none' },
      rounded: { borderRadius: radii.card },
    },
  },

  MuiCard: {
    defaultProps: { elevation: 0 },
    styleOverrides: {
      root: {
        borderRadius: radii.card,
        border: `1px solid ${tokens.border}`,
        boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
      },
    },
  },

  MuiButton: {
    defaultProps: { disableElevation: true },
    styleOverrides: {
      root: {
        borderRadius: radii.button,
        fontWeight: 600,
        textTransform: 'none',
        paddingInline: 18,
        minHeight: 40,
      },
      containedPrimary: {
        boxShadow: '0 2px 6px rgba(47,58,103,0.25)',
        '&:hover': { backgroundColor: tokens.primaryDark },
      },
      sizeSmall: { minHeight: 32, paddingInline: 12 },
    },
  },

  MuiIconButton: {
    styleOverrides: {
      root: { borderRadius: radii.button },
    },
  },

  MuiChip: {
    styleOverrides: {
      root: { borderRadius: radii.chip, fontWeight: 600, fontSize: 12 },
    },
  },

  MuiTextField: {
    defaultProps: { size: 'small', fullWidth: true },
  },

  MuiOutlinedInput: {
    styleOverrides: {
      root: { borderRadius: radii.input },
    },
  },

  MuiDialog: {
    styleOverrides: {
      paper: {
        borderRadius: radii.card,
        boxShadow: '0 12px 40px rgba(0,0,0,0.14)',
      },
    },
  },

  MuiDialogTitle: {
    styleOverrides: {
      root: {
        fontSize: 18,
        fontWeight: 600,
        padding: '18px 24px',
        borderBottom: `1px solid ${tokens.border}`,
      },
    },
  },

  MuiDialogContent: {
    styleOverrides: { root: { padding: '20px 24px' } },
  },

  MuiDialogActions: {
    styleOverrides: {
      root: { padding: '14px 24px', borderTop: `1px solid ${tokens.border}` },
    },
  },

  MuiTableCell: {
    styleOverrides: {
      head: {
        backgroundColor: '#F3F5FA',
        color: tokens.primary,
        fontSize: 13,
        fontWeight: 600,
        borderBottom: `1px solid ${tokens.border}`,
      },
      body: { fontSize: 14, color: tokens.textPrimary },
      root: { padding: '12px 14px' },
    },
  },

  MuiTableRow: {
    styleOverrides: {
      root: {
        '&:nth-of-type(even)': { backgroundColor: '#FBFCFE' },
        '&:hover': { backgroundColor: tokens.hover },
      },
    },
  },

  MuiTooltip: {
    styleOverrides: {
      tooltip: {
        backgroundColor: tokens.textPrimary,
        fontSize: 12,
        borderRadius: 6,
        padding: '6px 10px',
      },
    },
  },

  MuiTab: {
    styleOverrides: {
      root: { textTransform: 'none', fontWeight: 600, minHeight: 44 },
    },
  },

  MuiAlert: {
    styleOverrides: {
      root: { borderRadius: radii.button },
    },
  },
};

export default components;
