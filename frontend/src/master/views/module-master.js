import moment from 'moment';
import React, { Component } from 'react';
import {
  TextField, MenuItem, Grid, Box, CircularProgress, FormControlLabel, Switch,
  Snackbar, Alert, Tooltip, IconButton, Typography, Button as MuiButton,
  Menu, ListItemIcon, ListItemText,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreIcon,
  Extension as ModuleIcon,
} from '@mui/icons-material';
import LoginState from '../../authentication/loginState';
import CommonUtilityController from '../controller/common-utility-controller';
import { fillSelectList } from '../../helper/common-utility';
import { PageContainer, PageHeader, EmptyState, AppDataGrid, FormDialog, ConfirmDialog, AppBreadcrumbs, GridToolbar } from '../../components/ui';

const emptyModule = {
  ModuleId: 0, ModuleName: '', UserShownName: '', ModuleGroupId: '', ParentModuleId: '',
  Level: '', ModuleType: '', ModulePath: '', IsExact: false, IconType: '', IconPath: '', Remarks: '', Status: 0,
};

class Module extends Component {
  constructor(props) {
    super(props);
    this.formRef = React.createRef();
    this.state = {
      data: [],
      moduleData: { ...emptyModule },
      searchData: { ModuleId: 0, ModuleGroupId: '' },
      loading: false,
      filteredTotal: null,
      visible: false,
      moduleGroupList: [],
      moduleParentList: [],
      confirmOpen: false,
      pendingDelete: null,
      formErrors: {},
      snackbar: { open: false, severity: 'success', message: '' },
      searchText: '',
      columnVisibility: {
        ModuleName: true,
        UserShownName: true,
        ModuleGroupName: true,
        ParentModuleName: true,
        Level: true,
        ModulePath: true,
      },
      density: 'standard',
    };
  }

  componentDidMount() { this.getModuleGroups(); }

