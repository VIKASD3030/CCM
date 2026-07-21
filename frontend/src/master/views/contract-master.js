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
import FileHelper from '../../helper/file-helper';
import FileUpload from '../common/quality-file-upload';
import FileViewer from '../../helper/file-viewer';
import { SIGN_FILE_PROP } from '../../helper/constants';
import path from 'path-browserify';
import { PageContainer, PageHeader, DataCard, AppDataGrid, FormDialog, ConfirmDialog } from '../../components/ui';

const ContractAtt_Api = '/common/SaveContractAttachment';

const emptyContract = {
  ContractId: 0, ContractNo: '', ContractName: '', ProjectId: '', ContractorId: '', ContractType: '',
  ContractStartDate: '', ContractEndDate: '', ContractValue: '', SectionValue: '', Remarks: '',
  Status: 0, ClientName: '', ConsultantName: '', ShortDescription: '', FileName: '', DocumentPath: '',
};

class Contract extends Component {
  constructor(props) {
    super(props);
    this.formRef = React.createRef();
    this.state = {
      data: [],
      contractData: { ...emptyContract },
      loading: false,
      visible: false,
      filteredTotal: null,
      projectList: [],
      contractorList: [],
      contractTypeList: [],
      viewDoc: false,
      fileType: '',
      filePath: '',
      imageFileUrl: '',
      confirmOpen: false,
      pendingDelete: null,
      formErrors: {},
      snackbar: { open: false, severity: 'success', message: '' },
    };
  }

  componentDidMount() {
    this.getContracts(); this.getProjects(); this.getContractors(); this.getLookupDetails();
  }

