import moment from 'moment';
import React, { Component } from 'react';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import LoginState from '../../authentication/loginState';
import CommonUtilityController from '../controller/common-utility-controller';
import { fillSelectList } from '../../helper/common-utility';
import { PageContainer, PageHeader, DataCard, AppDataGrid, FormDialog, ConfirmDialog } from '../../components/ui';

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
      { field: 'ModuleName', headerName: 'Module Name', flex: 1, minWidth: 150 },
      { field: 'UserShownName', headerName: 'User Shown Name', flex: 1.2, minWidth: 160 },
      { field: 'ModuleGroupName', headerName: 'Module Group', flex: 1, minWidth: 150 },
      { field: 'ParentModuleName', headerName: 'Parent Module', flex: 1, minWidth: 150 },
      { field: 'Level', headerName: 'Order By', width: 100, type: 'number', align: 'right', headerAlign: 'right' },
      { field: 'ModulePath', headerName: 'Module Path', flex: 1.2, minWidth: 160 },
    ];
  }

  render() {
    const { data, loading, visible, moduleData, moduleGroupList, moduleParentList, searchData, confirmOpen, formErrors, snackbar } = this.state;
    const count = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;
    return (
      <PageContainer>
        <PageHeader title="Module" subtitle="Manage modules by group"
          actions={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={this.newRecord}>New Module</Button>}
        />
        <DataCard
          title="Module Details"
          count={data.length ? count : null}
          countLabel="Records"
          toolbar={
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TextField select size="small" label="Module Group" value={searchData.ModuleGroupId || ''} onChange={(e) => this.moduleGroupChange(e.target.value)} sx={{ minWidth: 220 }}>
                <MenuItem value="">Select....</MenuItem>
                {moduleGroupList.map((mg) => <MenuItem key={mg.ModuleGroupId} value={mg.ModuleGroupId}>{mg.ModuleGroupName}</MenuItem>)}
              </TextField>
            </Stack>
          }
        >
          <AppDataGrid rows={data} columns={this.gridColumns} loading={loading} getRowId={(row) => row.ModuleId}
            emptyTitle="No modules found" emptyDescription="Select a module group to load modules." height={600}
          />
        </DataCard>

        <FormDialog open={visible} onClose={this.toggleModal} title="Module Details" maxWidth="md"
          actions={<><Button variant="text" color="inherit" onClick={this.toggleModal}>Close</Button><Button variant="contained" onClick={this.onFormSubmit}>Submit</Button></>}
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
          <Alert onClose={this.closeSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>{snackbar.message}</Alert>
        </Snackbar>
      </PageContainer>
    );
  }
}

export default Module;
