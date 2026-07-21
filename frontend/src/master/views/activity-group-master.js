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
import { fillSelectList, compareDate } from '../../helper/common-utility';
import { PageContainer, PageHeader, DataCard, AppDataGrid, FormDialog, ConfirmDialog } from '../../components/ui';

const emptyActivityGroup = {
  ActivityGroupId: 0, ActivityGroupName: '', ActivityGroupCode: '', ActivityGroupParentId: '',
  ProjectId: '', ContractId: '', LocationId: 0, ModuleGroupId: 0,
  Quantity: 0, Weightage: '', StartDate: '', EndDate: '', Remarks: '', Status: 0,
};

class ActivityGroup extends Component {
  constructor(props) {
    super(props);
    this.formRef = React.createRef();
    this.state = {
      data: [], activityGroupData: { ...emptyActivityGroup },
      loading: false, visible: false, filteredTotal: null,
      projectList: [], contractList: [], activityGroupParentList: [],
      confirmOpen: false, pendingDelete: null, formErrors: {},
      snackbar: { open: false, severity: 'success', message: '' },
    };
  }

  componentDidMount() { this.getActivityGroups(); this.getProjects(); }

  notify = (s, m) => this.setState({ snackbar: { open: true, severity: s, message: m } });
  closeSnackbar = () => this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));

  async getActivityGroups() {
    this.setState({ loading: true });
    await new CommonUtilityController().getActivityGroups(0, 0)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) this.setState({ data, activityGroupParentList: fillSelectList(data, 'ActivityGroupName', 'ActivityGroupId') });
      })
      .catch((e) => { this.setState({ loading: false }); this.notify('error', e.toString()); });
  }

  async getProjects() {
    this.setState({ loading: true });
    await new CommonUtilityController().getProjects({ UserId: LoginState.UserId })
      .then((data) => { this.setState({ loading: false }); if (data != undefined) this.setState({ projectList: data }); })
      .catch((e) => { this.setState({ loading: false }); this.notify('error', e.toString()); });
  }

  async getContracts(projectId) {
    this.setState({ loading: true, contractList: [] });
    await new CommonUtilityController().getContracts({ projectId, workPackageId: 0, contractorId: 0 })
      .then((data) => { this.setState({ loading: false }); if (data != undefined) this.setState({ contractList: data }); })
      .catch((e) => { this.setState({ loading: false }); this.notify('error', e.toString()); });
  }

  projectChange = (value) => {
    this.setState((s) => ({ activityGroupData: { ...s.activityGroupData, ProjectId: value, ContractId: '' }, contractList: [] }));
    if (value) this.getContracts(value);
  };

  newRecord = () => this.setState({ visible: true, formErrors: {}, activityGroupData: { ...emptyActivityGroup } });
  editRecord = (r) => {
    const ag = JSON.parse(JSON.stringify(r));
    ag.StartDate = ag.StartDate ? moment(ag.StartDate).format('YYYY-MM-DD') : '';
    ag.EndDate = ag.EndDate ? moment(ag.EndDate).format('YYYY-MM-DD') : '';
    if (ag.ActivityGroupParentId == null || ag.ActivityGroupParentId == 0) ag.ActivityGroupParentId = '';
    this.setState({ visible: true, formErrors: {}, activityGroupData: ag });
    if (ag.ProjectId) this.getContracts(ag.ProjectId);
  };
  requestDelete = (r) => this.setState({ confirmOpen: true, pendingDelete: r });
  cancelDelete = () => this.setState({ confirmOpen: false, pendingDelete: null });
  confirmDelete = () => { const r = this.state.pendingDelete; this.setState({ confirmOpen: false, pendingDelete: null }); if (r) this.deleteRecord(r); };
  toggleModal = () => this.setState({ visible: !this.state.visible });

  deleteRecord = async (ag) => {
    ag.CreatedBy = LoginState.UserId; ag.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    this.setState({ loading: true });
    await new CommonUtilityController().deleteActivityGroupDetails(ag)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) this.setState({ data, activityGroupParentList: fillSelectList(data, 'ActivityGroupName', 'ActivityGroupId') });
        this.notify('success', 'Data successfully deleted.');
      })
      .catch(() => { this.setState({ loading: false }); this.notify('error', 'Data deletion issue!'); });
  };

  handleField = (field) => (e) => {
    const value = e?.target ? e.target.value : e;
    this.setState((s) => ({ activityGroupData: { ...s.activityGroupData, [field]: value }, formErrors: { ...s.formErrors, [field]: undefined } }));
  };

  validateForm = () => {
    const { activityGroupData: d } = this.state;
    const errors = {};
    if (!d.ProjectId) errors.ProjectId = 'Project is required';
    if (!d.ContractId) errors.ContractId = 'Contract is required';
    if (!String(d.ActivityGroupName || '').trim()) errors.ActivityGroupName = 'Activity Group Name is required';
    if (!String(d.ActivityGroupCode || '').trim()) errors.ActivityGroupCode = 'Code is required';
    if (!d.StartDate) errors.StartDate = 'Start Date is required';
    if (!d.EndDate) errors.EndDate = 'End Date is required';
    if (d.StartDate && d.EndDate && compareDate(d.StartDate, d.EndDate)) errors.EndDate = 'Start Date must be ≤ End Date';
    this.setState({ formErrors: errors });
    return Object.keys(errors).length === 0;
  };

  onFormSubmit = (e) => { if (e?.preventDefault) e.preventDefault(); if (!this.validateForm()) return; this.handleSubmit({ ...this.state.activityGroupData }); };

  handleSubmit = async (ag) => {
    ag.LocationId = 0; ag.ModuleGroupId = 0;
    if (ag.ActivityGroupParentId == '') ag.ActivityGroupParentId = '0';
    let isexist = false;
    this.setState({ loading: true });
    await new CommonUtilityController().isRecordExists({ Record: ag, TableName: 'ActivityGroup' })
      .then((r) => { this.setState({ loading: false }); if (r?.status == 1) { isexist = true; this.notify('error', 'Record already exists'); } })
      .catch(() => { isexist = true; this.setState({ loading: false }); this.notify('error', 'Error validating the Record'); });
    if (isexist) return;
    ag.StartDate = moment(ag.StartDate).format('YYYY-MM-DD HH:mm:ss');
    ag.EndDate = moment(ag.EndDate).format('YYYY-MM-DD HH:mm:ss');
    ag.CreatedBy = LoginState.UserId; ag.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    ag.LockedBy = LoginState.LockedBy; ag.LockedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    ag.SecurityId = LoginState.SecurityId; ag.Status = 1;
    this.setState({ loading: true });
    await new CommonUtilityController().saveActivityGroupDetails(ag)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) this.setState({ data, activityGroupParentList: fillSelectList(data, 'ActivityGroupName', 'ActivityGroupId'), visible: false });
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
      { field: 'ActivityGroupName', headerName: 'Activity Group', flex: 1.4, minWidth: 180 },
      { field: 'ActivityGroupCode', headerName: 'Code', flex: 1, minWidth: 120 },
      { field: 'ProjectName', headerName: 'Project Name', flex: 1.2, minWidth: 160 },
      { field: 'ContractName', headerName: 'Contract', flex: 1.4, minWidth: 180 },
      { field: 'Quantity', headerName: 'Quantity', type: 'number', align: 'right', headerAlign: 'right', width: 100 },
      { field: 'Weightage', headerName: 'Weightage %', type: 'number', align: 'right', headerAlign: 'right', width: 120 },
      { field: 'StartDate', headerName: 'Start Date', width: 120 },
      { field: 'EndDate', headerName: 'End Date', width: 120 },
      { field: 'Remarks', headerName: 'Remarks', flex: 1.2, minWidth: 150 },
    ];
  }

  render() {
    const { data, loading, visible, activityGroupData, projectList, contractList, activityGroupParentList, confirmOpen, formErrors, snackbar } = this.state;
    const count = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;
    return (
      <PageContainer>
        <PageHeader title="Activity Group" subtitle="Manage activity groups"
          actions={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={this.newRecord}>New Activity Group</Button>}
        />
        <DataCard title="Activity Group Details" count={data.length ? count : null} countLabel="Records">
          <AppDataGrid rows={data} columns={this.gridColumns} loading={loading} getRowId={(row) => row.ActivityGroupId}
            emptyTitle="No activity groups yet" emptyDescription="Create your first activity group."
            emptyAction={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={this.newRecord}>New Activity Group</Button>}
            height={600}
          />
        </DataCard>
        <FormDialog open={visible} onClose={this.toggleModal} title="Activity Group Details"
          actions={<><Button variant="text" color="inherit" onClick={this.toggleModal}>Close</Button><Button variant="contained" onClick={this.onFormSubmit}>Submit</Button></>}
        >
          <Grid container spacing={2.5} sx={{ pt: 0.5 }}>
            <Grid size={{ xs: 12 }}>
              <TextField select label="Project Name" required value={activityGroupData.ProjectId || ''} onChange={(e) => { this.handleField('ProjectId')(e); this.projectChange(e.target.value); }} error={!!formErrors.ProjectId} helperText={formErrors.ProjectId}>
                <MenuItem value="">Select....</MenuItem>
                {projectList.map((p) => <MenuItem key={p.ProjectMasterId} value={p.ProjectMasterId}>{p.ProjectName}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField select label="Contract Name" required value={activityGroupData.ContractId || ''} onChange={this.handleField('ContractId')} error={!!formErrors.ContractId} helperText={formErrors.ContractId}>
                <MenuItem value="">Select....</MenuItem>
                {contractList.map((c) => <MenuItem key={c.ContractId} value={c.ContractId}>{c.ContractName}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Activity Group Name" required value={activityGroupData.ActivityGroupName || ''} onChange={this.handleField('ActivityGroupName')} error={!!formErrors.ActivityGroupName} helperText={formErrors.ActivityGroupName} placeholder="Please enter activity group" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Code" required value={activityGroupData.ActivityGroupCode || ''} onChange={this.handleField('ActivityGroupCode')} error={!!formErrors.ActivityGroupCode} helperText={formErrors.ActivityGroupCode} placeholder="Please enter code" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField select label="Parent Activity Group" value={activityGroupData.ActivityGroupParentId || ''} onChange={this.handleField('ActivityGroupParentId')}>
                <MenuItem value="">Select....</MenuItem>
                {data.map((d) => <MenuItem key={d.ActivityGroupId} value={d.ActivityGroupId}>{d.ActivityGroupName}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField type="date" label="Start Date" required InputLabelProps={{ shrink: true }} value={activityGroupData.StartDate || ''} onChange={this.handleField('StartDate')} error={!!formErrors.StartDate} helperText={formErrors.StartDate} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField type="date" label="End Date" required InputLabelProps={{ shrink: true }} value={activityGroupData.EndDate || ''} onChange={this.handleField('EndDate')} error={!!formErrors.EndDate} helperText={formErrors.EndDate} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField type="number" label="Quantity" required value={activityGroupData.Quantity ?? ''} onChange={this.handleField('Quantity')} inputProps={{ min: 0 }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField type="number" label="Weightage %" required value={activityGroupData.Weightage ?? ''} onChange={this.handleField('Weightage')} inputProps={{ min: 0, max: 100 }} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField label="Remarks" multiline minRows={2} inputProps={{ maxLength: 4000 }} value={activityGroupData.Remarks || ''} onChange={this.handleField('Remarks')} placeholder="Please enter remarks" />
            </Grid>
          </Grid>
        </FormDialog>
        <ConfirmDialog open={confirmOpen} title="Delete activity group?" message="Are you sure?" confirmText="Delete" onConfirm={this.confirmDelete} onCancel={this.cancelDelete} />
        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={this.closeSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <Alert onClose={this.closeSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>{snackbar.message}</Alert>
        </Snackbar>
      </PageContainer>
    );
  }
}

export default ActivityGroup;
