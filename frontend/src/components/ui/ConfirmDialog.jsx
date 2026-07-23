// Confirmation dialog for destructive/irreversible actions.
import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import AlertTriangleIcon from '@mui/icons-material/WarningAmberRounded';

export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmColor = 'error',
  loading = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogContent sx={{ px: 3, pt: 3, pb: 2, textAlign: 'center' }}>
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: confirmColor === 'error' ? '#FEF2F2' : '#EFF6FF',
            color: confirmColor === 'error' ? '#EF4444' : '#1E3A8A',
            mx: 'auto',
            mb: 2,
          }}
        >
          <AlertTriangleIcon sx={{ fontSize: 28 }} />
        </Box>
        <DialogTitle sx={{ px: 0, pt: 0, pb: 0.5, fontSize: 18, fontWeight: 700, color: '#111827', textAlign: 'center' }}>
          {title}
        </DialogTitle>
        <DialogContentText sx={{ color: '#6B7280', fontSize: 14, textAlign: 'center' }}>
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button
          variant="outlined"
          onClick={onCancel}
          disabled={loading}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
        >
          {cancelText}
        </Button>
        <Button
          variant="contained"
          color={confirmColor}
          onClick={onConfirm}
          disabled={loading}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
