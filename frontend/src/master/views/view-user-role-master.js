import React, { Component } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import CommonUtilityController from '../controller/common-utility-controller';
import { TableHelper } from '../../helper/table-helper';
import ReportPdfFooter from '../../helper/report-pdf-footer';
import { PageContainer, PageHeader, DataCard, AppDataGrid } from '../../components/ui';

class ViewUserRole extends Component {
  constructor(props) {
    super(props);
    this.formRef = React.createRef();
    this.state = {
      data: [],
      userRoleData: { UserRoleId: 0, UserId: '', RoleId: '', Status: 0 },
      loading: false,
      visible: false,
      filteredTotal: null,
      userList: [],
      roleList: [],
      snackbar: { open: false, severity: 'success', message: '' },
    };
  }

  componentDidMount() {
    this.getUserRoles();
  }

  notify = (severity, message) => {
    this.setState({ snackbar: { open: true, severity, message } });
  };

  closeSnackbar = () => {
    this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));
  };

  async getUserRoles() {
    this.setState({ loading: true });
    await new CommonUtilityController().getUserRoles(0)
      .then((result) => {
        this.setState({ loading: false });
        if (result != undefined) this.setState({ data: result });
      })
      .catch((error) => {
        this.setState({ loading: false });
        this.notify('error', error.toString());
      });
  }

  columns = [
    { title: 'User Name', key: 'UserName', dataIndex: 'UserName', sorter: (a, b) => a.UserName.localeCompare(b.UserName), ...new TableHelper().getColumnSearchProps('UserName') },
    { title: 'Role Name', key: 'RoleName', dataIndex: 'RoleName', sorter: (a, b) => a.RoleName.localeCompare(b.RoleName), ...new TableHelper().getColumnSearchProps('RoleName') },
  ];

  gridColumns = [
    { field: 'UserName', headerName: 'User Name', flex: 1.4, minWidth: 180 },
    { field: 'RoleName', headerName: 'Role Name', flex: 1.4, minWidth: 180 },
  ];

  render() {
    const { data, loading, snackbar } = this.state;
    const count = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;
    return (
      <PageContainer>
        <PageHeader title="User Role" subtitle="View user role assignments" />
        <DataCard title="User Role Details" count={data.length ? count : null} countLabel="Records">
          <AppDataGrid rows={data} columns={this.gridColumns} loading={loading}
            getRowId={(row) => row.UserRoleId} emptyTitle="No user roles found"
            emptyDescription="Try adjusting your search." />
        </DataCard>
        <ReportPdfFooter columnHeader={this.columns} tableData={data}
          orientation="portrait" tableHeader="User Role Details" fileName="UserRoleDetails" />
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

export default ViewUserRole;
