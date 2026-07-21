import React, { Component } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import CommonUtilityController from '../controller/common-utility-controller';
import { TableHelper } from '../../helper/table-helper';
import ReportPdfFooter from '../../helper/report-pdf-footer';
import LoginState from '../../authentication/loginState';
import { PageContainer, PageHeader, DataCard, AppDataGrid } from '../../components/ui';

class ViewProject extends Component {
  constructor(props) {
    super(props);
    this.formRef = React.createRef();
    this.state = {
      data: [],
      projectData: {
        ProjectMasterId: 0, ParentProjectMasterId: '', ProjectCode: '',
        ProjectName: '', Remarks: '', Status: 0,
      },
      loading: false,
      visible: false,
      filteredTotal: null,
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

  async getProjects() {
    this.setState({ loading: true, projectList: [] });
    const reqData = { UserId: LoginState.UserId };
    await new CommonUtilityController().getProjects(reqData)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) this.setState({ data });
      })
      .catch((error) => {
        this.setState({ loading: false });
        this.notify('error', error.toString());
      });
  }

  columns = [
    { title: 'Project Code', key: 'ProjectCode', dataIndex: 'ProjectCode', sorter: (a, b) => a.ProjectCode.localeCompare(b.ProjectCode), ...new TableHelper().getColumnSearchProps('ProjectCode') },
    { title: 'Project Name', key: 'ProjectName', dataIndex: 'ProjectName', sorter: (a, b) => a.ProjectName.localeCompare(b.ProjectName), ...new TableHelper().getColumnSearchProps('ProjectName') },
    { title: 'Parent Project', key: 'ParentProjectName', dataIndex: 'ParentProjectName', sorter: (a, b) => a.ProjectName.localeCompare(b.ParentProjectName), ...new TableHelper().getColumnSearchProps('ParentProjectName') },
    { title: 'Remarks', key: 'Remarks', dataIndex: 'Remarks', sorter: (a, b) => a.Remarks.localeCompare(b.Remarks), ...new TableHelper().getColumnSearchProps('Remarks') },
  ];

  gridColumns = [
    { field: 'ProjectCode', headerName: 'Project Code', flex: 1, minWidth: 140 },
    { field: 'ProjectName', headerName: 'Project Name', flex: 1.6, minWidth: 200 },
    { field: 'ParentProjectName', headerName: 'Parent Project', flex: 1.2, minWidth: 170 },
    { field: 'Remarks', headerName: 'Remarks', flex: 1.4, minWidth: 180 },
  ];

  render() {
    const { data, loading, snackbar } = this.state;
    const count = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;
    return (
      <PageContainer>
        <PageHeader title="Project" subtitle="View project details" />
        <DataCard title="Project Details" count={data.length ? count : null} countLabel="Records">
          <AppDataGrid rows={data} columns={this.gridColumns} loading={loading}
            getRowId={(row) => row.ProjectMasterId} emptyTitle="No projects found"
            emptyDescription="Try adjusting your search." />
        </DataCard>
        <ReportPdfFooter columnHeader={this.columns} tableData={data}
          orientation="portrait" tableHeader="Project Details" fileName="ProjectDetails" />
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

export default ViewProject;
