// Page header: large title + optional subtitle on the left, actions on the right.
import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';

export default function PageHeader({ title, subtitle, actions, breadcrumb, sx }) {
  return (
    <Box sx={{ mb: 3, ...sx }}>
      {breadcrumb && (
        <Breadcrumbs sx={{ mb: 1.5 }}>
          {breadcrumb.map((item, i) => (
            item.href ? (
              <Link key={i} href={item.href} underline="hover" sx={{ fontSize: 14, color: '#6B7280', fontWeight: 500 }}>
                {item.label}
              </Link>
            ) : (
              <Typography key={i} sx={{ fontSize: 14, color: '#111827', fontWeight: 700 }}>
                {item.label}
              </Typography>
            )
          ))}
        </Breadcrumbs>
      )}

      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 3,
          flexWrap: { xs: 'wrap', sm: 'nowrap' },
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="h1"
            sx={{
              color: '#111827',
              fontWeight: 700,
              fontSize: { xs: 26, md: 32 },
              letterSpacing: '-0.025em',
              lineHeight: 1.2,
            }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography
              variant="body1"
              sx={{ color: '#6B7280', mt: 0.75, fontSize: 15, lineHeight: 1.5 }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
        {actions && (
          <Stack direction="row" spacing={1.5} alignItems="center" flexShrink={0}>
            {actions}
          </Stack>
        )}
      </Box>
    </Box>
  );
}
