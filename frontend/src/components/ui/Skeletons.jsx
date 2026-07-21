// Skeleton loaders — avoid blank pages and layout shift while data loads.
import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';

export function TableSkeleton({ rows = 8, cols = 5 }) {
  return (
    <Box sx={{ p: 1 }}>
      <Skeleton variant="rounded" height={44} sx={{ mb: 1 }} />
      <Stack spacing={1}>
        {Array.from({ length: rows }).map((_, r) => (
          <Stack key={r} direction="row" spacing={2}>
            {Array.from({ length: cols }).map((__, c) => (
              <Skeleton key={c} variant="text" sx={{ flex: c === 0 ? 0.4 : 1, fontSize: 20 }} />
            ))}
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

export function FormSkeleton({ fields = 4 }) {
  return (
    <Stack spacing={2.5}>
      {Array.from({ length: fields }).map((_, i) => (
        <Box key={i}>
          <Skeleton variant="text" width={120} sx={{ mb: 0.5 }} />
          <Skeleton variant="rounded" height={40} />
        </Box>
      ))}
    </Stack>
  );
}

export function CardsSkeleton({ count = 4 }) {
  return (
    <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant="rounded" height={110} sx={{ flex: '1 1 200px', borderRadius: 3 }} />
      ))}
    </Stack>
  );
}
