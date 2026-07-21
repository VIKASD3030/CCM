// Card that wraps a data table: header row (title + record count + toolbar) over content.
import React from 'react';
import Card from '@mui/material/Card';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';

export default function DataCard({ title, count, countLabel = 'Records', toolbar, children, sx }) {
  return (
    <Card sx={{ overflow: 'hidden', ...sx }}>
      {(title || toolbar) && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            px: 3,
            py: 2,
            borderBottom: (t) => `1px solid ${t.palette.divider}`,
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.5}>
            {title && (
              <Typography variant="h4" color="text.primary">
                {title}
              </Typography>
            )}
            {count != null && (
              <Chip
                size="small"
                label={`${count} ${count === 1 ? countLabel.replace(/s$/, '') : countLabel}`}
                sx={{
                  bgcolor: 'rgba(47,58,103,0.08)',
                  color: 'primary.main',
                  height: 22,
                }}
              />
            )}
          </Stack>
          {toolbar && (
            <Stack direction="row" spacing={1} alignItems="center">
              {toolbar}
            </Stack>
          )}
        </Box>
      )}
      <Box sx={{ p: 1 }}>{children}</Box>
    </Card>
  );
}
