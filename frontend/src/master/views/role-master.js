import moment from 'moment';
import React, { Component } from 'react';
import {
  TextField, MenuItem, Grid, Box, Typography,
  Snackbar, Alert, Button as MuiButton,
  Menu, ListItemIcon, ListItemText, Tooltip, IconButton,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreIcon,
  AdminPanelSettings as RoleIcon,
} from '@mui/icons-material';
import LoginState from '../../authentication/loginState';
import CommonUtilityController from '../controller/common-utility-controller';
import { fillSelectList } from '../../helper/common-utility';
import {
  PageContainer, PageHeader, AppDataGrid, FormDialog, ConfirmDialog,
  AppBreadcrumbs, GridToolbar,
} from '../../components/ui';

const emptyRole = { RoleId: 0, RoleCode: '', RoleName: '', ParentRoleId: '', Level: '', Remarks: '', Status: 0 };

class Role extends Component {
  constructor(props) {
    super(props);
    this.formRef = React.createRef();
    this.state = {
      data: [],
      roleData: { ...emptyRole },
      loading: false,
      visible: false,
      filteredTotal: null,
      confirmOpen: false,
      pendingDelete: null,
      formErrors: {},
      snackbar: { open: false, severity: 'success', message: '' },
      searchText: '',
      density: 'standard',
      columnVisibility: {
        RoleCode: true,
        RoleName: true,
        ParentRoleName: true,
        Remarks: true,
      },
    };
  }

  componentDidMount() { this.getRoles(); }

