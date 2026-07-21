// Page header: large title + optional subtitle on the left, actions on the right.
import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export default function PageHeader({ title, subtitle, actions, sx }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 2,
        mb: 3,
        flexWrap: { xs: 'wrap', sm: 'nowrap' },
        ...sx,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h1" color="text.primary">
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions && (
        <Stack direction="row" spacing={1.25} alignItems="center" flexShrink={0}>
          {actions}
        </Stack>
      )}
    </Box>
  );
}
