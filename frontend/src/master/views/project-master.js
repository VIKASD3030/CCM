import moment from 'moment';
import React, { Component } from 'react';
import { TextField, MenuItem, Grid, Typography, Tabs, Tab, Divider, Backdrop, CircularProgress } from '@mui/material';
import MuiButton from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import './project-master.css';
import LoginState from '../../authentication/loginState';
import FileViewer from '../../helper/file-viewer';
import CommonUtilityController from "../controller/common-utility-controller";
import { fillSelectList } from '../../helper/common-utility';
import FileHelper from '../../helper/file-helper';
import { SIGN_FILE_PROP } from '../../helper/constants';
import FileUpload from '../common/quality-file-upload';
import path from "path-browserify";
import { PageContainer, PageHeader, DataCard, EmptyState, FormDialog, ConfirmDialog, AppDataGrid } from '../../components/ui';
const ProjectAtt_Api = '/common/SaveProjectAttachment';

class Project extends Component {

  constructor(props) {
    super(props);
    this.state = {
      data: [],
      originalData: [],
      projectData: {
        ProjectMasterId: 0,
        ProjectCode: "",
        ProjectName: "",
        ClientName: "",
        BusinessUnit: "",
        BusinessLine: "",
        ProjectManagerId: "",
        ProjectDirectorId: "",
        PMOID: "",
        Remarks: "",
        Status: 0,
      },
      imageFileUrl: '',
      loading: false,
      visible: false,
      viewProject: false,
      projectList: [],
      projectParentList: [],
      businessUnitList: [],
      businessLineList: [],
      userList: [],
      currentUserList: [],
      isUpload: false,
      filteredTotal: null,
      viewDoc: false,
      fileType: '',
      filePath: '',
      confirmOpen: false,
      pendingDelete: null,
      snackbar: { open: false, severity: 'success', message: '' },
    };
  }
  //load initial data
  componentDidMount() {
    // this.getProjects();
    this.getLookupDetails();
    this.getUsers()
  }

  notify = (severity, message) => {
    this.setState({ snackbar: { open: true, severity, message } });
  };

