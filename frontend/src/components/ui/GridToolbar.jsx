// Enterprise DataGrid toolbar — search, filters, refresh, export, column visibility, density.
import React, { useState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import InputAdornment from '@mui/material/InputAdornment';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import Menu from '@mui/material/Menu';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import Badge from '@mui/material/Badge';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  GetApp as ExportIcon,
  ViewColumn as ColumnIcon,
  FilterList as FilterIcon,
  DensitySmall as DensityIcon,
  Close as CloseIcon,
  Check as CheckIcon,
} from '@mui/icons-material';

export default function GridToolbar({
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters = [],
  onFilterChange,
  onRefresh,
  onExport,
  columnVisibility = {},
  onColumnToggle,
  density = 'standard',
  onDensityChange,
}) {
  const [columnMenuAnchor, setColumnMenuAnchor] = useState(null);
  const [densityMenuAnchor, setDensityMenuAnchor] = useState(null);

  const activeFilterCount = filters.filter(f => f.value && f.value !== '').length;

  const densities = [
    { value: 'compact', label: 'Compact' },
    { value: 'standard', label: 'Standard' },
    { value: 'comfortable', label: 'Comfortable' },
  ];

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2.5,
        py: 1.5,
        borderBottom: '1px solid #F3F4F6',
        flexWrap: 'wrap',
        backgroundColor: '#FAFBFC',
      }}
    >
      {/* Search */}
      <TextField
        size="small"
        placeholder={searchPlaceholder}
        value={searchValue}
        onChange={(e) => onSearchChange?.(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: '#9CA3AF' }} />
              </InputAdornment>
            ),
          },
        }}
        sx={{
          minWidth: 280,
          flex: '1 1 280px',
          '& .MuiOutlinedInput-root': {
            bgcolor: '#fff',
            borderRadius: '10px',
            fontSize: 14,
            minHeight: 40,
            '& fieldset': { borderColor: '#E5E7EB' },
            '&:hover fieldset': { borderColor: '#CBD5E1' },
            '&.Mui-focused fieldset': { borderColor: '#2563EB', borderWidth: 1.5 },
          },
        }}
      />

      {/* Filter chips */}
      {filters.map((filter) => (
        <Select
          key={filter.name}
          size="small"
          value={filter.value || ''}
          onChange={(e) => onFilterChange?.(filter.name, e.target.value)}
          displayEmpty
          sx={{
            minWidth: 150,
            height: 40,
            borderRadius: '10px',
            fontSize: 14,
            bgcolor: filter.value ? '#EFF6FF' : '#fff',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: filter.value ? '#BFDBFE' : '#E5E7EB',
            },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#CBD5E1' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#2563EB', borderWidth: 1.5 },
          }}
        >
          <MenuItem value="">
            <em>{filter.label}</em>
          </MenuItem>
          {filter.options?.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      ))}

      {/* Active filter badge */}
      {activeFilterCount > 0 && (
        <Chip
          size="small"
          label={`${activeFilterCount} active`}
          onDelete={() => filters.forEach(f => onFilterChange?.(f.name, ''))}
          color="info"
          sx={{ height: 28, fontWeight: 600 }}
        />
      )}

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />

      {/* Refresh */}
      <Tooltip title="Refresh data">
        <IconButton size="small" onClick={onRefresh} sx={{ color: '#6B7280', '&:hover': { color: '#1E3A8A', bgcolor: '#EFF6FF' } }}>
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      {/* Export */}
      <Tooltip title="Export to Excel">
        <IconButton size="small" onClick={onExport} sx={{ color: '#6B7280', '&:hover': { color: '#1E3A8A', bgcolor: '#EFF6FF' } }}>
          <ExportIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      {/* Column visibility */}
      <Tooltip title="Column visibility">
        <IconButton
          size="small"
          onClick={(e) => setColumnMenuAnchor(e.currentTarget)}
          sx={{ color: '#6B7280', '&:hover': { color: '#1E3A8A', bgcolor: '#EFF6FF' } }}
        >
          <ColumnIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={columnMenuAnchor}
        open={Boolean(columnMenuAnchor)}
        onClose={() => setColumnMenuAnchor(null)}
        slotProps={{ paper: { sx: { minWidth: 200, p: 1 } } }}
      >
        <Typography sx={{ px: 2, py: 1, fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Columns
        </Typography>
        {columnVisibility && Object.entries(columnVisibility).map(([field, visible]) => (
          <MenuItem
            key={field}
            dense
            onClick={() => onColumnToggle?.(field)}
            sx={{ borderRadius: 1, py: 0.5 }}
          >
            <ListItemIcon sx={{ minWidth: 28 }}>
              {visible ? <CheckIcon sx={{ fontSize: 16, color: '#1E3A8A' }} /> : <Box sx={{ width: 16 }} />}
            </ListItemIcon>
            <ListItemText
              primary={field.replace(/([A-Z])/g, ' $1').trim()}
              primaryTypographyProps={{ fontSize: 13, fontWeight: 500 }}
            />
          </MenuItem>
        ))}
      </Menu>

      {/* Density */}
      <Tooltip title="Row density">
        <IconButton
          size="small"
          onClick={(e) => setDensityMenuAnchor(e.currentTarget)}
          sx={{ color: '#6B7280', '&:hover': { color: '#1E3A8A', bgcolor: '#EFF6FF' } }}
        >
          <DensityIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={densityMenuAnchor}
        open={Boolean(densityMenuAnchor)}
        onClose={() => setDensityMenuAnchor(null)}
        slotProps={{ paper: { sx: { minWidth: 160, p: 1 } } }}
      >
        {densities.map((d) => (
          <MenuItem
            key={d.value}
            dense
            selected={density === d.value}
            onClick={() => { onDensityChange?.(d.value); setDensityMenuAnchor(null); }}
            sx={{ borderRadius: 1, py: 0.5 }}
          >
            <ListItemText primary={d.label} primaryTypographyProps={{ fontSize: 13, fontWeight: 500 }} />
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
