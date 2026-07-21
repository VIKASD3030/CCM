import moment from 'moment';
import React, { Component } from 'react';
import { Card, CardContent, TextField, MenuItem, Grid, Typography, Backdrop, CircularProgress } from '@mui/material';
import Box from '@mui/material/Box';
import MuiButton from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Stack from '@mui/material/Stack';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import LoginState from '../../authentication/loginState';
import CommonUtilityController from "../controller/common-utility-controller";
import { fillSelectList } from '../../helper/common-utility';
import currencyList from '../common/currencyList'
import { PageContainer, PageHeader, DataCard, FormDialog, ConfirmDialog, AppDataGrid } from '../../components/ui';

const currencyOptions = currencyList.data.map(c => ({
  label: `${c.CtryNm} - ${c.CcyNm}`,
  value: `${c.CtryNm} - ${c.Ccy}`
}));

class ProjectDetails extends Component {

  constructor(props) {
    super(props);
    this.state = {
      data: [],
      projectDetailsData: {
        ProjectDetailsId: 0,
        ProjectId: "",
        ContractId: "",
        LOADate: "",
        Currency: "",
        StartDate: "",
        EndDate: "",
        OriginalContractValue: "",
        Margin: "",
        ClientName: "",
        ContractType: "",
        ProjectDescription: "",
        Remarks: "",
        Status: 0,
      },
      loading: false,
      visible: false,
      viewProject: false,
      projectList: [],
      projectCodeList: [],
      contractList: [],
      contractTypeList: [],
      filteredTotal: null,
      confirmOpen: false,
      pendingDelete: null,
      snackbar: { open: false, severity: 'success', message: '' },
    };

  }
  //load initial data
  componentDidMount() {
    this.getProjectDetails();
    this.getProjects();
    this.getLookupDetails();
  }

  notify = (severity, message) => {
    this.setState({ snackbar: { open: true, severity, message } });
  };