  notify = (severity, message) => this.setState({ snackbar: { open: true, severity, message } });
  closeSnackbar = () => this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));

  async getModules(reqData) {
    this.setState({ loading: true });
    await new CommonUtilityController().getModules(reqData)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) this.setState({ data, moduleParentList: fillSelectList(data, 'ModuleName', 'ModuleId') });
      })
      .catch((error) => { this.setState({ loading: false }); this.notify('error', error.toString()); });
  }

  async getModuleGroups() {
    this.setState({ loading: true });
    await new CommonUtilityController().getModuleGroups(0)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) this.setState({ moduleGroupList: data });
      })
      .catch((error) => { this.setState({ loading: false }); this.notify('error', error.toString()); });
  }

  moduleGroupChange = (value) => {
    this.setState((s) => ({ searchData: { ...s.searchData, ModuleGroupId: value } }));
    if (value) this.getModules({ ModuleId: 0, ModuleGroupId: value });
  };

  newRecord = () => this.setState({ visible: true, formErrors: {}, moduleData: { ...emptyModule } });
  editRecord = (mod) => {
    if (mod.ParentModuleId == 0 || mod.ParentModuleId == null) mod.ParentModuleId = '';
    this.setState({ visible: true, formErrors: {}, moduleData: { ...mod } });
  };
  requestDelete = (r) => this.setState({ confirmOpen: true, pendingDelete: r });
  cancelDelete = () => this.setState({ confirmOpen: false, pendingDelete: null });
  confirmDelete = () => { const r = this.state.pendingDelete; this.setState({ confirmOpen: false, pendingDelete: null }); if (r) this.deleteRecord(r); };
  toggleModal = () => this.setState({ visible: !this.state.visible });

  deleteRecord = async (mod) => {
    mod.CreatedBy = LoginState.UserId; mod.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    this.setState({ loading: true });
    await new CommonUtilityController().deleteModuleDetails(mod)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) this.setState({ data, moduleParentList: fillSelectList(data, 'ModuleName', 'ModuleId') });
        this.notify('success', 'Data successfully deleted.');
      })
      .catch(() => { this.setState({ loading: false }); this.notify('error', 'Data deletion issue!'); });
  };

  handleField = (field) => (e) => {
    const value = e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e;
    this.setState((s) => ({ moduleData: { ...s.moduleData, [field]: value }, formErrors: { ...s.formErrors, [field]: undefined } }));
  };

  validateForm = () => {
    const { moduleData: d } = this.state;
    const errors = {};
    if (!String(d.ModuleName || '').trim()) errors.ModuleName = 'Module Name is required';
    if (!String(d.UserShownName || '').trim()) errors.UserShownName = 'User Shown Name is required';
    if (!d.ModuleGroupId) errors.ModuleGroupId = 'Module Group is required';
    if (d.Level === '' || d.Level === null || d.Level === undefined) errors.Level = 'Order By is required';
    if (!String(d.ModulePath || '').trim()) errors.ModulePath = 'Module Path is required';
    if (!String(d.IconType || '').trim()) errors.IconType = 'Icon Type is required';
    if (!String(d.IconPath || '').trim()) errors.IconPath = 'Icon Path is required';
    this.setState({ formErrors: errors });
    return Object.keys(errors).length === 0;
  };

  onFormSubmit = (e) => { if (e?.preventDefault) e.preventDefault(); if (!this.validateForm()) return; this.handleSubmit({ ...this.state.moduleData }); };

  handleSubmit = async (mod) => {
    if (mod.ParentModuleId == '') mod.ParentModuleId = '0';
    mod.CreatedBy = LoginState.UserId; mod.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    mod.LockedBy = LoginState.LockedBy; mod.LockedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    mod.SecurityId = LoginState.SecurityId; mod.Status = 1;
    this.setState({ loading: true });
    await new CommonUtilityController().saveModuleDetails(mod)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) {
          const { searchData } = this.state;
          searchData.ModuleGroupId = mod.ModuleGroupId;
          this.setState({ data, searchData, moduleParentList: fillSelectList(data, 'ModuleName', 'ModuleId'), visible: false });
        }
        this.notify('success', 'Data successfully Inserted.');
      })
      .catch(() => { this.setState({ loading: false }); this.notify('error', 'Data insertion issue!'); });
  };

  getFilteredData() {
    const { data, searchText } = this.state;
    if (!searchText) return data;
    const q = searchText.toLowerCase();
    return data.filter(r =>
      (r.ModuleName || '').toLowerCase().includes(q) ||
      (r.UserShownName || '').toLowerCase().includes(q) ||
      (r.ModuleGroupName || '').toLowerCase().includes(q) ||
      (r.ModulePath || '').toLowerCase().includes(q)
    );
  }

  handleExport = () => {
    const filtered = this.getFilteredData();
    const headers = ['Module Name', 'User Shown Name', 'Module Group', 'Parent Module', 'Order By', 'Module Path'];
    const rows = filtered.map(r => [r.ModuleName, r.UserShownName, r.ModuleGroupName, r.ParentModuleName, r.Level, r.ModulePath]);
    const csv = [headers, ...rows].map(row => row.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'modules.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  handleRefresh = () => {
    const { searchData } = this.state;
    if (searchData.ModuleGroupId) this.getModules(searchData);
  };

  get gridColumns() {
    const { columnVisibility } = this.state;
    const cols = [
      {
        field: 'action',
        headerName: '',
        width: 56,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) => <ActionMenu record={params.row} onEdit={this.editRecord} onDelete={this.requestDelete} />,
      },
      {
        field: 'ModuleName',
        headerName: 'Module Name',
        flex: 1,
        minWidth: 150,
        renderCell: (params) => (
          <Typography sx={{ fontSize: 13, color: '#374151' }}>{params.value || '\u2014'}</Typography>
        ),
      },
      {
        field: 'UserShownName',
        headerName: 'User Shown Name',
        flex: 1.2,
        minWidth: 160,
        renderCell: (params) => (
          <Typography sx={{ fontSize: 13, color: '#374151' }}>{params.value || '\u2014'}</Typography>
        ),
      },
      {
        field: 'ModuleGroupName',
        headerName: 'Module Group',
        flex: 1,
        minWidth: 150,
        renderCell: (params) => (
          <Typography sx={{ fontSize: 13, color: '#374151' }}>{params.value || '\u2014'}</Typography>
        ),
      },
      {
        field: 'ParentModuleName',
        headerName: 'Parent Module',
        flex: 1,
        minWidth: 150,
        renderCell: (params) => (
          <Typography sx={{ fontSize: 13, color: '#374151' }}>{params.value || '\u2014'}</Typography>
        ),
      },
      {
        field: 'Level',
        headerName: 'Order By',
        width: 100,
        type: 'number',
        align: 'right',
        headerAlign: 'right',
        renderCell: (params) => (
          <Typography sx={{ fontSize: 13, color: '#374151' }}>{params.value != null ? params.value : '\u2014'}</Typography>
        ),
      },
      {
        field: 'ModulePath',
        headerName: 'Module Path',
        flex: 1.2,
        minWidth: 160,
        renderCell: (params) => (
          <Typography sx={{ fontSize: 13, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {params.value || '\u2014'}
          </Typography>
        ),
      },
    ];
    return cols.filter(c => c.field === 'action' || columnVisibility[c.field] !== false);
  }

  render() {
    const { data, loading, visible, moduleData, moduleGroupList, moduleParentList, searchData, confirmOpen, formErrors, snackbar, searchText, density, columnVisibility } = this.state;
    const filteredData = this.getFilteredData();
    const count = filteredData.length;

    return (
      <PageContainer>
        <AppBreadcrumbs />
        <PageHeader
          title="Module"
          subtitle="Manage modules by group"
          actions={
            <MuiButton variant="contained" startIcon={<AddIcon />} onClick={this.newRecord} sx={{ borderRadius: '10px', px: 3, py: 1.25 }}>
              New Module
            </MuiButton>
          }
        />

        {loading && data.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress /></Box>
        ) : !loading && data.length === 0 ? (
          <EmptyState
            icon={<ModuleIcon sx={{ fontSize: 40 }} />}
            title="No Modules Found"
            description="Select a module group to load modules, or create a new module."
            primaryAction={
              <MuiButton variant="contained" startIcon={<AddIcon />} onClick={this.newRecord} sx={{ borderRadius: '10px', px: 3 }}>
                Create Module
              </MuiButton>
            }
          />
        ) : (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <GridToolbar
                searchValue={searchText}
                onSearchChange={(val) => this.setState({ searchText: val })}
                searchPlaceholder="Search modules..."
                onRefresh={this.handleRefresh}
                onExport={this.handleExport}
                columnVisibility={columnVisibility}
                onColumnToggle={(field) => this.setState(prev => ({
                  columnVisibility: { ...prev.columnVisibility, [field]: !prev.columnVisibility[field] },
                }))}
                density={density}
                onDensityChange={(d) => this.setState({ density: d })}
              />
              <TextField
                select
                size="small"
                label="Module Group"
                value={searchData.ModuleGroupId || ''}
                onChange={(e) => this.moduleGroupChange(e.target.value)}
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="">Select....</MenuItem>
                {moduleGroupList.map((mg) => <MenuItem key={mg.ModuleGroupId} value={mg.ModuleGroupId}>{mg.ModuleGroupName}</MenuItem>)}
              </TextField>
            </Box>
            <AppDataGrid
              rows={filteredData}
              columns={this.gridColumns}
              loading={loading}
              getRowId={(row) => row.ModuleId}
              density={density}
              height={600}
              pageSize={10}
            />
          </Box>
        )}

        <FormDialog open={visible} onClose={this.toggleModal} title="Module Details" maxWidth="md"
          actions={
            <>
              <MuiButton variant="text" color="inherit" onClick={this.toggleModal} sx={{ borderRadius: '10px' }}>Cancel</MuiButton>
              <MuiButton variant="contained" color="primary" onClick={this.onFormSubmit} sx={{ borderRadius: '10px', px: 3 }}>Submit</MuiButton>
            </>
          }
        >
          <Grid container spacing={2.5} sx={{ pt: 0.5 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Module Name" required value={moduleData.ModuleName || ''} onChange={this.handleField('ModuleName')} error={!!formErrors.ModuleName} helperText={formErrors.ModuleName} placeholder="Please enter module name" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="User Shown Name" required value={moduleData.UserShownName || ''} onChange={this.handleField('UserShownName')} error={!!formErrors.UserShownName} helperText={formErrors.UserShownName} placeholder="Please enter user shown name" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select label="Module Group" required value={moduleData.ModuleGroupId || ''} onChange={this.handleField('ModuleGroupId')} error={!!formErrors.ModuleGroupId} helperText={formErrors.ModuleGroupId}>
                <MenuItem value="">Select....</MenuItem>
                {moduleGroupList.map((mg) => <MenuItem key={mg.ModuleGroupId} value={mg.ModuleGroupId}>{mg.ModuleGroupName}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select label="Parent Module" value={moduleData.ParentModuleId || ''} onChange={this.handleField('ParentModuleId')}>
                <MenuItem value="">Select....</MenuItem>
                {moduleParentList.map ? moduleParentList.map((m) => <MenuItem key={m.ModuleId} value={m.ModuleId}>{m.ModuleName}</MenuItem>) : moduleParentList}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField label="Order By" type="number" required value={moduleData.Level ?? ''} onChange={this.handleField('Level')} error={!!formErrors.Level} helperText={formErrors.Level} inputProps={{ min: 0 }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField label="Module Type" value={moduleData.ModuleType || ''} onChange={this.handleField('ModuleType')} placeholder="Please enter module type" />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField label="Module Path" required value={moduleData.ModulePath || ''} onChange={this.handleField('ModulePath')} error={!!formErrors.ModulePath} helperText={formErrors.ModulePath} placeholder="Please enter module path" />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField label="Icon Type" required value={moduleData.IconType || ''} onChange={this.handleField('IconType')} error={!!formErrors.IconType} helperText={formErrors.IconType} placeholder="Please enter icon type" />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField label="Icon Path" required value={moduleData.IconPath || ''} onChange={this.handleField('IconPath')} error={!!formErrors.IconPath} helperText={formErrors.IconPath} placeholder="Please enter icon path" />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControlLabel control={<Switch checked={!!moduleData.IsExact} onChange={this.handleField('IsExact')} />} label="Is Exact" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField label="Remarks" multiline minRows={2} inputProps={{ maxLength: 4000 }} value={moduleData.Remarks || ''} onChange={this.handleField('Remarks')} placeholder="Please enter remarks" />
            </Grid>
          </Grid>
        </FormDialog>

        <ConfirmDialog open={confirmOpen} title="Delete module?" message="Are you sure you want to delete this record?" confirmText="Delete" onConfirm={this.confirmDelete} onCancel={this.cancelDelete} />
        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={this.closeSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <Alert onClose={this.closeSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%', borderRadius: '10px' }}>{snackbar.message}</Alert>
        </Snackbar>
      </PageContainer>
    );
  }
}

function ActionMenu({ record, onEdit, onDelete }) {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);
  const disabled = record.Status == '9';

  return (
    <>
      <Tooltip title="Actions">
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); setAnchorEl(e.currentTarget); }}
          sx={{
            color: '#9CA3AF',
            width: 32, height: 32,
            borderRadius: '8px',
            transition: 'all 0.15s ease',
            '&:hover': { bgcolor: '#F1F5F9', color: '#1E3A8A' },
          }}
        >
          <MoreIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        slotProps={{ paper: { sx: { minWidth: 160, p: 0.5 } } }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem dense disabled={disabled} onClick={() => { setAnchorEl(null); onEdit(record); }} sx={{ borderRadius: 1 }}>
          <ListItemIcon><EditIcon sx={{ fontSize: 16, color: '#059669' }} /></ListItemIcon>
          <ListItemText primary="Edit" primaryTypographyProps={{ fontSize: 13, fontWeight: 500 }} />
        </MenuItem>
        <MenuItem dense disabled={disabled} onClick={() => { setAnchorEl(null); onDelete(record); }} sx={{ borderRadius: 1 }}>
          <ListItemIcon><DeleteIcon sx={{ fontSize: 16, color: '#EF4444' }} /></ListItemIcon>
          <ListItemText primary="Delete" primaryTypographyProps={{ fontSize: 13, fontWeight: 500, color: disabled ? undefined : '#EF4444' }} />
        </MenuItem>
      </Menu>
    </>
  );
}

export default Module;
