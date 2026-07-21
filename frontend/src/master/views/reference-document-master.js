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
import FileUpload from '../common/quality-file-upload';
import FileViewer from '../../helper/file-viewer';
import { IP_FILE_PROP } from '../../helper/constants';
import path from 'path-browserify';
import { PageContainer, PageHeader, DataCard, AppDataGrid, FormDialog, ConfirmDialog } from '../../components/ui';

const DocumentAtt_Api = '/common/SaveDocumentAttachment';
const emptyDoc = { DocumentId: 0, DocumentCode: '', DocumentName: '', ParentDocumentId: '', ModuleGroupId: '', FileName: '', DocumentPath: '', Level: '', Remarks: '', Status: 0 };

class ReferenceDocument extends Component {
  constructor(props) {
    super(props);
    this.formRef = React.createRef();
    this.state = {
      data: [], referenceDocumentData: { ...emptyDoc },
      loading: false, visible: false, filteredTotal: null,
      documentParentList: [], moduleGroupList: [],
      viewDoc: false, fileType: '', filePath: '',
      confirmOpen: false, pendingDelete: null, formErrors: {},
      snackbar: { open: false, severity: 'success', message: '' },
    };
  }

  componentDidMount() { this.getDocuments(); this.getModuleGroups(); }
  notify = (s, m) => this.setState({ snackbar: { open: true, severity: s, message: m } });
  closeSnackbar = () => this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));

  async getDocuments() {
    this.setState({ loading: true });
    await new CommonUtilityController().getDocuments(0)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) this.setState({ data, documentParentList: fillSelectList(data, 'DocumentName', 'DocumentId') });
      })
      .catch((e) => { this.setState({ loading: false }); this.notify('error', e.toString()); });
  }

  async getModuleGroups() {
    this.setState({ loading: true });
    await new CommonUtilityController().getModuleGroups(0)
      .then((data) => { this.setState({ loading: false }); if (data != undefined) this.setState({ moduleGroupList: data }); })
      .catch((e) => { this.setState({ loading: false }); this.notify('error', e.toString()); });
  }

  viewDocument = async (url) => {
    this.setState({ loading: true });
    await new CommonUtilityController().downloadAttachment(url)
      .then((res) => res.blob())
      .then((blob) => {
        const fileType = path.extname(url);
        const fileUrl = window.URL.createObjectURL(new Blob([blob]));
        this.setState({ loading: false, viewDoc: true, filePath: fileUrl, fileType });
      })
      .catch(() => { this.setState({ loading: false }); this.notify('error', 'Error loading document.'); });
  };

  newRecord = () => this.setState({ visible: true, formErrors: {}, referenceDocumentData: { ...emptyDoc } });
  editRecord = (r) => { if (r.ParentDocumentId == 0 || r.ParentDocumentId == null) r.ParentDocumentId = ''; this.setState({ visible: true, formErrors: {}, referenceDocumentData: { ...r } }); };
  requestDelete = (r) => this.setState({ confirmOpen: true, pendingDelete: r });
  cancelDelete = () => this.setState({ confirmOpen: false, pendingDelete: null });
  confirmDelete = () => { const r = this.state.pendingDelete; this.setState({ confirmOpen: false, pendingDelete: null }); if (r) this.deleteRecord(r); };
  toggleModal = () => this.setState({ visible: !this.state.visible });

  deleteRecord = async (doc) => {
    doc.CreatedBy = LoginState.UserId; doc.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    this.setState({ loading: true });
    await new CommonUtilityController().deleteDocumentDetails(doc)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) this.setState({ data, documentParentList: fillSelectList(data, 'DocumentName', 'DocumentId') });
        this.notify('success', 'Data successfully deleted.');
      })
      .catch(() => { this.setState({ loading: false }); this.notify('error', 'Data deletion issue!'); });
  };

  handleField = (field) => (e) => {
    const value = e?.target ? e.target.value : e;
    this.setState((s) => ({ referenceDocumentData: { ...s.referenceDocumentData, [field]: value }, formErrors: { ...s.formErrors, [field]: undefined } }));
  };

  validateForm = () => {
    const { referenceDocumentData: d } = this.state;
    const errors = {};
    if (!String(d.DocumentCode || '').trim()) errors.DocumentCode = 'Document Code is required';
    if (!String(d.DocumentName || '').trim()) errors.DocumentName = 'Document Name is required';
    if (d.Level === '' || d.Level === null || d.Level === undefined) errors.Level = 'Order By is required';
    this.setState({ formErrors: errors });
    return Object.keys(errors).length === 0;
  };

  onFormSubmit = (e) => { if (e?.preventDefault) e.preventDefault(); if (!this.validateForm()) return; this.handleSubmit({ ...this.state.referenceDocumentData }); };

  handleSubmit = async (doc) => {
    if (doc.ParentDocumentId == '') doc.ParentDocumentId = '0';
    let isexist = false;
    this.setState({ loading: true });
    await new CommonUtilityController().isRecordExists({ Record: doc, TableName: 'Document' })
      .then((r) => { this.setState({ loading: false }); if (r?.status == 1) { isexist = true; this.notify('error', 'Record already exists'); } })
      .catch(() => { isexist = true; this.setState({ loading: false }); this.notify('error', 'Error validating the Record'); });
    if (isexist) return;
    doc.CreatedBy = LoginState.UserId; doc.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    doc.LockedBy = LoginState.LockedBy; doc.LockedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    doc.SecurityId = LoginState.SecurityId; doc.Status = 1;
    this.setState({ loading: true });
    await new CommonUtilityController().saveDocumentDetails(doc)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) this.setState({ data, documentParentList: fillSelectList(data, 'DocumentName', 'DocumentId'), visible: false });
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
      { field: 'DocumentCode', headerName: 'Document Code', flex: 1, minWidth: 150 },
      { field: 'DocumentName', headerName: 'Document Name', flex: 1.6, minWidth: 200 },
      { field: 'ParentDocumentName', headerName: 'Parent Document', flex: 1.2, minWidth: 170 },
      { field: 'Level', headerName: 'Order By', width: 100, type: 'number', align: 'right', headerAlign: 'right' },
      { field: 'Remarks', headerName: 'Remarks', flex: 1.2, minWidth: 150 },
    ];
  }

  render() {
    const { data, loading, visible, referenceDocumentData, moduleGroupList, viewDoc, filePath, fileType, confirmOpen, formErrors, snackbar } = this.state;
    const count = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;
    return (
      <PageContainer>
        <PageHeader title="Reference Document" subtitle="Manage reference documents"
          actions={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={this.newRecord}>New Document</Button>}
        />
        <DataCard title="Reference Document Details" count={data.length ? count : null} countLabel="Records">
          <AppDataGrid rows={data} columns={this.gridColumns} loading={loading} getRowId={(row) => row.DocumentId}
            emptyTitle="No documents yet" emptyDescription="Create your first reference document."
            emptyAction={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={this.newRecord}>New Document</Button>}
          />
        </DataCard>
        <FormDialog open={visible} onClose={this.toggleModal} title="Reference Document Details"
          actions={<><Button variant="text" color="inherit" onClick={this.toggleModal}>Close</Button><Button variant="contained" onClick={this.onFormSubmit}>Submit</Button></>}
        >
          <Grid container spacing={2.5} sx={{ pt: 0.5 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Document Code" required value={referenceDocumentData.DocumentCode || ''} onChange={this.handleField('DocumentCode')} error={!!formErrors.DocumentCode} helperText={formErrors.DocumentCode} placeholder="Please enter document code" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Document Name" required value={referenceDocumentData.DocumentName || ''} onChange={this.handleField('DocumentName')} error={!!formErrors.DocumentName} helperText={formErrors.DocumentName} placeholder="Please enter document name" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField select label="Parent Document" value={referenceDocumentData.ParentDocumentId || ''} onChange={this.handleField('ParentDocumentId')}>
                <MenuItem value="">Select....</MenuItem>
                {data.map((d) => <MenuItem key={d.DocumentId} value={d.DocumentId}>{d.DocumentName}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField type="number" label="Order By" required value={referenceDocumentData.Level ?? ''} onChange={this.handleField('Level')} error={!!formErrors.Level} helperText={formErrors.Level} inputProps={{ min: 0 }} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField label="Remarks" multiline minRows={2} inputProps={{ maxLength: 4000 }} value={referenceDocumentData.Remarks || ''} onChange={this.handleField('Remarks')} placeholder="Please enter remarks" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FileUpload fileProp={IP_FILE_PROP} saveApi={DocumentAtt_Api} RecordData={referenceDocumentData}
                documentPath={referenceDocumentData.DocumentPath} fileName={referenceDocumentData.FileName} viewDocument={this.viewDocument} />
            </Grid>
          </Grid>
        </FormDialog>
        {viewDoc && <FileViewer fileType={fileType} filePath={filePath} onClose={() => this.setState({ viewDoc: false })} />}
        <ConfirmDialog open={confirmOpen} title="Delete document?" message="Are you sure?" confirmText="Delete" onConfirm={this.confirmDelete} onCancel={this.cancelDelete} />
        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={this.closeSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <Alert onClose={this.closeSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>{snackbar.message}</Alert>
        </Snackbar>
      </PageContainer>
    );
  }
}

export default ReferenceDocument;
