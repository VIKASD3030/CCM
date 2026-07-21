// Stat card for dashboards: label, value, optional delta + icon.
import React from 'react';
import Card from '@mui/material/Card';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export default function StatCard({ label, value, icon, accent = 'primary.main', helper }) {
  return (
    <Card sx={{ p: 2.5, height: '100%' }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {label}
          </Typography>
          <Typography variant="h2" sx={{ mt: 0.5, fontSize: 30 }} color="text.primary">
            {value}
          </Typography>
          {helper && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {helper}
            </Typography>
          )}
        </Box>
        {icon && (
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(47,58,103,0.08)',
              color: accent,
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
        )}
      </Stack>
    </Card>
  );
}
