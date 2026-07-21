// Typography hierarchy per the CCM design system.
// Page Title 28 / Section 20 / Card 18 / Body 14 / Caption 12.

const fontFamily = [
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
  h1: { fontSize: 28, fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.02em' },
  h2: { fontSize: 24, fontWeight: 700, lineHeight: 1.25 },
  h3: { fontSize: 20, fontWeight: 600, lineHeight: 1.3 }, // Section title
  h4: { fontSize: 18, fontWeight: 600, lineHeight: 1.35 }, // Card title
  h5: { fontSize: 16, fontWeight: 600, lineHeight: 1.4 },
  h6: { fontSize: 15, fontWeight: 600, lineHeight: 1.4 },
  subtitle1: { fontSize: 14, fontWeight: 600 },
  subtitle2: { fontSize: 13, fontWeight: 600 },
  body1: { fontSize: 14, lineHeight: 1.5 },
  body2: { fontSize: 13, lineHeight: 1.5 },
  caption: { fontSize: 12, color: '#6B7280' },
  button: { fontSize: 14, fontWeight: 600, textTransform: 'none' },
};

export default typography;
