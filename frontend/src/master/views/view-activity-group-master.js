import React, { Component } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Tooltip from '@mui/material/Tooltip';
import CommonUtilityController from '../controller/common-utility-controller';
import { TableHelper } from '../../helper/table-helper';
import { fillSelectList } from '../../helper/common-utility';
import ReportPdfFooter from '../../helper/report-pdf-footer';
import { PageContainer, PageHeader, DataCard, AppDataGrid } from '../../components/ui';

class ViewActivityGroup extends Component {
  constructor(props) {
    super(props);
    this.formRef = React.createRef();
    this.state = {
      data: [],
      activityGroupData: {
        ActivityGroupId: 0, ActivityGroupName: '', ActivityGroupParentId: '',
        ProjectId: '', ContractId: '', Remarks: '', Status: 0,
      },
      loading: false,
      visible: false,
      filteredTotal: null,
      projectList: [],
      contractList: [],
      activityGroupParentList: [],
      snackbar: { open: false, severity: 'success', message: '' },
    };
  }

  componentDidMount() {
    this.getActivityGroups();
    this.getProjects();
  }

  notify = (severity, message) => {
    this.setState({ snackbar: { open: true, severity, message } });
  };

  closeSnackbar = () => {
    this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));
  };

  async getActivityGroups() {
    this.setState({ loading: true });
    await new CommonUtilityController().getActivityGroups(0, 0)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) {
          let activityGroupParentList = fillSelectList(data, 'ActivityGroupName', 'ActivityGroupId');
          this.setState({ data, activityGroupParentList });
        }
      })
      .catch((error) => { this.setState({ loading: false }); this.notify('error', error.toString()); });
  }

  async getProjects() {
    this.setState({ loading: true });
    await new CommonUtilityController().getProjects()
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) {
          this.setState({ projectList: fillSelectList(data, 'ProjectName', 'ProjectMasterId') });
        }
      })
      .catch((error) => { this.setState({ loading: false }); this.notify('error', error.toString()); });
  }

  columns = [
    { title: 'Activity Group', key: 'ActivityGroupName', dataIndex: 'ActivityGroupName', sorter: (a, b) => a.ActivityGroupName.localeCompare(b.ActivityGroupName), ...new TableHelper().getColumnSearchProps('ActivityGroupName') },
    { title: 'Project Name', key: 'ProjectName', dataIndex: 'ProjectName', sorter: (a, b) => a.ProjectName.localeCompare(b.ProjectName), ...new TableHelper().getColumnSearchProps('ProjectName') },
    { title: 'Contract', key: 'ContractName', dataIndex: 'ContractName', sorter: (a, b) => a.ContractName.localeCompare(b.ContractName), ...new TableHelper().getColumnSearchProps('ContractName') },
    { title: 'Remarks', key: 'Remarks', dataIndex: 'Remarks', sorter: (a, b) => a?.Remarks?.localeCompare(b?.Remarks), ...new TableHelper().getColumnSearchProps('Remarks') },
  ];

  gridColumns = [
    { field: 'ActivityGroupName', headerName: 'Activity Group', flex: 1.4, minWidth: 180 },
    { field: 'ProjectName', headerName: 'Project Name', flex: 1.2, minWidth: 160 },
    { field: 'ContractName', headerName: 'Contract', flex: 1.4, minWidth: 180 },
    { field: 'Remarks', headerName: 'Remarks', flex: 1.2, minWidth: 150 },
  ];

  render() {
    const { data, loading, snackbar } = this.state;
    const count = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;
    return (
      <PageContainer>
        <PageHeader title="Activity Group" subtitle="View activity groups" />
        <DataCard title="Activity Group Details" count={data.length ? count : null} countLabel="Records">
          <AppDataGrid rows={data} columns={this.gridColumns} loading={loading}
            getRowId={(row) => row.ActivityGroupId} emptyTitle="No activity groups found"
            emptyDescription="Try adjusting your search." />
        </DataCard>
        <ReportPdfFooter columnHeader={this.columns} tableData={data}
          orientation="portrait" tableHeader="Activity Group Details" fileName="ActivityGroupDetails" />
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

export default ViewActivityGroup;
