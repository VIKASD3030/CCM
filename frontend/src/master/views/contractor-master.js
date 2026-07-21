import moment from 'moment';
import React, { Component } from 'react';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import LoginState from '../../authentication/loginState';
import CommonUtilityController from '../controller/common-utility-controller';
import FileUpload from '../common/quality-file-upload';
import FileViewer from '../../helper/file-viewer';
import { SIGN_FILE_PROP } from '../../helper/constants';
import path from 'path-browserify';
import { PageContainer, PageHeader, DataCard, AppDataGrid, FormDialog, ConfirmDialog } from '../../components/ui';

const ContractorAtt_Api = '/common/SaveContractorAttachment';

const emptyContractor = {
  ContractorId: 0, ContractorCode: '', ContractorName: '', Remarks: '', Status: 0, FileName: '', DocumentPath: '',
};

class Contractor extends Component {
  constructor(props) {
    super(props);
    this.formRef = React.createRef();
    this.state = {
      data: [],
      contractorData: { ...emptyContractor },
      loading: false,
      visible: false,
      filteredTotal: null,
      viewDoc: false,
      fileType: '',
      filePath: '',
      confirmOpen: false,
      pendingDelete: null,
      formErrors: {},
      snackbar: { open: false, severity: 'success', message: '' },
    };
  }

  componentDidMount() { this.getContractors(); }

  notify = (severity, message) => this.setState({ snackbar: { open: true, severity, message } });
  closeSnackbar = () => this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));

  async getContractors() {
    this.setState({ loading: true });
    await new CommonUtilityController().getContractors()
      .then((data) => { this.setState({ loading: false }); if (data != undefined) this.setState({ data }); })
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
        }
        this.setState({ loading: false });
      })
      .catch(() => { this.setState({ loading: false }); this.notify('error', 'Error loading document.'); });
  };

  newRecord = () => this.setState({ visible: true, formErrors: {}, contractorData: { ...emptyContractor } });
  editRecord = (r) => this.setState({ visible: true, formErrors: {}, contractorData: { ...r } });
  requestDelete = (r) => this.setState({ confirmOpen: true, pendingDelete: r });
  cancelDelete = () => this.setState({ confirmOpen: false, pendingDelete: null });
  confirmDelete = () => { const r = this.state.pendingDelete; this.setState({ confirmOpen: false, pendingDelete: null }); if (r) this.deleteRecord(r); };
  toggleModal = () => this.setState({ visible: !this.state.visible });

  deleteRecord = async (contractor) => {
    contractor.CreatedBy = LoginState.UserId; contractor.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    this.setState({ loading: true });
    await new CommonUtilityController().deleteContractorDetails(contractor)
      .then((data) => { this.setState({ loading: false }); if (data != undefined) this.setState({ data }); this.notify('success', 'Data successfully deleted.'); })
      .catch(() => { this.setState({ loading: false }); this.notify('error', 'Data deletion issue!'); });
  };

  handleField = (field) => (e) => {
    const value = e?.target ? e.target.value : e;
    this.setState((s) => ({ contractorData: { ...s.contractorData, [field]: value }, formErrors: { ...s.formErrors, [field]: undefined } }));
  };

  validateForm = () => {
    const { contractorData: d } = this.state;
    const errors = {};
    if (!String(d.ContractorCode || '').trim()) errors.ContractorCode = 'Contractor Code is required';
    if (!String(d.ContractorName || '').trim()) errors.ContractorName = 'Contractor Name is required';
    this.setState({ formErrors: errors });
    return Object.keys(errors).length === 0;
  };

  onFormSubmit = (e) => { if (e?.preventDefault) e.preventDefault(); if (!this.validateForm()) return; this.handleSubmit({ ...this.state.contractorData }); };

  handleSubmit = async (contractor) => {
    contractor.CreatedBy = LoginState.UserId; contractor.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    contractor.LockedBy = LoginState.LockedBy; contractor.LockedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    contractor.SecurityId = LoginState.SecurityId; contractor.Status = 1;
    this.setState({ loading: true });
    await new CommonUtilityController().saveContractorDetails(contractor)
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
      { field: 'ContractorCode', headerName: 'Contractor Code', flex: 1, minWidth: 150 },
      { field: 'ContractorName', headerName: 'Contractor Name', flex: 1.6, minWidth: 200 },
      { field: 'Remarks', headerName: 'Remarks', flex: 1.4, minWidth: 180 },
    ];
  }

  render() {
    const { data, loading, visible, contractorData, viewDoc, filePath, fileType, confirmOpen, formErrors, snackbar } = this.state;
    const count = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;
    return (
      <PageContainer>
        <PageHeader title="Contractor" subtitle="Manage contractor details"
          actions={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={this.newRecord}>New Contractor</Button>}
        />
        <DataCard title="Contractor Details" count={data.length ? count : null} countLabel="Records">
          <AppDataGrid rows={data} columns={this.gridColumns} loading={loading} getRowId={(row) => row.ContractorId}
            emptyTitle="No contractors yet" emptyDescription="Create your first contractor."
            emptyAction={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={this.newRecord}>New Contractor</Button>}
          />
        </DataCard>
        <FormDialog open={visible} onClose={this.toggleModal} title="Contractor Details"
          actions={<><Button variant="text" color="inherit" onClick={this.toggleModal}>Close</Button><Button variant="contained" onClick={this.onFormSubmit}>Submit</Button></>}
        >
          <Grid container spacing={2.5} sx={{ pt: 0.5 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Contractor Code" required value={contractorData.ContractorCode || ''} onChange={this.handleField('ContractorCode')} error={!!formErrors.ContractorCode} helperText={formErrors.ContractorCode} placeholder="Please enter contractor code" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Contractor Name" required value={contractorData.ContractorName || ''} onChange={this.handleField('ContractorName')} error={!!formErrors.ContractorName} helperText={formErrors.ContractorName} placeholder="Please enter contractor name" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField label="Remarks" multiline minRows={2} inputProps={{ maxLength: 4000 }} value={contractorData.Remarks || ''} onChange={this.handleField('Remarks')} placeholder="Please enter remarks" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FileUpload
                fileProp={SIGN_FILE_PROP}
                saveApi={ContractorAtt_Api}
                RecordData={contractorData}
                documentPath={contractorData.DocumentPath}
                fileName={contractorData.FileName}
                viewDocument={this.viewDocument}
              />
            </Grid>
          </Grid>
        </FormDialog>
        {viewDoc && (
          <FileViewer fileType={fileType} filePath={filePath} onClose={() => this.setState({ viewDoc: false })} />
        )}
        <ConfirmDialog open={confirmOpen} title="Delete contractor?" message="Are you sure you want to delete this record?" confirmText="Delete" onConfirm={this.confirmDelete} onCancel={this.cancelDelete} />
        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={this.closeSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <Alert onClose={this.closeSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>{snackbar.message}</Alert>
        </Snackbar>
      </PageContainer>
    );
  }
}

export default Contractor;
