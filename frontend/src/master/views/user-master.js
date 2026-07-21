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
import { fillSelectList } from '../../helper/common-utility';
import { PageContainer, PageHeader, DataCard, AppDataGrid, FormDialog, ConfirmDialog } from '../../components/ui';

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
      { field: 'UserId', headerName: 'UserID', width: 80, type: 'number', align: 'right', headerAlign: 'right' },
      { field: 'UserName', headerName: 'User Name', flex: 1.2, minWidth: 150 },
      { field: 'AdUserName', headerName: 'AD User Name', flex: 1, minWidth: 140 },
      { field: 'EmployeeNo', headerName: 'Employee No', width: 120 },
      { field: 'EmployeeName', headerName: 'Employee Name', flex: 1.2, minWidth: 160 },
      { field: 'DesignationName', headerName: 'Designation', flex: 1, minWidth: 140 },
      { field: 'DepartmentName', headerName: 'Department', flex: 1, minWidth: 140 },
      { field: 'UserType', headerName: 'User Type', width: 100 },
      { field: 'EmailId', headerName: 'Email Id', flex: 1.2, minWidth: 180 },
      { field: 'MobileNo', headerName: 'Mobile No', width: 130 },
    ];
  }

  render() {
    const { data, loading, visible, userData, designationList, departmentList, confirmOpen, formErrors, snackbar } = this.state;
    const count = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;
    return (
      <PageContainer>
        <PageHeader title="User" subtitle="Manage users and their access"
          actions={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={this.newRecord}>New User</Button>}
        />
        <DataCard title="User Details" count={data.length ? count : null} countLabel="Records">
          <AppDataGrid rows={data} columns={this.gridColumns} loading={loading} getRowId={(row) => row.UserId}
            emptyTitle="No users yet" emptyDescription="Create your first user."
            emptyAction={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={this.newRecord}>New User</Button>}
            height={650}
          />
        </DataCard>
        <FormDialog open={visible} onClose={this.toggleModal} title="User Details" maxWidth="md"
          actions={<><Button variant="text" color="inherit" onClick={this.toggleModal}>Close</Button><Button variant="contained" onClick={this.onFormSubmit}>Submit</Button></>}
        >
          <Grid container spacing={2.5} sx={{ pt: 0.5 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="AD User Name" value={userData.AdUserName || ''} onChange={this.handleField('AdUserName')} placeholder="Please enter AD user name" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Employee No" value={userData.EmployeeNo || ''} onChange={this.handleField('EmployeeNo')} placeholder="Please enter employee no" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Employee Name" required value={userData.EmployeeName || ''} onChange={this.handleField('EmployeeName')} error={!!formErrors.EmployeeName} helperText={formErrors.EmployeeName} placeholder="Please enter employee name" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select label="Designation" value={userData.DesignationId || ''} onChange={this.handleField('DesignationId')}>
                <MenuItem value="">Select....</MenuItem>
                {designationList.map((d) => <MenuItem key={d.DesignationId} value={d.DesignationId}>{d.DesignationName}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select label="Department" value={userData.DepartmentId || ''} onChange={this.handleField('DepartmentId')}>
                <MenuItem value="">Select....</MenuItem>
                {departmentList.map((d) => <MenuItem key={d.DepartmentId} value={d.DepartmentId}>{d.DepartmentName}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select label="User Type" required value={userData.UserType || ''} onChange={this.handleField('UserType')} error={!!formErrors.UserType} helperText={formErrors.UserType}>
                <MenuItem value="">Select....</MenuItem>
                {USER_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Email Id" required value={userData.EmailId || ''} onChange={this.handleField('EmailId')} error={!!formErrors.EmailId} helperText={formErrors.EmailId} placeholder="Please enter email id" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Mobile No" value={userData.MobileNo || ''} onChange={this.handleField('MobileNo')} placeholder="Please enter mobile no" />
            </Grid>
          </Grid>
        </FormDialog>
        <ConfirmDialog open={confirmOpen} title="Delete user?" message="Are you sure you want to delete this record?" confirmText="Delete" onConfirm={this.confirmDelete} onCancel={this.cancelDelete} />
        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={this.closeSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <Alert onClose={this.closeSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>{snackbar.message}</Alert>
        </Snackbar>
      </PageContainer>
    );
  }
}

export default User;
