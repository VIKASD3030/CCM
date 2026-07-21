// Centralized CCM / SYSTRA MUI theme. Import { theme } and pass to ThemeProvider.

import { createTheme } from '@mui/material/styles';
import palette, { tokens } from './palette';
import typography from './typography';
import components from './components';
import { shape, spacingUnit } from './shape';

const theme = createTheme({
  palette,
  typography,
  shape,
  spacing: spacingUnit,
  components,
  breakpoints: {
    values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 },
  },
});

export { theme, tokens };
export default theme;
