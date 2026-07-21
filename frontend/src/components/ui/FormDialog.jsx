// Reusable form dialog: styled header, scrollable body, standard footer buttons.
import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import Fade from '@mui/material/Fade';

const Transition = React.forwardRef((props, ref) => <Fade ref={ref} {...props} />);

export default function FormDialog({
  open,
  title,
  onClose,
  actions,
  maxWidth = 'sm',
  fullWidth = true,
  children,
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      slots={{ transition: Transition }}
      scroll="paper"
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {title}
        {onClose && (
          <IconButton size="small" onClick={onClose} aria-label="Close" sx={{ ml: 2 }}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        )}
      </DialogTitle>
      <DialogContent dividers>{children}</DialogContent>
      {actions && <DialogActions>{actions}</DialogActions>}
    </Dialog>
  );
}
