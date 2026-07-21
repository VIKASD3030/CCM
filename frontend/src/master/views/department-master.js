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
import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';
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
import CorporateFareRoundedIcon from '@mui/icons-material/CorporateFareRounded';

import LoginState from '../../authentication/loginState';
import CommonUtilityController from '../controller/common-utility-controller';
import { fillSelectList } from '../../helper/common-utility';
import ExcelJS from 'exceljs';
import FileHelper from '../../helper/file-helper';
import { DEPARTMENT_SAMPLE_DOC_PATH } from '../../helper/constants';
import {
  PageContainer,
  PageHeader,
  DataCard,
  EmptyState,
  FormDialog,
  ConfirmDialog,
  AppDataGrid,
} from '../../components/ui';

const inputJson = [
  { name: 'DepartmentCode', type: 'string', required: true },
  { name: 'DepartmentName', type: 'string', required: true },
  { name: 'ParentDepartmentCode', type: 'string', required: false },
];

const emptyDepartment = {
  DepartmentId: 0,
  DepartmentCode: '',
  DepartmentName: '',
  ParentDepartmentId: '',
  Level: '',
  Remarks: '',
  Status: 0,
  ReferenceCode: '',
};

class Department extends Component {
  constructor(props) {
    super(props);
    this.state = {
      data: [],
      departmentData: { ...emptyDepartment },
      loading: false,
      visible: false,
      departmentParentList: [],
      filteredTotal: null,
      isUpload: true,
      excelRows: [],
      enableUpload: false,
      confirmOpen: false,
      pendingDelete: null,
      formErrors: {},
      snackbar: { open: false, severity: 'success', message: '' },
    };
  }

  componentDidMount() {
    this.getDepartments();
  }

  notify = (severity, message) => {
    this.setState({ snackbar: { open: true, severity, message } });
  };

