import moment from 'moment';
import React, { Component } from 'react';
import {
  TextField, MenuItem, Grid, Box, CircularProgress,
  Snackbar, Alert, Tooltip, IconButton, Typography, Button as MuiButton,
  Menu, ListItemIcon, ListItemText,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreIcon,
  Category as CategoryIcon,
} from '@mui/icons-material';
import LoginState from '../../authentication/loginState';
import CommonUtilityController from '../controller/common-utility-controller';
import { fillSelectList } from '../../helper/common-utility';
import { PageContainer, PageHeader, EmptyState, AppDataGrid, FormDialog, ConfirmDialog, AppBreadcrumbs, GridToolbar } from '../../components/ui';

const emptyModuleGroup = { ModuleGroupId: 0, ModuleGroupCode: '', ModuleGroupName: '', ParentModuleGroupId: '', Level: '', Remarks: '', Status: 0 };

class ModuleGroup extends Component {
  constructor(props) {
    super(props);
    this.formRef = React.createRef();
    this.state = {
      data: [],
      moduleGroupData: { ...emptyModuleGroup },
      loading: false,
      filteredTotal: null,
      visible: false,
      confirmOpen: false,
      pendingDelete: null,
      formErrors: {},
      snackbar: { open: false, severity: 'success', message: '' },
      searchText: '',
      columnVisibility: {
        ModuleGroupCode: true,
        ModuleGroupName: true,
        ParentModuleGroupName: true,
        Level: true,
        Remarks: true,
      },
      density: 'standard',
    };
  }

  componentDidMount() { this.getModuleGroups(); }

