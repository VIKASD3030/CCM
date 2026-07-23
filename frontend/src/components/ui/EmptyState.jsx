// Meaningful empty state: icon badge, title, helper text, optional CTAs.
import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import InboxRoundedIcon from '@mui/icons-material/InboxRounded';

export default function EmptyState({ icon, title = 'No data yet', description, primaryAction, secondaryAction }) {
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      spacing={1.5}
      sx={{ width: '100%', height: '100%', py: 8, px: 3, textAlign: 'center' }}
    >
      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)',
          color: '#1E3A8A',
          mb: 1,
          '& svg': { fontSize: 36 },
        }}
      >
        {icon || <InboxRoundedIcon />}
      </Box>
      <Typography variant="h4" sx={{ color: '#111827', fontWeight: 700, fontSize: 20 }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body1" sx={{ color: '#6B7280', maxWidth: 400, lineHeight: 1.6, fontSize: 15 }}>
          {description}
        </Typography>
      )}
      {(primaryAction || secondaryAction) && (
        <Stack direction="row" spacing={1.5} sx={{ mt: 1.5 }}>
          {primaryAction}
          {secondaryAction}
        </Stack>
      )}
    </Stack>
  );
}
