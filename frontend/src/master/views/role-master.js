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

  get gridColumns() {
    return [
      {
        field: 'action', headerName: 'Action', width: 110, sortable: false, filterable: false, disableColumnMenu: true,
        renderCell: (params) => {
          const disabled = params.row.Status == '9';
          return (
            <Stack direction="row" spacing={0.5}>
              <Tooltip title="Edit record"><span><IconButton size="small" color="primary" disabled={disabled} onClick={() => this.editRecord(params.row)}><EditRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title="Delete record"><span><IconButton size="small" color="error" disabled={disabled} onClick={() => this.requestDelete(params.row)}><DeleteRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
            </Stack>
          );
        },
      },
      { field: 'RoleCode', headerName: 'Role Code', flex: 1, minWidth: 130 },
      { field: 'RoleName', headerName: 'Role Name', flex: 1.4, minWidth: 180 },
      { field: 'ParentRoleName', headerName: 'Parent Role', flex: 1.2, minWidth: 160 },
      { field: 'Remarks', headerName: 'Remarks', flex: 1.4, minWidth: 180 },
    ];
  }

  render() {
    const { data, loading, visible, roleData, confirmOpen, formErrors, snackbar } = this.state;
    const count = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;
    return (
      <PageContainer>
        <PageHeader title="Role" subtitle="Manage roles and their hierarchy"
          actions={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={this.newRecord}>New Role</Button>}
        />
        <DataCard title="Role Details" count={data.length ? count : null} countLabel="Records">
          <AppDataGrid rows={data} columns={this.gridColumns} loading={loading} getRowId={(row) => row.RoleId}
            emptyTitle="No roles yet" emptyDescription="Create your first role."
            emptyAction={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={this.newRecord}>New Role</Button>}
          />
        </DataCard>
        <FormDialog open={visible} onClose={this.toggleModal} title="Role Details"
          actions={<><Button variant="text" color="inherit" onClick={this.toggleModal}>Close</Button><Button variant="contained" onClick={this.onFormSubmit}>Submit</Button></>}
        >
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
        </FormDialog>
        <ConfirmDialog open={confirmOpen} title="Delete role?" message="Are you sure you want to delete this record?" confirmText="Delete" onConfirm={this.confirmDelete} onCancel={this.cancelDelete} />
        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={this.closeSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <Alert onClose={this.closeSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>{snackbar.message}</Alert>
        </Snackbar>
      </PageContainer>
    );
  }
}

export default Role;
