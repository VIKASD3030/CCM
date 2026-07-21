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

const LOOKUP_TYPE = [
  { LookupTypeId: 'ObservationType', LookupType: 'Observation Type' },
  { LookupTypeId: 'Category', LookupType: 'Category' },
  { LookupTypeId: 'SubCategory', LookupType: 'Sub Category' },
  { LookupTypeId: 'Location', LookupType: 'Location' },
  { LookupTypeId: 'RiskCategory', LookupType: 'Risk Category' },
  { LookupTypeId: 'ContractType', LookupType: 'Contract Type' },
  { LookupTypeId: 'rbsLevel1', LookupType: 'RBS Level 1' },
  { LookupTypeId: 'Impacted', LookupType: 'Impacted' },
  { LookupTypeId: 'BusinessUnit', LookupType: 'Business Unit' },
  { LookupTypeId: 'BusinessLine', LookupType: 'Business Line' },
  { LookupTypeId: 'BidStatus', LookupType: 'Bid Status' },
  { LookupTypeId: 'RiskResponse', LookupType: 'Risk Response' },
  { LookupTypeId: 'ActionOwner', LookupType: 'Action Owner' },
];

const emptyLookup = { LookupId: 0, LookupType: '', LookupCode: '', LookupName: '', Description: '', Status: 0 };

class LookupData extends Component {
  constructor(props) {
    super(props);
    this.formRef = React.createRef();
    this.state = {
      data: [],
      lookupData: { ...emptyLookup },
      loading: false,
      visible: false,
      confirmOpen: false,
      pendingDelete: null,
      formErrors: {},
      snackbar: { open: false, severity: 'success', message: '' },
    };
  }

  componentDidMount() { this.getLookupDetails(); }

