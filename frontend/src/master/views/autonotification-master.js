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

const NOTIFICATION_TYPES = ['Email', 'SMS', 'Push'];
const ACTIVITY_TYPES = ['Start', 'End', 'Milestone'];
const emptyNotification = { AutoNotificationId: 0, NotificaionName: '', NotificationType: '', ActivityType: '', Days: 0, Remarks: '', Status: 0 };

class AutoNotification extends Component {
  constructor(props) {
    super(props);
    this.state = {
      data: [], autoNotificationData: { ...emptyNotification },
      loading: false, visible: false, filteredTotal: null,
      confirmOpen: false, pendingDelete: null, formErrors: {},
      snackbar: { open: false, severity: 'success', message: '' },
    };
  }

  componentDidMount() { this.getAutoNotification(); }
  notify = (s, m) => this.setState({ snackbar: { open: true, severity: s, message: m } });
  closeSnackbar = () => this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));

  async getAutoNotification() {
    this.setState({ loading: true });
    await new CommonUtilityController().getAutoNotification()
      .then((data) => { this.setState({ loading: false }); if (data != undefined) this.setState({ data }); })
      .catch((e) => { this.setState({ loading: false }); this.notify('error', e.toString()); });
  }

  newRecord = () => this.setState({ visible: true, formErrors: {}, autoNotificationData: { ...emptyNotification } });
  editRecord = (r) => this.setState({ visible: true, formErrors: {}, autoNotificationData: { ...r } });
  requestDelete = (r) => this.setState({ confirmOpen: true, pendingDelete: r });
  cancelDelete = () => this.setState({ confirmOpen: false, pendingDelete: null });
  confirmDelete = () => { const r = this.state.pendingDelete; this.setState({ confirmOpen: false, pendingDelete: null }); if (r) this.deleteRecord(r); };
  toggleModal = () => this.setState({ visible: !this.state.visible });

  deleteRecord = async (n) => {
    n.CreatedBy = LoginState.UserId; n.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    this.setState({ loading: true });
    await new CommonUtilityController().deleteAutoNotificationDetails(n)
      .then((data) => { this.setState({ loading: false }); if (data != undefined) this.setState({ data }); this.notify('success', 'Data successfully deleted.'); })
      .catch(() => { this.setState({ loading: false }); this.notify('error', 'Data deletion issue!'); });
  };

  handleField = (field) => (e) => {
    const value = e?.target ? e.target.value : e;
    this.setState((s) => ({ autoNotificationData: { ...s.autoNotificationData, [field]: value }, formErrors: { ...s.formErrors, [field]: undefined } }));
  };

  validateForm = () => {
    const { autoNotificationData: d } = this.state;
    const errors = {};
    if (!String(d.NotificaionName || '').trim()) errors.NotificaionName = 'Notification Name is required';
    if (!String(d.NotificationType || '').trim()) errors.NotificationType = 'Notification Type is required';
    if (!String(d.ActivityType || '').trim()) errors.ActivityType = 'Activity Type is required';
    this.setState({ formErrors: errors });
    return Object.keys(errors).length === 0;
  };

  onFormSubmit = (e) => { if (e?.preventDefault) e.preventDefault(); if (!this.validateForm()) return; this.handleSubmit({ ...this.state.autoNotificationData }); };

  handleSubmit = async (n) => {
    n.CreatedBy = LoginState.UserId; n.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    n.LockedBy = LoginState.LockedBy; n.LockedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    n.SecurityId = LoginState.SecurityId; n.Status = 1;
    this.setState({ loading: true });
    await new CommonUtilityController().saveAutoNotificationDetails(n)
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
      { field: 'NotificationName', headerName: 'Notification Name', flex: 1.4, minWidth: 180 },
      { field: 'NotificationType', headerName: 'Notification Type', flex: 1.2, minWidth: 160 },
      { field: 'ActivityType', headerName: 'Activity Type', flex: 1.2, minWidth: 150 },
      { field: 'Days', headerName: 'Days', type: 'number', align: 'right', headerAlign: 'right', width: 90 },
      { field: 'Remarks', headerName: 'Remarks', flex: 1.4, minWidth: 180 },
    ];
  }

  render() {
    const { data, loading, visible, autoNotificationData, confirmOpen, formErrors, snackbar } = this.state;
    const count = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;
    return (
      <PageContainer>
        <PageHeader title="Auto Notification" subtitle="Manage auto notification settings"
          actions={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={this.newRecord}>New Notification</Button>}
        />
        <DataCard title="Notification Details" count={data.length ? count : null} countLabel="Records">
          <AppDataGrid rows={data} columns={this.gridColumns} loading={loading} getRowId={(row) => row.AutoNotificationId}
            emptyTitle="No notifications yet" emptyDescription="Create your first notification."
            emptyAction={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={this.newRecord}>New Notification</Button>}
          />
        </DataCard>
        <FormDialog open={visible} onClose={this.toggleModal} title="Auto Notification Details"
          actions={<><Button variant="text" color="inherit" onClick={this.toggleModal}>Close</Button><Button variant="contained" onClick={this.onFormSubmit}>Submit</Button></>}
        >
          <Grid container spacing={2.5} sx={{ pt: 0.5 }}>
            <Grid size={{ xs: 12 }}>
              <TextField label="Notification Name" required value={autoNotificationData.NotificaionName || ''} onChange={this.handleField('NotificaionName')} error={!!formErrors.NotificaionName} helperText={formErrors.NotificaionName} placeholder="Please enter notification name" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select label="Notification Type" required value={autoNotificationData.NotificationType || ''} onChange={this.handleField('NotificationType')} error={!!formErrors.NotificationType} helperText={formErrors.NotificationType}>
                <MenuItem value="">Select....</MenuItem>
                {NOTIFICATION_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select label="Activity Type" required value={autoNotificationData.ActivityType || ''} onChange={this.handleField('ActivityType')} error={!!formErrors.ActivityType} helperText={formErrors.ActivityType}>
                <MenuItem value="">Select....</MenuItem>
                {ACTIVITY_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField type="number" label="Days" value={autoNotificationData.Days ?? ''} onChange={this.handleField('Days')} inputProps={{ min: 0 }} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField label="Remarks" multiline minRows={2} inputProps={{ maxLength: 4000 }} value={autoNotificationData.Remarks || ''} onChange={this.handleField('Remarks')} placeholder="Please enter remarks" />
            </Grid>
          </Grid>
        </FormDialog>
        <ConfirmDialog open={confirmOpen} title="Delete notification?" message="Are you sure?" confirmText="Delete" onConfirm={this.confirmDelete} onCancel={this.cancelDelete} />
        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={this.closeSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <Alert onClose={this.closeSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>{snackbar.message}</Alert>
        </Snackbar>
      </PageContainer>
    );
  }
}

export default AutoNotification;
