import React, { Component } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CommonUtilityController from '../controller/common-utility-controller';
import { TableHelper } from '../../helper/table-helper';
import { fillSelectList } from '../../helper/common-utility';
import ReportPdfFooter from '../../helper/report-pdf-footer';
import { PageContainer, PageHeader, DataCard, AppDataGrid } from '../../components/ui';

class ViewModule extends Component {
  constructor(props) {
    super(props);
    this.formRef = React.createRef();
    this.searchFormRef = React.createRef();
    this.state = {
      data: [],
      moduleData: {
        ModuleId: 0,
        ModuleName: '',
        UserShownName: '',
        ModuleGroupId: '',
        ParentModuleId: '',
        Level: '',
        ModuleType: '',
        ModulePath: '',
        IsExact: false,
        IconType: '',
        IconPath: '',
        Remarks: '',
        Status: 0,
      },
      searchData: {
        ModuleId: 0,
        ModuleGroupId: '',
      },
      loading: false,
      visible: false,
      filteredTotal: null,
      moduleGroupList: [],
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

  async getModules(reqData) {
    this.setState({ loading: true });
    await new CommonUtilityController()
      .getModules(reqData)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) {
          this.setState({ data: data });
        }
      })
      .catch((error) => {
        this.setState({ loading: false });
        this.notify('error', error.toString());
      });
  }

  async getModuleGroups() {
    this.setState({ loading: true, moduleGroupList: [] });
    await new CommonUtilityController()
      .getModuleGroups(0)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) {
          this.setState({ moduleGroupList: data });
        }
      })
      .catch((error) => {
        this.setState({ loading: false });
        this.notify('error', error.toString());
      });
  }

  handleSearch = () => {
    const { searchData } = this.state;
    if (!searchData.ModuleGroupId) {
      this.notify('error', 'Please select a Module Group');
      return;
    }
    const reqData = { ModuleId: 0, ModuleGroupId: searchData.ModuleGroupId };
    this.getModules(reqData);
  };

  columns = [
    { title: 'Module Name', key: 'ModuleName', dataIndex: 'ModuleName', sorter: (a, b) => a.ModuleName.localeCompare(b.ModuleName), ...new TableHelper().getColumnSearchProps('ModuleName') },
    { title: 'User Shown Name', key: 'UserShownName', dataIndex: 'UserShownName', sorter: (a, b) => a.UserShownName.localeCompare(b.UserShownName), ...new TableHelper().getColumnSearchProps('UserShownName') },
    { title: 'Module Group', key: 'ModuleGroupName', dataIndex: 'ModuleGroupName', sorter: (a, b) => a.ModuleGroupName.localeCompare(b.ModuleGroupName), ...new TableHelper().getColumnSearchProps('ModuleGroupName') },
    { title: 'Parent Module', key: 'ParentModuleName', dataIndex: 'ParentModuleName', sorter: (a, b) => a.ModuleName.localeCompare(b.ParentModuleName), ...new TableHelper().getColumnSearchProps('ParentModuleName') },
    { title: 'Order By', align: 'right', key: 'Level', dataIndex: 'Level', sorter: (a, b) => a.ModuleName.localeCompare(b.Level), ...new TableHelper().getColumnSearchProps('Level') },
    { title: 'Module Type', key: 'ModuleType', dataIndex: 'ModuleType', sorter: (a, b) => a.ModuleType.localeCompare(b.ModuleType), ...new TableHelper().getColumnSearchProps('ModuleType') },
    { title: 'Module Path', key: 'ModulePath', dataIndex: 'ModulePath', sorter: (a, b) => a.ModulePath.localeCompare(b.ModulePath), ...new TableHelper().getColumnSearchProps('ModulePath') },
    { title: 'Icon Type', key: 'IconType', dataIndex: 'IconType', sorter: (a, b) => a.IconType.localeCompare(b.IconType), ...new TableHelper().getColumnSearchProps('IconType') },
    { title: 'Icon Path', key: 'IconPath', dataIndex: 'IconPath', sorter: (a, b) => a.IconPath.localeCompare(b.IconPath), ...new TableHelper().getColumnSearchProps('IconPath') },
    { title: 'Remarks', key: 'Remarks', dataIndex: 'Remarks', sorter: (a, b) => a?.Remarks?.localeCompare(b?.Remarks), ...new TableHelper().getColumnSearchProps('Remarks') },
  ];

  gridColumns = [
    { field: 'ModuleName', headerName: 'Module Name', flex: 1, minWidth: 150 },
    { field: 'UserShownName', headerName: 'User Shown Name', flex: 1.2, minWidth: 160 },
    { field: 'ModuleGroupName', headerName: 'Module Group', flex: 1, minWidth: 150 },
    { field: 'ParentModuleName', headerName: 'Parent Module', flex: 1, minWidth: 150 },
    { field: 'Level', headerName: 'Order By', width: 100, type: 'number', align: 'right', headerAlign: 'right' },
    { field: 'ModuleType', headerName: 'Module Type', flex: 1, minWidth: 130 },
    { field: 'ModulePath', headerName: 'Module Path', flex: 1.2, minWidth: 160 },
    { field: 'IconType', headerName: 'Icon Type', flex: 1, minWidth: 120 },
    { field: 'IconPath', headerName: 'Icon Path', flex: 1, minWidth: 120 },
    { field: 'Remarks', headerName: 'Remarks', flex: 1.2, minWidth: 150 },
  ];

  render() {
    const { data, moduleGroupList, loading, searchData, snackbar } = this.state;
    const count = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;
    return (
      <PageContainer>
        <PageHeader title="Module" subtitle="View modules by group" />

        <DataCard
          title="Module Details"
          count={data.length ? count : null}
          countLabel="Records"
          toolbar={
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TextField
                select
                size="small"
                label="Module Group"
                value={searchData.ModuleGroupId || ''}
                onChange={(e) => {
                  const { searchData: sd } = this.state;
                  this.setState({ searchData: { ...sd, ModuleGroupId: e.target.value } });
                }}
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="">Select....</MenuItem>
                {moduleGroupList.map((mg) => (
                  <MenuItem key={mg.ModuleGroupId} value={mg.ModuleGroupId}>
                    {mg.ModuleGroupName}
                  </MenuItem>
                ))}
              </TextField>
              <Button variant="contained" size="small" startIcon={<SearchRoundedIcon />} onClick={this.handleSearch}>
                Search
              </Button>
            </Stack>
          }
        >
          <AppDataGrid
            rows={data}
            columns={this.gridColumns}
            loading={loading}
            getRowId={(row) => row.ModuleId}
            emptyTitle="No modules found"
            emptyDescription="Select a module group and click Search."
            height={650}
          />
        </DataCard>

        <ReportPdfFooter
          columnHeader={this.columns}
          tableData={data}
          orientation="landscape"
          tableHeader="Module Details"
          fileName="ModuleDetails"
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

export default ViewModule;
