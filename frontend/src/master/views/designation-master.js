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

const emptyDesignation = {
  DesignationId: 0, DesignationCode: '', DesignationName: '', ParentDesignationId: '', Remarks: '', Status: 0,
};

class Designation extends Component {
  constructor(props) {
    super(props);
    this.formRef = React.createRef();
    this.state = {
      data: [],
      designationData: { ...emptyDesignation },
      loading: false,
      filteredTotal: null,
      visible: false,
      confirmOpen: false,
      pendingDelete: null,
      formErrors: {},
      snackbar: { open: false, severity: 'success', message: '' },
    };
  }

  componentDidMount() { this.getDesignations(); }

  notify = (severity, message) => this.setState({ snackbar: { open: true, severity, message } });
  closeSnackbar = () => this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));

  async getDesignations() {
    this.setState({ loading: true });
    await new CommonUtilityController().getDesignations()
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) {
          this.setState({ data, designationList: fillSelectList(data, 'DesignationName', 'DesignationId') });
        }
      })
      .catch((error) => { this.setState({ loading: false }); this.notify('error', error.toString()); });
  }

  newRecord = () => this.setState({ visible: true, formErrors: {}, designationData: { ...emptyDesignation } });

  editRecord = (designation) => {
    if (designation.ParentDesignationId == 0 || designation.ParentDesignationId == null) designation.ParentDesignationId = '';
    this.setState({ visible: true, formErrors: {}, designationData: { ...designation } });
  };

  requestDelete = (d) => this.setState({ confirmOpen: true, pendingDelete: d });
  cancelDelete = () => this.setState({ confirmOpen: false, pendingDelete: null });
  confirmDelete = () => {
    const d = this.state.pendingDelete;
    this.setState({ confirmOpen: false, pendingDelete: null });
    if (d) this.deleteRecord(d);
  };

  deleteRecord = async (designation) => {
    designation.CreatedBy = LoginState.UserId;
    designation.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    designation.LockedBy = LoginState.LockedBy;
    designation.LockedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    designation.SecurityId = LoginState.SecurityId;
    designation.Status = 1;
    this.setState({ loading: true });
    await new CommonUtilityController().deleteDesignationDetails(designation)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) this.setState({ data });
        this.notify('success', 'Data successfully deleted.');
      })
      .catch(() => { this.setState({ loading: false }); this.notify('error', 'Data deletion issue!'); });
  };

  toggleModal = () => this.setState({ visible: !this.state.visible });

  handleField = (field) => (e) => {
    const value = e?.target ? e.target.value : e;
    this.setState((s) => ({
      designationData: { ...s.designationData, [field]: value },
      formErrors: { ...s.formErrors, [field]: undefined },
    }));
  };

  validateForm = () => {
    const { designationData: d } = this.state;
    const errors = {};
    if (!String(d.DesignationCode || '').trim()) errors.DesignationCode = 'Designation Code is required';
    if (!String(d.DesignationName || '').trim()) errors.DesignationName = 'Designation Name is required';
    this.setState({ formErrors: errors });
    return Object.keys(errors).length === 0;
  };

  onFormSubmit = (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!this.validateForm()) return;
    this.handleSubmit({ ...this.state.designationData });
  };

  handleSubmit = async (designation) => {
    if (designation.ParentDesignationId == '') designation.ParentDesignationId = '0';
    let isexist = false;
    this.setState({ loading: true });
    await new CommonUtilityController().isRecordExists({ Record: designation, TableName: 'Designation' })
      .then((result) => {
        this.setState({ loading: false });
        if (result?.status == 1) { isexist = true; this.notify('error', 'Record already exists'); }
      })
      .catch(() => { isexist = true; this.setState({ loading: false }); this.notify('error', 'Error found while validating the Record'); });
    if (isexist) return;

    designation.CreatedBy = LoginState.UserId;
    designation.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    designation.LockedBy = LoginState.LockedBy;
    designation.LockedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    designation.SecurityId = LoginState.SecurityId;
    designation.Status = 1;
    this.setState({ loading: true });
    await new CommonUtilityController().saveDesignationDetails(designation)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) {
          this.setState({ data, designationList: fillSelectList(data, 'DesignationName', 'DesignationId'), visible: false });
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
              <Tooltip title="Edit record"><span>
                <IconButton size="small" color="primary" disabled={disabled} onClick={() => this.editRecord(params.row)}>
                  <EditRoundedIcon fontSize="small" />
                </IconButton>
              </span></Tooltip>
              <Tooltip title="Delete record"><span>
                <IconButton size="small" color="error" disabled={disabled} onClick={() => this.requestDelete(params.row)}>
                  <DeleteRoundedIcon fontSize="small" />
                </IconButton>
              </span></Tooltip>
            </Stack>
          );
        },
      },
      { field: 'DesignationCode', headerName: 'Designation Code', flex: 1, minWidth: 150 },
      { field: 'DesignationName', headerName: 'Designation Name', flex: 1.4, minWidth: 180 },
      { field: 'ParentDesignationName', headerName: 'Parent Designation', flex: 1.2, minWidth: 170 },
      { field: 'Remarks', headerName: 'Remarks', flex: 1.4, minWidth: 180 },
    ];
  }

  render() {
    const { data, loading, visible, designationData, confirmOpen, formErrors, snackbar } = this.state;
    const count = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;
    return (
      <PageContainer>
        <PageHeader title="Designation" subtitle="Manage organizational designations"
          actions={<Button variant="contained" color="primary" startIcon={<AddRoundedIcon />} onClick={this.newRecord}>New Designation</Button>}
        />
        <DataCard title="Designation Details" count={data.length ? count : null} countLabel="Records">
          <AppDataGrid rows={data} columns={this.gridColumns} loading={loading}
            getRowId={(row) => row.DesignationId} emptyTitle="No designations yet"
            emptyDescription="Create your first designation."
            emptyAction={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={this.newRecord}>New Designation</Button>}
          />
        </DataCard>

        <FormDialog open={visible} onClose={this.toggleModal} title="Designation Details"
          actions={<><Button variant="text" color="inherit" onClick={this.toggleModal}>Close</Button><Button variant="contained" onClick={this.onFormSubmit}>Submit</Button></>}
        >
          <Grid container spacing={2.5} sx={{ pt: 0.5 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Designation Code" required value={designationData.DesignationCode || ''}
                onChange={this.handleField('DesignationCode')} error={!!formErrors.DesignationCode}
                helperText={formErrors.DesignationCode} placeholder="Please enter designation code" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Designation Name" required value={designationData.DesignationName || ''}
                onChange={this.handleField('DesignationName')} error={!!formErrors.DesignationName}
                helperText={formErrors.DesignationName} placeholder="Please enter designation name" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField select label="Parent Designation" value={designationData.ParentDesignationId || ''}
                onChange={this.handleField('ParentDesignationId')}>
                <MenuItem value="">Select....</MenuItem>
                {data.map((d) => <MenuItem key={d.DesignationId} value={d.DesignationId}>{d.DesignationName}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField label="Remarks" multiline minRows={2} inputProps={{ maxLength: 4000 }}
                value={designationData.Remarks || ''} onChange={this.handleField('Remarks')} placeholder="Please enter remarks" />
            </Grid>
          </Grid>
        </FormDialog>

        <ConfirmDialog open={confirmOpen} title="Delete designation?"
          message="Are you sure you want to delete this record? This action cannot be undone."
          confirmText="Delete" onConfirm={this.confirmDelete} onCancel={this.cancelDelete} />

        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={this.closeSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <Alert onClose={this.closeSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>{snackbar.message}</Alert>
        </Snackbar>
      </PageContainer>
    );
  }
}

export default Designation;
