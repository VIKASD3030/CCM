import React, { Component } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Grid from '@mui/material/Grid';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Tooltip from '@mui/material/Tooltip';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CommonUtilityController from '../controller/common-utility-controller';
import { TableHelper } from '../../helper/table-helper';
import { fillSelectList } from '../../helper/common-utility';
import ReportPdfFooter from '../../helper/report-pdf-footer';
import LoginState from '../../authentication/loginState';
import { PageContainer, PageHeader, DataCard, AppDataGrid } from '../../components/ui';

class ViewActivity extends Component {
  constructor(props) {
    super(props);
    this.state = {
      data: [],
      searchData: { ProjectId: '', ContractId: '', ActivityGroupId: '' },
      loading: false,
      filteredTotal: null,
      activityGroupList: [],
      projectList: [],
      contractList: [],
      projectId: '',
      snackbar: { open: false, severity: 'success', message: '' },
    };
  }

  componentDidMount() {
    this.getProjects();
  }

  notify = (severity, message) => {
    this.setState({ snackbar: { open: true, severity, message } });
  };

  closeSnackbar = () => {
    this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));
  };

  async getActivities(activityGroupId) {
    this.setState({ loading: true });
    await new CommonUtilityController().getActivities(activityGroupId)
      .then((result) => {
        this.setState({ loading: false });
        if (result != undefined) this.setState({ data: result });
      })
      .catch((error) => {
        this.setState({ loading: false });
        this.notify('error', error.toString());
      });
  }

  async getProjects() {
    this.setState({ loading: true });
    const reqData = { UserId: LoginState.UserId };
    await new CommonUtilityController().getProjects(reqData)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) this.setState({ projectList: data });
      })
      .catch((error) => { this.setState({ loading: false }); this.notify('error', error.toString()); });
  }

  async getContracts(reqData) {
    this.setState({ loading: true, contractList: [] });
    await new CommonUtilityController().getContracts(reqData)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) this.setState({ contractList: data });
      })
      .catch((error) => { this.setState({ loading: false }); this.notify('error', error.toString()); });
  }

  async getActivityGroups(projectId, contractId) {
    this.setState({ loading: true, activityGroupList: [] });
    await new CommonUtilityController().getActivityGroups(projectId, contractId)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) this.setState({ activityGroupList: data });
      })
      .catch((error) => { this.setState({ loading: false }); this.notify('error', error.toString()); });
  }

  projectChange = (value) => {
    this.setState({ contractList: [], activityGroupList: [], data: [] });
    this.setState((s) => ({ searchData: { ...s.searchData, ProjectId: value, ContractId: '', ActivityGroupId: '' }, projectId: value }));
    if (value) {
      this.getContracts({ projectId: value, workPackageId: 0, contractorId: 0 });
    }
  };

  contractChange = (value) => {
    this.setState({ activityGroupList: [], data: [] });
    const { projectId } = this.state;
    this.setState((s) => ({ searchData: { ...s.searchData, ContractId: value, ActivityGroupId: '' } }));
    if (value) this.getActivityGroups(projectId, value);
  };

  activityGroupChange = (value) => {
    this.setState((s) => ({ searchData: { ...s.searchData, ActivityGroupId: value }, data: [] }));
    if (value) this.getActivities(value);
  };

  columns = [
    { title: 'Activity', key: 'ActivityName', dataIndex: 'ActivityName', sorter: (a, b) => a.ActivityName.localeCompare(b.ActivityName), ...new TableHelper().getColumnSearchProps('ActivityName') },
    { title: 'Activity Code', key: 'ActivityCode', dataIndex: 'ActivityCode', sorter: (a, b) => a.ActivityCode.localeCompare(b.ActivityCode), ...new TableHelper().getColumnSearchProps('ActivityCode') },
    { title: 'Activity Group', key: 'ActivityGroupName', dataIndex: 'ActivityGroupName', sorter: (a, b) => a.ActivityGroupName.localeCompare(b.ActivityGroupName), ...new TableHelper().getColumnSearchProps('ActivityGroupName') },
    { title: 'Project Name', key: 'ProjectName', dataIndex: 'ProjectName', sorter: (a, b) => a.ProjectName.localeCompare(b.ProjectName), ...new TableHelper().getColumnSearchProps('ProjectName') },
    { title: 'Contract', key: 'ContractName', dataIndex: 'ContractName', sorter: (a, b) => a.ContractName.localeCompare(b.ContractName), ...new TableHelper().getColumnSearchProps('ContractName') },
    { title: 'Remarks', key: 'Remarks', dataIndex: 'Remarks', sorter: (a, b) => a?.Remarks?.localeCompare(b?.Remarks), ...new TableHelper().getColumnSearchProps('Remarks') },
  ];

  gridColumns = [
    { field: 'ActivityName', headerName: 'Activity', flex: 1.6, minWidth: 200 },
    { field: 'ActivityCode', headerName: 'Activity Code', flex: 1, minWidth: 140 },
    { field: 'ActivityGroupName', headerName: 'Activity Group', flex: 1.2, minWidth: 160 },
    { field: 'ProjectName', headerName: 'Project Name', flex: 1.2, minWidth: 160 },
    { field: 'ContractName', headerName: 'Contract', flex: 1.4, minWidth: 180 },
    { field: 'Remarks', headerName: 'Remarks', flex: 1.2, minWidth: 150 },
  ];

  render() {
    const { data, activityGroupList, projectList, contractList, loading, searchData, snackbar } = this.state;
    const count = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;
    return (
      <PageContainer>
        <PageHeader title="Activity" subtitle="View activities by project, contract, and activity group" />

        {/* Filter panel */}
        <Box sx={{ mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Grid container spacing={2} alignItems="flex-end">
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField select size="small" label="Project Name" fullWidth
                value={searchData.ProjectId || ''} onChange={(e) => this.projectChange(e.target.value)}>
                <MenuItem value="">Select....</MenuItem>
                {projectList.map((p) => (
                  <MenuItem key={p.ProjectMasterId} value={p.ProjectMasterId}>{p.ProjectName}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField select size="small" label="Contract Name" fullWidth
                value={searchData.ContractId || ''} onChange={(e) => this.contractChange(e.target.value)}>
                <MenuItem value="">Select....</MenuItem>
                {contractList.map((c) => (
                  <MenuItem key={c.ContractId} value={c.ContractId}>{c.ContractName}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField select size="small" label="Activity Group" fullWidth
                value={searchData.ActivityGroupId || ''} onChange={(e) => this.activityGroupChange(e.target.value)}>
                <MenuItem value="">Select....</MenuItem>
                {activityGroupList.map((ag) => (
                  <MenuItem key={ag.ActivityGroupId} value={ag.ActivityGroupId}>{ag.ActivityGroupName}</MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
        </Box>

        <DataCard title="Activity Details" count={data.length ? count : null} countLabel="Records">
          <AppDataGrid rows={data} columns={this.gridColumns} loading={loading}
            getRowId={(row) => row.ActivityId} emptyTitle="No activities found"
            emptyDescription="Select a project, contract and activity group to load activities." height={600} />
        </DataCard>

        <ReportPdfFooter columnHeader={this.columns} tableData={data}
          tableHeader="Activity Details" fileName="ActivityDetails" />

        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={this.closeSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <Alert onClose={this.closeSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </PageContainer>
    );
  }
}

export default ViewActivity;
