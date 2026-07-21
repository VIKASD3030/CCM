import React, { Component } from 'react';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CommonUtilityController from '../controller/common-utility-controller';
import { TableHelper } from '../../helper/table-helper';
import ReportPdfFooter from '../../helper/report-pdf-footer';
import { compareDate } from '../../helper/common-utility';
import { PageContainer, PageHeader, DataCard, AppDataGrid } from '../../components/ui';

class ViewUserLogs extends Component {
  constructor(props) {
    super(props);
    this.state = {
      data: [],
      loading: false,
      searchData: { UserId: 0, FromDate: '', ToDate: '' },
      snackbar: { open: false, severity: 'success', message: '' },
    };
  }

  componentDidMount() {}

  notify = (severity, message) => {
    this.setState({ snackbar: { open: true, severity, message } });
  };

  closeSnackbar = () => {
    this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));
  };

  async getUserLogs(reqData) {
    this.setState({ loading: true });
    await new CommonUtilityController().getUserLogs(reqData)
      .then((data) => {
        this.setState({ loading: false });
        if (data !== undefined) this.setState({ data });
      })
      .catch((error) => {
        this.setState({ loading: false });
        this.notify('error', error.toString());
      });
  }

  handleSearch = () => {
    const { searchData } = this.state;
    if (!searchData.FromDate || !searchData.ToDate) {
      this.notify('error', 'Please select both From Date and To Date.');
      return;
    }
    if (compareDate(searchData.FromDate, searchData.ToDate)) {
      this.notify('error', 'From Date should be less than or equal to To Date.');
      return;
    }
    this.getUserLogs(searchData);
  };

  columns = [
    { title: 'User Name', key: 'UserName', dataIndex: 'UserName', sorter: (a, b) => a.UserName.localeCompare(b.UserName), ...new TableHelper().getColumnSearchProps('UserName') },
    { title: 'Log In Status', key: 'LogInStatus', dataIndex: 'LogInStatus', ...new TableHelper().getColumnSearchProps('LogInStatus') },
    { title: 'Login Date', key: 'LoginDate', dataIndex: 'LoginDate', ...new TableHelper().getColumnSearchProps('LoginDate') },
    { title: 'LogOut Date', key: 'LogOutDate', dataIndex: 'LogOutDate', ...new TableHelper().getColumnSearchProps('LogOutDate') },
  ];

  gridColumns = [
    { field: 'UserName', headerName: 'User Name', flex: 1.2, minWidth: 160 },
    {
      field: 'LogInStatus', headerName: 'Log In Status', width: 130,
      renderCell: (params) => <span>{params.row.LogInStatus === 1 ? 'LoggedIn' : 'Logout'}</span>,
    },
    { field: 'LoginDate', headerName: 'Login Date', flex: 1, minWidth: 160 },
    { field: 'LogOutDate', headerName: 'LogOut Date', flex: 1, minWidth: 160 },
  ];

  render() {
    const { data, loading, searchData, snackbar } = this.state;
    return (
      <PageContainer>
        <PageHeader title="User Log" subtitle="View user login and logout activity" />
        <DataCard
          title="User Log Details"
          count={data.length ? data.length : null}
          countLabel="Records"
          toolbar={
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TextField
                type="date"
                size="small"
                label="From Date"
                InputLabelProps={{ shrink: true }}
                value={searchData.FromDate}
                onChange={(e) => this.setState((s) => ({ searchData: { ...s.searchData, FromDate: e.target.value } }))}
              />
              <TextField
                type="date"
                size="small"
                label="To Date"
                InputLabelProps={{ shrink: true }}
                value={searchData.ToDate}
                onChange={(e) => this.setState((s) => ({ searchData: { ...s.searchData, ToDate: e.target.value } }))}
              />
              <Button variant="contained" size="small" startIcon={<SearchRoundedIcon />} onClick={this.handleSearch}>
                Search
              </Button>
            </Stack>
          }
        >
          <AppDataGrid rows={data} columns={this.gridColumns} loading={loading}
            getRowId={(row) => row.LogId || (row.UserName + row.LoginDate)}
            emptyTitle="No log records found"
            emptyDescription="Select a date range and click Search." />
        </DataCard>
        <ReportPdfFooter columnHeader={this.columns} tableData={data}
          orientation="portrait" tableHeader="User Log Details" fileName="UserLogDetails" />
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

export default ViewUserLogs;
