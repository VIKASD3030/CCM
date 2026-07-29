/**
 * Project Master — Premium enterprise SaaS redesign.
 * Design reference: Azure Portal + Linear + GitHub Projects.
 *
 * All backend logic, APIs, CRUD, file upload, and routing are preserved exactly.
 * Only the UI/UX has been transformed.
 */
import moment from 'moment';
import React, { Component } from 'react';
import {
  TextField, MenuItem, Grid, Typography, Tabs, Tab, Divider,
  Backdrop, CircularProgress, Box, Snackbar, Alert, Avatar,
  Tooltip, IconButton, Chip, Stack, Button as MuiButton,
  Menu, ListItemIcon, ListItemText, InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  MoreVert as MoreIcon,
  FolderOpen as FolderIcon,
  Business as BusinessIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import LoginState from '../../authentication/loginState';
import FileViewer from '../../helper/file-viewer';
import CommonUtilityController from '../controller/common-utility-controller';
import { fillSelectList } from '../../helper/common-utility';
import FileHelper from '../../helper/file-helper';
import { SIGN_FILE_PROP } from '../../helper/constants';
import FileUpload from '../common/quality-file-upload';
import path from 'path-browserify';
import {
  PageContainer, PageHeader, EmptyState, FormDialog, ConfirmDialog,
  AppDataGrid, AppBreadcrumbs, GridToolbar,
} from '../../components/ui';
import './project-master.css';

const ProjectAtt_Api = '/common/SaveProjectAttachment';

// ─── Helpers ──────────────────────────────────────────────
function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function stringToColor(str) {
  if (!str) return '#6B7280';
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const colors = ['#1E3A8A', '#7C3AED', '#059669', '#D97706', '#DC2626', '#2563EB', '#0891B2', '#4F46E5'];
  return colors[Math.abs(hash) % colors.length];
}

// ─── Component ────────────────────────────────────────────
class Project extends Component {

  constructor(props) {
    super(props);
    this.state = {
      // data
      data: [],
      originalData: [],
      projectData: {
        ProjectMasterId: 0, ProjectCode: '', ProjectName: '', ClientName: '',
        BusinessUnit: '', BusinessLine: '', ProjectManagerId: '',
        ProjectDirectorId: '', PMOID: '', ProjectDataSource: '', Remarks: '', Status: 0,
      },
      imageFileUrl: '',

      // ui state
      loading: false,
      visible: false,
      viewProject: false,
      editable: false,
      isUpload: false,
      viewDoc: false,
      fileType: '',
      filePath: '',
      confirmOpen: false,
      pendingDelete: null,
      snackbar: { open: false, severity: 'success', message: '' },

      // filters & search
      searchText: '',
      filterBusinessUnit: '',
      filterClient: '',
      filterStatus: '',
      density: 'standard',

      // dropdowns
      projectList: [],
      projectParentList: [],
      businessUnitList: [],
      businessLineList: [],
      userList: [],
      currentUserList: [],

      // column visibility
      columnVisibility: {
        ProjectCode: true,
        ProjectName: true,
        BusinessUnit: true,
        ClientName: true,
        ProjectManagerName: true,
        ProjectDirectorName: true,
        ProjectDataSource: true,
        Remarks: true,
      },

      // pagination
      filteredTotal: null,
    };
  }

  componentDidMount() {
    this.getLookupDetails();
    this.getUsers();
  }

  // ─── Snackbar ──────────────────────────────────────────
  notify = (severity, message) => {
    this.setState({ snackbar: { open: true, severity, message } });
  };

  closeSnackbar = () => {
    this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));
  };

  // ─── Form handlers ────────────────────────────────────
  handleFieldChange = (field, value) => {
    this.setState((prev) => ({
      projectData: { ...prev.projectData, [field]: value }
    }));
  }

  handleSubmitForm = (e) => {
    e.preventDefault();
    this.handleSubmit(this.state.projectData);
  }

  // ─── Data fetching ────────────────────────────────────
  getUserName(id) {
    const user = this.state.currentUserList.find((u) => u.UserId === id);
    return user?.EmployeeName || '';
  }

  async getProjects() {
    this.setState({ loading: true });
    const reqData = { UserId: LoginState.UserId };
    await new CommonUtilityController().getProjects(reqData)
      .then(data => {
        this.setState({ loading: false });
        if (data != undefined) {
          const originalData = data.map(item => ({ ...item }));
          const displayData = data.map(item => ({
            ...item,
            ProjectManagerName: this.getUserName(item.ProjectManagerId),
            ProjectDirectorName: this.getUserName(item.ProjectDirectorId),
            PMOName: item.PMOEmployeeName,
          }));
          const projectParentList = fillSelectList(data, 'ProjectName', 'ProjectMasterId');
          this.setState({ data: displayData, originalData, projectParentList });
        }
      })
      .catch(error => {
        this.setState({ loading: false });
        this.notify('error', error.toString());
      });
  }

  async getLookupDetails() {
    this.setState({ loading: true });
    await new CommonUtilityController().getLookupDetails(0)
      .then(data => {
        this.setState({ loading: false });
        if (data != undefined) {
          const businessUnit = data.filter(a => a.LookupType == 'BusinessUnit');
          this.setState({ businessUnitList: fillSelectList(businessUnit, 'LookupName', 'LookupName') });
          const businessLine = data.filter(a => a.LookupType == 'BusinessLine');
          this.setState({ businessLineList: fillSelectList(businessLine, 'LookupName', 'LookupName') });
        }
      })
      .catch(() => {
        this.setState({ loading: false });
        this.notify('error', 'Data fetching issue!!!');
      });
  }

  async getUsers() {
    this.setState({ loading: true });
    await new CommonUtilityController().getUsers()
      .then(result => {
        this.setState({ loading: false });
        if (result != undefined) {
          const userList = fillSelectList(result, 'EmployeeName', 'UserId');
          this.setState({ userList, currentUserList: result });
        }
        this.getProjects();
      })
      .catch(() => {
        this.setState({ loading: false });
      });
  }

  // ─── File handling ────────────────────────────────────
  viewDocument = async (url) => {
    this.setState({ loading: true });
    await new CommonUtilityController().downloadAttachment(url)
      .then(res => res.blob())
      .then(blob => {
        const fileType = path.extname(url);
        if (fileType == '.pdf') {
          const fileUrl = window.URL.createObjectURL(blob);
          this.setState({ viewDoc: true, filePath: fileUrl, fileType });
        } else {
          const file = new Blob([blob], { type: 'image/png' });
          new FileHelper().getImageUrl(file, imageUrl => {
            this.setState({ viewDoc: true, filePath: imageUrl, fileType });
          });
        }
        this.setState({ loading: false });
      })
      .catch(error => {
        this.setState({ loading: false });
        this.notify('error', error.toString());
      });
  }

  getProjectImageURL = async (url) => {
    this.setState({ loading: true });
    await new CommonUtilityController().downloadAttachment(url)
      .then(res => res.blob())
      .then(blob => {
        const file = new Blob([blob], { type: 'image/png' });
        new FileHelper().getImageUrl(file, imageUrl => {
          this.setState({ loading: false, imageFileUrl: imageUrl });
        });
      })
      .catch(error => {
        this.setState({ loading: false });
        this.notify('error', error.toString());
      });
  }

  // ─── CRUD operations ──────────────────────────────────
  newRecord = () => {
    const projectData = {
      ProjectMasterId: 0, ProjectCode: '', ProjectName: '', ClientName: '',
      BusinessUnit: '', BusinessLine: '', ProjectManagerId: '',
      ProjectDirectorId: '', PMOID: '', Remarks: '', Status: 0,
    };
    this.setState({ loading: false, editable: true, isUpload: false, visible: true, projectData });
  }

  editRecord = (project) => {
    const originalProject = this.state.originalData.find(p => p.ProjectMasterId === project.ProjectMasterId);
    if (originalProject) {
      this.getProjectImageURL(originalProject.DocumentPath);
      this.setState({
        loading: false, isUpload: false, editable: true, visible: true,
        projectData: { ...originalProject, PMOID: originalProject.PMOID || '' },
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

  deleteRecord = async (project) => {
    project.CreatedBy = LoginState.UserId;
    project.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    this.setState({ loading: true });
    await new CommonUtilityController().deleteProjectDetails(project)
      .then(data => {
        this.setState({ loading: false });
        if (data != undefined) {
          const projectParentList = fillSelectList(data, 'ProjectName', 'ProjectMasterId');
          this.setState({ data, originalData: data, projectParentList });
        }
        this.getProjects();
        this.notify('success', 'Data successfully deleted.');
      })
      .catch(error => {
        this.setState({ loading: false });
        this.notify('error', 'Data deletion issue!');
      });
  }

  viewProjectDetails = (project) => {
    this.setState({ projectData: project, loading: false, viewProject: true, visible: false, editable: false });
  }

  handleSubmit = async (project) => {
    if (project.ParentProjectMasterId == '') project.ParentProjectMasterId = '0';
    project.CreatedBy = LoginState.UserId;
    project.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    project.LockedBy = LoginState.LockedBy;
    project.LockedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    project.SecurityId = LoginState.SecurityId;
    project.Status = 1;
    if (!project.PMOID) project.PMOID = 0;
    this.setState({ loading: true });
    await new CommonUtilityController().saveProjectDetails(project)
      .then(data => {
        this.setState({ loading: false });
        if (data != undefined) {
          const projectParentList = fillSelectList(data, 'ProjectName', 'ProjectMasterId');
          this.setState({ data, projectParentList, originalData: data, visible: false });
        }
        this.getProjects();
        this.notify('success', 'Data successfully Inserted.');
      })
      .catch(error => {
        this.setState({ loading: false });
        this.notify('error', 'Data insertion issue!');
      });
  }

  // ─── Toggle / upload ──────────────────────────────────
  toggleModal = () => {
    this.setState({ visible: !this.state.visible });
  }

  toggleViewModal = () => {
    this.setState({ viewProject: !this.state.viewProject });
  }

  uploadDocument = async (project) => {
    const reqData = { ProjectMasterId: project.ProjectMasterId };
    await this.getProjects(reqData);
  }

  toggleUploadModal = () => {
    this.setState({ isUpload: !this.state.isUpload, visible: !this.state.visible });
  }

  fileUploadSubmit = async () => {
    this.setState({ isUpload: false, visible: false });
    this.getProjects();
  }

  // ─── Search & filter ──────────────────────────────────
  getFilteredData() {
    const { data, searchText, filterBusinessUnit, filterClient, filterStatus } = this.state;
    let filtered = [...data];

    if (searchText) {
      const q = searchText.toLowerCase();
      filtered = filtered.filter(r =>
        (r.ProjectName || '').toLowerCase().includes(q) ||
        (r.ProjectCode || '').toLowerCase().includes(q) ||
        (r.ClientName || '').toLowerCase().includes(q) ||
        (r.ProjectManagerName || '').toLowerCase().includes(q) ||
        (r.BusinessUnit || '').toLowerCase().includes(q)
      );
    }
    if (filterBusinessUnit) {
      filtered = filtered.filter(r => r.BusinessUnit === filterBusinessUnit);
    }
    if (filterClient) {
      filtered = filtered.filter(r => r.ClientName === filterClient);
    }
    if (filterStatus) {
      const isActive = filterStatus === 'active';
      filtered = filtered.filter(r => isActive ? String(r.Status) !== '9' : String(r.Status) === '9');
    }

    return filtered;
  }

  getUniqueClients() {
    const { data } = this.state;
    const clients = [...new Set(data.map(r => r.ClientName).filter(Boolean))];
    return clients.map(c => ({ label: c, value: c }));
  }

  // ─── Export ────────────────────────────────────────────
  handleExport = () => {
    const filtered = this.getFilteredData();
    const headers = ['Project Code', 'Project Name', 'Business Unit', 'Client', 'Project Manager', 'Project Director', 'Remarks'];
    const rows = filtered.map(r => [
      r.ProjectCode, r.ProjectName, r.BusinessUnit, r.ClientName,
      r.ProjectManagerName, r.ProjectDirectorName, r.Remarks,
    ]);
    const csv = [headers, ...rows].map(row => row.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'projects.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  handleRefresh = () => {
    this.getProjects();
  }

  // ─── Column definitions ────────────────────────────────
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
        renderCell: (params) => <ActionMenu record={params.row} onEdit={this.editRecord} onDelete={this.requestDelete} onView={this.viewProjectDetails} />,
      },
      {
        field: 'ProjectName',
        headerName: 'Project',
        flex: 1.5,
        minWidth: 220,
        renderCell: (params) => (
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#111827', lineHeight: 1.3 }}>
              {params.value || '—'}
            </Typography>
            <Typography sx={{ fontSize: 12, color: '#9CA3AF', mt: 0.25 }}>
              {params.row.ProjectCode || ''}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'BusinessUnit',
        headerName: 'Business Unit',
        width: 150,
        renderCell: (params) => params.value ? (
          <Chip
            size="small"
            label={params.value}
            sx={{
              height: 26, fontSize: 12, fontWeight: 600, borderRadius: '999px',
              bgcolor: '#EFF6FF', color: '#1E3A8A', border: '1px solid #BFDBFE',
              '& .MuiChip-label': { px: 1.5 },
            }}
          />
        ) : '—',
      },
      {
        field: 'ClientName',
        headerName: 'Client',
        flex: 1,
        minWidth: 160,
        renderCell: (params) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BusinessIcon sx={{ fontSize: 16, color: '#9CA3AF' }} />
            <Typography sx={{ fontSize: 13, color: '#374151' }}>
              {params.value || '—'}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'ProjectManagerName',
        headerName: 'Project Manager',
        width: 180,
        renderCell: (params) => {
          const name = params.value || '';
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Avatar
                sx={{
                  width: 32, height: 32, fontSize: 12, fontWeight: 700,
                  bgcolor: stringToColor(name), color: '#fff',
                }}
              >
                {getInitials(name)}
              </Avatar>
              <Typography sx={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
                {name || '—'}
              </Typography>
            </Box>
          );
        },
      },
      {
        field: 'ProjectDirectorName',
        headerName: 'Director',
        width: 160,
        renderCell: (params) => {
          const name = params.value || '';
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Avatar
                sx={{
                  width: 28, height: 28, fontSize: 11, fontWeight: 700,
                  bgcolor: `${stringToColor(name)}18`, color: stringToColor(name),
                  border: `1.5px solid ${stringToColor(name)}40`,
                }}
              >
                {getInitials(name)}
              </Avatar>
              <Typography sx={{ fontSize: 13, color: '#6B7280' }}>
                {name || '—'}
              </Typography>
            </Box>
          );
        },
      },
      {
        field: 'ProjectDataSource',
        headerName: 'Data Source',
        flex: 1,
        minWidth: 180,
        renderCell: (params) => {
          const url = params.value || '';
          if (!url) return <Typography sx={{ fontSize: 13, color: '#D1D5DB' }}>—</Typography>;
          return (
            <Tooltip title={url} arrow placement="top">
              <Typography
                component="a"
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  fontSize: 13, color: '#2563EB', textDecoration: 'none',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  display: 'block', maxWidth: '100%',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                {url}
              </Typography>
            </Tooltip>
          );
        },
      },
      {
        field: 'Remarks',
        headerName: 'Remarks',
        flex: 1,
        minWidth: 140,
        renderCell: (params) => (
          <Typography sx={{ fontSize: 13, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {params.value || '—'}
          </Typography>
        ),
      },
    ];

    return cols.filter(c => c.field === 'action' || columnVisibility[c.field] !== false);
  }

  // ─── Render ───────────────────────────────────────────
  render() {
    const {
      data, loading, visible, viewProject, editable, projectData,
      userList, projectParentList, businessUnitList, businessLineList,
      isUpload, filePath, fileType, viewDoc, imageFileUrl,
      confirmOpen, snackbar, searchText, filterBusinessUnit,
      filterClient, filterStatus, density, columnVisibility,
    } = this.state;

    const filteredData = this.getFilteredData();
    const count = filteredData.length;

    const buOptions = this.state.businessUnitList?.map(b => ({ label: b.label, value: b.value })) || [];
    const clientOptions = this.getUniqueClients();
    const statusOptions = [
      { label: 'Active', value: 'active' },
      { label: 'Archived', value: 'archived' },
    ];

    return (
      <PageContainer>

        {/* ── Breadcrumbs ── */}
        <AppBreadcrumbs />

        {/* ── Page Header ── */}
        <PageHeader
          title="Projects"
          subtitle="Manage all projects in the CCM system."
          actions={
            <MuiButton
              variant="contained"
              startIcon={<AddIcon />}
              onClick={this.newRecord}
              sx={{ borderRadius: '10px', px: 3, py: 1.25 }}
            >
              New Project
            </MuiButton>
          }
        />

        {/* ── Data Grid ── */}
        {loading && data.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <CircularProgress />
          </Box>
        ) : !loading && data.length === 0 ? (
          <EmptyState
            icon={<FolderIcon sx={{ fontSize: 40 }} />}
            title="No Projects Found"
            description="Get started by creating your first project in the CCM system."
            primaryAction={
              <MuiButton variant="contained" startIcon={<AddIcon />} onClick={this.newRecord} sx={{ borderRadius: '10px', px: 3 }}>
                Create Project
              </MuiButton>
            }
          />
        ) : (
          <Box>
            <GridToolbar
              searchValue={searchText}
              onSearchChange={(val) => this.setState({ searchText: val })}
              searchPlaceholder="Search projects..."
              filters={[
                {
                  name: 'BusinessUnit',
                  label: 'Business Unit',
                  value: filterBusinessUnit,
                  options: buOptions,
                },
                {
                  name: 'Client',
                  label: 'Client',
                  value: filterClient,
                  options: clientOptions,
                },
                {
                  name: 'Status',
                  label: 'Status',
                  value: filterStatus,
                  options: statusOptions,
                },
              ]}
              onFilterChange={(name, val) => {
                if (name === 'BusinessUnit') this.setState({ filterBusinessUnit: val });
                else if (name === 'Client') this.setState({ filterClient: val });
                else if (name === 'Status') this.setState({ filterStatus: val });
              }}
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
              getRowId={(row) => row.ProjectMasterId}
              density={density}
              height={Math.min(56 + count * 56 + 56, 720)}
              pageSize={10}
            />
          </Box>
        )}

        {/* ── Create / Edit dialog ── */}
        <FormDialog
          open={visible}
          onClose={this.toggleModal}
          title={projectData.ProjectMasterId === 0 ? 'Create New Project' : 'Edit Project'}
          maxWidth="md"
          actions={null}
        >
          <Backdrop open={loading} sx={{ position: 'absolute', zIndex: (t) => t.zIndex.modal + 1 }}>
            <CircularProgress />
          </Backdrop>
          <Tabs
            value={editable ? 0 : 1}
            onChange={(_e, val) => { if (val === 1) this.uploadDocument(projectData); }}
            sx={{ mb: 1 }}
          >
            <Tab label="Project Details" />
            <Tab label="Upload Document" disabled={projectData.ProjectMasterId === 0} />
          </Tabs>

          {/* ── Form tab ── */}
          <div hidden={!editable} style={{ padding: '8px 0 16px' }}>
            <Box component="form" onSubmit={this.handleSubmitForm}>
              <Divider textAlign="left" sx={{ color: '#475569', fontWeight: 600, fontSize: 13, mb: 2, letterSpacing: '0.04em' }}>
                Project Information
              </Divider>
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

              <Divider textAlign="left" sx={{ color: '#475569', fontWeight: 600, fontSize: 13, mt: 3, mb: 2, letterSpacing: '0.04em' }}>
                Business Classification
              </Divider>
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

              <Divider textAlign="left" sx={{ color: '#475569', fontWeight: 600, fontSize: 13, mt: 3, mb: 2, letterSpacing: '0.04em' }}>
                Data Source
              </Divider>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                  <TextField fullWidth size="small" label="Project Data Source (SharePoint Link)"
                    placeholder="https://yourtenant.sharepoint.com/sites/project-name"
                    value={projectData.ProjectDataSource || ''}
                    onChange={(e) => this.handleFieldChange('ProjectDataSource', e.target.value)}
                    helperText="Paste the SharePoint site or folder link for this project"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LinkIcon sx={{ color: '#9CA3AF', fontSize: 18 }} />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
              </Grid>

              <Divider textAlign="left" sx={{ color: '#475569', fontWeight: 600, fontSize: 13, mt: 3, mb: 2, letterSpacing: '0.04em' }}>
                Team
              </Divider>
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

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, pt: 2, mt: 3, borderTop: '1px solid #F3F4F6' }}>
                <MuiButton variant="text" color="inherit" onClick={this.toggleModal} sx={{ borderRadius: '10px' }}>
                  Cancel
                </MuiButton>
                <MuiButton variant="contained" color="primary" type="submit" sx={{ borderRadius: '10px', px: 3 }}>
                  {projectData.ProjectMasterId === 0 ? 'Create Project' : 'Save Changes'}
                </MuiButton>
              </Box>
            </Box>
          </div>

          {/* ── Upload tab ── */}
          <div hidden={editable}>
            <FileUpload
              toggleUploadModal={this.toggleUploadModal}
              api={ProjectAtt_Api}
              fileProp={SIGN_FILE_PROP}
              dataKey="ProjectMasterId"
              keyVal={projectData.ProjectMasterId}
              fileUploadSubmit={this.fileUploadSubmit}
              reset={true}
              page="Project"
            />
            <Divider sx={{ my: 1 }} hidden={projectData.DocumentPath == 0 || projectData.DocumentPath == null}>
              Project Logo
            </Divider>
            <Box sx={{ textAlign: 'center', py: 2 }} hidden={projectData.DocumentPath == 0 || projectData.DocumentPath == null}>
              <img alt="ProjectLogo" style={{ width: 100, height: 100, objectFit: 'contain', borderRadius: 12 }} src={imageFileUrl} />
            </Box>
          </div>
        </FormDialog>

        {/* ── View dialog ── */}
        <FormDialog
          open={viewProject}
          onClose={this.toggleViewModal}
          title="Project Details"
          maxWidth="sm"
          actions={
            <MuiButton variant="contained" color="primary" onClick={this.toggleViewModal} sx={{ borderRadius: '10px' }}>
              Close
            </MuiButton>
          }
        >
          <Backdrop open={loading} sx={{ position: 'absolute', zIndex: (t) => t.zIndex.modal + 1 }}>
            <CircularProgress />
          </Backdrop>
          <Box sx={{ py: 2 }}>
            <Stack spacing={2}>
              {[
                ['Project Code', projectData.ProjectCode],
                ['Project Name', projectData.ProjectName],
                ['Client', projectData.ClientName],
                ['Business Unit', projectData.BusinessUnit],
                ['Business Line', projectData.BusinessLine],
                ['Project Manager', projectData.ProjectManagerName],
                ['Project Director', projectData.ProjectDirectorName],
                ['Remarks', projectData.Remarks],
              ].map(([label, value]) => (
                <Box key={label}>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
                    {label}
                  </Typography>
                  <Typography sx={{ fontSize: 15, color: '#111827', fontWeight: 500 }}>
                    {value || '—'}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        </FormDialog>

        {/* ── Confirm Delete ── */}
        <ConfirmDialog
          open={confirmOpen}
          title="Delete project?"
          message="Are you sure you want to delete this record? This action cannot be undone."
          confirmText="Delete"
          onConfirm={this.confirmDelete}
          onCancel={this.cancelDelete}
        />

        {/* ── File Viewer ── */}
        <FileViewer filePath={filePath} fileType={fileType} onCancel={() => this.setState({ viewDoc: false })} visible={viewDoc} />

        {/* ── Snackbar ── */}
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
function ActionMenu({ record, onEdit, onDelete, onView }) {
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
        <MenuItem dense onClick={() => { setAnchorEl(null); onView(record); }} sx={{ borderRadius: 1 }}>
          <ListItemIcon><ViewIcon sx={{ fontSize: 16, color: '#2563EB' }} /></ListItemIcon>
          <ListItemText primary="View" primaryTypographyProps={{ fontSize: 13, fontWeight: 500 }} />
        </MenuItem>
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

export default Project;