  notify = (severity, message) => this.setState({ snackbar: { open: true, severity, message } });
  closeSnackbar = () => this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));

  async getLookupDetails() {
    this.setState({ loading: true });
    await new CommonUtilityController().getLookupDetails(0)
      .then((data) => { this.setState({ loading: false }); if (data !== undefined) this.setState({ data }); })
      .catch(() => { this.setState({ loading: false }); this.notify('error', 'Data fetching issue!!!'); });
  }

  newRecord = () => this.setState({ visible: true, formErrors: {}, lookupData: { ...emptyLookup } });
  editRecord = (r) => this.setState({ visible: true, formErrors: {}, lookupData: JSON.parse(JSON.stringify(r)) });
  requestDelete = (r) => this.setState({ confirmOpen: true, pendingDelete: r });
  cancelDelete = () => this.setState({ confirmOpen: false, pendingDelete: null });
  confirmDelete = () => { const r = this.state.pendingDelete; this.setState({ confirmOpen: false, pendingDelete: null }); if (r) this.deleteRecord(r); };
  toggleModal = () => this.setState({ visible: !this.state.visible });

  deleteRecord = async (lookup) => {
    lookup.CreatedBy = LoginState.UserId;
    lookup.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    this.setState({ loading: true });
    await new CommonUtilityController().deleteLookupDetails(lookup)
      .then((data) => { this.setState({ loading: false }); if (data !== undefined) this.setState({ data }); this.notify('success', 'Data successfully deleted.'); })
      .catch(() => { this.setState({ loading: false }); this.notify('error', 'Data deletion issue!'); });
  };

  handleField = (field) => (e) => {
    const value = e?.target ? e.target.value : e;
    this.setState((s) => ({ lookupData: { ...s.lookupData, [field]: value }, formErrors: { ...s.formErrors, [field]: undefined } }));
  };

  validateForm = () => {
    const { lookupData: d } = this.state;
    const errors = {};
    if (!String(d.LookupType || '').trim()) errors.LookupType = 'Type is required';
    if (!String(d.LookupCode || '').trim()) errors.LookupCode = 'Code is required';
    if (!String(d.LookupName || '').trim()) errors.LookupName = 'Name is required';
    this.setState({ formErrors: errors });
    return Object.keys(errors).length === 0;
  };

  onFormSubmit = (e) => { if (e?.preventDefault) e.preventDefault(); if (!this.validateForm()) return; this.handleSubmit({ ...this.state.lookupData }); };

  handleSubmit = async (lookup) => {
    lookup.CreatedBy = LoginState.UserId;
    lookup.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    lookup.LockedBy = LoginState.LockedBy;
    lookup.LockedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    lookup.SecurityId = LoginState.SecurityId;
    lookup.Status = lookup.LookupCode === 'NCR' ? 2 : 1;
    this.setState({ loading: true });
    await new CommonUtilityController().saveLookupDetails(lookup)
      .then((data) => { this.setState({ loading: false }); if (data !== undefined) this.setState({ data, visible: false }); this.notify('success', 'Data successfully Inserted.'); })
      .catch(() => { this.setState({ loading: false }); this.notify('error', 'Data insertion issue!'); });
  };

  get gridColumns() {
    return [
      {
        field: 'action', headerName: 'Action', width: 110, sortable: false, filterable: false, disableColumnMenu: true,
        renderCell: (params) => {
          const disabled = params.row.Status === '9';
          return (
            <Stack direction="row" spacing={0.5}>
              <Tooltip title="Edit record"><span><IconButton size="small" color="primary" disabled={disabled} onClick={() => this.editRecord(params.row)}><EditRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title="Delete record"><span><IconButton size="small" color="error" disabled={disabled} onClick={() => this.requestDelete(params.row)}><DeleteRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
            </Stack>
          );
        },
      },
      { field: 'LookupType', headerName: 'Lookup Type', flex: 1.2, minWidth: 160 },
      { field: 'LookupCode', headerName: 'Lookup Code', flex: 1, minWidth: 140 },
      { field: 'LookupName', headerName: 'Lookup Name', flex: 1.4, minWidth: 180 },
      { field: 'Description', headerName: 'Description', flex: 1.6, minWidth: 200 },
    ];
  }

  render() {
    const { data, loading, visible, lookupData, confirmOpen, formErrors, snackbar } = this.state;
    return (
      <PageContainer>
        <PageHeader title="Lookup Data" subtitle="Manage lookup reference values"
          actions={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={this.newRecord}>New Lookup</Button>}
        />
        <DataCard title="Lookup Data Details" count={data.length || null} countLabel="Records">
          <AppDataGrid rows={data} columns={this.gridColumns} loading={loading} getRowId={(row) => row.LookupId}
            emptyTitle="No lookup data yet" emptyDescription="Create your first lookup record."
            emptyAction={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={this.newRecord}>New Lookup</Button>}
          />
        </DataCard>
        <FormDialog open={visible} onClose={this.toggleModal} title="Lookup Data Details"
          actions={<><Button variant="text" color="inherit" onClick={this.toggleModal}>Close</Button><Button variant="contained" onClick={this.onFormSubmit}>Submit</Button></>}
        >
          <Grid container spacing={2.5} sx={{ pt: 0.5 }}>
            <Grid size={{ xs: 12 }}>
              <TextField select label="Type" required value={lookupData.LookupType || ''} onChange={this.handleField('LookupType')} error={!!formErrors.LookupType} helperText={formErrors.LookupType}>
                <MenuItem value="">Select....</MenuItem>
                {LOOKUP_TYPE.map((t) => <MenuItem key={t.LookupTypeId} value={t.LookupTypeId}>{t.LookupType}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Code" required value={lookupData.LookupCode || ''} onChange={this.handleField('LookupCode')} error={!!formErrors.LookupCode} helperText={formErrors.LookupCode} placeholder="Please enter code" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Name" required value={lookupData.LookupName || ''} onChange={this.handleField('LookupName')} error={!!formErrors.LookupName} helperText={formErrors.LookupName} placeholder="Please enter name" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField label="Description" multiline minRows={2} value={lookupData.Description || ''} onChange={this.handleField('Description')} placeholder="Please enter description" />
            </Grid>
          </Grid>
        </FormDialog>
        <ConfirmDialog open={confirmOpen} title="Delete lookup?" message="Are you sure you want to delete this record?" confirmText="Delete" onConfirm={this.confirmDelete} onCancel={this.cancelDelete} />
        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={this.closeSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <Alert onClose={this.closeSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>{snackbar.message}</Alert>
        </Snackbar>
      </PageContainer>
    );
  }
}

export default LookupData;
