/**
 * Department Master — Premium enterprise SaaS redesign.
 *
 * All backend logic, APIs, CRUD, Excel upload, and routing are preserved exactly.
 * Only the UI/UX has been transformed.
 */
import moment from 'moment';
import React, { Component } from 'react';
import {
  TextField, MenuItem, Grid, Typography, Box, Snackbar, Alert,
  Backdrop, CircularProgress, Tooltip, Button as MuiButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Menu, ListItemIcon, ListItemText,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreIcon,
  CloudDownload as CloudDownloadIcon,
  UploadFile as UploadFileIcon,
  Business as BusinessIcon,
} from '@mui/icons-material';
import LoginState from '../../authentication/loginState';
import CommonUtilityController from '../controller/common-utility-controller';
import { fillSelectList } from '../../helper/common-utility';
import ExcelJS from 'exceljs';
import FileHelper from '../../helper/file-helper';
import { DEPARTMENT_SAMPLE_DOC_PATH } from '../../helper/constants';
import {
  PageContainer,
  PageHeader,
  EmptyState,
  FormDialog,
  ConfirmDialog,
  AppDataGrid,
  AppBreadcrumbs,
  GridToolbar,
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
      searchText: '',
      columnVisibility: {
        DepartmentCode: true,
        DepartmentName: true,
        ParentDepartmentName: true,
        Level: true,
        Remarks: true,
      },
      density: 'standard',
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

  // ─── Search & filter ──────────────────────────────────
  getFilteredData() {
    const { data, searchText } = this.state;
    if (!searchText) return data;
    const q = searchText.toLowerCase();
    return data.filter(r =>
      (r.DepartmentCode || '').toLowerCase().includes(q) ||
      (r.DepartmentName || '').toLowerCase().includes(q) ||
      (r.ParentDepartmentName || '').toLowerCase().includes(q)
    );
  }

  // ─── Export ────────────────────────────────────────────
  handleExport = () => {
    const filtered = this.getFilteredData();
    const headers = ['Department Code', 'Department Name', 'Parent Department', 'Order By', 'Remarks'];
    const rows = filtered.map(r => [
      r.DepartmentCode, r.DepartmentName, r.ParentDepartmentName, r.Level, r.Remarks,
    ]);
    const csv = [headers, ...rows].map(row => row.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'departments.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  handleRefresh = () => {
    this.getDepartments();
  }

  // DataGrid columns
  get gridColumns() {
    const { columnVisibility } = this.state;
    const cols = [
      {
        field: 'action',
        headerName: '',
        width: 56,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) => <ActionMenu record={params.row} onEdit={this.editRecord} onDelete={this.requestDelete} />,
      },
      {
        field: 'DepartmentCode',
        headerName: 'Department Code',
        flex: 1,
        minWidth: 140,
        renderCell: (params) => (
          <Typography sx={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
            {params.value || '—'}
          </Typography>
        ),
      },
      {
        field: 'DepartmentName',
        headerName: 'Department Name',
        flex: 1.4,
        minWidth: 180,
        renderCell: (params) => (
          <Typography sx={{ fontSize: 13, color: '#374151' }}>
            {params.value || '—'}
          </Typography>
        ),
      },
      {
        field: 'ParentDepartmentName',
        headerName: 'Parent Department',
        flex: 1.2,
        minWidth: 160,
        renderCell: (params) => (
          <Typography sx={{ fontSize: 13, color: '#374151' }}>
            {params.value || '—'}
          </Typography>
        ),
      },
      {
        field: 'Level',
        headerName: 'Order By',
        width: 110,
        type: 'number',
        align: 'right',
        headerAlign: 'right',
        renderCell: (params) => (
          <Typography sx={{ fontSize: 13, color: '#374151', textAlign: 'right', width: '100%' }}>
            {params.value ?? '—'}
          </Typography>
        ),
      },
      {
        field: 'Remarks',
        headerName: 'Remarks',
        flex: 1.4,
        minWidth: 180,
        renderCell: (params) => (
          <Typography sx={{ fontSize: 13, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {params.value || '—'}
          </Typography>
        ),
      },
    ];

    return cols.filter(c => c.field === 'action' || columnVisibility[c.field] !== false);
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
      searchText,
      columnVisibility,
      density,
    } = this.state;

    const filteredData = this.getFilteredData();
    const count = filteredData.length;

    return (
      <PageContainer>

        <AppBreadcrumbs />

        <PageHeader
          title="Department"
          subtitle="Manage organizational departments and their hierarchy"
          actions={
            <>
              <Tooltip title="Download sample file: In ParentDepartmentUnit cell set NA if Department is Parent Department">
                <MuiButton
                  variant="outlined"
                  color="primary"
                  startIcon={<CloudDownloadIcon />}
                  onClick={() => new FileHelper().downloadAttachment(DEPARTMENT_SAMPLE_DOC_PATH, 'Sample')}
                  sx={{ borderRadius: '10px', px: 3, py: 1.25 }}
                >
                  Download Sample
                </MuiButton>
              </Tooltip>
              <MuiButton
                variant="outlined"
                color="primary"
                startIcon={<UploadFileIcon />}
                onClick={() => this.handleUploadSubmit()}
                sx={{ borderRadius: '10px', px: 3, py: 1.25 }}
              >
                Upload
              </MuiButton>
              <MuiButton
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => this.newRecord()}
                sx={{ borderRadius: '10px', px: 3, py: 1.25 }}
              >
                New Department
              </MuiButton>
            </>
          }
        />

        {loading && data.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <CircularProgress />
          </Box>
        ) : !loading && data.length === 0 ? (
          <EmptyState
            icon={<BusinessIcon sx={{ fontSize: 40 }} />}
            title="No Departments Found"
            description="Get started by creating your first department or bulk-importing from Excel."
            primaryAction={
              <MuiButton variant="contained" startIcon={<AddIcon />} onClick={() => this.newRecord()} sx={{ borderRadius: '10px', px: 3 }}>
                Create Department
              </MuiButton>
            }
          />
        ) : (
          <Box>
            <GridToolbar
              searchValue={searchText}
              onSearchChange={(val) => this.setState({ searchText: val })}
              searchPlaceholder="Search departments..."
              onRefresh={this.handleRefresh}
              onExport={this.handleExport}
              columnVisibility={columnVisibility}
              onColumnToggle={(field) => this.setState(prev => ({
                columnVisibility: { ...prev.columnVisibility, [field]: !prev.columnVisibility[field] },
              }))}
              density={density}
              onDensityChange={(d) => this.setState({ density: d })}
            />
            <AppDataGrid
              rows={filteredData}
              columns={this.gridColumns}
              loading={loading}
              getRowId={(row) => row.DepartmentId}
              density={density}
              height={Math.min(56 + count * 56 + 56, 720)}
              pageSize={10}
            />
          </Box>
        )}

        {/* Create / Edit / Upload dialog */}
        <FormDialog
          open={visible}
          onClose={this.toggleModal}
          title={isUpload ? 'Upload Departments' : 'Department Details'}
          maxWidth={isUpload ? 'md' : 'sm'}
          actions={
            isUpload ? (
              <>
                <MuiButton variant="text" color="inherit" onClick={this.toggleModal} sx={{ borderRadius: '10px' }}>
                  Close
                </MuiButton>
                <MuiButton variant="contained" disabled={!enableUpload} onClick={this.saveUploadData} sx={{ borderRadius: '10px', px: 3 }}>
                  Save
                </MuiButton>
              </>
            ) : (
              <>
                <MuiButton variant="text" color="inherit" onClick={this.toggleModal} sx={{ borderRadius: '10px' }}>
                  Cancel
                </MuiButton>
                <MuiButton variant="contained" color="primary" onClick={this.onFormSubmit} sx={{ borderRadius: '10px', px: 3 }}>
                  Submit
                </MuiButton>
              </>
            )
          }
        >
          {!isUpload ? (
            <Box component="form" onSubmit={this.onFormSubmit} noValidate>
              <Grid container spacing={2.5} sx={{ pt: 0.5 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    size="small"
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
                    fullWidth
                    size="small"
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
                    fullWidth
                    size="small"
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
                    fullWidth
                    size="small"
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
                    fullWidth
                    size="small"
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
              <MuiButton variant="outlined" component="label" startIcon={<UploadFileIcon />} sx={{ mb: 2, borderRadius: '10px' }}>
                Choose Excel File
                <input type="file" accept=".xlsx" hidden onChange={this.fileHandler} />
              </MuiButton>
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
          <Alert onClose={this.closeSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%', borderRadius: '10px' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </PageContainer>
    );
  }
}

// ─── Action Menu Component (⋮ button) ────────────────────
function ActionMenu({ record, onEdit, onDelete }) {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);
  const disabled = record.Status == '9';

  return (
    <>
      <Tooltip title="Actions">
        <Box
          component="span"
          onClick={(e) => { e.stopPropagation(); setAnchorEl(e.currentTarget); }}
          sx={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: '#9CA3AF', width: 32, height: 32, borderRadius: '8px', cursor: 'pointer',
            transition: 'all 0.15s ease',
            '&:hover': { bgcolor: '#F1F5F9', color: '#1E3A8A' },
          }}
        >
          <MoreIcon sx={{ fontSize: 18 }} />
        </Box>
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

export default Department;