  closeSnackbar = () => {
    this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));
  };

  handleFieldChange = (field, value) => {
    this.setState((prev) => ({
      projectData: { ...prev.projectData, [field]: value }
    }));
  }

  handleSubmitForm = (e) => {
    e.preventDefault();
    this.handleSubmit(this.state.projectData);
  }

  //fetch projects
  getUserName(id) {
    const user = this.state.currentUserList.find((user) => user.UserId === id)
    return user?.EmployeeName ? user?.EmployeeName : ''
  }
  async getProjects() {
    this.setState({ loading: true });
    let reqData = {
      UserId: LoginState.UserId
    }
    await new CommonUtilityController().getProjects(reqData)
      .then(data => {
        this.setState({ loading: false });
        if (data != undefined) {
          let originalData = data.map((item) => {
            return { ...item }
          });

          let displayData = data.map((item) => {
            return {
              ...item,
              ProjectManagerName: this.getUserName(item.ProjectManagerId),
              ProjectDirectorName: this.getUserName(item.ProjectDirectorId),
              PMOName: item.PMOEmployeeName,
            }
          });

          let projectParentList = fillSelectList(data, "ProjectName", 'ProjectMasterId');
          this.setState({
            data: displayData,
            originalData: originalData,
            projectParentList: projectParentList
          });
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
          let businessUnit = data.filter(a => a.LookupType == "BusinessUnit")
          let businessUnitList = fillSelectList(businessUnit, "LookupName", "LookupName")
          this.setState({ businessUnitList: businessUnitList });

          let businessLine = data.filter(a => a.LookupType == "BusinessLine")
          let businessLineList = fillSelectList(businessLine, "LookupName", "LookupName")
          this.setState({ businessLineList: businessLineList });
        }
      })
      .catch(() => {
        this.setState({ loading: false, });
        this.notify('error', 'Data fetching issue!!!');
      });
  }

  async getUsers() {
    this.setState({ loading: true, });
    await new CommonUtilityController().getUsers()
      .then(result => {
        this.setState({ loading: false, });
        if (result != undefined) {
          //fill drop down list
          let userList = fillSelectList(result, "EmployeeName", 'UserId');
          this.setState({ userList: userList, currentUserList: result });
        }
        this.getProjects()
      })
      .catch(error => {
        this.setState({ loading: false, });
      });

  }

  viewDocument = async (url) => {
    this.setState({ loading: true, });
    await new CommonUtilityController().downloadAttachment(url)
      .then(res => res.blob())
      .then(blob => {

        let fileType = path.extname(url);
        if (fileType == '.pdf') {
          let fileUrl = window.URL.createObjectURL(blob);
          this.setState({ viewDoc: true, filePath: fileUrl, fileType: fileType });
        }
        else {
          var file = new Blob([blob], { type: 'image/png' });
          new FileHelper().getImageUrl(file, imageUrl => {
            this.setState({ viewDoc: true, filePath: imageUrl, fileType: fileType });
          });
        }
        this.setState({ loading: false });

      })
      .catch(error => {
        this.setState({ loading: false, });
        this.notify('error', error.toString());
      });
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
              <Tooltip title="View record">
                <span>
                  <IconButton size="small" color="primary" onClick={() => this.viewProjectDetails(record)}>
                    <VisibilityRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          );
        },
      },
      { field: 'ProjectCode', headerName: 'Project Code', width: 130 },
      { field: 'ProjectName', headerName: 'Project Name', flex: 1, minWidth: 160 },
      { field: 'BusinessUnit', headerName: 'Business Unit', width: 130 },
      { field: 'BusinessLine', headerName: 'Business Line', width: 130 },
      { field: 'ClientName', headerName: 'Client Name', flex: 1, minWidth: 160 },
      { field: 'ProjectManagerName', headerName: 'Project Manager', width: 150 },
      { field: 'ProjectDirectorName', headerName: 'Project Director', width: 150 },
      { field: 'PMOName', headerName: 'PMO', width: 120 },
      { field: 'Remarks', headerName: 'Remarks', flex: 1, minWidth: 140 },
    ];
  }

  //New record
  newRecord = () => {
    let projectData = {
      ProjectMasterId: 0,
      ProjectCode: "",
      ProjectName: "",
      ClientName: "",
      BusinessUnit: "",
      BusinessLine: "",
      ProjectManagerId: "",
      ProjectDirectorId: "",
      PMOID: "",
      Remarks: "",
      Status: 0,
    }
    this.setState({ loading: false, editable: true, isUpload: false, visible: true, projectData: projectData });
  }

  getProjectImageURL = async (url) => {
    this.setState({ loading: true, });
    await new CommonUtilityController().downloadAttachment(url)
      .then(res => res.blob())
      .then(blob => {
        var file = new Blob([blob], { type: 'image/png' });
        var fileUrl = URL.createObjectURL(file);
        new FileHelper().getImageUrl(file, imageUrl => {
          this.setState({ loading: false, imageFileUrl: imageUrl });
        }

        );

        this.setState({ loading: false, });

      })
      .catch(error => {
        this.setState({ loading: false, });
        this.notify('error', error.toString());
      });
  }

  //edit record
  editRecord = (project) => {
    const originalProject = this.state.originalData.find(p => p.ProjectMasterId === project.ProjectMasterId);

    if (originalProject) {
      let path = originalProject.DocumentPath;
      this.getProjectImageURL(path);

      const formattedProject = {
        ...originalProject,
        PMOID: originalProject.PMOID || "",
      };
      this.setState({
        loading: false,
        isUpload: false,
        editable: true,
        visible: true,
        projectData: formattedProject
      });
    }
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

    await new CommonUtilityController().deleteProjectDetails(project)
      .then(data => {
        this.setState({ loading: false, });

        if (data != undefined) {
          let projectParentList = fillSelectList(data, "ProjectName", 'ProjectMasterId');
          this.setState({ data: data, originalData: data, projectParentList: projectParentList });
        }
        this.getProjects();
        this.notify('success', 'Data successfully deleted.');
      })
      .catch(error => {
        this.setState({ loading: false, });
        this.notify('error', 'Data deletion issue!');
      });
  }

  //view record
  viewProjectDetails = (project) => {
    // alert(JSON.stringify(project))
    this.setState({ projectData: project, loading: false, viewProject: true, visible: false, editable: false });
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

  //upload document
  uploadDocument = async (project) => {
    let reqData = {
      ProjectMasterId: project.ProjectMasterId
    }
    await this.getProjects(reqData);
    // this.setState({ projectData: project, loading: false, editable: false, visible: false, isUpload: true });
  }

  //upload popup
  toggleUploadModal = () => {
    this.setState({
      isUpload: !this.state.isUpload,
      visible: !this.state.visible
    });
  }

  fileUploadSubmit = async () => {
    this.setState({ isUpload: false, visible: false })
    this.getProjects();
  }

  handleSubmit = async (project) => {

    const { data } = this.state;


    //********** Duplicate entry validation*/
    if (project.ParentProjectMasterId == "") { project.ParentProjectMasterId = "0"; }

    let isexist = false;
    let reqData = {
      "Record": project,
      "TableName": "ProjectMaster"
    }

    this.setState({ loading: true });
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
    //   .catch(error => {
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
    // ensure PMOID is set
    if (!project.PMOID) project.PMOID = 0; // ★ NEW
    this.setState({ loading: true });

    await new CommonUtilityController().saveProjectDetails(project)
      .then(data => {
        this.setState({ loading: false, });
        if (data != undefined) {
          let projectParentList = fillSelectList(data, "ProjectName", 'ProjectMasterId');
          this.setState({
            data: data, projectParentList: projectParentList,
            originalData: data, visible: false
          });
        }
        this.getProjects();
        this.notify('success', 'Data successfully Inserted.');
      })
      .catch(error => {
        this.setState({ loading: false, });
        this.notify('error', 'Data insertion issue!');
      });
  }

  render() {
    const { data, loading, visible, viewProject, editable, projectData, userList, projectParentList, businessUnitList, businessLineList, isUpload, filePath, fileType, viewDoc, imageFileUrl, confirmOpen, snackbar } = this.state;
    const projectCount = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;

    return (
      <PageContainer>
        <PageHeader
          title="Project Details"
          subtitle="Manage all projects in the CCM system."
          actions={
            <MuiButton variant="contained" color="primary" startIcon={<AddRoundedIcon />} onClick={() => this.newRecord()}>
              New Project
            </MuiButton>
          }
        />

        <DataCard title="Projects" count={data.length ? projectCount : null} countLabel="Projects">
          {!loading && data.length === 0 ? (
            <EmptyState
              icon={<FolderOpenRoundedIcon />}
              title="No Projects Yet"
              description="Projects will appear here once created. Get started by adding your first project."
              primaryAction={
                <MuiButton variant="contained" startIcon={<AddRoundedIcon />} onClick={() => this.newRecord()}>
                  Create Project
                </MuiButton>
              }
            />
          ) : (
            <AppDataGrid
              rows={data}
              columns={this.gridColumns}
              loading={loading}
              getRowId={(row) => row.ProjectMasterId}
              height={640}
              emptyTitle="No matching projects"
              emptyDescription="Try adjusting your search."
            />
          )}
        </DataCard>

        {/* ── Create / Edit dialog (MUI Tabs + controlled form) ── */}
        <FormDialog
          open={visible}
          onClose={this.toggleModal}
          title={projectData.ProjectMasterId === 0 ? 'Create New Project' : 'Edit Project'}
          maxWidth="md"
          actions={null}
        >
          <Backdrop open={this.state.loading} sx={{ position: 'absolute', zIndex: (t) => t.zIndex.modal + 1 }}>
            <CircularProgress />
          </Backdrop>
          <Tabs
            value={editable ? 0 : 1}
            onChange={(_e, val) => { if (val === 1) this.uploadDocument(); }}
            sx={{ mb: 1 }}
          >
            <Tab label="Project Details" />
            <Tab label="Upload Document" disabled={projectData.ProjectMasterId === 0} />
          </Tabs>
          <div hidden={!editable} style={{ padding: '8px 0 16px' }}>
            <Box component="form" onSubmit={this.handleSubmitForm}>
              <Divider textAlign="left" sx={{ color: '#3b466f', fontWeight: 600, fontSize: '14px', mb: 2 }}>Project Information</Divider>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField fullWidth size="small" label="Project Code" required
                    value={projectData.ProjectCode || ''}
                    onChange={(e) => this.handleFieldChange('ProjectCode', e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField fullWidth size="small" label="Project Name" required
                    value={projectData.ProjectName || ''}
                    onChange={(e) => this.handleFieldChange('ProjectName', e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField fullWidth size="small" label="Client" required
                    value={projectData.ClientName || ''}
                    onChange={(e) => this.handleFieldChange('ClientName', e.target.value)}
                  />
                </Grid>
              </Grid>

              <Divider textAlign="left" sx={{ color: '#3b466f', fontWeight: 600, fontSize: '14px', mt: 3, mb: 2 }}>Business Classification</Divider>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField fullWidth size="small" label="Business Unit" required select
                    value={projectData.BusinessUnit || ''}
                    onChange={(e) => this.handleFieldChange('BusinessUnit', e.target.value)}
                  >
                    <MenuItem value="">Select....</MenuItem>
                    <MenuItem value="Systra India">Systra India</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField fullWidth size="small" label="Business Line" required select
                    value={projectData.BusinessLine || ''}
                    onChange={(e) => this.handleFieldChange('BusinessLine', e.target.value)}
                  >
                    <MenuItem value="">Select....</MenuItem>
                    <MenuItem value="PMC">PMC</MenuItem>
                    <MenuItem value="Design">Design</MenuItem>
                    <MenuItem value="System">System</MenuItem>
                    <MenuItem value="CTR">CTR</MenuItem>
                  </TextField>
                </Grid>
              </Grid>

              <Divider textAlign="left" sx={{ color: '#3b466f', fontWeight: 600, fontSize: '14px', mt: 3, mb: 2 }}>Team</Divider>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField fullWidth size="small" label="Project Manager" required select
                    value={projectData.ProjectManagerId || ''}
                    onChange={(e) => this.handleFieldChange('ProjectManagerId', e.target.value)}
                  >
                    <MenuItem value="">Select....</MenuItem>
                    <MenuItem value="Vikas Dwivedi">Vikas Dwivedi</MenuItem>
                    {(this.state.currentUserList || []).filter(u => u.EmployeeName !== 'Vikas Dwivedi').map((user) => (
                      <MenuItem key={user.UserId} value={user.UserId}>{user.EmployeeName}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField fullWidth size="small" label="Project Director" required select
                    value={projectData.ProjectDirectorId || ''}
                    onChange={(e) => this.handleFieldChange('ProjectDirectorId', e.target.value)}
                  >
                    <MenuItem value="">Select....</MenuItem>
                    <MenuItem value="Vikas Dwivedi">Vikas Dwivedi</MenuItem>
                    {(this.state.currentUserList || []).filter(u => u.EmployeeName !== 'Vikas Dwivedi').map((user) => (
                      <MenuItem key={user.UserId} value={user.UserId}>{user.EmployeeName}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField fullWidth size="small" label="PMO" select
                    value={projectData.PMOID || ''}
                    onChange={(e) => this.handleFieldChange('PMOID', e.target.value)}
                  >
                    <MenuItem value="">Select....</MenuItem>
                    <MenuItem value="Vikas Dwivedi">Vikas Dwivedi</MenuItem>
                    {(this.state.currentUserList || []).filter(u => u.EmployeeName !== 'Vikas Dwivedi').map((user) => (
                      <MenuItem key={user.UserId} value={user.UserId}>{user.EmployeeName}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, pt: 2, mt: 3, borderTop: '1px solid #f0f0f0' }}>
                <MuiButton variant="text" color="inherit" onClick={this.toggleModal}>
                  Close
                </MuiButton>
                <MuiButton variant="contained" color="primary" type="submit">
                  {projectData.ProjectMasterId === 0 ? 'Create Project' : 'Save Changes'}
                </MuiButton>
              </Box>
            </Box>
          </div>
          <div hidden={editable}>
            <FileUpload toggleUploadModal={this.toggleUploadModal} api={ProjectAtt_Api} fileProp={SIGN_FILE_PROP} dataKey="ProjectMasterId" keyVal={projectData.ProjectMasterId} fileUploadSubmit={this.fileUploadSubmit} reset={true} page={'Project'} />
            <Divider sx={{ color: 'success.main', my: 1 }} hidden={projectData.DocumentPath == 0 || projectData.DocumentPath == null}>
              Project's Logo
            </Divider>
            <table className="table-from table-from-th table-from-td" style={{ marginTop: -1, width: '100%' }} hidden={projectData.DocumentPath == 0 || projectData.DocumentPath == null}>
              <tbody><tr style={{ textAlign: "center" }}><td><img alt='ProjectLogo' style={{ width: "100px", height: "100px", objectFit: 'contain' }} src={imageFileUrl} /></td></tr></tbody>
            </table>
          </div>
        </FormDialog>

        {/* ── View dialog ── */}
        <FormDialog
          open={viewProject}
          onClose={this.toggleViewModal}
          title="Project Details"
          maxWidth="sm"
          actions={
            <MuiButton variant="contained" color="primary" onClick={this.toggleViewModal}>Close</MuiButton>
          }
        >
          <Backdrop open={this.state.loading} sx={{ position: 'absolute', zIndex: (t) => t.zIndex.modal + 1 }}>
            <CircularProgress />
          </Backdrop>
          <div hidden={editable}>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              Project: {projectData.ProjectCode} - {projectData.ProjectName}
            </Typography>
          </div>
        </FormDialog>

        <ConfirmDialog
          open={confirmOpen}
          title="Delete project?"
          message="Are you sure you want to delete this record? This action cannot be undone."
          confirmText="Delete"
          onConfirm={this.confirmDelete}
          onCancel={this.cancelDelete}
        />

        <div>
          <FileViewer filePath={filePath} fileType={fileType} onCancel={() => this.setState({ viewDoc: false })} visible={viewDoc} />
        </div>

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

export default Project;
