// Card shell: header row (title + count + toolbar) over content.
import React from 'react';
import Card from '@mui/material/Card';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';

export default function DataCard({ title, count, countLabel = 'Records', toolbar, children, sx }) {
  return (
    <Card sx={{ overflow: 'hidden', borderRadius: '16px', ...sx }}>
      {(title || toolbar) && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            px: 3,
            py: 2,
            borderBottom: '1px solid #F3F4F6',
            backgroundColor: '#FAFBFC',
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.5}>
            {title && (
              <Typography variant="h4" sx={{ color: '#111827', fontWeight: 700, fontSize: 18 }}>
                {title}
              </Typography>
            )}
            {count != null && (
              <Chip
                size="small"
                label={`${count} ${count === 1 ? countLabel.replace(/s$/, '') : countLabel}`}
                sx={{
                  bgcolor: '#EFF6FF',
                  color: '#1E3A8A',
                  height: 26,
                  fontWeight: 600,
                  fontSize: 12,
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
