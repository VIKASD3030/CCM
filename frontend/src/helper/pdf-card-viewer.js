import React, { useState } from "react";
import { Card, CardContent, CardActions, Typography, Button, IconButton, Tooltip } from '@mui/material';
import { ZoomIn, ZoomOut, PictureAsPdf, Search } from '@mui/icons-material';
import { Document, Page } from 'react-pdf';

const PdfCardViewer = ({ filePath, toggleModal, documentDate }) => {
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

  const pdfDownload = (filePath) => {
    const a = document.createElement('a');
    a.href = filePath;
    a.download = 'attachment.pdf';
    a.click();
  };

  return (
    <Card>
      <CardActions sx={{ justifyContent: 'space-between', px: 2, py: 1 }}>
        <Typography variant="subtitle1" fontWeight="bold">Program Details</Typography>
        <Typography variant="body2">Document Date: {documentDate}</Typography>
        <div>
          <Tooltip title="Search Record">
            <IconButton size="small" color="primary" onClick={toggleModal}>
              <Search fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Download PDF">
            <IconButton size="small" sx={{ ml: 0.5 }} onClick={() => pdfDownload(filePath)}>
              <PictureAsPdf fontSize="small" color="error" />
            </IconButton>
          </Tooltip>
        </div>
      </CardActions>

      <CardContent sx={{ height: 500, overflowY: 'auto', textAlign: 'center' }}>
        <Document
          file={filePath}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={(err) => console.error("PDF load error:", err)}
        >
          <Page pageNumber={page} scale={scale} />
        </Document>
      </CardContent>

      <CardActions sx={{ justifyContent: 'space-between', px: 2, py: 1 }}>
        <Button size="small" disabled={page === 1} onClick={() => onPageChange(0)}>Previous</Button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ mr: 1 }}>Page {page} of {numPages}</Typography>
          <IconButton size="small" disabled={scale === 0.1} onClick={() => onSetScale(0)}>
            <ZoomOut fontSize="small" />
          </IconButton>
          <IconButton size="small" disabled={scale === 2} onClick={() => onSetScale(1)}>
            <ZoomIn fontSize="small" />
          </IconButton>
          <Typography variant="body2">{Math.round(scale * 100)}%</Typography>
        </div>
        <Button size="small" disabled={page === numPages} onClick={() => onPageChange(1)}>Next</Button>
      </CardActions>
    </Card>
  );
};

export default PdfCardViewer;
