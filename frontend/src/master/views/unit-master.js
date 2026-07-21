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
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloudDownloadRoundedIcon from '@mui/icons-material/CloudDownloadRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import LoginState from '../../authentication/loginState';
import CommonUtilityController from '../controller/common-utility-controller';
import { fillSelectList } from '../../helper/common-utility';
import ExcelJS from 'exceljs';
import FileHelper from '../../helper/file-helper';
import { UNIT_SAMPLE_DOC_PATH } from '../../helper/constants';
import { PageContainer, PageHeader, DataCard, AppDataGrid, FormDialog, ConfirmDialog } from '../../components/ui';

const inputJson = [
  { name: 'UnitCode', type: 'string', required: true },
  { name: 'UnitName', type: 'string', required: true },
  { name: 'ParentUnitCode', type: 'string', required: false },
];

const emptyUnit = {
  UnitId: 0, UnitCode: '', UnitName: '', ParentUnitId: '', Remarks: '', Status: 0, ReferenceCode: '',
};

class Unit extends Component {
  constructor(props) {
    super(props);
    this.formRef = React.createRef();
    this.state = {
      data: [],
      unitData: { ...emptyUnit },
      loading: false,
      visible: false,
      isUpload: false,
      excelRows: [],
      enableUpload: false,
      filteredTotal: null,
      confirmOpen: false,
      pendingDelete: null,
      formErrors: {},
      snackbar: { open: false, severity: 'success', message: '' },
    };
  }

  componentDidMount() { this.getUnits(); }

