import React, { Component } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import CommonUtilityController from '../controller/common-utility-controller';
import { TableHelper } from '../../helper/table-helper';
import { fillSelectList } from '../../helper/common-utility';
import ReportPdfFooter from '../../helper/report-pdf-footer';
import { PageContainer, PageHeader, DataCard, AppDataGrid } from '../../components/ui';

class ViewUser extends Component {
  constructor(props) {
    super(props);
    this.formUserRef = React.createRef();
    this.state = {
      data: [],
      userData: {
        Id: 0, UserId: 0, AdUserName: '', EmployeeNo: '', EmployeeName: '',
        DesignationId: '', DepartmentId: '', UserType: '', EmailId: '', Status: 0,
      },
      loading: false,
      visible: false,
      filteredTotal: null,
      designationList: [],
      departmentList: [],
      snackbar: { open: false, severity: 'success', message: '' },
    };
  }

  componentDidMount() {
    this.getUsers();
    this.getDesignations();
    this.getDepartments();
  }

  notify = (severity, message) => {
    this.setState({ snackbar: { open: true, severity, message } });
  };

  closeSnackbar = () => {
    this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));
  };

  async getUsers() {
    const reqData = { designationId: 0, departmentId: 0 };
    this.setState({ loading: true });
    await new CommonUtilityController().getUsers(reqData)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) this.setState({ data });
      })
      .catch((error) => {
        this.setState({ loading: false });
        this.notify('error', error.toString());
      });
  }

  async getDesignations() {
    this.setState({ loading: true });
    await new CommonUtilityController().getDesignations()
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) {
          this.setState({ designationList: fillSelectList(data, 'DesignationName', 'DesignationId') });
        }
      })
      .catch((error) => { this.setState({ loading: false }); this.notify('error', error.toString()); });
  }

  async getDepartments() {
    this.setState({ loading: true, departmentList: [] });
    await new CommonUtilityController().getDepartments(0)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) {
          this.setState({ departmentList: fillSelectList(data, 'DepartmentName', 'DepartmentId') });
        }
      })
      .catch((error) => { this.setState({ loading: false }); this.notify('error', error.toString()); });
  }

  columns = [
    { title: 'UserID', width: 70, key: 'UserId', dataIndex: 'UserId', ...new TableHelper().getColumnSearchProps('UserId') },
    { title: 'User Name', key: 'UserName', dataIndex: 'UserName', sorter: (a, b) => a.UserName.localeCompare(b.UserName), ...new TableHelper().getColumnSearchProps('UserName') },
    { title: 'AdUser Name', key: 'AdUserName', dataIndex: 'AdUserName', sorter: (a, b) => a.AdUserName.localeCompare(b.AdUserName), ...new TableHelper().getColumnSearchProps('AdUserName') },
    { title: 'Employee No', width: 100, key: 'EmployeeNo', dataIndex: 'EmployeeNo', ...new TableHelper().getColumnSearchProps('EmployeeNo') },
    { title: 'Employee Name', key: 'EmployeeName', dataIndex: 'EmployeeName', ...new TableHelper().getColumnSearchProps('EmployeeName') },
    { title: 'Designation', key: 'DesignationName', dataIndex: 'DesignationName', ...new TableHelper().getColumnSearchProps('DesignationName') },
    { title: 'Department', key: 'DepartmentName', dataIndex: 'DepartmentName', ...new TableHelper().getColumnSearchProps('DepartmentName') },
    { title: 'User Type', width: 70, key: 'UserType', dataIndex: 'UserType', ...new TableHelper().getColumnSearchProps('UserType') },
    { title: 'Email Id', key: 'EmailId', dataIndex: 'EmailId', ...new TableHelper().getColumnSearchProps('EmailId') },
    { title: 'Mobile No', key: 'MobileNo', dataIndex: 'MobileNo', ...new TableHelper().getColumnSearchProps('MobileNo') },
  ];

  gridColumns = [
    { field: 'UserId', headerName: 'UserID', width: 80, type: 'number', align: 'right', headerAlign: 'right' },
    { field: 'UserName', headerName: 'User Name', flex: 1.2, minWidth: 150 },
    { field: 'AdUserName', headerName: 'AD User Name', flex: 1.2, minWidth: 150 },
    { field: 'EmployeeNo', headerName: 'Employee No', width: 120 },
    { field: 'EmployeeName', headerName: 'Employee Name', flex: 1.2, minWidth: 160 },
    { field: 'DesignationName', headerName: 'Designation', flex: 1, minWidth: 140 },
    { field: 'DepartmentName', headerName: 'Department', flex: 1, minWidth: 140 },
    { field: 'UserType', headerName: 'User Type', width: 100 },
    { field: 'EmailId', headerName: 'Email Id', flex: 1.2, minWidth: 180 },
    { field: 'MobileNo', headerName: 'Mobile No', width: 130 },
  ];

  render() {
    const { data, loading, snackbar } = this.state;
    const count = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;
    return (
      <PageContainer>
        <PageHeader title="User" subtitle="View user details" />
        <DataCard title="User Details" count={data.length ? count : null} countLabel="Records">
          <AppDataGrid rows={data} columns={this.gridColumns} loading={loading}
            getRowId={(row) => row.UserId} emptyTitle="No users found"
            emptyDescription="Try adjusting your search." height={650} />
        </DataCard>
        <ReportPdfFooter columnHeader={this.columns} tableData={data}
          orientation="portrait" tableHeader="User Details" fileName="UserDetails" />
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

export default ViewUser;
