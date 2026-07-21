import moment from 'moment';
import React, { Component } from 'react';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import LoginState from '../../authentication/loginState';
import CommonUtilityController from '../controller/common-utility-controller';
import { PageContainer, PageHeader, DataCard, AppDataGrid, FormDialog, ConfirmDialog } from '../../components/ui';

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

  get gridColumns() {
    return [
      {
        field: 'action', headerName: 'Action', width: 110, sortable: false, filterable: false, disableColumnMenu: true,
        renderCell: (params) => {
          const disabled = params.row.Status == '9';
          return (
            <Stack direction="row" spacing={0.5}>
              <Tooltip title="Edit"><span><IconButton size="small" color="primary" disabled={disabled} onClick={() => this.editRecord(params.row)}><EditRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title="Delete"><span><IconButton size="small" color="error" disabled={disabled} onClick={() => this.requestDelete(params.row)}><DeleteRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
            </Stack>
          );
        },
      },
      { field: 'UserName', headerName: 'User Name', flex: 1.4, minWidth: 180 },
      { field: 'RoleName', headerName: 'Role Name', flex: 1.4, minWidth: 180 },
    ];
  }

  render() {
    const { data, loading, visible, userRoleData, userList, roleList, projectList, businessUnitList, businessLineList, confirmOpen, formErrors, snackbar } = this.state;
    const count = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;
    return (
      <PageContainer>
        <PageHeader title="User Role" subtitle="Manage user role assignments"
          actions={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={this.newRecord}>New User Role</Button>}
        />
        <DataCard title="User Role Details" count={data.length ? count : null} countLabel="Records">
          <AppDataGrid rows={data} columns={this.gridColumns} loading={loading} getRowId={(row) => row.UserRoleId}
            emptyTitle="No user roles yet" emptyDescription="Create your first user role assignment."
            emptyAction={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={this.newRecord}>New User Role</Button>}
          />
        </DataCard>
        <FormDialog open={visible} onClose={this.toggleModal} title="User Role Details" maxWidth="sm"
          actions={<><Button variant="text" color="inherit" onClick={this.toggleModal}>Close</Button><Button variant="contained" onClick={this.onFormSubmit}>Submit</Button></>}
        >
          <Grid container spacing={2.5} sx={{ pt: 0.5 }}>
            <Grid size={{ xs: 12 }}>
              <TextField select label="User" required value={userRoleData.UserId || ''} onChange={this.handleField('UserId')} error={!!formErrors.UserId} helperText={formErrors.UserId}>
                <MenuItem value="">Select....</MenuItem>
                {userList.map((u) => <MenuItem key={u.UserId} value={u.UserId}>{u.EmployeeName}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField select label="Role" required value={userRoleData.RoleId || ''} onChange={this.handleField('RoleId')} error={!!formErrors.RoleId} helperText={formErrors.RoleId}>
                <MenuItem value="">Select....</MenuItem>
                {roleList.map((r) => <MenuItem key={r.RoleId} value={r.RoleId}>{r.RoleName}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField select label="Business Unit" SelectProps={{ multiple: true }}
                value={userRoleData.BusinessUnitIds || []}
                onChange={this.handleMultiField('BusinessUnitIds')}>
                {businessUnitList.map((b) => <MenuItem key={b.LookupId} value={b.LookupName}>{b.LookupName}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField select label="Business Line" SelectProps={{ multiple: true }}
                value={userRoleData.BusinessLineIds || []}
                onChange={this.handleMultiField('BusinessLineIds')}>
                {businessLineList.map((b) => <MenuItem key={b.LookupId} value={b.LookupName}>{b.LookupName}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField select label="Project" SelectProps={{ multiple: true }}
                value={userRoleData.ProjectIds || []}
                onChange={this.handleMultiField('ProjectIds')}>
                {projectList.map((p) => <MenuItem key={p.ProjectMasterId} value={p.ProjectMasterId}>{p.ProjectName}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>
        </FormDialog>
        <ConfirmDialog open={confirmOpen} title="Delete user role?" message="Are you sure you want to delete this record?" confirmText="Delete" onConfirm={this.confirmDelete} onCancel={this.cancelDelete} />
        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={this.closeSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <Alert onClose={this.closeSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>{snackbar.message}</Alert>
        </Snackbar>
      </PageContainer>
    );
  }
}

export default UserRole;
