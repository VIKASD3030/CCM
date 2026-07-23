// Enterprise stat card — animated gradient accent bar, hover lift, icon badge.
import React from 'react';
import { motion } from 'framer-motion';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export default function StatCard({ icon, value, label, accent = '#1E3A8A', loading = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      whileHover={{ y: -3, boxShadow: '0 8px 24px rgba(0,0,0,0.10)' }}
      style={{ height: '100%' }}
    >
      <Card
        sx={{
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          cursor: 'default',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: `linear-gradient(90deg, ${accent}, ${accent}88)`,
            borderRadius: '16px 16px 0 0',
          },
        }}
      >
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="overline"
                sx={{ color: '#9CA3AF', fontWeight: 600, fontSize: 11, letterSpacing: '0.08em' }}
              >
                {label}
              </Typography>
              <Typography
                variant="h2"
                sx={{
                  mt: 0.5,
                  fontSize: { xs: 28, md: 32 },
                  fontWeight: 700,
                  color: '#111827',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                }}
              >
                {loading ? '—' : value}
              </Typography>
            </Box>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: `${accent}10`,
                color: accent,
                flexShrink: 0,
                transition: 'all 0.2s ease',
                '&:hover': { transform: 'scale(1.08)', bgcolor: `${accent}18` },
              }}
            >
              {icon}
            </Box>
          </Box>
        </CardContent>
      </Card>
    </motion.div>
  );
}
