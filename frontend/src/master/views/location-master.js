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

const emptyLocation = {
  LocationId: 0, LocationName: '', ParentLocationId: '', Level: '', Remarks: '', Status: 0,
};

class Location extends Component {
  constructor(props) {
    super(props);
    this.state = {
      data: [],
      locationData: { ...emptyLocation },
      loading: false,
      filteredTotal: null,
      visible: false,
      locationParentList: [],
      confirmOpen: false,
      pendingDelete: null,
      formErrors: {},
      snackbar: { open: false, severity: 'success', message: '' },
    };
  }

  componentDidMount() { this.getLocations(); }

  notify = (severity, message) => this.setState({ snackbar: { open: true, severity, message } });
  closeSnackbar = () => this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));

  async getLocations() {
    this.setState({ loading: true });
    await new CommonUtilityController().getLocations(0, 0)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) {
          this.setState({ data, locationParentList: fillSelectList(data, 'LocationName', 'LocationId') });
        }
      })
      .catch((error) => { this.setState({ loading: false }); this.notify('error', error.toString()); });
  }

  newRecord = () => {
    this.setState({ visible: true, formErrors: {}, locationData: { ...emptyLocation } });
  };

  editRecord = (location) => {
    if (location.ParentLocationId == 0 || location.ParentLocationId == null) location.ParentLocationId = '';
    this.setState({ visible: true, formErrors: {}, locationData: { ...location } });
  };

  requestDelete = (location) => this.setState({ confirmOpen: true, pendingDelete: location });
  cancelDelete = () => this.setState({ confirmOpen: false, pendingDelete: null });
  confirmDelete = () => {
    const location = this.state.pendingDelete;
    this.setState({ confirmOpen: false, pendingDelete: null });
    if (location) this.deleteRecord(location);
  };

  deleteRecord = async (location) => {
    location.CreatedBy = LoginState.UserId;
    location.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    this.setState({ loading: true });
    await new CommonUtilityController().deleteLocationDetails(location)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) {
          this.setState({ data, locationParentList: fillSelectList(data, 'LocationName', 'LocationId') });
        }
        this.notify('success', 'Data successfully deleted.');
      })
      .catch(() => { this.setState({ loading: false }); this.notify('error', 'Data deletion issue!'); });
  };

  toggleModal = () => this.setState({ visible: !this.state.visible });

  handleField = (field) => (event) => {
    const value = event?.target ? event.target.value : event;
    this.setState((s) => ({
      locationData: { ...s.locationData, [field]: value },
      formErrors: { ...s.formErrors, [field]: undefined },
    }));
  };

  validateForm = () => {
    const { locationData } = this.state;
    const errors = {};
    if (!String(locationData.LocationName || '').trim()) errors.LocationName = 'Location Name is required';
    if (locationData.Level === '' || locationData.Level === null || locationData.Level === undefined) errors.Level = 'Order By is required';
    this.setState({ formErrors: errors });
    return Object.keys(errors).length === 0;
  };

  onFormSubmit = (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!this.validateForm()) return;
    this.handleSubmit({ ...this.state.locationData });
  };

  handleSubmit = async (location) => {
    if (location.ParentLocationId == '') location.ParentLocationId = '0';
    let isexist = false;
    const reqData = { Record: location, TableName: 'Location' };
    this.setState({ loading: true });
    await new CommonUtilityController().isRecordExists(reqData)
      .then((result) => {
        this.setState({ loading: false });
        if (result?.status == 1) { isexist = true; this.notify('error', 'Record already exists'); }
      })
      .catch(() => { isexist = true; this.setState({ loading: false }); this.notify('error', 'Error found while validate the Record'); });
    if (isexist) return;

    location.CreatedBy = LoginState.UserId;
    location.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    location.LockedBy = LoginState.LockedBy;
    location.LockedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    location.SecurityId = LoginState.SecurityId;
    location.Status = 1;
    this.setState({ loading: true });
    await new CommonUtilityController().saveLocationDetails(location)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) {
          this.setState({ data, locationParentList: fillSelectList(data, 'LocationName', 'LocationId'), visible: false });
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
      { field: 'LocationName', headerName: 'Location Name', flex: 1.2, minWidth: 160 },
      { field: 'ParentLocationName', headerName: 'Parent Location', flex: 1.2, minWidth: 160 },
      { field: 'Level', headerName: 'Order By', width: 110, type: 'number', align: 'right', headerAlign: 'right' },
      { field: 'Remarks', headerName: 'Remarks', flex: 1.4, minWidth: 180 },
    ];
  }

  render() {
    const { data, loading, visible, locationData, locationParentList, confirmOpen, formErrors, snackbar } = this.state;
    const count = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;
    return (
      <PageContainer>
        <PageHeader title="Location" subtitle="Manage organizational locations and their hierarchy"
          actions={
            <Button variant="contained" color="primary" startIcon={<AddRoundedIcon />} onClick={() => this.newRecord()}>
              New Location
            </Button>
          }
        />
        <DataCard title="Location Details" count={data.length ? count : null} countLabel="Records">
          <AppDataGrid rows={data} columns={this.gridColumns} loading={loading}
            getRowId={(row) => row.LocationId} emptyTitle="No locations yet"
            emptyDescription="Create your first location."
            emptyAction={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => this.newRecord()}>New Location</Button>}
          />
        </DataCard>

        <FormDialog open={visible} onClose={this.toggleModal} title="Location Details"
          actions={
            <>
              <Button variant="text" color="inherit" onClick={this.toggleModal}>Close</Button>
              <Button variant="contained" onClick={this.onFormSubmit}>Submit</Button>
            </>
          }
        >
          <Grid container spacing={2.5} sx={{ pt: 0.5 }}>
            <Grid size={{ xs: 12 }}>
              <TextField label="Location Name" required value={locationData.LocationName || ''}
                onChange={this.handleField('LocationName')} error={!!formErrors.LocationName}
                helperText={formErrors.LocationName} placeholder="Please enter location name" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField select label="Parent Location" value={locationData.ParentLocationId || ''}
                onChange={this.handleField('ParentLocationId')}>
                <MenuItem value="">Select....</MenuItem>
                {data.map((d) => (
                  <MenuItem key={d.LocationId} value={d.LocationId}>{d.LocationName}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField label="Order By" type="number" required value={locationData.Level ?? ''}
                onChange={this.handleField('Level')} error={!!formErrors.Level}
                helperText={formErrors.Level} inputProps={{ min: 0 }} placeholder="Please enter number" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField label="Remarks" multiline minRows={2} inputProps={{ maxLength: 4000 }}
                value={locationData.Remarks || ''} onChange={this.handleField('Remarks')}
                placeholder="Please enter remarks" />
            </Grid>
          </Grid>
        </FormDialog>

        <ConfirmDialog open={confirmOpen} title="Delete location?"
          message="Are you sure you want to delete this record? This action cannot be undone."
          confirmText="Delete" onConfirm={this.confirmDelete} onCancel={this.cancelDelete} />

        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={this.closeSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <Alert onClose={this.closeSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </PageContainer>
    );
  }
}

export default Location;
