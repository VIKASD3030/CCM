import React, { Component } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import CommonUtilityController from "../controller/common-utility-controller";
import { TableHelper } from '../../helper/table-helper';
import { fillSelectList } from '../../helper/common-utility';
import ReportPdfFooter from '../../helper/report-pdf-footer';
import { PageContainer, PageHeader, DataCard, AppDataGrid } from '../../components/ui';

class ViewDepartment extends Component {

  constructor(props) {
    super(props);
    this.formRef = React.createRef();
    this.state = {
      data: [],
      departmentData: {
        DepartmentId: 0,
        DepartmentCode: "",
        DepartmentName: "",
        ParentDepartmentId: "",
        Level: "",
        Remarks: "",
        Status: 0,
      },
      loading: false,
      visible: false,
      filteredTotal: null,
      departmentParentList: [],
      snackbar: { open: false, severity: 'success', message: '' },
    };

  }
  //load initial data
  componentDidMount() {
    this.getDepartments();
  }

  notify = (severity, message) => {
    this.setState({ snackbar: { open: true, severity, message } });
  };

  closeSnackbar = () => {
    this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));
  };

  //fetch Departments
  async getDepartments() {
    this.setState({ loading: true, departmentList: [] });
    await new CommonUtilityController().getDepartments(0, 0)
      .then(data => {
        this.setState({ loading: false, });
        if (data != undefined) {
          let departmentParentList = fillSelectList(data, "DepartmentName", 'DepartmentId');

          this.setState({ data: data, departmentParentList: departmentParentList });
        }
      })
      .catch(error => {
        this.setState({ loading: false, });
        this.notify('error', error.toString());
      });

  }
  columns = [

    { title: 'Department Code', key: 'DepartmentCode', dataIndex: 'DepartmentCode', sorter: (a, b) => a.DepartmentCode.localeCompare(b.DepartmentCode), ...new TableHelper().getColumnSearchProps('DepartmentCode') },
    { title: 'Department Name', key: 'DepartmentName', dataIndex: 'DepartmentName', sorter: (a, b) => a.DepartmentName.localeCompare(b.DepartmentName), ...new TableHelper().getColumnSearchProps('DepartmentName') },
    { title: 'Parent Department', key: 'ParentDepartmentName', dataIndex: 'ParentDepartmentName', sorter: (a, b) => a.DepartmentName.localeCompare(b.ParentDepartmentName), ...new TableHelper().getColumnSearchProps('ParentDepartmentName') },
    { title: 'Order By', align: "right", key: 'Level', dataIndex: 'Level', sorter: (a, b) => a.DepartmentName.localeCompare(b.Level), ...new TableHelper().getColumnSearchProps('Level') },
    { title: 'Remarks', key: 'Remarks', dataIndex: 'Remarks', sorter: (a, b) => a?.Remarks?.localeCompare(b?.Remarks), ...new TableHelper().getColumnSearchProps('Remarks') },

  ];

  gridColumns = [
    { field: 'DepartmentCode', headerName: 'Department Code', flex: 1, minWidth: 140 },
    { field: 'DepartmentName', headerName: 'Department Name', flex: 1.4, minWidth: 180 },
    { field: 'ParentDepartmentName', headerName: 'Parent Department', flex: 1.2, minWidth: 160 },
    { field: 'Level', headerName: 'Order By', width: 110, type: 'number', align: 'right', headerAlign: 'right' },
    { field: 'Remarks', headerName: 'Remarks', flex: 1.4, minWidth: 180 },
  ];

  render() {
    const { data, loading, snackbar } = this.state;
    const count = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;
    return (
      <PageContainer>
        <PageHeader title="Department" subtitle="View organizational departments and their hierarchy" />

        <DataCard title="Department Details" count={data.length ? count : null} countLabel="Records">
          <AppDataGrid
            rows={data}
            columns={this.gridColumns}
            loading={loading}
            getRowId={(row) => row.DepartmentId}
            emptyTitle="No departments found"
            emptyDescription="Try adjusting your search."
          />
        </DataCard>

        <ReportPdfFooter
          columnHeader={this.columns}
          tableData={data}
          orientation="portrait"
          tableHeader="Department Details"
          fileName="DepartmentDetails"
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
export default ViewDepartment;