  notify = (severity, message) => this.setState({ snackbar: { open: true, severity, message } });
  closeSnackbar = () => this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));

  async getRoles() {
    this.setState({ loading: true });
    await new CommonUtilityController().getRoles(0)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) this.setState({ data, roleParentList: fillSelectList(data, 'RoleName', 'RoleId') });
      })
      .catch((error) => { this.setState({ loading: false }); this.notify('error', error.toString()); });
  }

  newRecord = () => this.setState({ visible: true, formErrors: {}, roleData: { ...emptyRole } });
  editRecord = (role) => {
    if (role.ParentRoleId == 0 || role.ParentRoleId == null) role.ParentRoleId = '';
    this.setState({ visible: true, formErrors: {}, roleData: { ...role } });
  };
  requestDelete = (r) => this.setState({ confirmOpen: true, pendingDelete: r });
  cancelDelete = () => this.setState({ confirmOpen: false, pendingDelete: null });
  confirmDelete = () => { const r = this.state.pendingDelete; this.setState({ confirmOpen: false, pendingDelete: null }); if (r) this.deleteRecord(r); };
  toggleModal = () => this.setState({ visible: !this.state.visible });

  deleteRecord = async (role) => {
    role.CreatedBy = LoginState.UserId;
    role.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    this.setState({ loading: true });
    await new CommonUtilityController().deleteRoles(role)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) this.setState({ data, roleParentList: fillSelectList(data, 'RoleName', 'RoleId') });
        this.notify('success', 'Data successfully deleted.');
      })
      .catch(() => { this.setState({ loading: false }); this.notify('error', 'Data deletion issue!'); });
  };

  handleField = (field) => (e) => {
    const value = e?.target ? e.target.value : e;
    this.setState((s) => ({ roleData: { ...s.roleData, [field]: value }, formErrors: { ...s.formErrors, [field]: undefined } }));
  };

  validateForm = () => {
    const { roleData: d } = this.state;
    const errors = {};
    if (!String(d.RoleCode || '').trim()) errors.RoleCode = 'Role Code is required';
    if (!String(d.RoleName || '').trim()) errors.RoleName = 'Role Name is required';
    this.setState({ formErrors: errors });
    return Object.keys(errors).length === 0;
  };

  onFormSubmit = (e) => { if (e?.preventDefault) e.preventDefault(); if (!this.validateForm()) return; this.handleSubmit({ ...this.state.roleData }); };

  handleSubmit = async (role) => {
    if (role.ParentRoleId == '') role.ParentRoleId = '0';
    let isexist = false;
    this.setState({ loading: true });
    await new CommonUtilityController().isRecordExists({ Record: role, TableName: 'Role' })
      .then((result) => { this.setState({ loading: false }); if (result?.status == 1) { isexist = true; this.notify('error', 'Record already exists'); } })
      .catch(() => { isexist = true; this.setState({ loading: false }); this.notify('error', 'Error found while validating the Record'); });
    if (isexist) return;

    role.CreatedBy = LoginState.UserId;
    role.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    role.LockedBy = LoginState.LockedBy;
    role.LockedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    role.SecurityId = LoginState.SecurityId;
    role.Status = 1;
    this.setState({ loading: true });
    await new CommonUtilityController().saveRoles(role)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) this.setState({ data, roleParentList: fillSelectList(data, 'RoleName', 'RoleId'), visible: false });
        this.notify('success', 'Data successfully Inserted.');
      })
      .catch(() => { this.setState({ loading: false }); this.notify('error', 'Data insertion issue!'); });
  };

  getFilteredData() {
    const { data, searchText } = this.state;
    if (!searchText) return data;
    const q = searchText.toLowerCase();
    return data.filter((r) =>
      (r.RoleCode || '').toLowerCase().includes(q) ||
      (r.RoleName || '').toLowerCase().includes(q) ||
      (r.ParentRoleName || '').toLowerCase().includes(q)
    );
  }

  handleExport = () => {
    const filtered = this.getFilteredData();
    const headers = ['Role Code', 'Role Name', 'Parent Role', 'Remarks'];
    const rows = filtered.map((r) => [r.RoleCode, r.RoleName, r.ParentRoleName, r.Remarks]);
    const csv = [headers, ...rows].map((row) => row.map((c) => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'roles.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  handleRefresh = () => {
    this.getRoles();
  }

  get gridColumns() {
    const { columnVisibility } = this.state;
    const cols = [
      {
        field: 'action', headerName: '', width: 56, sortable: false, filterable: false, disableColumnMenu: true,
        renderCell: (params) => <ActionMenu record={params.row} onEdit={this.editRecord} onDelete={this.requestDelete} />,
      },
      {
        field: 'RoleCode', headerName: 'Role Code', flex: 1, minWidth: 130,
        renderCell: (params) => (
          <Typography sx={{ fontSize: 13, color: '#374151' }}>{params.value || '—'}</Typography>
        ),
      },
      {
        field: 'RoleName', headerName: 'Role Name', flex: 1.4, minWidth: 180,
        renderCell: (params) => (
          <Typography sx={{ fontSize: 13, color: '#374151' }}>{params.value || '—'}</Typography>
        ),
      },
      {
        field: 'ParentRoleName', headerName: 'Parent Role', flex: 1.2, minWidth: 160,
        renderCell: (params) => (
          <Typography sx={{ fontSize: 13, color: '#374151' }}>{params.value || '—'}</Typography>
        ),
      },
      {
        field: 'Remarks', headerName: 'Remarks', flex: 1.4, minWidth: 180,
        renderCell: (params) => (
          <Typography sx={{ fontSize: 13, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {params.value || '—'}
          </Typography>
        ),
      },
    ];
    return cols.filter((c) => c.field === 'action' || columnVisibility[c.field] !== false);
  }

  render() {
    const { data, loading, visible, roleData, confirmOpen, formErrors, snackbar, searchText, density, columnVisibility } = this.state;
    const filteredData = this.getFilteredData();
    const count = filteredData.length;

    return (
      <PageContainer>
        <AppBreadcrumbs />

        <PageHeader title="Role" subtitle="Manage roles and their hierarchy"
          actions={
            <MuiButton variant="contained" startIcon={<AddIcon />} onClick={this.newRecord} sx={{ borderRadius: '10px', px: 3, py: 1.25 }}>
              New Role
            </MuiButton>
          }
        />

        <Box>
          <GridToolbar
            searchValue={searchText}
            onSearchChange={(val) => this.setState({ searchText: val })}
            searchPlaceholder="Search roles..."
            onRefresh={this.handleRefresh}
            onExport={this.handleExport}
            columnVisibility={columnVisibility}
            onColumnToggle={(field) => this.setState((prev) => ({
              columnVisibility: { ...prev.columnVisibility, [field]: !prev.columnVisibility[field] },
            }))}
            density={density}
            onDensityChange={(d) => this.setState({ density: d })}
          />
          <AppDataGrid
            rows={filteredData}
            columns={this.gridColumns}
            loading={loading}
            getRowId={(row) => row.RoleId}
            density={density}
            height={Math.min(56 + count * 56 + 56, 720)}
            pageSize={10}
            emptyTitle="No roles yet"
            emptyDescription="Create your first role."
            emptyIcon={<RoleIcon sx={{ fontSize: 40 }} />}
            emptyAction={
              <MuiButton variant="contained" startIcon={<AddIcon />} onClick={this.newRecord} sx={{ borderRadius: '10px', px: 3 }}>
                Create Role
              </MuiButton>
            }
          />
        </Box>

        <FormDialog open={visible} onClose={this.toggleModal} title="Role Details"
          actions={null}
        >
          <Box component="form" onSubmit={this.onFormSubmit}>
            <Grid container spacing={2.5} sx={{ pt: 0.5 }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="Role Code" required value={roleData.RoleCode || ''} onChange={this.handleField('RoleCode')} error={!!formErrors.RoleCode} helperText={formErrors.RoleCode} placeholder="Please enter role code" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="Role Name" required value={roleData.RoleName || ''} onChange={this.handleField('RoleName')} error={!!formErrors.RoleName} helperText={formErrors.RoleName} placeholder="Please enter role name" />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField select label="Parent Role" value={roleData.ParentRoleId || ''} onChange={this.handleField('ParentRoleId')}>
                  <MenuItem value="">Select....</MenuItem>
                  {data.map((d) => <MenuItem key={d.RoleId} value={d.RoleId}>{d.RoleName}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField label="Remarks" multiline minRows={2} inputProps={{ maxLength: 4000 }} value={roleData.Remarks || ''} onChange={this.handleField('Remarks')} placeholder="Please enter remarks" />
              </Grid>
            </Grid>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, pt: 2, mt: 3, borderTop: '1px solid #F3F4F6' }}>
              <MuiButton variant="text" color="inherit" onClick={this.toggleModal} sx={{ borderRadius: '10px' }}>
                Cancel
              </MuiButton>
              <MuiButton variant="contained" color="primary" type="submit" sx={{ borderRadius: '10px', px: 3 }}>
                Submit
              </MuiButton>
            </Box>
          </Box>
        </FormDialog>

        <ConfirmDialog open={confirmOpen} title="Delete role?" message="Are you sure you want to delete this record?" confirmText="Delete" onConfirm={this.confirmDelete} onCancel={this.cancelDelete} />

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

export default Role;
