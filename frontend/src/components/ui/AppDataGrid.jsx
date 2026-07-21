// Enterprise DataGrid wrapper: MUI X DataGrid pre-wired with our styling,
// built-in toolbar (quick filter), empty state, loading overlay, and pagination.
import React from 'react';
import { DataGrid } from '@mui/x-data-grid';
import Box from '@mui/material/Box';
import EmptyState from './EmptyState';

export default function AppDataGrid({
  rows = [],
  columns = [],
  loading = false,
  getRowId,
  emptyTitle,
  emptyDescription,
  emptyAction,
  height = 600,
  pageSize = 10,
  showToolbar = true,
  sx,
  ...rest
}) {
  return (
    <Box sx={{ width: '100%', height }}>
      <DataGrid
        rows={rows}
        columns={columns}
        loading={loading}
        getRowId={getRowId}
        disableRowSelectionOnClick
        showToolbar={showToolbar}
        pageSizeOptions={[10, 20, 30, 50, 100]}
        initialState={{ pagination: { paginationModel: { pageSize } } }}
        slots={{
          noRowsOverlay: () => (
            <EmptyState title={emptyTitle} description={emptyDescription} primaryAction={emptyAction} />
          ),
        }}
        sx={{
          border: 'none',
          '& .MuiDataGrid-columnHeaders': { backgroundColor: '#F3F5FA' },
          '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 600, color: 'primary.main', fontSize: 13 },
          '& .MuiDataGrid-cell': { fontSize: 14 },
          '& .MuiDataGrid-row:nth-of-type(even)': { backgroundColor: '#FBFCFE' },
          '& .MuiDataGrid-row:hover': { backgroundColor: 'action.hover' },
          '& .MuiDataGrid-footerContainer': { borderTop: (t) => `1px solid ${t.palette.divider}` },
          // Keep the no-rows overlay from collapsing so the empty state stays centered.
          '& .MuiDataGrid-overlayWrapper': { minHeight: 320 },
          '& .MuiDataGrid-overlayWrapperInner': { height: '100% !important' },
          ...sx,
        }}
        {...rest}
      />
    </Box>
  );
}
