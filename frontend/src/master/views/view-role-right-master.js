import React, { Component } from 'react';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Box from '@mui/material/Box';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { fillSelectList } from '../../helper/common-utility';
import CommonUtilityController from '../controller/common-utility-controller';
import { TableHelper } from '../../helper/table-helper';
import ReportPdfFooter from '../../helper/report-pdf-footer';
import { PageContainer, PageHeader, DataCard, AppDataGrid } from '../../components/ui';

class RoleRight extends Component {
  constructor(props) {
    super(props);
    this.formRef = React.createRef();
    this.childFormRef = React.createRef();
    this.state = {
      roleRightExistData: [],
      role: {
        RoleId: '',
        Status: 0,
      },
      roleRightDetails: [],
      roleList: [],
      loading: false,
      childData: [],
      editingKey: '',
      buttonVisible: false,
      snackbar: { open: false, severity: 'success', message: '' },
    };
  }

  componentDidMount() {
    this.getRoles(0);
  }

  notify = (severity, message) => {
    this.setState({ snackbar: { open: true, severity, message } });
  };

  closeSnackbar = () => {
    this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));
  };

  async getRoleRightDetails(reqData) {
    await new CommonUtilityController()
      .getRoleRightDetails(reqData)
      .then((result) => {
        this.setState({ loading: false });
        if (result != undefined) {
          this.setState({ roleRightExistData: result, childData: result });
        }
      })
      .catch(() => {
        this.setState({ loading: false });
        this.notify('error', 'Data fetching issue!');
      });
  }

  async getRoles(reqData) {
    this.setState({ loading: true });
    await new CommonUtilityController()
      .getRoles(reqData)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) {
          let roleList = fillSelectList(data, 'RoleName', 'RoleId');
          this.setState({ roleList: data });
          let { role } = this.props;
          if (role != undefined) {
            this.setState({ role: role, childData: role.roleRightDetails });
          }
        }
      })
      .catch(() => {
        this.setState({ loading: false });
      });
  }

  roleChange = (value) => {
    if (value !== '') {
      this.getRoleRightDetails(value);
    }
    const { role } = this.state;
    this.setState({ role: { ...role, RoleId: value } });
  };

  childColumns = [
    { field: 'UserShownName', headerName: 'Module', flex: 1, minWidth: 160 },
    { field: 'ModuleGroupName', headerName: 'Module Group', flex: 1.2, minWidth: 160 },
    { field: 'ParentModuleGroupName', headerName: 'Main Module Group', flex: 1.2, minWidth: 180 },
  ];

  // kept for ReportPdfFooter
  childColumnsForPdf = [
    { title: 'Module', key: 'UserShownName', dataIndex: 'UserShownName', ...new TableHelper().getColumnSearchProps('UserShownName') },
    { title: 'Module Group', key: 'ModuleGroupName', dataIndex: 'ModuleGroupName', ...new TableHelper().getColumnSearchProps('ModuleGroupName') },
    { title: 'Main Module Group', key: 'ParentModuleGroupName', dataIndex: 'ParentModuleGroupName', ...new TableHelper().getColumnSearchProps('ParentModuleGroupName') },
  ];

  render() {
    const { role, roleList, loading, childData, snackbar } = this.state;

    return (
      <PageContainer>
        <PageHeader title="Role Right" subtitle="View modules assigned to each role" />

        <DataCard
          title="Role Right Details"
          count={childData.length ? childData.length : null}
          countLabel="Records"
          toolbar={
            <Box sx={{ minWidth: 260 }}>
              <TextField
                select
                size="small"
                label="Role Name"
                value={role.RoleId || ''}
                onChange={(e) => this.roleChange(e.target.value)}
                fullWidth
              >
                <MenuItem value="">Select....</MenuItem>
                {roleList.map((r) => (
                  <MenuItem key={r.RoleId} value={r.RoleId}>
                    {r.RoleName}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          }
        >
          <AppDataGrid
            rows={childData}
            columns={this.childColumns}
            loading={loading}
            getRowId={(row) => row.ModuleId || row.UserShownName}
            emptyTitle="No role rights found"
            emptyDescription="Select a role to view its module rights."
          />
        </DataCard>

        <ReportPdfFooter
          columnHeader={this.childColumnsForPdf}
          tableData={childData}
          orientation="portrait"
          tableHeader="Role Right Details"
          fileName="RoleRightDetails"
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

export default RoleRight;
