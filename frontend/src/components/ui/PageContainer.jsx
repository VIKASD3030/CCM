// Page shell: sets the padded, background-tinted canvas every screen sits on.
import React from 'react';
import Box from '@mui/material/Box';

export default function PageContainer({ children, sx, ...rest }) {
  return (
    <Box
      sx={{
        width: '100%',
        minHeight: '100%',
        px: { xs: 2, md: 4 },
        pt: 3,
        pb: 4,
        bgcolor: 'background.default',
        boxSizing: 'border-box',
        ...sx,
      }}
      {...rest}
    >
      {children}
    </Box>
  );
}
