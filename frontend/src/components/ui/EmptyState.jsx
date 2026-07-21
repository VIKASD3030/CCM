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
      spacing={1}
      sx={{ width: '100%', height: '100%', py: 7, px: 3, textAlign: 'center' }}
    >
      <Box
        sx={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'rgba(47,58,103,0.06)',
          color: 'primary.main',
          mb: 1,
          '& svg': { fontSize: 34 },
        }}
      >
        {icon || <InboxRoundedIcon />}
      </Box>
      <Typography variant="h5" color="text.primary">
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 340 }}>
          {description}
        </Typography>
      )}
      {(primaryAction || secondaryAction) && (
        <Stack direction="row" spacing={1.5} sx={{ mt: 1 }}>
          {primaryAction}
          {secondaryAction}
        </Stack>
      )}
    </Stack>
  );
}
