import React, { Component } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';

class ImageViewer extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    const { fileType, filePath, visible, onCancel } = this.props;
    return (
      <Dialog
        open={visible}
        onClose={onCancel}
        maxWidth="lg"
        fullWidth
        slotProps={{ paper: { sx: { mt: '55px' } } }}
      >
        <DialogTitle>Documents</DialogTitle>
        <DialogContent sx={{ height: 550, overflowY: 'auto' }}>
          <img
            src={filePath}
            alt="Document"
            style={{ maxWidth: '100%', maxHeight: '100%', cursor: 'zoom-in' }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancel}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  }
}

export default ImageViewer;
