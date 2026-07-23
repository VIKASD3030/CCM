// Global MUI component overrides — the visual DNA of the enterprise CCM design system.
// Keeps buttons, cards, dialogs, tables, chips consistent everywhere.

import { tokens } from './palette';
import { radii } from './shape';

const components = {
  MuiCssBaseline: {
    styleOverrides: {
      body: {
        backgroundColor: tokens.background,
        color: tokens.textPrimary,
        fontFamily: '"Inter", "Segoe UI", Roboto, sans-serif',
      },
      '*::-webkit-scrollbar': { width: 6, height: 6 },
      '*::-webkit-scrollbar-track': { background: 'transparent' },
      '*::-webkit-scrollbar-thumb': {
        backgroundColor: '#CBD5E1',
        borderRadius: 8,
      },
      '*::-webkit-scrollbar-thumb:hover': { backgroundColor: '#94A3B8' },
      '::selection': { backgroundColor: tokens.selected, color: tokens.primary },
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
        boxShadow: `0 1px 3px ${tokens.shadow}, 0 1px 2px rgba(0,0,0,0.04)`,
        transition: 'box-shadow 0.2s ease, transform 0.2s ease',
        '&:hover': {
          boxShadow: `0 4px 12px ${tokens.shadow}, 0 2px 4px rgba(0,0,0,0.04)`,
        },
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
        paddingInline: 20,
        minHeight: 42,
        fontSize: 14,
        letterSpacing: '0.01em',
        transition: 'all 0.15s ease',
        '&:hover': { transform: 'translateY(-1px)' },
      },
      contained: {
        boxShadow: '0 2px 8px rgba(30,58,138,0.24)',
        '&:hover': { boxShadow: '0 4px 16px rgba(30,58,138,0.32)' },
      },
      containedPrimary: {
        background: `linear-gradient(135deg, ${tokens.primary} 0%, ${tokens.primaryLight} 100%)`,
        '&:hover': { background: `linear-gradient(135deg, ${tokens.primaryDark} 0%, ${tokens.primary} 100%)` },
      },
      outlined: {
        borderWidth: 1.5,
        '&:hover': { borderWidth: 1.5 },
      },
      sizeSmall: { minHeight: 36, paddingInline: 14, fontSize: 13 },
      sizeMedium: { minHeight: 42, paddingInline: 20, fontSize: 14 },
      sizeLarge: { minHeight: 48, paddingInline: 28, fontSize: 15 },
      text: {
        '&:hover': { backgroundColor: tokens.hover },
      },
    },
  },

  MuiIconButton: {
    styleOverrides: {
      root: {
        borderRadius: radii.button,
        padding: 8,
        transition: 'all 0.15s ease',
        '&:hover': { backgroundColor: tokens.hover },
      },
    },
  },

  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: radii.chip,
        fontWeight: 600,
        fontSize: 12,
        height: 28,
        letterSpacing: '0.02em',
      },
      filled: {
        '&.MuiChip-colorSuccess': { backgroundColor: tokens.successLight, color: '#16A34A' },
        '&.MuiChip-colorError': { backgroundColor: tokens.errorLight, color: '#DC2626' },
        '&.MuiChip-colorWarning': { backgroundColor: tokens.warningLight, color: '#D97706' },
        '&.MuiChip-colorInfo': { backgroundColor: tokens.infoLight, color: '#2563EB' },
        '&.MuiChip-colorDefault': { backgroundColor: tokens.hover, color: tokens.textSecondary },
      },
      outlined: {
        borderWidth: 1.5,
      },
    },
  },

  MuiTextField: {
    defaultProps: { size: 'small', fullWidth: true },
    styleOverrides: {
      root: {
        '& .MuiOutlinedInput-root': {
          borderRadius: radii.input,
          transition: 'all 0.15s ease',
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: tokens.primaryLight,
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: tokens.primary,
            borderWidth: 2,
          },
        },
      },
    },
  },

  MuiOutlinedInput: {
    styleOverrides: {
      root: { borderRadius: radii.input },
    },
  },

  MuiSelect: {
    styleOverrides: {
      root: { borderRadius: radii.input },
    },
  },

  MuiDialog: {
    styleOverrides: {
      paper: {
        borderRadius: radii.dialog,
        boxShadow: '0 24px 48px rgba(0,0,0,0.16)',
      },
    },
  },

  MuiDialogTitle: {
    styleOverrides: {
      root: {
        fontSize: 18,
        fontWeight: 700,
        padding: '20px 24px',
        borderBottom: `1px solid ${tokens.border}`,
        color: tokens.textPrimary,
      },
    },
  },

  MuiDialogContent: {
    styleOverrides: { root: { padding: '20px 24px' } },
  },

  MuiDialogActions: {
    styleOverrides: {
      root: { padding: '16px 24px', borderTop: `1px solid ${tokens.border}` },
    },
  },

  MuiTableCell: {
    styleOverrides: {
      head: {
        backgroundColor: '#F8FAFC',
        color: tokens.textSecondary,
        fontSize: 13,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        borderBottom: `2px solid ${tokens.border}`,
        padding: '16px 16px',
        whiteSpace: 'nowrap',
      },
      body: {
        fontSize: 14,
        color: tokens.textPrimary,
        padding: '14px 16px',
        borderBottom: `1px solid ${tokens.borderLight}`,
        lineHeight: 1.5,
      },
      root: { padding: '14px 16px' },
    },
  },

  MuiTableRow: {
    styleOverrides: {
      root: {
        transition: 'background-color 0.15s ease',
        '&:hover': { backgroundColor: tokens.hover },
        '&:nth-of-type(even)': { backgroundColor: '#FAFBFC' },
      },
    },
  },

  MuiTooltip: {
    styleOverrides: {
      tooltip: {
        backgroundColor: tokens.textPrimary,
        fontSize: 12,
        fontWeight: 500,
        borderRadius: 8,
        padding: '8px 12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      },
      arrow: {
        color: tokens.textPrimary,
      },
    },
  },

  MuiTab: {
    styleOverrides: {
      root: {
        textTransform: 'none',
        fontWeight: 600,
        minHeight: 44,
        fontSize: 14,
        letterSpacing: '0.01em',
        transition: 'all 0.15s ease',
        '&.Mui-selected': {
          color: tokens.primary,
        },
      },
    },
  },

  MuiTabs: {
    styleOverrides: {
      indicator: {
        height: 3,
        borderRadius: '3px 3px 0 0',
      },
    },
  },

  MuiAlert: {
    styleOverrides: {
      root: { borderRadius: radii.button, fontWeight: 500 },
      standardSuccess: { backgroundColor: tokens.successLight, color: '#16A34A' },
      standardError: { backgroundColor: tokens.errorLight, color: '#DC2626' },
      standardWarning: { backgroundColor: tokens.warningLight, color: '#D97706' },
      standardInfo: { backgroundColor: tokens.infoLight, color: '#2563EB' },
    },
  },

  MuiSkeleton: {
    styleOverrides: {
      root: { borderRadius: radii.input },
    },
  },

  MuiLinearProgress: {
    styleOverrides: {
      root: { borderRadius: 4, height: 6 },
    },
  },

  MuiCircularProgress: {
    styleOverrides: {
      root: { color: tokens.primary },
    },
  },

  MuiBackdrop: {
    styleOverrides: {
      root: { backgroundColor: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)' },
    },
  },

  MuiPopover: {
    styleOverrides: {
      paper: {
        borderRadius: radii.card,
        boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
        border: `1px solid ${tokens.border}`,
      },
    },
  },

  MuiMenu: {
    styleOverrides: {
      paper: {
        borderRadius: radii.card,
        boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
        border: `1px solid ${tokens.border}`,
        marginTop: 8,
      },
    },
  },

  MuiMenuItem: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        margin: '2px 6px',
        padding: '10px 14px',
        fontSize: 14,
        fontWeight: 500,
        transition: 'all 0.1s ease',
        '&:hover': { backgroundColor: tokens.hover },
        '&.Mui-selected': { backgroundColor: tokens.selected, '&:hover': { backgroundColor: '#DBEAFE' } },
      },
    },
  },

  MuiDivider: {
    styleOverrides: {
      root: { borderColor: tokens.border },
    },
  },
};

export default components;
