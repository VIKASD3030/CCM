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
      { field: 'ModuleGroupCode', headerName: 'Module Group Code', flex: 1, minWidth: 160 },
      { field: 'ModuleGroupName', headerName: 'Module Group Name', flex: 1.4, minWidth: 190 },
      { field: 'ParentModuleGroupName', headerName: 'Parent Module Group', flex: 1.2, minWidth: 180 },
      { field: 'Level', headerName: 'Order By', width: 110, type: 'number', align: 'right', headerAlign: 'right' },
      { field: 'Remarks', headerName: 'Remarks', flex: 1.2, minWidth: 150 },
    ];
  }

  render() {
    const { data, loading, visible, moduleGroupData, confirmOpen, formErrors, snackbar } = this.state;
    const count = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;
    return (
      <PageContainer>
        <PageHeader title="Module Group" subtitle="Manage module groups and their hierarchy"
          actions={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={this.newRecord}>New Module Group</Button>}
        />
        <DataCard title="Module Group Details" count={data.length ? count : null} countLabel="Records">
          <AppDataGrid rows={data} columns={this.gridColumns} loading={loading} getRowId={(row) => row.ModuleGroupId}
            emptyTitle="No module groups yet" emptyDescription="Create your first module group."
            emptyAction={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={this.newRecord}>New Module Group</Button>}
          />
        </DataCard>
        <FormDialog open={visible} onClose={this.toggleModal} title="Module Group Details"
          actions={<><Button variant="text" color="inherit" onClick={this.toggleModal}>Close</Button><Button variant="contained" onClick={this.onFormSubmit}>Submit</Button></>}
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
          <Alert onClose={this.closeSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>{snackbar.message}</Alert>
        </Snackbar>
      </PageContainer>
    );
  }
}

export default ModuleGroup;
