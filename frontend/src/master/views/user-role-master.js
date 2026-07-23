/**
 * User Role Master — Premium enterprise SaaS redesign.
 *
 * All backend logic, APIs, CRUD, and routing are preserved exactly.
 * Only the UI/UX has been transformed.
 */
import moment from 'moment';
import React, { Component } from 'react';
import {
  TextField, MenuItem, Grid, Typography, Box, Snackbar, Alert,
  CircularProgress, Tooltip, Button as MuiButton, Menu, ListItemIcon, ListItemText,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import LoginState from '../../authentication/loginState';
import CommonUtilityController from '../controller/common-utility-controller';
import {
  PageContainer, PageHeader, EmptyState, AppDataGrid, FormDialog, ConfirmDialog,
  AppBreadcrumbs, GridToolbar,
} from '../../components/ui';

const emptyUserRole = { UserRoleId: 0, UserId: '', RoleId: '', Status: 0 };

class UserRole extends Component {
  constructor(props) {
    super(props);
    this.formRef = React.createRef();
    this.state = {
      data: [],
      userRoleData: { ...emptyUserRole },
      loading: false,
      visible: false,
      filteredTotal: null,
      userList: [],
      roleList: [],
      projectList: [],
      businessUnitList: [],
      businessLineList: [],
      confirmOpen: false,
      pendingDelete: null,
      formErrors: {},
      snackbar: { open: false, severity: 'success', message: '' },
      searchText: '',
      columnVisibility: {
        UserName: true,
        RoleName: true,
      },
      density: 'standard',
    };
  }

  componentDidMount() {
    this.getUserRoles(); this.getUsers(); this.getRoles(); this.getLookupDetails(); this.getProjects();
  }

  notify = (severity, message) => this.setState({ snackbar: { open: true, severity, message } });
  closeSnackbar = () => this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));

  async getUserRoles() {
    this.setState({ loading: true });
    await new CommonUtilityController().getUserRoles(0)
      .then((result) => { this.setState({ loading: false }); if (result != undefined) this.setState({ data: result }); })
      .catch((error) => { this.setState({ loading: false }); this.notify('error', error.toString()); });
  }

  async getUsers() {
    this.setState({ loading: true });
    await new CommonUtilityController().getUsers()
      .then((data) => { this.setState({ loading: false }); if (data != undefined) this.setState({ userList: data }); })
      .catch(() => { this.setState({ loading: false }); });
  }

  async getRoles() {
    this.setState({ loading: true });
    await new CommonUtilityController().getRoles(0)
      .then((data) => { this.setState({ loading: false }); if (data != undefined) this.setState({ roleList: data }); })
      .catch((error) => { this.setState({ loading: false }); this.notify('error', error.toString()); });
  }

  async getProjects() {
    this.setState({ loading: true });
    await new CommonUtilityController().getProjects({ UserId: LoginState.UserId })
      .then((data) => { this.setState({ loading: false }); if (data != undefined) this.setState({ projectList: data }); })
      .catch(() => { this.setState({ loading: false }); });
  }

  async getLookupDetails() {
    this.setState({ loading: true });
    await new CommonUtilityController().getLookupDetails(0)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) {
          this.setState({
            businessUnitList: data.filter((a) => a.LookupType === 'BusinessUnit'),
            businessLineList: data.filter((a) => a.LookupType === 'BusinessLine'),
          });
        }
      })
      .catch(() => { this.setState({ loading: false }); this.notify('error', 'Data fetching issue!!!'); });
  }

  newRecord = () => this.setState({ visible: true, formErrors: {}, userRoleData: { ...emptyUserRole } });
  editRecord = (r) => this.setState({ visible: true, formErrors: {}, userRoleData: { ...r, BusinessUnitIds: r.BusinessUnitIds || [], BusinessLineIds: r.BusinessLineIds || [], ProjectIds: r.ProjectIds || [] } });
  requestDelete = (r) => this.setState({ confirmOpen: true, pendingDelete: r });
  cancelDelete = () => this.setState({ confirmOpen: false, pendingDelete: null });
  confirmDelete = () => { const r = this.state.pendingDelete; this.setState({ confirmOpen: false, pendingDelete: null }); if (r) this.deleteRecord(r); };
  toggleModal = () => this.setState({ visible: !this.state.visible });

  deleteRecord = async (userRole) => {
    userRole.CreatedBy = LoginState.UserId; userRole.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    this.setState({ loading: true });
    await new CommonUtilityController().deleteUserRoleDetails(userRole)
      .then((data) => { this.setState({ loading: false }); if (data != undefined) this.setState({ data }); this.notify('success', 'Data successfully deleted.'); })
      .catch(() => { this.setState({ loading: false }); this.notify('error', 'Data deletion issue!'); });
  };

  handleField = (field) => (e) => {
    const value = e?.target ? e.target.value : e;
    this.setState((s) => ({ userRoleData: { ...s.userRoleData, [field]: value }, formErrors: { ...s.formErrors, [field]: undefined } }));
  };

  handleMultiField = (field) => (e) => {
    const value = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
    this.setState((s) => ({ userRoleData: { ...s.userRoleData, [field]: value } }));
  };

  validateForm = () => {
    const { userRoleData: d } = this.state;
    const errors = {};
    if (!d.UserId) errors.UserId = 'User is required';
    if (!d.RoleId) errors.RoleId = 'Role is required';
    this.setState({ formErrors: errors });
    return Object.keys(errors).length === 0;
  };

  onFormSubmit = (e) => { if (e?.preventDefault) e.preventDefault(); if (!this.validateForm()) return; this.handleSubmit({ ...this.state.userRoleData }); };

  handleSubmit = async (userRole) => {
    userRole.CreatedBy = LoginState.UserId; userRole.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    userRole.LockedBy = LoginState.LockedBy; userRole.LockedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    userRole.SecurityId = LoginState.SecurityId; userRole.Status = 1;
    this.setState({ loading: true });
    await new CommonUtilityController().saveUserRoleDetails(userRole)
      .then((data) => { this.setState({ loading: false }); if (data != undefined) this.setState({ data, visible: false }); this.notify('success', 'Data successfully Inserted.'); })
      .catch(() => { this.setState({ loading: false }); this.notify('error', 'Data insertion issue!'); });
  };

  // ─── Search & filter ──────────────────────────────────
  getFilteredData() {
    const { data, searchText } = this.state;
    if (!searchText) return data;
    const q = searchText.toLowerCase();
    return data.filter(r =>
      (r.UserName || '').toLowerCase().includes(q) ||
      (r.RoleName || '').toLowerCase().includes(q)
    );
  }

  // ─── Export ────────────────────────────────────────────
  handleExport = () => {
    const filtered = this.getFilteredData();
    const headers = ['User Name', 'Role Name'];
    const rows = filtered.map(r => [r.UserName, r.RoleName]);
    const csv = [headers, ...rows].map(row => row.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'user-roles.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  handleRefresh = () => {
    this.getUserRoles();
  }

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
        field: 'UserName',
        headerName: 'User Name',
        flex: 1.4,
        minWidth: 180,
        renderCell: (params) => (
          <Typography sx={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
            {params.value || '—'}
          </Typography>
        ),
      },
      {
        field: 'RoleName',
        headerName: 'Role Name',
        flex: 1.4,
        minWidth: 180,
        renderCell: (params) => (
          <Typography sx={{ fontSize: 13, color: '#374151' }}>
            {params.value || '—'}
          </Typography>
        ),
      },
    ];

    return cols.filter(c => c.field === 'action' || columnVisibility[c.field] !== false);
  }

  render() {
    const { data, loading, visible, userRoleData, userList, roleList, projectList, businessUnitList, businessLineList, confirmOpen, formErrors, snackbar, searchText, columnVisibility, density } = this.state;
    const filteredData = this.getFilteredData();
    const count = filteredData.length;

    return (
      <PageContainer>

        <AppBreadcrumbs />

        <PageHeader
          title="User Role"
          subtitle="Manage user role assignments"
          actions={
            <MuiButton
              variant="contained"
              startIcon={<AddIcon />}
              onClick={this.newRecord}
              sx={{ borderRadius: '10px', px: 3, py: 1.25 }}
            >
              New User Role
            </MuiButton>
          }
        />

        {loading && data.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <CircularProgress />
          </Box>
        ) : !loading && data.length === 0 ? (
          <EmptyState
            icon={<AssignmentIcon sx={{ fontSize: 40 }} />}
            title="No User Roles Found"
            description="Get started by creating your first user role assignment."
            primaryAction={
              <MuiButton variant="contained" startIcon={<AddIcon />} onClick={this.newRecord} sx={{ borderRadius: '10px', px: 3 }}>
                Create User Role
              </MuiButton>
            }
          />
        ) : (
          <Box>
            <GridToolbar
              searchValue={searchText}
              onSearchChange={(val) => this.setState({ searchText: val })}
              searchPlaceholder="Search user roles..."
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
              getRowId={(row) => row.UserRoleId}
              density={density}
              height={Math.min(56 + count * 56 + 56, 720)}
              pageSize={10}
            />
          </Box>
        )}

        <FormDialog open={visible} onClose={this.toggleModal} title="User Role Details" maxWidth="sm"
          actions={
            <>
              <MuiButton variant="text" color="inherit" onClick={this.toggleModal} sx={{ borderRadius: '10px' }}>
                Cancel
              </MuiButton>
              <MuiButton variant="contained" color="primary" onClick={this.onFormSubmit} sx={{ borderRadius: '10px', px: 3 }}>
                Submit
              </MuiButton>
            </>
          }
        >
          <Grid container spacing={2.5} sx={{ pt: 0.5 }}>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth size="small" select label="User" required value={userRoleData.UserId || ''} onChange={this.handleField('UserId')} error={!!formErrors.UserId} helperText={formErrors.UserId}>
                <MenuItem value="">Select....</MenuItem>
                {userList.map((u) => <MenuItem key={u.UserId} value={u.UserId}>{u.EmployeeName}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth size="small" select label="Role" required value={userRoleData.RoleId || ''} onChange={this.handleField('RoleId')} error={!!formErrors.RoleId} helperText={formErrors.RoleId}>
                <MenuItem value="">Select....</MenuItem>
                {roleList.map((r) => <MenuItem key={r.RoleId} value={r.RoleId}>{r.RoleName}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth size="small" select label="Business Unit" SelectProps={{ multiple: true }}
                value={userRoleData.BusinessUnitIds || []}
                onChange={this.handleMultiField('BusinessUnitIds')}>
                {businessUnitList.map((b) => <MenuItem key={b.LookupId} value={b.LookupName}>{b.LookupName}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth size="small" select label="Business Line" SelectProps={{ multiple: true }}
                value={userRoleData.BusinessLineIds || []}
                onChange={this.handleMultiField('BusinessLineIds')}>
                {businessLineList.map((b) => <MenuItem key={b.LookupId} value={b.LookupName}>{b.LookupName}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth size="small" select label="Project" SelectProps={{ multiple: true }}
                value={userRoleData.ProjectIds || []}
                onChange={this.handleMultiField('ProjectIds')}>
                {projectList.map((p) => <MenuItem key={p.ProjectMasterId} value={p.ProjectMasterId}>{p.ProjectName}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>
        </FormDialog>

        <ConfirmDialog open={confirmOpen} title="Delete user role?" message="Are you sure you want to delete this record?" confirmText="Delete" onConfirm={this.confirmDelete} onCancel={this.cancelDelete} />

        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={this.closeSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <Alert onClose={this.closeSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%', borderRadius: '10px' }}>{snackbar.message}</Alert>
        </Snackbar>
      </PageContainer>
    );
  }
}

// ─── Action Menu Component (⋮ button) ────────────────────
function ActionMenu({ record, onEdit, onDelete }) {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);
  const disabled = record.Status == '9';

  return (
    <>
      <Tooltip title="Actions">
        <Box
          component="span"
          onClick={(e) => { e.stopPropagation(); setAnchorEl(e.currentTarget); }}
          sx={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: '#9CA3AF', width: 32, height: 32, borderRadius: '8px', cursor: 'pointer',
            transition: 'all 0.15s ease',
            '&:hover': { bgcolor: '#F1F5F9', color: '#1E3A8A' },
          }}
        >
          <MoreIcon sx={{ fontSize: 18 }} />
        </Box>
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

export default UserRole;
