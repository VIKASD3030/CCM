import React, { Component } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import CommonUtilityController from '../controller/common-utility-controller';
import { TableHelper } from '../../helper/table-helper';
import { fillSelectList } from '../../helper/common-utility';
import ReportPdfFooter from '../../helper/report-pdf-footer';
import { PageContainer, PageHeader, DataCard, AppDataGrid } from '../../components/ui';

class ViewRole extends Component {
  constructor(props) {
    super(props);
    this.formRef = React.createRef();
    this.state = {
      data: [],
      roleData: {
        RoleId: 0,
        RoleCode: '',
        RoleName: '',
        ParentRoleId: '0',
        Level: '',
        Remarks: '',
        Status: 0,
      },
      loading: false,
      visible: false,
      filteredTotal: null,
      roleParentList: [],
      snackbar: { open: false, severity: 'success', message: '' },
    };
  }

  componentDidMount() {
    this.getRoles();
  }

  notify = (severity, message) => {
    this.setState({ snackbar: { open: true, severity, message } });
  };

  closeSnackbar = () => {
    this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));
  };

  async getRoles() {
    this.setState({ loading: true, roleList: [] });
    await new CommonUtilityController()
      .getRoles(0)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) {
          let roleParentList = fillSelectList(data, 'RoleName', 'RoleId');
          this.setState({ data: data, roleParentList: roleParentList });
        }
      })
      .catch((error) => {
        this.setState({ loading: false });
        this.notify('error', error.toString());
      });
  }

  columns = [
    { title: 'Role Code', key: 'RoleCode', dataIndex: 'RoleCode', sorter: (a, b) => a.RoleCode.localeCompare(b.RoleCode), ...new TableHelper().getColumnSearchProps('RoleCode') },
    { title: 'Role Name', key: 'RoleName', dataIndex: 'RoleName', sorter: (a, b) => a.RoleName.localeCompare(b.RoleName), ...new TableHelper().getColumnSearchProps('RoleName') },
    { title: 'Parent Role', key: 'ParentRoleName', dataIndex: 'ParentRoleName', sorter: (a, b) => a.ParentRoleName?.localeCompare(b?.ParentRoleName), ...new TableHelper().getColumnSearchProps('ParentRoleName') },
    { title: 'Remarks', key: 'Remarks', dataIndex: 'Remarks', sorter: (a, b) => a?.Remarks?.localeCompare(b?.Remarks), ...new TableHelper().getColumnSearchProps('Remarks') },
  ];

  gridColumns = [
    { field: 'RoleCode', headerName: 'Role Code', flex: 1, minWidth: 130 },
    { field: 'RoleName', headerName: 'Role Name', flex: 1.4, minWidth: 180 },
    { field: 'ParentRoleName', headerName: 'Parent Role', flex: 1.2, minWidth: 160 },
    { field: 'Remarks', headerName: 'Remarks', flex: 1.4, minWidth: 180 },
  ];

  render() {
    const { data, loading, snackbar } = this.state;
    const count = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;
    return (
      <PageContainer>
        <PageHeader title="Role" subtitle="View roles and their hierarchy" />

        <DataCard title="Role Details" count={data.length ? count : null} countLabel="Records">
          <AppDataGrid
            rows={data}
            columns={this.gridColumns}
            loading={loading}
            getRowId={(row) => row.RoleId}
            emptyTitle="No roles found"
            emptyDescription="Try adjusting your search."
          />
        </DataCard>

        <ReportPdfFooter
          columnHeader={this.columns}
          tableData={data}
          orientation="portrait"
          tableHeader="Role Details"
          fileName="RoleDetails"
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

export default ViewRole;