  notify = (severity, message) => this.setState({ snackbar: { open: true, severity, message } });
  closeSnackbar = () => this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));

  async getContracts() {
    this.setState({ loading: true });
    await new CommonUtilityController().getContracts({ projectId: 0, workPackageId: 0, contractorId: 0 })
      .then((data) => { this.setState({ loading: false }); if (data != undefined) this.setState({ data }); })
      .catch((error) => { this.setState({ loading: false }); this.notify('error', error.toString()); });
  }

  async getLookupDetails() {
    this.setState({ loading: true });
    await new CommonUtilityController().getLookupDetails(0)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) {
          const contractType = data.filter((a) => a.LookupType === 'ContractType');
          this.setState({ contractTypeList: contractType });
        }
      })
      .catch(() => { this.setState({ loading: false }); this.notify('error', 'Data fetching issue!!!'); });
  }

  async getContractors() {
    this.setState({ loading: true });
    await new CommonUtilityController().getContractors()
      .then((data) => { this.setState({ loading: false }); if (data != undefined) this.setState({ contractorList: data }); })
      .catch((error) => { this.setState({ loading: false }); this.notify('error', error.toString()); });
  }

  async getProjects() {
    this.setState({ loading: true });
    await new CommonUtilityController().getProjects({ UserId: LoginState.UserId })
      .then((data) => { this.setState({ loading: false }); if (data != undefined) this.setState({ projectList: data }); })
      .catch((error) => { this.setState({ loading: false }); this.notify('error', error.toString()); });
  }

  viewDocument = async (url) => {
    this.setState({ loading: true });
    await new CommonUtilityController().downloadAttachment(url)
      .then((res) => res.blob())
      .then((blob) => {
        const fileType = path.extname(url);
        if (fileType === '.pdf') {
          const fileUrl = window.URL.createObjectURL(blob);
          this.setState({ viewDoc: true, filePath: fileUrl, fileType });
        } else {
          new FileHelper().getImageUrl(new Blob([blob], { type: 'image/png' }), (imageUrl) => {
            this.setState({ viewDoc: true, filePath: imageUrl, fileType });
          });
        }
        this.setState({ loading: false });
      })
      .catch(() => { this.setState({ loading: false }); this.notify('error', 'Error loading document.'); });
  };

  newRecord = () => this.setState({ visible: true, formErrors: {}, contractData: { ...emptyContract } });

  editRecord = (contract) => {
    const contractData = {
      ...contract,
      ContractStartDate: contract.ContractStartDate ? moment(contract.ContractStartDate).format('YYYY-MM-DD') : '',
      ContractEndDate: contract.ContractEndDate ? moment(contract.ContractEndDate).format('YYYY-MM-DD') : '',
    };
    this.setState({ visible: true, formErrors: {}, contractData });
    if (contract.DocumentPath) this.viewDocument(contract.DocumentPath);
  };

  requestDelete = (r) => this.setState({ confirmOpen: true, pendingDelete: r });
  cancelDelete = () => this.setState({ confirmOpen: false, pendingDelete: null });
  confirmDelete = () => { const r = this.state.pendingDelete; this.setState({ confirmOpen: false, pendingDelete: null }); if (r) this.deleteRecord(r); };
  toggleModal = () => this.setState({ visible: !this.state.visible });

  deleteRecord = async (contract) => {
    contract.CreatedBy = LoginState.UserId; contract.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    this.setState({ loading: true });
    await new CommonUtilityController().deleteContractDetails(contract)
      .then((data) => { this.setState({ loading: false }); if (data != undefined) this.setState({ data }); this.notify('success', 'Data successfully deleted.'); })
      .catch(() => { this.setState({ loading: false }); this.notify('error', 'Data deletion issue!'); });
  };

  handleField = (field) => (e) => {
    const value = e?.target ? e.target.value : e;
    this.setState((s) => ({ contractData: { ...s.contractData, [field]: value }, formErrors: { ...s.formErrors, [field]: undefined } }));
  };

  validateForm = () => {
    const { contractData: d } = this.state;
    const errors = {};
    if (!String(d.ContractNo || '').trim()) errors.ContractNo = 'Contract No. is required';
    if (!String(d.ContractName || '').trim()) errors.ContractName = 'Contract Name is required';
    if (!d.ProjectId) errors.ProjectId = 'Project is required';
    if (!d.ContractorId) errors.ContractorId = 'Contractor is required';
    if (!String(d.ContractType || '').trim()) errors.ContractType = 'Contract Type is required';
    if (!d.ContractStartDate) errors.ContractStartDate = 'Start Date is required';
    if (!d.ContractEndDate) errors.ContractEndDate = 'End Date is required';
    if (d.ContractStartDate && d.ContractEndDate && compareDate(d.ContractStartDate, d.ContractEndDate)) {
      errors.ContractEndDate = 'Start Date should be less than or equal to End Date';
    }
    this.setState({ formErrors: errors });
    return Object.keys(errors).length === 0;
  };

  onFormSubmit = (e) => { if (e?.preventDefault) e.preventDefault(); if (!this.validateForm()) return; this.handleSubmit({ ...this.state.contractData }); };

  handleSubmit = async (contract) => {
    let isexist = false;
    this.setState({ loading: true });
    await new CommonUtilityController().isRecordExists({ Record: contract, TableName: 'ContractMaster' })
      .then((result) => { this.setState({ loading: false }); if (result?.status == 1) { isexist = true; this.notify('error', 'Record already exists'); } })
      .catch(() => { isexist = true; this.setState({ loading: false }); this.notify('error', 'Error found while validating the Record'); });
    if (isexist) return;

    contract.ContractStartDate = moment(contract.ContractStartDate).format('YYYY-MM-DD HH:mm:ss');
    contract.ContractEndDate = moment(contract.ContractEndDate).format('YYYY-MM-DD HH:mm:ss');
    contract.CreatedBy = LoginState.UserId; contract.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    contract.LockedBy = LoginState.LockedBy; contract.LockedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    contract.SecurityId = LoginState.SecurityId; contract.Status = 1;
    this.setState({ loading: true });
    await new CommonUtilityController().saveContractDetails(contract)
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
      { field: 'ContractNo', headerName: 'Contract No.', flex: 1, minWidth: 130 },
      { field: 'ContractName', headerName: 'Contract', flex: 1.6, minWidth: 200 },
      { field: 'ProjectName', headerName: 'Project', flex: 1.2, minWidth: 150 },
      { field: 'ContractorName', headerName: 'Contractor', flex: 1.2, minWidth: 150 },
      { field: 'ContractType', headerName: 'Contract Type', flex: 1, minWidth: 130 },
      { field: 'ContractStartDate', headerName: 'Start Date', width: 120 },
      { field: 'ContractEndDate', headerName: 'End Date', width: 120 },
      { field: 'ContractValue', headerName: 'Contract Value', type: 'number', align: 'right', headerAlign: 'right', width: 140 },
      { field: 'SectionValue', headerName: 'Section Value', type: 'number', align: 'right', headerAlign: 'right', width: 130 },
    ];
  }

  render() {
    const { data, loading, visible, contractData, projectList, contractorList, contractTypeList, viewDoc, filePath, fileType, confirmOpen, formErrors, snackbar } = this.state;
    const count = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;
    return (
      <PageContainer>
        <PageHeader title="Contract" subtitle="Manage contract details"
          actions={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={this.newRecord}>New Contract</Button>}
        />
        <DataCard title="Contract Details" count={data.length ? count : null} countLabel="Records">
          <AppDataGrid rows={data} columns={this.gridColumns} loading={loading} getRowId={(row) => row.ContractId}
            emptyTitle="No contracts yet" emptyDescription="Create your first contract."
            emptyAction={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={this.newRecord}>New Contract</Button>}
            height={650}
          />
        </DataCard>

        <FormDialog open={visible} onClose={this.toggleModal} title="Contract Details" maxWidth="md"
          actions={<><Button variant="text" color="inherit" onClick={this.toggleModal}>Close</Button><Button variant="contained" onClick={this.onFormSubmit}>Submit</Button></>}
        >
          <Grid container spacing={2.5} sx={{ pt: 0.5 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Contract No." required value={contractData.ContractNo || ''} onChange={this.handleField('ContractNo')} error={!!formErrors.ContractNo} helperText={formErrors.ContractNo} placeholder="Please enter contract no." />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Contract Name" required value={contractData.ContractName || ''} onChange={this.handleField('ContractName')} error={!!formErrors.ContractName} helperText={formErrors.ContractName} placeholder="Please enter contract name" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select label="Project" required value={contractData.ProjectId || ''} onChange={this.handleField('ProjectId')} error={!!formErrors.ProjectId} helperText={formErrors.ProjectId}>
                <MenuItem value="">Select....</MenuItem>
                {projectList.map((p) => <MenuItem key={p.ProjectMasterId} value={p.ProjectMasterId}>{p.ProjectName}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select label="Contractor" required value={contractData.ContractorId || ''} onChange={this.handleField('ContractorId')} error={!!formErrors.ContractorId} helperText={formErrors.ContractorId}>
                <MenuItem value="">Select....</MenuItem>
                {contractorList.map((c) => <MenuItem key={c.ContractorId} value={c.ContractorId}>{c.ContractorName}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select label="Contract Type" required value={contractData.ContractType || ''} onChange={this.handleField('ContractType')} error={!!formErrors.ContractType} helperText={formErrors.ContractType}>
                <MenuItem value="">Select....</MenuItem>
                {contractTypeList.map((t) => <MenuItem key={t.LookupId} value={t.LookupName}>{t.LookupName}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField type="date" label="Start Date" required InputLabelProps={{ shrink: true }} value={contractData.ContractStartDate || ''} onChange={this.handleField('ContractStartDate')} error={!!formErrors.ContractStartDate} helperText={formErrors.ContractStartDate} />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField type="date" label="End Date" required InputLabelProps={{ shrink: true }} value={contractData.ContractEndDate || ''} onChange={this.handleField('ContractEndDate')} error={!!formErrors.ContractEndDate} helperText={formErrors.ContractEndDate} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField type="number" label="Contract Value" value={contractData.ContractValue || ''} onChange={this.handleField('ContractValue')} placeholder="Please enter contract value" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField type="number" label="Section Value" value={contractData.SectionValue || ''} onChange={this.handleField('SectionValue')} placeholder="Please enter section value" />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField label="Client Name" value={contractData.ClientName || ''} onChange={this.handleField('ClientName')} placeholder="Please enter client name" />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField label="Consultant Name" value={contractData.ConsultantName || ''} onChange={this.handleField('ConsultantName')} placeholder="Please enter consultant name" />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField label="Short Description" value={contractData.ShortDescription || ''} onChange={this.handleField('ShortDescription')} placeholder="Please enter short description" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField label="Remarks" multiline minRows={2} inputProps={{ maxLength: 4000 }} value={contractData.Remarks || ''} onChange={this.handleField('Remarks')} placeholder="Please enter remarks" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FileUpload
                fileProp={SIGN_FILE_PROP}
                saveApi={ContractAtt_Api}
                RecordData={contractData}
                documentPath={contractData.DocumentPath}
                fileName={contractData.FileName}
                viewDocument={this.viewDocument}
              />
            </Grid>
          </Grid>
        </FormDialog>

        {viewDoc && (
          <FileViewer fileType={fileType} filePath={filePath} onClose={() => this.setState({ viewDoc: false })} />
        )}

        <ConfirmDialog open={confirmOpen} title="Delete contract?" message="Are you sure you want to delete this record?" confirmText="Delete" onConfirm={this.confirmDelete} onCancel={this.cancelDelete} />
        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={this.closeSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <Alert onClose={this.closeSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>{snackbar.message}</Alert>
        </Snackbar>
      </PageContainer>
    );
  }
}

export default Contract;
