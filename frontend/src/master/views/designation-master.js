import moment from 'moment';
import React, { Component } from 'react';
import {
  TextField, MenuItem, Grid, Box, Typography,
  Snackbar, Alert, Button as MuiButton,
  Menu, ListItemIcon, ListItemText, Tooltip, IconButton,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreIcon,
  Category as CategoryIcon,
} from '@mui/icons-material';
import LoginState from '../../authentication/loginState';
import CommonUtilityController from '../controller/common-utility-controller';
import { fillSelectList } from '../../helper/common-utility';
import {
  PageContainer, PageHeader, AppDataGrid, FormDialog, ConfirmDialog,
  AppBreadcrumbs, GridToolbar,
} from '../../components/ui';

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
      searchText: '',
      density: 'standard',
      columnVisibility: {
        DesignationCode: true,
        DesignationName: true,
        ParentDesignationName: true,
        Remarks: true,
      },
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

  getFilteredData() {
    const { data, searchText } = this.state;
    if (!searchText) return data;
    const q = searchText.toLowerCase();
    return data.filter((r) =>
      (r.DesignationCode || '').toLowerCase().includes(q) ||
      (r.DesignationName || '').toLowerCase().includes(q) ||
      (r.ParentDesignationName || '').toLowerCase().includes(q)
    );
  }

  handleExport = () => {
    const filtered = this.getFilteredData();
    const headers = ['Designation Code', 'Designation Name', 'Parent Designation', 'Remarks'];
    const rows = filtered.map((r) => [r.DesignationCode, r.DesignationName, r.ParentDesignationName, r.Remarks]);
    const csv = [headers, ...rows].map((row) => row.map((c) => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'designations.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  handleRefresh = () => {
    this.getDesignations();
  }

  get gridColumns() {
    const { columnVisibility } = this.state;
    const cols = [
      {
        field: 'action', headerName: '', width: 56, sortable: false, filterable: false, disableColumnMenu: true,
        renderCell: (params) => <ActionMenu record={params.row} onEdit={this.editRecord} onDelete={this.requestDelete} />,
      },
      {
        field: 'DesignationCode', headerName: 'Designation Code', flex: 1, minWidth: 150,
        renderCell: (params) => (
          <Typography sx={{ fontSize: 13, color: '#374151' }}>{params.value || '—'}</Typography>
        ),
      },
      {
        field: 'DesignationName', headerName: 'Designation Name', flex: 1.4, minWidth: 180,
        renderCell: (params) => (
          <Typography sx={{ fontSize: 13, color: '#374151' }}>{params.value || '—'}</Typography>
        ),
      },
      {
        field: 'ParentDesignationName', headerName: 'Parent Designation', flex: 1.2, minWidth: 170,
        renderCell: (params) => (
          <Typography sx={{ fontSize: 13, color: '#374151' }}>{params.value || '—'}</Typography>
        ),
      },
      {
        field: 'Remarks', headerName: 'Remarks', flex: 1.4, minWidth: 180,
        renderCell: (params) => (
          <Typography sx={{ fontSize: 13, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {params.value || '—'}
          </Typography>
        ),
      },
    ];
    return cols.filter((c) => c.field === 'action' || columnVisibility[c.field] !== false);
  }

  render() {
    const { data, loading, visible, designationData, confirmOpen, formErrors, snackbar, searchText, density, columnVisibility } = this.state;
    const filteredData = this.getFilteredData();
    const count = filteredData.length;

    return (
      <PageContainer>
        <AppBreadcrumbs />

        <PageHeader title="Designation" subtitle="Manage organizational designations"
          actions={
            <MuiButton variant="contained" startIcon={<AddIcon />} onClick={this.newRecord} sx={{ borderRadius: '10px', px: 3, py: 1.25 }}>
              New Designation
            </MuiButton>
          }
        />

        <Box>
          <GridToolbar
            searchValue={searchText}
            onSearchChange={(val) => this.setState({ searchText: val })}
            searchPlaceholder="Search designations..."
            onRefresh={this.handleRefresh}
            onExport={this.handleExport}
            columnVisibility={columnVisibility}
            onColumnToggle={(field) => this.setState((prev) => ({
              columnVisibility: { ...prev.columnVisibility, [field]: !prev.columnVisibility[field] },
            }))}
            density={density}
            onDensityChange={(d) => this.setState({ density: d })}
          />
          <AppDataGrid
            rows={filteredData}
            columns={this.gridColumns}
            loading={loading}
            getRowId={(row) => row.DesignationId}
            density={density}
            height={Math.min(56 + count * 56 + 56, 720)}
            pageSize={10}
            emptyTitle="No designations yet"
            emptyDescription="Create your first designation."
            emptyIcon={<CategoryIcon sx={{ fontSize: 40 }} />}
            emptyAction={
              <MuiButton variant="contained" startIcon={<AddIcon />} onClick={this.newRecord} sx={{ borderRadius: '10px', px: 3 }}>
                Create Designation
              </MuiButton>
            }
          />
        </Box>

        <FormDialog open={visible} onClose={this.toggleModal} title="Designation Details"
          actions={null}
        >
          <Box component="form" onSubmit={this.onFormSubmit}>
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
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, pt: 2, mt: 3, borderTop: '1px solid #F3F4F6' }}>
              <MuiButton variant="text" color="inherit" onClick={this.toggleModal} sx={{ borderRadius: '10px' }}>
                Cancel
              </MuiButton>
              <MuiButton variant="contained" color="primary" type="submit" sx={{ borderRadius: '10px', px: 3 }}>
                Submit
              </MuiButton>
            </Box>
          </Box>
        </FormDialog>

        <ConfirmDialog open={confirmOpen} title="Delete designation?"
          message="Are you sure you want to delete this record? This action cannot be undone."
          confirmText="Delete" onConfirm={this.confirmDelete} onCancel={this.cancelDelete} />

        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={this.closeSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <Alert onClose={this.closeSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%', borderRadius: '10px' }}>{snackbar.message}</Alert>
        </Snackbar>
      </PageContainer>
    );
  }
}

function ActionMenu({ record, onEdit, onDelete }) {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);
  const disabled = record.Status == '9';

  return (
    <>
      <Tooltip title="Actions">
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); setAnchorEl(e.currentTarget); }}
          sx={{
            color: '#9CA3AF',
            width: 32, height: 32,
            borderRadius: '8px',
            transition: 'all 0.15s ease',
            '&:hover': { bgcolor: '#F1F5F9', color: '#1E3A8A' },
          }}
        >
          <MoreIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        slotProps={{ paper: { sx: { minWidth: 160, p: 0.5 } } }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem dense disabled={disabled} onClick={() => { setAnchorEl(null); onEdit(record); }} sx={{ borderRadius: 1 }}>
          <ListItemIcon><EditIcon sx={{ fontSize: 16, color: '#059669' }} /></ListItemIcon>
          <ListItemText primary="Edit" primaryTypographyProps={{ fontSize: 13, fontWeight: 500 }} />
        </MenuItem>
        <MenuItem dense disabled={disabled} onClick={() => { setAnchorEl(null); onDelete(record); }} sx={{ borderRadius: 1 }}>
          <ListItemIcon><DeleteIcon sx={{ fontSize: 16, color: '#EF4444' }} /></ListItemIcon>
          <ListItemText primary="Delete" primaryTypographyProps={{ fontSize: 13, fontWeight: 500, color: disabled ? undefined : '#EF4444' }} />
        </MenuItem>
      </Menu>
    </>
  );
}

export default Designation;
