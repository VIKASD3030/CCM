import React, { Component } from 'react';
import moment from 'moment';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { DataGrid } from '@mui/x-data-grid';
import { fillSelectList } from '../../helper/common-utility';
import CommonUtilityController from '../controller/common-utility-controller';
import LoginState from '../../authentication/loginState';
import { PageContainer, PageHeader, DataCard } from '../../components/ui';

const requiredChildFields = [];

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

  childColumns = [
    { field: 'UserShownName', headerName: 'Module', flex: 1, minWidth: 160 },
    { field: 'ModuleGroupName', headerName: 'Module Group', flex: 1.2, minWidth: 160 },
    { field: 'ParentModuleGroupName', headerName: 'Main Module Group', flex: 1.2, minWidth: 180 },
  ];

  render() {
    const { role, roleList, moduleGroupList, loading, childData, selectedRowKeys, selectedModuleGroups, snackbar } = this.state;
    return (
      <PageContainer>
        <PageHeader title="Role Right" subtitle="Assign module rights to roles" />

        <DataCard title="Role Right Details" sx={{ mb: 2 }}>
          <Box sx={{ p: 2 }}>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField select size="small" label="Role Name" required fullWidth
                  value={role.RoleId || ''} onChange={(e) => this.roleChange(e.target.value)}>
                  <MenuItem value="">Select....</MenuItem>
                  {roleList.map((r) => <MenuItem key={r.RoleId} value={r.RoleId}>{r.RoleName}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField select size="small" label="Module Group Filter" fullWidth
                  SelectProps={{ multiple: true }}
                  value={selectedModuleGroups}
                  onChange={(e) => this.moduleGroupChange(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}>
                  {moduleGroupList.map((mg) => <MenuItem key={mg.ModuleGroupId} value={mg.ModuleGroupName}>{mg.ModuleGroupName}</MenuItem>)}
                </TextField>
              </Grid>
            </Grid>

            {selectedRowKeys.length > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {selectedRowKeys.length} item{selectedRowKeys.length !== 1 ? 's' : ''} selected
              </Typography>
            )}

            <Box sx={{ height: 500, width: '100%' }}>
              <DataGrid
                rows={childData}
                columns={this.childColumns}
                loading={loading}
                getRowId={(row) => row.ModuleId?.toString() || row.key}
                checkboxSelection
                rowSelectionModel={selectedRowKeys}
                onRowSelectionModelChange={(newSelection) => this.setState({ selectedRowKeys: newSelection })}
                disableRowSelectionOnClick
                showToolbar
                pageSizeOptions={[10, 20, 50, 100]}
                initialState={{ pagination: { paginationModel: { pageSize: 20 } } }}
                sx={{
                  border: 'none',
                  '& .MuiDataGrid-columnHeaders': { backgroundColor: '#F3F5FA' },
                  '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 600, color: 'primary.main', fontSize: 13 },
                }}
              />
            </Box>

            <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
              <Button variant="contained" startIcon={<SaveRoundedIcon />} onClick={this.saveData}
                disabled={!role.RoleId}>
                Save
              </Button>
            </Stack>
          </Box>
        </DataCard>

        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={this.closeSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <Alert onClose={this.closeSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>{snackbar.message}</Alert>
        </Snackbar>
      </PageContainer>
    );
  }
}

export default RoleRight;