  closeSnackbar = () => {
    this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));
  };

  async getProjectDetails() {
    var reqData = {
      "projectId": 0,
      "contractorId": 0
    }
    this.setState({ loading: true });
    await new CommonUtilityController().getProjectDetails(reqData)
      .then(data => {
        this.setState({ loading: false, });
        if (data != undefined) {
          this.setState({ data: data });
        }
      })
      .catch(error => {
        this.setState({ loading: false, });
        this.notify('error', error.toString());
      });
  }

  //fetch projects
  async getProjects() {
    this.setState({ loading: true });
    let reqData = {
      UserId: LoginState.UserId
    }
    await new CommonUtilityController().getProjects(reqData)
      .then(data => {
        this.setState({ loading: false });
        if (data != undefined) {
          let projectCodeList = fillSelectList(data, "ProjectCode", 'ProjectMasterId');
          this.setState({ projectCodeList: projectCodeList });
        }
      })
      .catch(error => {
        this.setState({ loading: false, });
        this.notify('error', error.toString());
      });
  }

  //fetch contracts
  getcontracts = async (data) => {
    this.setState({ loading: true, });
    await new CommonUtilityController().getContracts(data)
      .then(data => {
        this.setState({ loading: false, });
        if (data != undefined) {
          //fill drop down list
          let contractList = fillSelectList(data, "ContractName", 'ContractId');
          this.setState({ contractList: contractList });
        }
      })
      .catch(error => {
        this.setState({ loading: false, });
        this.notify('error', error.toString());
      });
  }

  async getLookupDetails() {
    this.setState({ loading: true });
    await new CommonUtilityController().getLookupDetails(0)
      .then(data => {
        this.setState({ loading: false });
        if (data != undefined) {
          let contractType = data.filter(a => a.LookupType == "ContractType")

          let contractTypeList = fillSelectList(contractType, "LookupName", "LookupName")
          this.setState({ contractTypeList: contractTypeList });
        }
      })
      .catch(() => {
        this.setState({ loading: false, });
        this.notify('error', 'Data fetching issue!!!');
      });
  }

  projectChange = (value) => {
    this.setState({ contractList: [], projectId: value });
    let { projectDetailsData } = this.state;
    projectDetailsData.ProjectId = value;
    projectDetailsData.ContractId = '';
    this.setState({ projectDetailsData: projectDetailsData });
    var data = {
      "projectId": value,
      "workPackageId": 0,
      "contractorId": 0
    }
    if (value) {
      this.getcontracts(data);
    }
  }

  get gridColumns() {
    return [
      {
        field: 'action',
        headerName: 'Action',
        width: 130,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) => {
          const record = params.row;
          const disabled = record.Status == "9";
          return (
            <Stack direction="row" spacing={0.5}>
              <Tooltip title="View">
                <span>
                  <IconButton size="small" color="primary" onClick={() => this.viewProjectDetails(record)}>
                    <InfoRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Edit record">
                <span>
                  <IconButton size="small" color="primary" disabled={disabled} onClick={() => this.editRecord(record)}>
                    <EditRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Delete record">
                <span>
                  <IconButton size="small" color="error" disabled={disabled} onClick={() => this.requestDelete(record)}>
                    <DeleteRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          );
        },
      },
      { field: 'ProjectCode', headerName: 'Project No.', flex: 1, minWidth: 130 },
      { field: 'ContractName', headerName: 'Contract Name', flex: 1.4, minWidth: 180 },
      { field: 'LOADate', headerName: 'LOA Date', flex: 1, minWidth: 130 },
      { field: 'Remarks', headerName: 'Remarks', flex: 1.4, minWidth: 160 },
    ];
  }

  //New record
  newRecord = () => {
    let projectDetailsData = {
      ProjectDetailsId: 0,
      ProjectId: "",
      ContractId: "",
      LOADate: "",
      Currency: "",
      StartDate: "",
      EndDate: "",
      OriginalContractValue: "",
      Margin: "",
      ClientName: "",
      ContractType: "",
      ProjectDescription: "",
      Remarks: "",
      Status: 0,
    }
    this.setState({ loading: false, editable: true, visible: true, projectDetailsData: projectDetailsData });
  }

  //edit record
  editRecord = async (projectData) => {
    let project = JSON.parse(JSON.stringify(projectData));
    await this.projectEditChange(project.ProjectId);
    await this.contractChange(project.ContractId);
    project.LOADate = moment(project.LOADate, 'DD-MM-YYYY')
    project.StartDate = moment(project.StartDate, 'DD-MM-YYYY')
    project.EndDate = moment(project.EndDate, 'DD-MM-YYYY')
    this.setState({ loading: false, editable: true, visible: true, projectDetailsData: project });
  }

  projectEditChange = async (value) => {
    this.setState({ contractList: [], projectId: value });
    let { projectDetailsData } = this.state;
    projectDetailsData.ProjectId = value;
    this.setState({ projectDetailsData: projectDetailsData });
    var data = {
      "projectId": value,
      "contractorId": 0
    }
    if (value != "") {
      this.getcontracts(data, false);
    }
  }

  contractChange = async (value) => {
    let { projectDetailsData } = this.state;
    projectDetailsData.ContractId = value;
    this.setState({ projectDetailsData: projectDetailsData });
  }

  handleFieldChange = (field, value) => {
    this.setState((prev) => ({
      projectDetailsData: { ...prev.projectDetailsData, [field]: value }
    }));
  }

  handleSubmitForm = (e) => {
    e.preventDefault();
    this.handleSubmit(this.state.projectDetailsData);
  }

  requestDelete = (project) => {
    this.setState({ confirmOpen: true, pendingDelete: project });
  };

  cancelDelete = () => {
    this.setState({ confirmOpen: false, pendingDelete: null });
  };

  confirmDelete = () => {
    const project = this.state.pendingDelete;
    this.setState({ confirmOpen: false, pendingDelete: null });
    if (project) this.deleteRecord(project);
  };

  //delete record
  deleteRecord = async (project) => {
    project.CreatedBy = LoginState.UserId;
    project.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    this.setState({ loading: true });

    await new CommonUtilityController().deleteProjectDetailsData(project)
      .then(data => {
        this.setState({ loading: false, });

        if (data != undefined) {
          this.setState({ data: data });
        }
        this.notify('success', 'Data successfully deleted.');
      })
      .catch(() => {
        this.setState({ loading: false, });
        this.notify('error', 'Data deletion issue!');
      });
  }

  //view record
  viewProjectDetails = (project) => {
    this.setState({ projectDetailsData: project, loading: false, viewProject: true, visible: false, editable: false });
  }

  toggleModal = () => {
    this.setState({
      visible: !this.state.visible
    });
  }

  toggleViewModal = () => {
    this.setState({
      viewProject: !this.state.viewProject
    });
  }

  //upload popup
  toggleUploadModal = () => {
    this.setState({
      visible: !this.state.visible
    });
  }

  handleSubmit = async (project) => {
    const { data } = this.state;

    // //********** Duplicate entry validation*/   

    // let isexist = false;
    // let reqData = {
    //   "Record": project,
    //   "TableName": "ProjectMaster"
    // }

    // this.setState({ loading: true });
    // await new CommonUtilityController().isRecordExists(reqData)
    //   .then((result) => {
    //     this.setState({ loading: false });
    //     if (result?.status == 1) {
    //       isexist = true;
    //       Modal.error({
    //         content: 'Record already exists',
    //       });
    //     }
    //   })
    //   .catch(() => {
    //     isexist = true;
    //     this.setState({ loading: false });
    //     Modal.error({
    //       content: <p>Error found while validate the Record</p>,
    //     });
    //   });
    // if (isexist)

    //   return false;
    ///********** Duplicate entry validation*/
    project.CreatedBy = LoginState.UserId;
    project.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    project.LockedBy = LoginState.LockedBy;
    project.LockedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    project.SecurityId = LoginState.SecurityId;
    project.Status = 1;
    this.setState({ loading: true });

    await new CommonUtilityController().saveProjectDetailsData(project)
      .then(data => {
        this.setState({ loading: false, });
        if (data != undefined) {
          this.setState({ data: data, visible: false });
        }
        this.notify('success', 'Data successfully Inserted.');
      })
      .catch(() => {
        this.setState({ loading: false, });
        this.notify('error', 'Data insertion issue!');
      });
  }

  valueWithComma(value) {
    return value.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
  }

  marginWithPercentage(value){
    return value +"%"
  }

  render() {
    const { data, loading, visible, viewProject, editable, projectDetailsData, projectCodeList, contractList, contractTypeList, confirmOpen, snackbar } = this.state;
    const count = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;
    return (
      <PageContainer>
        <PageHeader
          title="PMO Details"
          subtitle="Manage project management office details"
          actions={
            <MuiButton variant="contained" color="primary" startIcon={<AddRoundedIcon />} onClick={() => this.newRecord()}>
              New
            </MuiButton>
          }
        />

        <DataCard title="PMO Details" count={data.length ? count : null} countLabel="Records">
          <AppDataGrid
            rows={data}
            columns={this.gridColumns}
            loading={loading}
            getRowId={(row) => row.ProjectDetailsId}
            emptyTitle="No records yet"
            emptyDescription="Create your first record to get started."
          />
        </DataCard>

        {/* ── Create / Edit dialog (MUI controlled form) ── */}
        <FormDialog
          open={visible}
          onClose={this.toggleModal}
          title="PMO Details"
          maxWidth="md"
          actions={null}
        >
          <Backdrop open={this.state.loading} sx={{ position: 'absolute', zIndex: (t) => t.zIndex.modal + 1 }}>
            <CircularProgress />
          </Backdrop>
          <div hidden={!editable}>
            <Box component="form" onSubmit={this.handleSubmitForm}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField type="hidden" value={projectDetailsData.ProjectDetailsId || 0} />
                  <TextField
                    fullWidth size="small" label="Project No." required select
                    value={projectDetailsData.ProjectId || ''}
                    onChange={(e) => { this.handleFieldChange('ProjectId', e.target.value); this.projectChange(e.target.value); }}
                  >
                    <MenuItem value="">Select....</MenuItem>
                    {projectCodeList.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth size="small" label="Contract Name" required select
                    value={projectDetailsData.ContractId || ''}
                    onChange={(e) => this.handleFieldChange('ContractId', e.target.value)}
                  >
                    <MenuItem value="">Select....</MenuItem>
                    {contractList.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>

              <Grid container spacing={2} sx={{ mt: 0 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth size="small" label="LOA Date" required type="date"
                    value={projectDetailsData.LOADate || ''}
                    onChange={(e) => this.handleFieldChange('LOADate', e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth size="small" label="Currency" required select
                    value={projectDetailsData.Currency || ''}
                    onChange={(e) => this.handleFieldChange('Currency', e.target.value)}
                  >
                    <MenuItem value="">Select....</MenuItem>
                    {currencyOptions.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>

              <Grid container spacing={2} sx={{ mt: 0 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth size="small" label="Start Date" required type="date"
                    value={projectDetailsData.StartDate || ''}
                    onChange={(e) => this.handleFieldChange('StartDate', e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth size="small" label="End Date" required type="date"
                    value={projectDetailsData.EndDate || ''}
                    onChange={(e) => this.handleFieldChange('EndDate', e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    inputProps={{ min: moment().format('YYYY-MM-DD') }}
                  />
                </Grid>
              </Grid>

              <Grid container spacing={2} sx={{ mt: 0 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth size="small" label="Original Contract Value" required type="number"
                    value={projectDetailsData.OriginalContractValue || ''}
                    onChange={(e) => this.handleFieldChange('OriginalContractValue', e.target.value)}
                    inputProps={{ min: 0 }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth size="small" label="Margin (%age)" required type="number"
                    value={projectDetailsData.Margin || ''}
                    onChange={(e) => this.handleFieldChange('Margin', e.target.value)}
                    inputProps={{ min: 0, max: 100 }}
                  />
                </Grid>
              </Grid>

              <Grid container spacing={2} sx={{ mt: 0 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth size="small" label="Client Name" required
                    value={projectDetailsData.ClientName || ''}
                    onChange={(e) => this.handleFieldChange('ClientName', e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth size="small" label="Contract Type" required select
                    value={projectDetailsData.ContractType || ''}
                    onChange={(e) => this.handleFieldChange('ContractType', e.target.value)}
                  >
                    <MenuItem value="">Select....</MenuItem>
                    {contractTypeList.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>

              <Grid container spacing={2} sx={{ mt: 0 }}>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth size="small" label="Project Description" required multiline rows={3}
                    value={projectDetailsData.ProjectDescription || ''}
                    onChange={(e) => this.handleFieldChange('ProjectDescription', e.target.value)}
                    inputProps={{ maxLength: 4000 }}
                  />
                </Grid>
              </Grid>

              <Grid container spacing={2} sx={{ mt: 0 }}>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth size="small" label="Remarks" multiline rows={2}
                    value={projectDetailsData.Remarks || ''}
                    onChange={(e) => this.handleFieldChange('Remarks', e.target.value)}
                    inputProps={{ maxLength: 4000 }}
                  />
                </Grid>
              </Grid>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, pt: 1 }}>
                <MuiButton variant="text" color="inherit" onClick={this.toggleModal}>Close</MuiButton>
                <MuiButton variant="contained" color="primary" type="submit">Submit</MuiButton>
              </Box>
            </Box>
          </div>
        </FormDialog>

        {/* ── View dialog ── */}
        <FormDialog
          open={viewProject}
          onClose={this.toggleViewModal}
          title="PMO Details"
          maxWidth="md"
          actions={<MuiButton variant="contained" color="primary" onClick={this.toggleViewModal}>Close</MuiButton>}
        >
          <Backdrop open={this.state.loading} sx={{ position: 'absolute', zIndex: (t) => t.zIndex.modal + 1 }}>
            <CircularProgress />
          </Backdrop>
          <Card hidden={editable}>
            <CardContent>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">Project No.</Typography>
                  <Typography variant="body2">{projectDetailsData.ProjectCode}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">Contract Name</Typography>
                  <Typography variant="body2">{projectDetailsData.ContractName}</Typography>
                </Grid>
              </Grid>

              <Grid container spacing={2} sx={{ mt: 0 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">LOA Date</Typography>
                  <Typography variant="body2">{projectDetailsData.LOADate}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">Currency</Typography>
                  <Typography variant="body2">{projectDetailsData.Currency}</Typography>
                </Grid>
              </Grid>

              <Grid container spacing={2} sx={{ mt: 0 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">Start Date</Typography>
                  <Typography variant="body2">{projectDetailsData.StartDate}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">End Date</Typography>
                  <Typography variant="body2">{projectDetailsData.EndDate}</Typography>
                </Grid>
              </Grid>

              <Grid container spacing={2} sx={{ mt: 0 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">Original Contract Value</Typography>
                  <Typography variant="body2">{this.valueWithComma(projectDetailsData.OriginalContractValue)}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">Margin (%age)</Typography>
                  <Typography variant="body2">{this.marginWithPercentage(projectDetailsData.Margin)}</Typography>
                </Grid>
              </Grid>

              <Grid container spacing={2} sx={{ mt: 0 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">Client Name</Typography>
                  <Typography variant="body2">{projectDetailsData.ClientName}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">Contract Type</Typography>
                  <Typography variant="body2">{projectDetailsData.ContractType}</Typography>
                </Grid>
              </Grid>

              <Grid container spacing={2} sx={{ mt: 0 }}>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="caption" color="text.secondary">Project Description</Typography>
                  <Typography variant="body2" sx={{ textAlign: 'justify' }}>{projectDetailsData.ProjectDescription}</Typography>
                </Grid>
              </Grid>

              <Grid container spacing={2} sx={{ mt: 0 }}>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="caption" color="text.secondary">Remarks</Typography>
                  <Typography variant="body2" sx={{ textAlign: 'justify' }}>{projectDetailsData.Remarks}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </FormDialog>

        <ConfirmDialog
          open={confirmOpen}
          title="Delete record?"
          message="Are you sure you want to delete this record? This action cannot be undone."
          confirmText="Delete"
          onConfirm={this.confirmDelete}
          onCancel={this.cancelDelete}
        />

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

export default ProjectDetails;