// Enterprise DataGrid wrapper: MUI X DataGrid with premium Azure/Linear-inspired styling.
import React from 'react';
import { DataGrid } from '@mui/x-data-grid';
import Box from '@mui/material/Box';
import EmptyState from './EmptyState';

const densityRowHeights = { compact: 44, standard: 56, comfortable: 68 };
const densityCellPadding = { compact: '10px 16px', standard: '14px 16px', comfortable: '18px 16px' };

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
  density = 'standard',
  sx,
  ...rest
}) {
  return (
    <Box
      sx={{
        width: '100%',
        height,
        borderRadius: '16px',
        overflow: 'hidden',
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        transition: 'box-shadow 0.2s ease',
        '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)' },
      }}
    >
      <DataGrid
        rows={rows}
        columns={columns}
        loading={loading}
        getRowId={getRowId}
        disableRowSelectionOnClick
        pageSizeOptions={[10, 20, 30, 50, 100]}
        initialState={{ pagination: { paginationModel: { pageSize } } }}
        slotProps={{
          loadingOverlay: {
            variant: 'skeleton',
            noRowsVariant: 'skeleton',
          },
        }}
        slots={{
          noRowsOverlay: () => (
            <EmptyState title={emptyTitle} description={emptyDescription} primaryAction={emptyAction} />
          ),
        }}
        sx={{
          border: 'none',
          fontSize: 14,

          // ── Column Headers ──
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: '#F8FAFC',
            borderBottom: '2px solid #E5E7EB',
            minHeight: 56,
          },
          '& .MuiDataGrid-columnHeader': {
            padding: '0 16px',
            '&:focus, &:focus-within': { outline: 'none' },
          },
          '& .MuiDataGrid-columnHeaderTitle': {
            fontWeight: 700,
            color: '#475569',
            fontSize: 13,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          },
          '& .MuiDataGrid-columnSeparator': { color: '#E5E7EB' },
          '& .MuiDataGrid-iconButtonContainer': { width: 28 },
          '& .MuiDataGrid-menuIcon': { width: 28 },
          '& .MuiDataGrid-sortIcon': { color: '#1E3A8A' },

          // ── Cells ──
          '& .MuiDataGrid-cell': {
            fontSize: 14,
            color: '#374151',
            borderBottom: '1px solid #F3F4F6',
            padding: densityCellPadding[density],
            lineHeight: 1.5,
            transition: 'background-color 0.12s ease',
            '&:focus, &:focus-within': { outline: 'none' },
          },

          // ── Rows ──
          '& .MuiDataGrid-row': {
            transition: 'background-color 0.15s ease',
          },
          '& .MuiDataGrid-row:nth-of-type(odd)': { backgroundColor: '#FFFFFF' },
          '& .MuiDataGrid-row:nth-of-type(even)': { backgroundColor: '#FAFBFC' },
          '& .MuiDataGrid-row:hover': {
            backgroundColor: '#F0F7FF !important',
          },

          // ── Action column ──
          '& .MuiDataGrid-cell[data-field="action"]': {
            display: 'flex',
            justifyContent: 'center',
          },

          // ── Footer / Pagination ──
          '& .MuiDataGrid-footerContainer': {
            borderTop: '1px solid #E5E7EB',
            backgroundColor: '#FAFBFC',
            minHeight: 60,
          },
          '& .MuiDataGrid-pagination': {
            '& .MuiTablePagination-toolbar': { minHeight: 60 },
            '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
              fontSize: 14,
              color: '#6B7280',
            },
          },
          '& .MuiDataGrid-topContainer': { boxShadow: 'none' },

          // ── Overlay / Skeleton ──
          '& .MuiDataGrid-overlayWrapper': { minHeight: 320 },
          '& .MuiDataGrid-overlayWrapperInner': { height: '100% !important' },

          // ── Virtual scroller ──
          '& .MuiDataGrid-virtualScroller': {
            '&::-webkit-scrollbar': { width: 6, height: 6 },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': { backgroundColor: '#CBD5E1', borderRadius: 8 },
            '&::-webkit-scrollbar-thumb:hover': { backgroundColor: '#94A3B8' },
          },

          ...sx,
        }}
        {...rest}
      />
    </Box>
  );
}
