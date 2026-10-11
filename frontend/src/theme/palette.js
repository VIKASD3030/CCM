// Enterprise CCM palette — single source of truth for colors.
// Inspired by Azure Portal, Linear, and Material Design 3.

export const tokens = {
  // CCM design red (see src/ccm/ui/ccm-ui.css --cx-red).
  primary: '#C4232A',
  primaryDark: '#A51D23',
  primaryLight: '#D9474D',
  accent: '#C4232A',
  accentLight: '#D9474D',
  secondary: '#6B7280',
  background: '#F4F5F7',
  paper: '#FFFFFF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  hover: '#F1F5F9',
  hoverLight: '#F8FAFC',
  selected: '#EFF6FF',
  success: '#22C55E',
  successLight: '#F0FDF4',
  warning: '#F59E0B',
  warningLight: '#FFFBEB',
  error: '#EF4444',
  errorLight: '#FEF2F2',
  info: '#3B82F6',
  infoLight: '#EFF6FF',
  white: '#FFFFFF',
  black: '#111827',
  divider: '#E5E7EB',
  shadow: 'rgba(0,0,0,0.08)',
};

const palette = {
  mode: 'light',
  primary: {
    main: tokens.primary,
    dark: tokens.primaryDark,
    light: tokens.primaryLight,
    contrastText: '#FFFFFF',
  },
  secondary: {
    main: tokens.secondary,
    dark: '#4B5563',
    light: '#9CA3AF',
    contrastText: '#FFFFFF',
  },
  error: {
    main: tokens.error,
    dark: '#DC2626',
    light: '#FCA5A5',
    contrastText: '#FFFFFF',
  },
  success: {
    main: tokens.success,
    dark: '#16A34A',
    light: '#86EFAC',
    contrastText: '#FFFFFF',
  },
  warning: {
    main: tokens.warning,
    dark: '#D97706',
    light: '#FCD34D',
    contrastText: '#FFFFFF',
  },
  info: {
    main: tokens.info,
    dark: '#2563EB',
    light: '#93C5FD',
    contrastText: '#FFFFFF',
  },
  background: {
    default: tokens.background,
    paper: tokens.paper,
  },
  text: {
    primary: tokens.textPrimary,
    secondary: tokens.textSecondary,
    disabled: tokens.textTertiary,
  },
  divider: tokens.divider,
  action: {
    hover: tokens.hover,
    selected: tokens.selected,
    disabledBackground: '#F3F4F6',
    focus: tokens.selected,
  },
};

export default palette;
