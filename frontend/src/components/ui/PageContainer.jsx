// Page shell: full-width canvas beside the sidebar.
import React from 'react';
import Box from '@mui/material/Box';

export default function PageContainer({ children, sx, ...rest }) {
  return (
    <Box
      sx={{
        width: '100%',
        minHeight: '100%',
        px: { xs: 2, sm: 3, md: 4 },
        pt: { xs: 2.5, md: 3 },
        pb: 4,
        bgcolor: '#F8FAFC',
        boxSizing: 'border-box',
        ...sx,
      }}
      {...rest}
    >
      {children}
    </Box>
  );
}
