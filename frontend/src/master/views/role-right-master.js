import React, { Component } from 'react';
import moment from 'moment';
import {
  TextField, MenuItem, Grid, Box, Typography,
  Snackbar, Alert, Button as MuiButton, Stack,
} from '@mui/material';
import {
  Save as SaveIcon,
  VpnKey as VpnKeyIcon,
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { fillSelectList } from '../../helper/common-utility';
import CommonUtilityController from '../controller/common-utility-controller';
import LoginState from '../../authentication/loginState';
import {
  PageContainer, PageHeader, EmptyState, AppBreadcrumbs, GridToolbar,
} from '../../components/ui';

class RoleRight extends Component {
  constructor(props) {
    super(props);
    this.formRef = React.createRef();
    this.state = {
      roleRightExistData: [],
      role: { RoleId: '', Status: 0 },
      roleList: [],
      moduleGroupList: [],
      loading: false,
      selectedRowKeys: [],
      childData: [],
      selectedModuleGroups: [],
      snackbar: { open: false, severity: 'success', message: '' },
      searchText: '',
    };
  }

  componentDidMount() {
    this.getRoles(0);
    this.getModuleGroups();
  }

  notify = (severity, message) => this.setState({ snackbar: { open: true, severity, message } });
  closeSnackbar = () => this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));

  async getRoleRightDetails(reqData) {
    await new CommonUtilityController().getRoleRightDetails(reqData)
      .then((result) => {
        this.setState({ loading: false });
        if (result != undefined) {
          const selectedRowKeys = result.filter((r) => r.RightStatus == 1).map((r) => r.ModuleId?.toString());
          this.setState({ roleRightExistData: result, childData: result, selectedRowKeys });
        }
      })
      .catch(() => { this.setState({ loading: false }); this.notify('error', 'Data fetching issue!'); });
  }

  async getRoles(reqData) {
    this.setState({ loading: true });
    await new CommonUtilityController().getRoles(reqData)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) this.setState({ roleList: data });
      })
      .catch(() => { this.setState({ loading: false }); });
  }

  async getModuleGroups() {
    this.setState({ loading: true });
    await new CommonUtilityController().getModuleGroups(0)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) this.setState({ moduleGroupList: data });
      })
      .catch((error) => { this.setState({ loading: false }); this.notify('error', error.toString()); });
  }

  roleChange = (value) => {
    if (value !== '') this.getRoleRightDetails(value);
    const { role } = this.state;
    this.setState({ role: { ...role, RoleId: value }, selectedModuleGroups: [] });
  };

  moduleGroupChange = (values) => {
    this.setState({ selectedModuleGroups: values });
    const { roleRightExistData } = this.state;
    if (values.length > 0) {
      const selectedModules = roleRightExistData.filter((a) => a.RightStatus == 1);
      const extra = roleRightExistData.filter((i) => values.indexOf(i.ModuleGroupName) >= 0 && i.RightStatus == 0);
      this.setState({ childData: selectedModules.concat(extra) });
    } else {
      this.setState({ childData: roleRightExistData });
    }
  };

  saveData = async () => {
    const { role, childData, selectedRowKeys } = this.state;
    const roleRightData = selectedRowKeys.map((key) => {
      const obj = childData.find((c) => c.key == key || c.ModuleId?.toString() == key);
      if (!obj) return null;
      return {
        ...obj,
        Status: 1,
        CreatedBy: LoginState.UserId,
        CreatedDate: moment().format('YYYY-MM-DD HH:mm:ss'),
        LockedBy: LoginState.LockedBy,
        LockedDate: moment().format('YYYY-MM-DD HH:mm:ss'),
        SecurityId: LoginState.SecurityId,
      };
    }).filter(Boolean);

    this.setState({ loading: true });
    await new CommonUtilityController().saveRoleRightDetails(roleRightData)
      .then(() => {
        this.setState({ loading: false, selectedModuleGroups: [] });
        this.getRoleRightDetails(role.RoleId);
        this.notify('success', 'Data submitted successfully.');
      })
      .catch((error) => { this.setState({ loading: false }); this.notify('error', error.toString()); });
  };

  handleRefresh = () => {
    const { role } = this.state;
    if (role.RoleId) this.getRoleRightDetails(role.RoleId);
  };

  handleExport = () => {
    const { childData } = this.state;
    const headers = ['Module', 'Module Group', 'Main Module Group'];
    const rows = childData.map((r) => [r.UserShownName, r.ModuleGroupName, r.ParentModuleGroupName]);
    const csv = [headers, ...rows].map((row) => row.map((c) => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'role-rights.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  getFilteredChildData() {
    const { childData, searchText } = this.state;
    if (!searchText) return childData;
    const q = searchText.toLowerCase();
    return childData.filter((r) =>
      (r.UserShownName || '').toLowerCase().includes(q) ||
      (r.ModuleGroupName || '').toLowerCase().includes(q) ||
      (r.ParentModuleGroupName || '').toLowerCase().includes(q)
    );
  }

  childColumns = [
    {
      field: 'UserShownName', headerName: 'Module', flex: 1, minWidth: 160,
      renderCell: (params) => (
        <Typography sx={{ fontSize: 13, color: '#374151' }}>{params.value || '—'}</Typography>
      ),
    },
    {
      field: 'ModuleGroupName', headerName: 'Module Group', flex: 1.2, minWidth: 160,
      renderCell: (params) => (
        <Typography sx={{ fontSize: 13, color: '#374151' }}>{params.value || '—'}</Typography>
      ),
    },
    {
      field: 'ParentModuleGroupName', headerName: 'Main Module Group', flex: 1.2, minWidth: 180,
      renderCell: (params) => (
        <Typography sx={{ fontSize: 13, color: '#374151' }}>{params.value || '—'}</Typography>
      ),
    },
  ];

  render() {
    const { role, roleList, moduleGroupList, loading, childData, selectedRowKeys, selectedModuleGroups, snackbar, searchText } = this.state;
    const filteredChildData = this.getFilteredChildData();

    const hasData = role.RoleId && filteredChildData.length > 0;
    const noRoleSelected = !role.RoleId;

    return (
      <PageContainer>
        <AppBreadcrumbs />

        <PageHeader title="Role Right" subtitle="Assign module rights to roles" />

        {noRoleSelected && !loading ? (
          <EmptyState
            icon={<VpnKeyIcon sx={{ fontSize: 40 }} />}
            title="Select a Role"
            description="Choose a role from the dropdown to manage its module rights."
          />
        ) : (
          <Box>
            <Box sx={{
              border: '1px solid #E5E7EB',
              borderRadius: '12px',
              p: 3,
              mb: 3,
              bgcolor: '#FFFFFF',
            }}>
              <Grid container spacing={2} alignItems="center">
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField select size="small" label="Role Name" required fullWidth
                    value={role.RoleId || ''} onChange={(e) => this.roleChange(e.target.value)}>
                    <MenuItem value="">Select....</MenuItem>
                    {roleList.map((r) => <MenuItem key={r.RoleId} value={r.RoleId}>{r.RoleName}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField select size="small" label="Module Group Filter" fullWidth
                    SelectProps={{ multiple: true }}
                    value={selectedModuleGroups}
                    onChange={(e) => this.moduleGroupChange(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}>
                    {moduleGroupList.map((mg) => <MenuItem key={mg.ModuleGroupId} value={mg.ModuleGroupName}>{mg.ModuleGroupName}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}>
                    <MuiButton
                      variant="contained"
                      startIcon={<SaveIcon />}
                      onClick={this.saveData}
                      disabled={!role.RoleId}
                      sx={{ borderRadius: '10px', px: 3, py: 1.25 }}
                    >
                      Save
                    </MuiButton>
                  </Box>
                </Grid>
              </Grid>
            </Box>

            {selectedRowKeys.length > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1, ml: 0.5 }}>
                {selectedRowKeys.length} item{selectedRowKeys.length !== 1 ? 's' : ''} selected
              </Typography>
            )}

            <Box>
              <GridToolbar
                searchValue={searchText}
                onSearchChange={(val) => this.setState({ searchText: val })}
                searchPlaceholder="Search modules..."
                onRefresh={this.handleRefresh}
                onExport={this.handleExport}
              />
              <Box sx={{ height: 500, width: '100%' }}>
                <DataGrid
                  rows={filteredChildData}
                  columns={this.childColumns}
                  loading={loading}
                  getRowId={(row) => row.ModuleId?.toString() || row.key}
                  checkboxSelection
                  rowSelectionModel={selectedRowKeys}
                  onRowSelectionModelChange={(newSelection) => this.setState({ selectedRowKeys: newSelection })}
                  disableRowSelectionOnClick
                  pageSizeOptions={[10, 20, 50, 100]}
                  initialState={{ pagination: { paginationModel: { pageSize: 20 } } }}
                  sx={{
                    border: 'none',
                    '& .MuiDataGrid-columnHeaders': { backgroundColor: '#F3F5FA' },
                    '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 600, color: 'primary.main', fontSize: 13 },
                  }}
                />
              </Box>
            </Box>
          </Box>
        )}

        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={this.closeSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <Alert onClose={this.closeSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%', borderRadius: '10px' }}>{snackbar.message}</Alert>
        </Snackbar>
      </PageContainer>
    );
  }
}

export default RoleRight;
