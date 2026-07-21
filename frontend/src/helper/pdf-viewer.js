import React, { useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, Tooltip } from "@mui/material";
import { ZoomIn, ZoomOut } from '@mui/icons-material';
import { Document, Page } from 'react-pdf';

const PdfViewer = ({ filePath, onCancel, visible }) => {
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(null);
  const [scale, setScale] = useState(1);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setPage(1);
  };

  const onSetScale = (type) => {
    let newScale = type ? scale + 0.1 : scale - 0.1;
    newScale = Math.min(Math.max(newScale, 0.1), 2);
    setScale(newScale);
  };

  const onPageChange = (type) => {
    let newPage = type ? page + 1 : page - 1;
    if (newPage > numPages) newPage = 1;
    if (newPage < 1) newPage = numPages;
    setPage(newPage);
  };

  const footer = (
    <div className="footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
      <Button size="small" disabled={page === 1} onClick={() => onPageChange(0)}>Previous</Button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <span style={{ marginRight: 10 }}>Page {page} of {numPages}</span>
        <IconButton size="small" disabled={scale === 0.1} onClick={() => onSetScale(0)}>
          <ZoomOut fontSize="small" />
        </IconButton>
        <IconButton size="small" disabled={scale === 2} onClick={() => onSetScale(1)}>
          <ZoomIn fontSize="small" />
        </IconButton>
        <span>{Math.round(scale * 100)}%</span>
      </div>
      <Button size="small" disabled={page === numPages} onClick={() => onPageChange(1)}>Next</Button>
    </div>
  );

  return (
    <Dialog
      open={visible}
      onClose={onCancel}
      maxWidth="lg"
      fullWidth
      slotProps={{ paper: { sx: { mt: '55px' } } }}
    >
      <DialogTitle>Documents</DialogTitle>
      <DialogContent sx={{ height: 550, overflowY: 'auto', textAlign: 'center' }}>
        <Document
          file={filePath}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={(err) => { console.log(err); }}
        >
          <Page pageNumber={page} scale={scale} />
        </Document>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        {footer}
      </DialogActions>
    </Dialog>
  );
};

export default PdfViewer;