  notify = (severity, message) => this.setState({ snackbar: { open: true, severity, message } });
  closeSnackbar = () => this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));

  async getModuleGroups() {
    this.setState({ loading: true });
    await new CommonUtilityController().getModuleGroups(0)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) this.setState({ data, moduleGroupParentList: fillSelectList(data, 'ModuleGroupName', 'ModuleGroupId') });
      })
      .catch((error) => { this.setState({ loading: false }); this.notify('error', error.toString()); });
  }

  newRecord = () => this.setState({ visible: true, formErrors: {}, moduleGroupData: { ...emptyModuleGroup } });
  editRecord = (r) => {
    if (r.ParentModuleGroupId == 0 || r.ParentModuleGroupId == null) r.ParentModuleGroupId = '';
    this.setState({ visible: true, formErrors: {}, moduleGroupData: { ...r } });
  };
  requestDelete = (r) => this.setState({ confirmOpen: true, pendingDelete: r });
  cancelDelete = () => this.setState({ confirmOpen: false, pendingDelete: null });
  confirmDelete = () => { const r = this.state.pendingDelete; this.setState({ confirmOpen: false, pendingDelete: null }); if (r) this.deleteRecord(r); };
  toggleModal = () => this.setState({ visible: !this.state.visible });

  deleteRecord = async (modgr) => {
    modgr.CreatedBy = LoginState.UserId;
    modgr.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    this.setState({ loading: true });
    await new CommonUtilityController().deleteModuleGroupDetails(modgr)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) this.setState({ data, moduleGroupParentList: fillSelectList(data, 'ModuleGroupName', 'ModuleGroupId') });
        this.notify('success', 'Data successfully deleted.');
      })
      .catch(() => { this.setState({ loading: false }); this.notify('error', 'Data deletion issue!'); });
  };

  handleField = (field) => (e) => {
    const value = e?.target ? e.target.value : e;
    this.setState((s) => ({ moduleGroupData: { ...s.moduleGroupData, [field]: value }, formErrors: { ...s.formErrors, [field]: undefined } }));
  };

  validateForm = () => {
    const { moduleGroupData: d } = this.state;
    const errors = {};
    if (!String(d.ModuleGroupCode || '').trim()) errors.ModuleGroupCode = 'Module Group Code is required';
    if (!String(d.ModuleGroupName || '').trim()) errors.ModuleGroupName = 'Module Group Name is required';
    if (d.Level === '' || d.Level === null || d.Level === undefined) errors.Level = 'Order By is required';
    this.setState({ formErrors: errors });
    return Object.keys(errors).length === 0;
  };

  onFormSubmit = (e) => { if (e?.preventDefault) e.preventDefault(); if (!this.validateForm()) return; this.handleSubmit({ ...this.state.moduleGroupData }); };

  handleSubmit = async (modgr) => {
    if (modgr.ParentModuleGroupId == '') modgr.ParentModuleGroupId = '0';
    let isexist = false;
    this.setState({ loading: true });
    await new CommonUtilityController().isRecordExists({ Record: modgr, TableName: 'ModuleGroup' })
      .then((result) => { this.setState({ loading: false }); if (result?.status == 1) { isexist = true; this.notify('error', 'Record already exists'); } })
      .catch(() => { isexist = true; this.setState({ loading: false }); this.notify('error', 'Error found while validating the Record'); });
    if (isexist) return;
    modgr.CreatedBy = LoginState.UserId; modgr.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    modgr.LockedBy = LoginState.LockedBy; modgr.LockedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    modgr.SecurityId = LoginState.SecurityId; modgr.Status = 1;
    this.setState({ loading: true });
    await new CommonUtilityController().saveModuleGroupDetails(modgr)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) this.setState({ data, moduleGroupParentList: fillSelectList(data, 'ModuleGroupName', 'ModuleGroupId'), visible: false });
        this.notify('success', 'Data successfully Inserted.');
      })
      .catch(() => { this.setState({ loading: false }); this.notify('error', 'Data insertion issue!'); });
  };

  getFilteredData() {
    const { data, searchText } = this.state;
    if (!searchText) return data;
    const q = searchText.toLowerCase();
    return data.filter(r =>
      (r.ModuleGroupCode || '').toLowerCase().includes(q) ||
      (r.ModuleGroupName || '').toLowerCase().includes(q) ||
      (r.ParentModuleGroupName || '').toLowerCase().includes(q)
    );
  }

  handleExport = () => {
    const filtered = this.getFilteredData();
    const headers = ['Module Group Code', 'Module Group Name', 'Parent Module Group', 'Order By', 'Remarks'];
    const rows = filtered.map(r => [r.ModuleGroupCode, r.ModuleGroupName, r.ParentModuleGroupName, r.Level, r.Remarks]);
    const csv = [headers, ...rows].map(row => row.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'module-groups.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  handleRefresh = () => { this.getModuleGroups(); };

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
        field: 'ModuleGroupCode',
        headerName: 'Module Group Code',
        flex: 1,
        minWidth: 160,
        renderCell: (params) => (
          <Typography sx={{ fontSize: 13, color: '#374151' }}>{params.value || '\u2014'}</Typography>
        ),
      },
      {
        field: 'ModuleGroupName',
        headerName: 'Module Group Name',
        flex: 1.4,
        minWidth: 190,
        renderCell: (params) => (
          <Typography sx={{ fontSize: 13, color: '#374151' }}>{params.value || '\u2014'}</Typography>
        ),
      },
      {
        field: 'ParentModuleGroupName',
        headerName: 'Parent Module Group',
        flex: 1.2,
        minWidth: 180,
        renderCell: (params) => (
          <Typography sx={{ fontSize: 13, color: '#374151' }}>{params.value || '\u2014'}</Typography>
        ),
      },
      {
        field: 'Level',
        headerName: 'Order By',
        width: 110,
        type: 'number',
        align: 'right',
        headerAlign: 'right',
        renderCell: (params) => (
          <Typography sx={{ fontSize: 13, color: '#374151' }}>{params.value != null ? params.value : '\u2014'}</Typography>
        ),
      },
      {
        field: 'Remarks',
        headerName: 'Remarks',
        flex: 1.2,
        minWidth: 150,
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
    const { data, loading, visible, moduleGroupData, confirmOpen, formErrors, snackbar, searchText, density, columnVisibility } = this.state;
    const filteredData = this.getFilteredData();
    const count = filteredData.length;

    return (
      <PageContainer>
        <AppBreadcrumbs />
        <PageHeader
          title="Module Group"
          subtitle="Manage module groups and their hierarchy"
          actions={
            <MuiButton variant="contained" startIcon={<AddIcon />} onClick={this.newRecord} sx={{ borderRadius: '10px', px: 3, py: 1.25 }}>
              New Module Group
            </MuiButton>
          }
        />

        {loading && data.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress /></Box>
        ) : !loading && data.length === 0 ? (
          <EmptyState
            icon={<CategoryIcon sx={{ fontSize: 40 }} />}
            title="No Module Groups Found"
            description="Get started by creating your first module group."
            primaryAction={
              <MuiButton variant="contained" startIcon={<AddIcon />} onClick={this.newRecord} sx={{ borderRadius: '10px', px: 3 }}>
                Create Module Group
              </MuiButton>
            }
          />
        ) : (
          <Box>
            <GridToolbar
              searchValue={searchText}
              onSearchChange={(val) => this.setState({ searchText: val })}
              searchPlaceholder="Search module groups..."
              onRefresh={this.handleRefresh}
              onExport={this.handleExport}
              columnVisibility={columnVisibility}
              onColumnToggle={(field) => this.setState(prev => ({
                columnVisibility: { ...prev.columnVisibility, [field]: !prev.columnVisibility[field] },
              }))}
              density={density}
              onDensityChange={(d) => this.setState({ density: d })}
            />
            <AppDataGrid
              rows={filteredData}
              columns={this.gridColumns}
              loading={loading}
              getRowId={(row) => row.ModuleGroupId}
              density={density}
              height={Math.min(56 + count * 56 + 56, 720)}
              pageSize={10}
            />
          </Box>
        )}

        <FormDialog open={visible} onClose={this.toggleModal} title="Module Group Details"
          actions={
            <>
              <MuiButton variant="text" color="inherit" onClick={this.toggleModal} sx={{ borderRadius: '10px' }}>Cancel</MuiButton>
              <MuiButton variant="contained" color="primary" onClick={this.onFormSubmit} sx={{ borderRadius: '10px', px: 3 }}>Submit</MuiButton>
            </>
          }
        >
          <Grid container spacing={2.5} sx={{ pt: 0.5 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Module Group Code" required value={moduleGroupData.ModuleGroupCode || ''} onChange={this.handleField('ModuleGroupCode')} error={!!formErrors.ModuleGroupCode} helperText={formErrors.ModuleGroupCode} placeholder="Please enter module group code" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Module Group Name" required value={moduleGroupData.ModuleGroupName || ''} onChange={this.handleField('ModuleGroupName')} error={!!formErrors.ModuleGroupName} helperText={formErrors.ModuleGroupName} placeholder="Please enter module group name" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField select label="Parent Module Group" value={moduleGroupData.ParentModuleGroupId || ''} onChange={this.handleField('ParentModuleGroupId')}>
                <MenuItem value="">Select....</MenuItem>
                {data.map((d) => <MenuItem key={d.ModuleGroupId} value={d.ModuleGroupId}>{d.ModuleGroupName}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Order By" type="number" required value={moduleGroupData.Level ?? ''} onChange={this.handleField('Level')} error={!!formErrors.Level} helperText={formErrors.Level} inputProps={{ min: 0 }} placeholder="Please enter number" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField label="Remarks" multiline minRows={2} inputProps={{ maxLength: 4000 }} value={moduleGroupData.Remarks || ''} onChange={this.handleField('Remarks')} placeholder="Please enter remarks" />
            </Grid>
          </Grid>
        </FormDialog>
        <ConfirmDialog open={confirmOpen} title="Delete module group?" message="Are you sure you want to delete this record?" confirmText="Delete" onConfirm={this.confirmDelete} onCancel={this.cancelDelete} />
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

export default ModuleGroup;
