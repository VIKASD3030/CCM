// Confirmation dialog for destructive/irreversible actions.
import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';

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
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mt: 1 }}>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button variant="text" color="inherit" onClick={onCancel} disabled={loading}>
          {cancelText}
        </Button>
        <Button variant="contained" color={confirmColor} onClick={onConfirm} disabled={loading}>
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
