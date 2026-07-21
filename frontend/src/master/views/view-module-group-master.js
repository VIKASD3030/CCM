import React, { Component } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import CommonUtilityController from '../controller/common-utility-controller';
import { TableHelper } from '../../helper/table-helper';
import { fillSelectList } from '../../helper/common-utility';
import ReportPdfFooter from '../../helper/report-pdf-footer';
import { PageContainer, PageHeader, DataCard, AppDataGrid } from '../../components/ui';

class ViewModuleGroup extends Component {
  constructor(props) {
    super(props);
    this.formRef = React.createRef();
    this.state = {
      data: [],
      moduleGroupData: {
        ModuleGroupId: 0,
        ModuleGroupCode: '',
        ModuleGroupName: '',
        ParentModuleGroupId: '',
        Level: '',
        Remarks: '',
        Status: 0,
      },
      loading: false,
      visible: false,
      filteredTotal: null,
      moduleGroupParentList: [],
      snackbar: { open: false, severity: 'success', message: '' },
    };
  }

  componentDidMount() {
    this.getModuleGroups();
  }

  notify = (severity, message) => {
    this.setState({ snackbar: { open: true, severity, message } });
  };

  closeSnackbar = () => {
    this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));
  };

  async getModuleGroups() {
    this.setState({ loading: true, departmentList: [] });
    await new CommonUtilityController()
      .getModuleGroups(0)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) {
          let moduleGroupParentList = fillSelectList(data, 'ModuleGroupName', 'ModuleGroupId');
          this.setState({ data: data, moduleGroupParentList: moduleGroupParentList });
        }
      })
      .catch((error) => {
        this.setState({ loading: false });
        this.notify('error', error.toString());
      });
  }

  columns = [
    { title: 'Module Group Code', key: 'ModuleGroupCode', dataIndex: 'ModuleGroupCode', sorter: (a, b) => a.ModuleGroupCode.localeCompare(b.ModuleGroupCode), ...new TableHelper().getColumnSearchProps('ModuleGroupCode') },
    { title: 'Module Group Name', key: 'ModuleGroupName', dataIndex: 'ModuleGroupName', sorter: (a, b) => a.ModuleGroupName.localeCompare(b.ModuleGroupName), ...new TableHelper().getColumnSearchProps('ModuleGroupName') },
    { title: 'Parent Module Group', key: 'ParentModuleGroupName', dataIndex: 'ParentModuleGroupName', sorter: (a, b) => a.ModuleGroupName.localeCompare(b.ParentModuleGroupName), ...new TableHelper().getColumnSearchProps('ParentModuleGroupName') },
    { title: 'Order By', align: 'right', key: 'Level', dataIndex: 'Level', sorter: (a, b) => a.Level.localeCompare(b.Level), ...new TableHelper().getColumnSearchProps('Level') },
    { title: 'Remarks', key: 'Remarks', dataIndex: 'Remarks', sorter: (a, b) => a?.Remarks?.localeCompare(b?.Remarks), ...new TableHelper().getColumnSearchProps('Remarks') },
  ];

  gridColumns = [
    { field: 'ModuleGroupCode', headerName: 'Module Group Code', flex: 1, minWidth: 160 },
    { field: 'ModuleGroupName', headerName: 'Module Group Name', flex: 1.4, minWidth: 190 },
    { field: 'ParentModuleGroupName', headerName: 'Parent Module Group', flex: 1.2, minWidth: 180 },
    { field: 'Level', headerName: 'Order By', width: 110, type: 'number', align: 'right', headerAlign: 'right' },
    { field: 'Remarks', headerName: 'Remarks', flex: 1.2, minWidth: 150 },
  ];

  render() {
    const { data, loading, snackbar } = this.state;
    const count = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;
    return (
      <PageContainer>
        <PageHeader title="Module Group" subtitle="View module groups and their hierarchy" />

        <DataCard title="Module Group Details" count={data.length ? count : null} countLabel="Records">
          <AppDataGrid
            rows={data}
            columns={this.gridColumns}
            loading={loading}
            getRowId={(row) => row.ModuleGroupId}
            emptyTitle="No module groups found"
            emptyDescription="Try adjusting your search."
          />
        </DataCard>

        <ReportPdfFooter
          columnHeader={this.columns}
          tableData={data}
          orientation="portrait"
          tableHeader="Module Group Details"
          fileName="ModuleGroupDetails"
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

export default ViewModuleGroup;