  notify = (severity, message) => this.setState({ snackbar: { open: true, severity, message } });
  closeSnackbar = () => this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));

  async getUnits() {
    this.setState({ loading: true });
    await new CommonUtilityController().getUnits()
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) {
          this.setState({ data, unitList: fillSelectList(data, 'UnitName', 'UnitId') });
        }
      })
      .catch((error) => { this.setState({ loading: false }); this.notify('error', error.toString()); });
  }

  newRecord = () => this.setState({ visible: true, isUpload: false, formErrors: {}, unitData: { ...emptyUnit } });

  editRecord = (unit) => {
    if (unit.ParentUnitId == 0 || unit.ParentUnitId == null) unit.ParentUnitId = '';
    this.setState({ visible: true, isUpload: false, formErrors: {}, unitData: { ...unit } });
  };

  requestDelete = (u) => this.setState({ confirmOpen: true, pendingDelete: u });
  cancelDelete = () => this.setState({ confirmOpen: false, pendingDelete: null });
  confirmDelete = () => {
    const u = this.state.pendingDelete;
    this.setState({ confirmOpen: false, pendingDelete: null });
    if (u) this.deleteRecord(u);
  };

  deleteRecord = async (unit) => {
    unit.CreatedBy = LoginState.UserId;
    unit.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    unit.Status = 1;
    this.setState({ loading: true });
    await new CommonUtilityController().deleteUnitDetails(unit)
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
      unitData: { ...s.unitData, [field]: value },
      formErrors: { ...s.formErrors, [field]: undefined },
    }));
  };

  validateForm = () => {
    const { unitData: d } = this.state;
    const errors = {};
    if (!String(d.UnitCode || '').trim()) errors.UnitCode = 'Unit Code is required';
    if (!String(d.UnitName || '').trim()) errors.UnitName = 'Unit Name is required';
    this.setState({ formErrors: errors });
    return Object.keys(errors).length === 0;
  };

  onFormSubmit = (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!this.validateForm()) return;
    this.handleSubmit({ ...this.state.unitData });
  };

  handleSubmit = async (unit) => {
    if (unit.ParentUnitId == '') unit.ParentUnitId = '0';
    let isexist = false;
    this.setState({ loading: true });
    await new CommonUtilityController().isRecordExists({ Record: unit, TableName: 'Unit' })
      .then((result) => {
        this.setState({ loading: false });
        if (result?.status == 1) { isexist = true; this.notify('error', 'Record already exists'); }
      })
      .catch(() => { isexist = true; this.setState({ loading: false }); this.notify('error', 'Error found while validating the Record'); });
    if (isexist) return;

    unit.CreatedBy = LoginState.UserId;
    unit.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    unit.LockedBy = LoginState.LockedBy;
    unit.LockedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    unit.SecurityId = LoginState.SecurityId;
    unit.Status = 1;
    this.setState({ loading: true });
    await new CommonUtilityController().saveUnitDetails(unit)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) {
          this.setState({ data, unitList: fillSelectList(data, 'UnitName', 'UnitId'), visible: false });
        }
        this.notify('success', 'Data successfully Inserted.');
      })
      .catch(() => { this.setState({ loading: false }); this.notify('error', 'Data insertion issue!'); });
  };

  renderFileData = async (fileObj) => {
    this.setState({ loading: true, excelRows: [], enableUpload: false });
    try {
      const buffer = await fileObj.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) { this.setState({ loading: false }); return; }
      const excelData = [];
      worksheet.eachRow({ includeEmpty: true }, (row) => { const v = row.values; v.shift(); excelData.push(v); });
      if (!excelData.length) { this.setState({ loading: false }); return; }
      const cols = excelData[0];
      if (inputJson.length !== cols.length) { this.notify('error', 'No. of columns should be equal as given sample excel !!'); this.setState({ loading: false }); return; }
      for (let i = 0; i < inputJson.length; i++) {
        if (cols[i] !== inputJson[i].name) { this.notify('error', `${inputJson[i].name} column is invalid or not in sequence !!`); this.setState({ loading: false }); return; }
      }
      let jdata = [], strMsg = '', rowCount = 0;
      for (let i = 1; i < excelData.length; i++) {
        const rowVal = excelData[i];
        if (!rowVal || !rowVal.length) continue;
        if (inputJson.length !== rowVal.length) { strMsg += `Row ${i + 1} cell values should not be empty, `; continue; }
        let rowData = {}, flag = false;
        for (let c = 0; c < inputJson.length; c++) {
          if (inputJson[c].required && (rowVal[c] === null || rowVal[c] === undefined || rowVal[c] === '')) { strMsg += `Row ${i + 1}, Cell ${c + 1} should not be empty, `; flag = true; break; }
          rowData[inputJson[c].name] = rowVal[c];
        }
        if (!flag) {
          rowCount++;
          rowData.Sno = rowCount;
          rowData.CreatedBy = LoginState.UserId;
          rowData.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
          rowData.LockedBy = LoginState.LockedBy;
          rowData.LockedDate = moment().format('YYYY-MM-DD HH:mm:ss');
          rowData.SecurityId = LoginState.SecurityId;
          rowData.Status = 1;
          jdata.push(rowData);
        }
      }
      this.setState({ loading: false, excelRows: jdata, enableUpload: jdata.length > 0 });
      if (strMsg) this.notify('error', strMsg + '!!');
    } catch (error) {
      this.notify('error', 'Error reading Excel file.');
      this.setState({ loading: false });
    }
  };

  fileHandler = (event) => {
    if (event.target.files.length) {
      const fileObj = event.target.files[0];
      if (fileObj.name?.slice(fileObj.name.lastIndexOf('.') + 1) === 'xlsx') {
        this.renderFileData(fileObj);
      } else {
        this.notify('error', 'Invalid File!!');
        this.setState({ excelRows: [] });
      }
    }
  };

  handleUploadSubmit = () => this.setState({ visible: true, isUpload: true, enableUpload: false, excelRows: [] });

  saveUploadData = async () => {
    const { excelRows } = this.state;
    this.setState({ loading: true });
    await new CommonUtilityController().SaveUnitBulkDetails(excelRows)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) this.setState({ data, visible: false });
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
              <Tooltip title="Edit record"><span><IconButton size="small" color="primary" disabled={disabled} onClick={() => this.editRecord(params.row)}><EditRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title="Delete record"><span><IconButton size="small" color="error" disabled={disabled} onClick={() => this.requestDelete(params.row)}><DeleteRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
            </Stack>
          );
        },
      },
      { field: 'UnitCode', headerName: 'Unit Code', flex: 1, minWidth: 130 },
      { field: 'UnitName', headerName: 'Unit Name', flex: 1.4, minWidth: 160 },
      { field: 'ParentUnitName', headerName: 'Parent Unit', flex: 1.2, minWidth: 150 },
      { field: 'Remarks', headerName: 'Remarks', flex: 1.4, minWidth: 180 },
    ];
  }

  render() {
    const { data, loading, visible, unitData, isUpload, excelRows, enableUpload, confirmOpen, formErrors, snackbar } = this.state;
    const count = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;
    return (
      <PageContainer>
        <PageHeader title="Unit" subtitle="Manage measurement units"
          actions={
            <>
              <Tooltip title="Download sample file: In ParentUnit cell set NA if unit is Parent Unit">
                <Button variant="outlined" startIcon={<CloudDownloadRoundedIcon />}
                  onClick={() => new FileHelper().downloadAttachment(UNIT_SAMPLE_DOC_PATH, 'Sample')}>Sample</Button>
              </Tooltip>
              <Button variant="outlined" startIcon={<UploadFileRoundedIcon />} onClick={this.handleUploadSubmit}>Upload</Button>
              <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={this.newRecord}>New Unit</Button>
            </>
          }
        />
        <DataCard title="Unit Details" count={data.length ? count : null} countLabel="Records">
          <AppDataGrid rows={data} columns={this.gridColumns} loading={loading}
            getRowId={(row) => row.UnitId} emptyTitle="No units yet"
            emptyDescription="Create your first unit or bulk-import from Excel."
            emptyAction={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={this.newRecord}>New Unit</Button>}
          />
        </DataCard>

        <FormDialog open={visible} onClose={this.toggleModal}
          title={isUpload ? 'Upload Units' : 'Unit Details'}
          maxWidth={isUpload ? 'md' : 'sm'}
          actions={
            isUpload ? (
              <><Button variant="text" color="inherit" onClick={this.toggleModal}>Close</Button><Button variant="contained" disabled={!enableUpload} onClick={this.saveUploadData}>Save</Button></>
            ) : (
              <><Button variant="text" color="inherit" onClick={this.toggleModal}>Close</Button><Button variant="contained" onClick={this.onFormSubmit}>Submit</Button></>
            )
          }
        >
          {!isUpload ? (
            <Grid container spacing={2.5} sx={{ pt: 0.5 }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="Unit Code" required value={unitData.UnitCode || ''}
                  onChange={this.handleField('UnitCode')} error={!!formErrors.UnitCode}
                  helperText={formErrors.UnitCode} placeholder="Please enter unit code" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="Unit Name" required value={unitData.UnitName || ''}
                  onChange={this.handleField('UnitName')} error={!!formErrors.UnitName}
                  helperText={formErrors.UnitName} placeholder="Please enter unit name" />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField select label="Parent Unit" value={unitData.ParentUnitId || ''} onChange={this.handleField('ParentUnitId')}>
                  <MenuItem value="">Select....</MenuItem>
                  {data.map((d) => <MenuItem key={d.UnitId} value={d.UnitId}>{d.UnitName}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField label="Remarks" multiline minRows={2} inputProps={{ maxLength: 4000 }}
                  value={unitData.Remarks || ''} onChange={this.handleField('Remarks')} placeholder="Please enter remarks" />
              </Grid>
            </Grid>
          ) : (
            <Box>
              <Button variant="outlined" component="label" startIcon={<UploadFileRoundedIcon />} sx={{ mb: 2 }}>
                Choose Excel File
                <input type="file" accept=".xlsx" hidden onChange={this.fileHandler} />
              </Button>
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 360 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Unit Code</TableCell>
                      <TableCell>Unit Name</TableCell>
                      <TableCell>Parent Unit Code</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {excelRows.length === 0 ? (
                      <TableRow><TableCell colSpan={3} align="center" sx={{ color: 'text.secondary' }}>No rows loaded. Choose a .xlsx file to preview.</TableCell></TableRow>
                    ) : excelRows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>{r.UnitCode}</TableCell>
                        <TableCell>{r.UnitName}</TableCell>
                        <TableCell>{r.ParentUnitCode}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </FormDialog>

        <ConfirmDialog open={confirmOpen} title="Delete unit?"
          message="Are you sure you want to delete this record? This action cannot be undone."
          confirmText="Delete" onConfirm={this.confirmDelete} onCancel={this.cancelDelete} />

        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={this.closeSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <Alert onClose={this.closeSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>{snackbar.message}</Alert>
        </Snackbar>
      </PageContainer>
    );
  }
}

export default Unit;
