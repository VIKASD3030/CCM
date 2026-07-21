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

const emptyVO = {
  VariationOrderId: 0, ProjectId: '', ContractId: '', VariationNo: '', VariationDate: '',
  ExtentionDate: '', OrderValue: '', VariationOrderDescription: '', Remarks: '', Status: 0,
};

class VariationOrder extends Component {
  constructor(props) {
    super(props);
    this.formRef = React.createRef();
    this.state = {
      data: [], variationOrderData: { ...emptyVO },
      loading: false, visible: false, filteredTotal: null,
      projectList: [], contractList: [],
      confirmOpen: false, pendingDelete: null, formErrors: {},
      snackbar: { open: false, severity: 'success', message: '' },
    };
  }

  componentDidMount() { this.getVariationOrderDetails(); this.getProjects(); }
  notify = (s, m) => this.setState({ snackbar: { open: true, severity: s, message: m } });
  closeSnackbar = () => this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));

  async getVariationOrderDetails() {
    this.setState({ loading: true });
    await new CommonUtilityController().getVariationOrderDetails({ projectId: 0, contractorId: 0 })
      .then((data) => { this.setState({ loading: false }); if (data != undefined) this.setState({ data }); })
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
    this.setState((s) => ({ variationOrderData: { ...s.variationOrderData, ProjectId: value, ContractId: '' }, contractList: [] }));
    if (value) this.getContracts(value);
  };

  newRecord = () => this.setState({ visible: true, formErrors: {}, variationOrderData: { ...emptyVO } });
  editRecord = (r) => {
    const vo = { ...r };
    vo.VariationDate = vo.VariationDate ? moment(vo.VariationDate).format('YYYY-MM-DD') : '';
    vo.ExtentionDate = vo.ExtentionDate ? moment(vo.ExtentionDate).format('YYYY-MM-DD') : '';
    this.setState({ visible: true, formErrors: {}, variationOrderData: vo });
    if (vo.ProjectId) this.getContracts(vo.ProjectId);
  };
  requestDelete = (r) => this.setState({ confirmOpen: true, pendingDelete: r });
  cancelDelete = () => this.setState({ confirmOpen: false, pendingDelete: null });
  confirmDelete = () => { const r = this.state.pendingDelete; this.setState({ confirmOpen: false, pendingDelete: null }); if (r) this.deleteRecord(r); };
  toggleModal = () => this.setState({ visible: !this.state.visible });

  deleteRecord = async (vo) => {
    vo.CreatedBy = LoginState.UserId; vo.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    this.setState({ loading: true });
    await new CommonUtilityController().deleteVariationOrderDetails(vo)
      .then((data) => { this.setState({ loading: false }); if (data != undefined) this.setState({ data }); this.notify('success', 'Data successfully deleted.'); })
      .catch(() => { this.setState({ loading: false }); this.notify('error', 'Data deletion issue!'); });
  };

  handleField = (field) => (e) => {
    const value = e?.target ? e.target.value : e;
    this.setState((s) => ({ variationOrderData: { ...s.variationOrderData, [field]: value }, formErrors: { ...s.formErrors, [field]: undefined } }));
  };

  validateForm = () => {
    const { variationOrderData: d } = this.state;
    const errors = {};
    if (!d.ProjectId) errors.ProjectId = 'Project is required';
    if (!d.ContractId) errors.ContractId = 'Contract is required';
    if (!String(d.VariationNo || '').trim()) errors.VariationNo = 'Variation No. is required';
    if (!d.VariationDate) errors.VariationDate = 'Variation Date is required';
    this.setState({ formErrors: errors });
    return Object.keys(errors).length === 0;
  };

  onFormSubmit = (e) => { if (e?.preventDefault) e.preventDefault(); if (!this.validateForm()) return; this.handleSubmit({ ...this.state.variationOrderData }); };

  handleSubmit = async (vo) => {
    vo.VariationDate = moment(vo.VariationDate).format('YYYY-MM-DD HH:mm:ss');
    if (vo.ExtentionDate) vo.ExtentionDate = moment(vo.ExtentionDate).format('YYYY-MM-DD HH:mm:ss');
    vo.CreatedBy = LoginState.UserId; vo.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    vo.LockedBy = LoginState.LockedBy; vo.LockedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    vo.SecurityId = LoginState.SecurityId; vo.Status = 1;
    this.setState({ loading: true });
    await new CommonUtilityController().saveVariationOrderDetails(vo)
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
      { field: 'ProjectCode', headerName: 'Project No.', flex: 1, minWidth: 130 },
      { field: 'ContractName', headerName: 'Contract Name', flex: 1.6, minWidth: 200 },
      { field: 'VariationNo', headerName: 'Variation No.', flex: 1, minWidth: 130 },
      { field: 'VariationDate', headerName: 'Variation Date', width: 130 },
      { field: 'ExtentionDate', headerName: 'Extension Date', width: 130 },
      { field: 'OrderValue', headerName: 'Order Value', type: 'number', align: 'right', headerAlign: 'right', width: 140 },
      { field: 'VariationOrderDescription', headerName: 'Description', flex: 1.4, minWidth: 180 },
      { field: 'Remarks', headerName: 'Remarks', flex: 1.2, minWidth: 150 },
    ];
  }

  render() {
    const { data, loading, visible, variationOrderData, projectList, contractList, confirmOpen, formErrors, snackbar } = this.state;
    const count = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;
    return (
      <PageContainer>
        <PageHeader title="Variation Order" subtitle="Manage variation orders"
          actions={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={this.newRecord}>New Variation Order</Button>}
        />
        <DataCard title="Variation Order Details" count={data.length ? count : null} countLabel="Records">
          <AppDataGrid rows={data} columns={this.gridColumns} loading={loading} getRowId={(row) => row.VariationOrderId}
            emptyTitle="No variation orders yet" emptyDescription="Create your first variation order."
            emptyAction={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={this.newRecord}>New Variation Order</Button>}
            height={600}
          />
        </DataCard>
        <FormDialog open={visible} onClose={this.toggleModal} title="Variation Order Details"
          actions={<><Button variant="text" color="inherit" onClick={this.toggleModal}>Close</Button><Button variant="contained" onClick={this.onFormSubmit}>Submit</Button></>}
        >
          <Grid container spacing={2.5} sx={{ pt: 0.5 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select label="Project" required value={variationOrderData.ProjectId || ''} onChange={(e) => { this.handleField('ProjectId')(e); this.projectChange(e.target.value); }} error={!!formErrors.ProjectId} helperText={formErrors.ProjectId}>
                <MenuItem value="">Select....</MenuItem>
                {projectList.map((p) => <MenuItem key={p.ProjectMasterId} value={p.ProjectMasterId}>{p.ProjectName}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select label="Contract" required value={variationOrderData.ContractId || ''} onChange={this.handleField('ContractId')} error={!!formErrors.ContractId} helperText={formErrors.ContractId}>
                <MenuItem value="">Select....</MenuItem>
                {contractList.map((c) => <MenuItem key={c.ContractId} value={c.ContractId}>{c.ContractName}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Variation No." required value={variationOrderData.VariationNo || ''} onChange={this.handleField('VariationNo')} error={!!formErrors.VariationNo} helperText={formErrors.VariationNo} placeholder="Please enter variation no." />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField type="date" label="Variation Date" required InputLabelProps={{ shrink: true }} value={variationOrderData.VariationDate || ''} onChange={this.handleField('VariationDate')} error={!!formErrors.VariationDate} helperText={formErrors.VariationDate} />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField type="date" label="Extension Date" InputLabelProps={{ shrink: true }} value={variationOrderData.ExtentionDate || ''} onChange={this.handleField('ExtentionDate')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField type="number" label="Order Value" value={variationOrderData.OrderValue || ''} onChange={this.handleField('OrderValue')} placeholder="Please enter order value" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField label="Description" multiline minRows={2} value={variationOrderData.VariationOrderDescription || ''} onChange={this.handleField('VariationOrderDescription')} placeholder="Please enter description" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField label="Remarks" multiline minRows={2} inputProps={{ maxLength: 4000 }} value={variationOrderData.Remarks || ''} onChange={this.handleField('Remarks')} placeholder="Please enter remarks" />
            </Grid>
          </Grid>
        </FormDialog>
        <ConfirmDialog open={confirmOpen} title="Delete variation order?" message="Are you sure?" confirmText="Delete" onConfirm={this.confirmDelete} onCancel={this.cancelDelete} />
        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={this.closeSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <Alert onClose={this.closeSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>{snackbar.message}</Alert>
        </Snackbar>
      </PageContainer>
    );
  }
}

export default VariationOrder;
