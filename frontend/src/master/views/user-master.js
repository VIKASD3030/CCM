/**
 * User Master — Premium enterprise SaaS redesign.
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
  Person as PersonIcon,
} from '@mui/icons-material';
import LoginState from '../../authentication/loginState';
import CommonUtilityController from '../controller/common-utility-controller';
import { fillSelectList } from '../../helper/common-utility';
import {
  PageContainer, PageHeader, EmptyState, AppDataGrid, FormDialog, ConfirmDialog,
  AppBreadcrumbs, GridToolbar,
} from '../../components/ui';

const USER_TYPES = ['Admin', 'User', 'Viewer'];

const emptyUser = {
  Id: 0, UserId: '0', UserName: '', AdUserName: '', EmployeeNo: '', EmployeeName: '',
  DesignationId: '', DepartmentId: '', UserType: '', EmailId: '', MobileNo: '', ModuleGroupId: '', Status: 0,
};

class User extends Component {
  constructor(props) {
    super(props);
    this.formUserRef = React.createRef();
    this.state = {
      data: [],
      userData: { ...emptyUser },
      loading: false,
      visible: false,
      filteredTotal: null,
      designationList: [],
      departmentList: [],
      moduleGroupList: [],
      confirmOpen: false,
      pendingDelete: null,
      formErrors: {},
      baseUrl: window.location.origin,
      snackbar: { open: false, severity: 'success', message: '' },
      searchText: '',
      columnVisibility: {
        UserId: true,
        UserName: true,
        AdUserName: true,
        EmployeeNo: true,
        EmployeeName: true,
        DesignationName: true,
        DepartmentName: true,
        UserType: true,
        EmailId: true,
        MobileNo: true,
      },
      density: 'standard',
    };
  }

  componentDidMount() {
    this.getUsers(); this.getDesignations(); this.getDepartments(); this.getModuleGroups();
  }

  notify = (severity, message) => this.setState({ snackbar: { open: true, severity, message } });
  closeSnackbar = () => this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));

  async getUsers() {
    this.setState({ loading: true });
    await new CommonUtilityController().getUsers({ designationId: 0, departmentId: 0 })
      .then((data) => { this.setState({ loading: false }); if (data != undefined) this.setState({ data }); })
      .catch((error) => { this.setState({ loading: false }); this.notify('error', error.toString()); });
  }

  async getDesignations() {
    this.setState({ loading: true });
    await new CommonUtilityController().getDesignations()
      .then((data) => { this.setState({ loading: false }); if (data != undefined) this.setState({ designationList: data }); })
      .catch((error) => { this.setState({ loading: false }); this.notify('error', error.toString()); });
  }

  async getDepartments() {
    this.setState({ loading: true });
    await new CommonUtilityController().getDepartments(0)
      .then((data) => { this.setState({ loading: false }); if (data != undefined) this.setState({ departmentList: data }); })
      .catch((error) => { this.setState({ loading: false }); this.notify('error', error.toString()); });
  }

  async getModuleGroups() {
    this.setState({ loading: true });
    await new CommonUtilityController().getModuleGroups(0)
      .then((data) => { this.setState({ loading: false }); if (data != undefined) this.setState({ moduleGroupList: data }); })
      .catch((error) => { this.setState({ loading: false }); this.notify('error', error.toString()); });
  }

  newRecord = () => this.setState({ visible: true, formErrors: {}, userData: { ...emptyUser } });
  editRecord = (user) => this.setState({ visible: true, formErrors: {}, userData: { ...user } });
  requestDelete = (r) => this.setState({ confirmOpen: true, pendingDelete: r });
  cancelDelete = () => this.setState({ confirmOpen: false, pendingDelete: null });
  confirmDelete = () => { const r = this.state.pendingDelete; this.setState({ confirmOpen: false, pendingDelete: null }); if (r) this.deleteRecord(r); };
  toggleModal = () => this.setState({ visible: !this.state.visible });

  deleteRecord = async (user) => {
    user.CreatedBy = LoginState.UserId; user.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    this.setState({ loading: true });
    await new CommonUtilityController().deleteUserDetails(user)
      .then((data) => { this.setState({ loading: false }); if (data != undefined) this.setState({ data }); this.notify('success', 'Data successfully deleted.'); })
      .catch(() => { this.setState({ loading: false }); this.notify('error', 'Data deletion issue!'); });
  };

  handleField = (field) => (e) => {
    const value = e?.target ? e.target.value : e;
    this.setState((s) => ({ userData: { ...s.userData, [field]: value }, formErrors: { ...s.formErrors, [field]: undefined } }));
  };

  validateForm = () => {
    const { userData: d } = this.state;
    const errors = {};
    if (!String(d.EmployeeName || '').trim()) errors.EmployeeName = 'Employee Name is required';
    if (!String(d.EmailId || '').trim()) errors.EmailId = 'Email Id is required';
    if (!String(d.UserType || '').trim()) errors.UserType = 'User Type is required';
    this.setState({ formErrors: errors });
    return Object.keys(errors).length === 0;
  };

  onFormSubmit = (e) => { if (e?.preventDefault) e.preventDefault(); if (!this.validateForm()) return; this.handleSubmit({ ...this.state.userData }); };

  handleSubmit = async (user) => {
    if (user.MobileNo == '') user.MobileNo = null;
    let isexist = false;
    this.setState({ loading: true });
    await new CommonUtilityController().isRecordExists({ Record: user, TableName: 'Users' })
      .then((result) => { this.setState({ loading: false }); if (result?.status == 1) { isexist = true; this.notify('error', 'Record already exists'); } })
      .catch(() => { isexist = true; this.setState({ loading: false }); this.notify('error', 'Error found while validating the Record'); });
    if (isexist) return;

    user.CreatedBy = LoginState.UserId; user.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    user.LastUpdatedBy = LoginState.LastUpdatedBy; user.LastUpdatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    user.SecurityId = LoginState.SecurityId; user.Status = 1; user.ModuleGroupId = 0;
    const { data, baseUrl } = this.state;
    const sender = data.filter((a) => a.UserId == LoginState.UserId);
    const emailModel = {
      from: sender[0]?.EmailId, to: user?.EmailId, subject: 'User Detail',
      cc: sender[0]?.EmailId, text: '', html: '',
      senderName: sender[0]?.EmployeeName, recieverName: user?.EmployeeName, url: baseUrl,
    };
    this.setState({ loading: true });
    await new CommonUtilityController().saveUserDetails({ User: user, EmailModel: emailModel })
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
      (r.AdUserName || '').toLowerCase().includes(q) ||
      (r.EmployeeName || '').toLowerCase().includes(q) ||
      (r.EmailId || '').toLowerCase().includes(q)
    );
  }

  // ─── Export ────────────────────────────────────────────
  handleExport = () => {
    const filtered = this.getFilteredData();
    const headers = ['UserId', 'User Name', 'AD User Name', 'Employee No', 'Employee Name', 'Designation', 'Department', 'User Type', 'Email Id', 'Mobile No'];
    const rows = filtered.map(r => [
      r.UserId, r.UserName, r.AdUserName, r.EmployeeNo, r.EmployeeName,
      r.DesignationName, r.DepartmentName, r.UserType, r.EmailId, r.MobileNo,
    ]);
    const csv = [headers, ...rows].map(row => row.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'users.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  handleRefresh = () => {
    this.getUsers();
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
        field: 'UserId',
        headerName: 'UserId',
        width: 80,
        type: 'number',
        align: 'right',
        headerAlign: 'right',
        renderCell: (params) => (
          <Typography sx={{ fontSize: 13, color: '#374151', textAlign: 'right', width: '100%' }}>
            {params.value ?? '—'}
          </Typography>
        ),
      },
      {
        field: 'UserName',
        headerName: 'User Name',
        flex: 1.2,
        minWidth: 150,
        renderCell: (params) => (
          <Typography sx={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
            {params.value || '—'}
          </Typography>
        ),
      },
      {
        field: 'AdUserName',
        headerName: 'AD User Name',
        flex: 1,
        minWidth: 140,
        renderCell: (params) => (
          <Typography sx={{ fontSize: 13, color: '#374151' }}>
            {params.value || '—'}
          </Typography>
        ),
      },
      {
        field: 'EmployeeNo',
        headerName: 'Employee No',
        width: 120,
        renderCell: (params) => (
          <Typography sx={{ fontSize: 13, color: '#374151' }}>
            {params.value || '—'}
          </Typography>
        ),
      },
      {
        field: 'EmployeeName',
        headerName: 'Employee Name',
        flex: 1.2,
        minWidth: 160,
        renderCell: (params) => (
          <Typography sx={{ fontSize: 13, color: '#374151' }}>
            {params.value || '—'}
          </Typography>
        ),
      },
      {
        field: 'DesignationName',
        headerName: 'Designation',
        flex: 1,
        minWidth: 140,
        renderCell: (params) => (
          <Typography sx={{ fontSize: 13, color: '#374151' }}>
            {params.value || '—'}
          </Typography>
        ),
      },
      {
        field: 'DepartmentName',
        headerName: 'Department',
        flex: 1,
        minWidth: 140,
        renderCell: (params) => (
          <Typography sx={{ fontSize: 13, color: '#374151' }}>
            {params.value || '—'}
          </Typography>
        ),
      },
      {
        field: 'UserType',
        headerName: 'User Type',
        width: 100,
        renderCell: (params) => (
          <Typography sx={{ fontSize: 13, color: '#374151' }}>
            {params.value || '—'}
          </Typography>
        ),
      },
      {
        field: 'EmailId',
        headerName: 'Email Id',
        flex: 1.2,
        minWidth: 180,
        renderCell: (params) => (
          <Typography sx={{ fontSize: 13, color: '#374151' }}>
            {params.value || '—'}
          </Typography>
        ),
      },
      {
        field: 'MobileNo',
        headerName: 'Mobile No',
        width: 130,
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
    const { data, loading, visible, userData, designationList, departmentList, confirmOpen, formErrors, snackbar, searchText, columnVisibility, density } = this.state;
    const filteredData = this.getFilteredData();
    const count = filteredData.length;

    return (
      <PageContainer>

        <AppBreadcrumbs />

        <PageHeader
          title="User"
          subtitle="Manage users and their access"
          actions={
            <MuiButton
              variant="contained"
              startIcon={<AddIcon />}
              onClick={this.newRecord}
              sx={{ borderRadius: '10px', px: 3, py: 1.25 }}
            >
              New User
            </MuiButton>
          }
        />

        {loading && data.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <CircularProgress />
          </Box>
        ) : !loading && data.length === 0 ? (
          <EmptyState
            icon={<PersonIcon sx={{ fontSize: 40 }} />}
            title="No Users Found"
            description="Get started by creating your first user in the system."
            primaryAction={
              <MuiButton variant="contained" startIcon={<AddIcon />} onClick={this.newRecord} sx={{ borderRadius: '10px', px: 3 }}>
                Create User
              </MuiButton>
            }
          />
        ) : (
          <Box>
            <GridToolbar
              searchValue={searchText}
              onSearchChange={(val) => this.setState({ searchText: val })}
              searchPlaceholder="Search users..."
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
              getRowId={(row) => row.UserId}
              density={density}
              height={Math.min(56 + count * 56 + 56, 720)}
              pageSize={10}
            />
          </Box>
        )}

        <FormDialog open={visible} onClose={this.toggleModal} title="User Details" maxWidth="md"
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
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth size="small" label="AD User Name" value={userData.AdUserName || ''} onChange={this.handleField('AdUserName')} placeholder="Please enter AD user name" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth size="small" label="Employee No" value={userData.EmployeeNo || ''} onChange={this.handleField('EmployeeNo')} placeholder="Please enter employee no" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth size="small" label="Employee Name" required value={userData.EmployeeName || ''} onChange={this.handleField('EmployeeName')} error={!!formErrors.EmployeeName} helperText={formErrors.EmployeeName} placeholder="Please enter employee name" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth size="small" select label="Designation" value={userData.DesignationId || ''} onChange={this.handleField('DesignationId')}>
                <MenuItem value="">Select....</MenuItem>
                {designationList.map((d) => <MenuItem key={d.DesignationId} value={d.DesignationId}>{d.DesignationName}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth size="small" select label="Department" value={userData.DepartmentId || ''} onChange={this.handleField('DepartmentId')}>
                <MenuItem value="">Select....</MenuItem>
                {departmentList.map((d) => <MenuItem key={d.DepartmentId} value={d.DepartmentId}>{d.DepartmentName}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth size="small" select label="User Type" required value={userData.UserType || ''} onChange={this.handleField('UserType')} error={!!formErrors.UserType} helperText={formErrors.UserType}>
                <MenuItem value="">Select....</MenuItem>
                {USER_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth size="small" label="Email Id" required value={userData.EmailId || ''} onChange={this.handleField('EmailId')} error={!!formErrors.EmailId} helperText={formErrors.EmailId} placeholder="Please enter email id" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth size="small" label="Mobile No" value={userData.MobileNo || ''} onChange={this.handleField('MobileNo')} placeholder="Please enter mobile no" />
            </Grid>
          </Grid>
        </FormDialog>

        <ConfirmDialog open={confirmOpen} title="Delete user?" message="Are you sure you want to delete this record?" confirmText="Delete" onConfirm={this.confirmDelete} onCancel={this.cancelDelete} />

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

export default User;
