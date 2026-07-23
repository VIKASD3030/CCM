// Typography hierarchy per the enterprise design system.
// Page Title 32-34 / Section 22 / Card 18 / Body 14-15 / Caption 12.

const fontFamily = [
  '"Inter"',
  '"Segoe UI"',
  'Roboto',
  '"Helvetica Neue"',
  'Arial',
  'system-ui',
  'sans-serif',
].join(',');

const typography = {
  fontFamily,
  fontSize: 14,
  lineHeight: 1.6,
  h1: { fontSize: 32, fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.025em' },
  h2: { fontSize: 24, fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.02em' },
  h3: { fontSize: 22, fontWeight: 600, lineHeight: 1.3, letterSpacing: '-0.015em' },
  h4: { fontSize: 18, fontWeight: 600, lineHeight: 1.35 },
  h5: { fontSize: 16, fontWeight: 600, lineHeight: 1.4 },
  h6: { fontSize: 15, fontWeight: 600, lineHeight: 1.4 },
  subtitle1: { fontSize: 15, fontWeight: 600, lineHeight: 1.5 },
  subtitle2: { fontSize: 14, fontWeight: 600, lineHeight: 1.5 },
  body1: { fontSize: 14, lineHeight: 1.6, letterSpacing: '0.01em' },
  body2: { fontSize: 13, lineHeight: 1.5, letterSpacing: '0.01em' },
  caption: { fontSize: 12, color: '#6B7280', letterSpacing: '0.02em', lineHeight: 1.5 },
  overline: { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' },
  button: { fontSize: 14, fontWeight: 600, textTransform: 'none', letterSpacing: '0.01em' },
};

export default typography;
