// SYSTRA / CCM brand palette — single source of truth for colors.
// Mirrors the design tokens defined in the redesigned Project Master page.

export const tokens = {
  primary: '#2F3A67',
  primaryDark: '#26305A',
  primaryLight: '#3B466F',
  secondary: '#D62828',
  secondaryDark: '#B71F1F',
  background: '#F6F7FB',
  paper: '#FFFFFF',
  border: '#E5E7EB',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  hover: '#F1F5FB',
  success: '#2E7D32',
  warning: '#ED6C02',
  info: '#0288D1',
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
    dark: tokens.secondaryDark,
    contrastText: '#FFFFFF',
  },
  error: {
    main: tokens.secondary,
    dark: tokens.secondaryDark,
  },
  success: { main: tokens.success },
  warning: { main: tokens.warning },
  info: { main: tokens.info },
  background: {
    default: tokens.background,
    paper: tokens.paper,
  },
  text: {
    primary: tokens.textPrimary,
    secondary: tokens.textSecondary,
  },
  divider: tokens.border,
  action: {
    hover: tokens.hover,
    selected: tokens.hover,
  },
};

export default palette;