  closeSnackbar = () => {
    this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));
  };

  // fetch Departments
  async getDepartments() {
    this.setState({ loading: true, departmentList: [] });
    await new CommonUtilityController()
      .getDepartments(0, 0)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) {
          let departmentParentList = fillSelectList(data, 'DepartmentName', 'DepartmentId');
          this.setState({ data: data, departmentParentList: departmentParentList });
        }
      })
      .catch((error) => {
        this.setState({ loading: false });
        this.notify('error', error.toString());
      });
  }

  // New record
  newRecord = () => {
    this.setState({
      loading: false,
      editable: true,
      visible: true,
      isUpload: false,
      formErrors: {},
      departmentData: { ...emptyDepartment },
    });
  };

  // edit record
  editRecord = (department) => {
    if (department.ParentDepartmentId == 0 || department.ParentDepartmentId == null) {
      department.ParentDepartmentId = '';
    }
    this.setState({
      loading: false,
      editable: true,
      isUpload: false,
      visible: true,
      formErrors: {},
      departmentData: { ...department },
    });
  };

  requestDelete = (department) => {
    this.setState({ confirmOpen: true, pendingDelete: department });
  };

  cancelDelete = () => {
    this.setState({ confirmOpen: false, pendingDelete: null });
  };

  confirmDelete = () => {
    const department = this.state.pendingDelete;
    this.setState({ confirmOpen: false, pendingDelete: null });
    if (department) this.deleteRecord(department);
  };

  // delete record
  deleteRecord = async (department) => {
    department.CreatedBy = LoginState.UserId;
    department.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    this.setState({ loading: true });

    await new CommonUtilityController()
      .deleteDepartmentDetails(department)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) {
          let departmentParentList = fillSelectList(data, 'DepartmentName', 'DepartmentId');
          this.setState({ data: data, departmentParentList: departmentParentList });
        }
        this.notify('success', 'Data successfully deleted.');
      })
      .catch((error) => {
        this.setState({ loading: false });
        this.notify('error', 'Data deletion issue!');
      });
  };

  toggleModal = () => {
    this.setState({ visible: !this.state.visible });
  };

  handleField = (field) => (event) => {
    const value = event && event.target ? event.target.value : event;
    this.setState((s) => ({
      departmentData: { ...s.departmentData, [field]: value },
      formErrors: { ...s.formErrors, [field]: undefined },
    }));
  };

  validateForm = () => {
    const { departmentData } = this.state;
    const errors = {};
    if (!String(departmentData.DepartmentCode || '').trim()) errors.DepartmentCode = 'Department Code is required';
    if (!String(departmentData.DepartmentName || '').trim()) errors.DepartmentName = 'Department Name is required';
    if (departmentData.Level === '' || departmentData.Level === null || departmentData.Level === undefined)
      errors.Level = 'Order By is required';
    this.setState({ formErrors: errors });
    return Object.keys(errors).length === 0;
  };

  onFormSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!this.validateForm()) return;
    this.handleSubmit({ ...this.state.departmentData });
  };

  handleSubmit = async (department) => {
    // ********** Duplicate entry validation */
    if (department.ParentDepartmentId == '') {
      department.ParentDepartmentId = '0';
    }
    let isexist = false;
    let reqData = {
      Record: department,
      TableName: 'Department',
    };

    this.setState({ loading: true });
    await new CommonUtilityController()
      .isRecordExists(reqData)
      .then((result) => {
        this.setState({ loading: false });
        if (result?.status == 1) {
          isexist = true;
          this.notify('error', 'Record already exists');
        }
      })
      .catch((error) => {
        isexist = true;
        this.setState({ loading: false });
        this.notify('error', 'Error found while validate the Record');
      });
    if (isexist) return false;
    /// ********** Duplicate entry validation */

    department.CreatedBy = LoginState.UserId;
    department.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    department.LockedBy = LoginState.LockedBy;
    department.LockedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    department.SecurityId = LoginState.SecurityId;
    department.Status = 1;
    this.setState({ loading: true });
    await new CommonUtilityController()
      .saveDepartmentDetails(department)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) {
          let departmentParentList = fillSelectList(data, 'DepartmentName', 'DepartmentId');
          this.setState({ data: data, departmentParentList: departmentParentList, visible: false });
        }
        this.notify('success', 'Data successfully Inserted.');
      })
      .catch((error) => {
        this.setState({ loading: false });
        this.notify('error', 'Data insertion issue!');
      });
  };

  // -------- upload file ------------------------
  renderFileData = async (fileObj, inputJson) => {
    const { searchData } = this.state;

    this.setState({ loading: true, excelRows: [], enableUpload: false });

    try {
      const buffer = await fileObj.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        this.setState({ loading: false });
        return;
      }

      const excelData = [];
      worksheet.eachRow({ includeEmpty: true }, (row) => {
        const rowValues = row.values;
        rowValues.shift();
        excelData.push(rowValues);
      });

      if (!excelData || excelData.length === 0) {
        this.setState({ loading: false });
        return;
      }

      const cols = excelData[0];
      if (inputJson.length !== cols.length) {
        this.notify('error', 'No. of columns should be equal as given sample excel !!');
        this.setState({ loading: false });
        return;
      }

      for (let i = 0; i < inputJson.length; i++) {
        if (cols[i] !== inputJson[i].name) {
          this.notify('error', `${inputJson[i].name} column is invalid or not in sequence !!`);
          this.setState({ loading: false });
          return;
        }
      }

      let jdata = [];
      let strMsg = '';
      let rowCount = 0;

      for (let i = 1; i < excelData.length; i++) {
        const rowVal = excelData[i];
        if (!rowVal || rowVal.length === 0) continue;

        if (inputJson.length !== rowVal.length) {
          strMsg += `Row ${i + 1} cell values should not be empty, `;
          continue;
        }

        let rowData = {};
        let flag = false;

        for (let c = 0; c < inputJson.length; c++) {
          if (inputJson[c].required && (rowVal[c] === null || rowVal[c] === undefined || rowVal[c] === '')) {
            if (!(inputJson[c].type === 'number' && rowVal[c] === 0)) {
              strMsg += `Row ${i + 1}, Cell ${c + 1} should not be empty, `;
              flag = true;
              break;
            }
          }

          if (inputJson[c].type === 'number') {
            if (isNaN(rowVal[c])) {
              strMsg += `${rowVal[c]} is not numeric in Row ${i + 1}, Cell ${c + 1}, `;
              flag = true;
              break;
            } else {
              rowData[inputJson[c].name] = rowVal[c];
            }
          } else {
            rowData[inputJson[c].name] = rowVal[c];
          }
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
          rowData.ReferenceCode =
            typeof rowData.ParentActivityCode === 'number'
              ? rowData.ParentActivityCode
              : rowData.ParentActivityCode?.trim();
          rowData.ActivityGroupId = searchData?.ActivityGroupId;

          jdata.push(rowData);
        }
      }

      this.setState({ loading: false, excelRows: jdata, enableUpload: jdata.length > 0 });

      if (strMsg) {
        this.notify('error', `${strMsg}!!`);
      }
    } catch (error) {
      this.notify('error', 'Error reading Excel file.');
      this.setState({ loading: false });
    }
  };

  fileHandler = (event) => {
    if (event.target.files.length) {
      let fileObj = event.target.files[0];
      let fileName = fileObj.name;

      if (fileName?.slice(fileName.lastIndexOf('.') + 1) === 'xlsx') {
        this.renderFileData(fileObj, inputJson);
      } else {
        this.notify('error', 'Invalid File!!');
        this.setState({ excelCols: [], excelRows: [] });
      }
    }
  };
  // --------- Upload File end --------------------

  handleUploadSubmit = async () => {
    this.setState({ visible: true, isUpload: true, enableUpload: false, loading: false, excelRows: [] });
  };

  saveUploadData = async () => {
    let { excelRows } = this.state;
    this.setState({ loading: true });
    await new CommonUtilityController()
      .SaveDepartmentBulkDetails(excelRows)
      .then((data) => {
        this.setState({ loading: false });
        if (data !== undefined) {
          this.setState({ data: data, visible: false });
        }
        this.notify('success', 'Data successfully Inserted.');
      })
      .catch((data) => {
        this.setState({ loading: false });
        this.notify('error', 'Data insertion issue!');
      });
  };

  // DataGrid columns
  get gridColumns() {
    return [
      {
        field: 'action',
        headerName: 'Action',
        width: 110,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) => {
          const disabled = params.row.Status == '9';
          return (
            <Stack direction="row" spacing={0.5}>
              <Tooltip title="Edit record">
                <span>
                  <IconButton
                    size="small"
                    color="primary"
                    disabled={disabled}
                    onClick={() => this.editRecord(params.row)}
                  >
                    <EditRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Delete record">
                <span>
                  <IconButton
                    size="small"
                    color="error"
                    disabled={disabled}
                    onClick={() => this.requestDelete(params.row)}
                  >
                    <DeleteRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          );
        },
      },
      { field: 'DepartmentCode', headerName: 'Department Code', flex: 1, minWidth: 140 },
      { field: 'DepartmentName', headerName: 'Department Name', flex: 1.4, minWidth: 180 },
      { field: 'ParentDepartmentName', headerName: 'Parent Department', flex: 1.2, minWidth: 160 },
      { field: 'Level', headerName: 'Order By', width: 110, type: 'number', align: 'right', headerAlign: 'right' },
      { field: 'Remarks', headerName: 'Remarks', flex: 1.4, minWidth: 180 },
    ];
  }

  get uploadColumns() {
    return ['Department Code', 'Department Name', 'Parent Department'];
  }

  render() {
    const {
      data,
      loading,
      visible,
      departmentData,
      isUpload,
      enableUpload,
      excelRows,
      confirmOpen,
      formErrors,
      snackbar,
    } = this.state;

    const count = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;

    return (
      <PageContainer>
        <PageHeader
          title="Department"
          subtitle="Manage organizational departments and their hierarchy"
          actions={
            <>
              <Tooltip title="Download sample file: In ParentDepartmentUnit cell set NA if Department is Parent Department">
                <Button
                  variant="outlined"
                  color="primary"
                  startIcon={<CloudDownloadRoundedIcon />}
                  onClick={() => new FileHelper().downloadAttachment(DEPARTMENT_SAMPLE_DOC_PATH, 'Sample')}
                >
                  Sample
                </Button>
              </Tooltip>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<UploadFileRoundedIcon />}
                onClick={() => this.handleUploadSubmit()}
              >
                Upload
              </Button>
              <Button variant="contained" color="primary" startIcon={<AddRoundedIcon />} onClick={() => this.newRecord()}>
                New Department
              </Button>
            </>
          }
        />

        <DataCard title="Department Details" count={data.length ? count : null} countLabel="Records">
          {!loading && data.length === 0 ? (
            <EmptyState
              icon={<CorporateFareRoundedIcon />}
              title="No departments yet"
              description="Create your first department or bulk-import them from an Excel sheet."
              primaryAction={
                <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => this.newRecord()}>
                  New Department
                </Button>
              }
            />
          ) : (
            <AppDataGrid
              rows={data}
              columns={this.gridColumns}
              loading={loading}
              getRowId={(row) => row.DepartmentId}
              onStateChange={() => {}}
              emptyTitle="No matching departments"
              emptyDescription="Try adjusting your search."
            />
          )}
        </DataCard>

        {/* Create / Edit / Upload dialog */}
        <FormDialog
          open={visible}
          onClose={this.toggleModal}
          title={isUpload ? 'Upload Departments' : 'Department Details'}
          maxWidth={isUpload ? 'md' : 'sm'}
          actions={
            isUpload ? (
              <>
                <Button variant="text" color="inherit" onClick={this.toggleModal}>
                  Close
                </Button>
                <Button variant="contained" disabled={!enableUpload} onClick={this.saveUploadData}>
                  Save
                </Button>
              </>
            ) : (
              <>
                <Button variant="text" color="inherit" onClick={this.toggleModal}>
                  Close
                </Button>
                <Button variant="contained" onClick={this.onFormSubmit}>
                  Submit
                </Button>
              </>
            )
          }
        >
          {!isUpload ? (
            <Box component="form" onSubmit={this.onFormSubmit} noValidate>
              <Grid container spacing={2.5} sx={{ pt: 0.5 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Department Code"
                    required
                    value={departmentData.DepartmentCode || ''}
                    onChange={this.handleField('DepartmentCode')}
                    error={!!formErrors.DepartmentCode}
                    helperText={formErrors.DepartmentCode}
                    placeholder="Please enter department code"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Department Name"
                    required
                    value={departmentData.DepartmentName || ''}
                    onChange={this.handleField('DepartmentName')}
                    error={!!formErrors.DepartmentName}
                    helperText={formErrors.DepartmentName}
                    placeholder="Please enter department name"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    select
                    label="Parent Department"
                    value={departmentData.ParentDepartmentId || ''}
                    onChange={this.handleField('ParentDepartmentId')}
                  >
                    <MenuItem value="">Select....</MenuItem>
                    {data.map((d) => (
                      <MenuItem key={d.DepartmentId} value={d.DepartmentId}>
                        {d.DepartmentName}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Order By"
                    type="number"
                    required
                    value={departmentData.Level ?? ''}
                    onChange={this.handleField('Level')}
                    error={!!formErrors.Level}
                    helperText={formErrors.Level}
                    inputProps={{ min: 0 }}
                    placeholder="Please enter number"
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="Remarks"
                    multiline
                    minRows={2}
                    inputProps={{ maxLength: 4000 }}
                    value={departmentData.Remarks || ''}
                    onChange={this.handleField('Remarks')}
                    placeholder="Please enter remarks"
                  />
                </Grid>
              </Grid>
            </Box>
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
                      {this.uploadColumns.map((c) => (
                        <TableCell key={c}>{c}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {excelRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={this.uploadColumns.length} align="center" sx={{ color: 'text.secondary' }}>
                          No rows loaded. Choose a .xlsx file to preview.
                        </TableCell>
                      </TableRow>
                    ) : (
                      excelRows.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell>{r.DepartmentCode}</TableCell>
                          <TableCell>{r.DepartmentName}</TableCell>
                          <TableCell>{r.ParentDepartmentCode}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </FormDialog>

        <ConfirmDialog
          open={confirmOpen}
          title="Delete department?"
          message="Are you sure you want to delete this record? This action cannot be undone."
          confirmText="Delete"
          onConfirm={this.confirmDelete}
          onCancel={this.cancelDelete}
        />

        <Backdrop open={loading && visible} sx={{ position: 'absolute', zIndex: (t) => t.zIndex.modal + 1 }}>
          <CircularProgress color="inherit" />
        </Backdrop>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={this.closeSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert onClose={this.closeSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </PageContainer>
    );
  }
}

export default Department;
