import React, { Component } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import CommonUtilityController from '../controller/common-utility-controller';
import { TableHelper } from '../../helper/table-helper';
import ReportPdfFooter from '../../helper/report-pdf-footer';
import { PageContainer, PageHeader, DataCard, AppDataGrid } from '../../components/ui';

class ViewAutoNotification extends Component {
  constructor(props) {
    super(props);
    this.formRef = React.createRef();
    this.state = {
      data: [],
      loading: false,
      filteredTotal: null,
      snackbar: { open: false, severity: 'success', message: '' },
    };
  }

  componentDidMount() {
    this.getAutoNotification();
  }

  notify = (severity, message) => {
    this.setState({ snackbar: { open: true, severity, message } });
  };

  closeSnackbar = () => {
    this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));
  };

  async getAutoNotification() {
    this.setState({ loading: true });
    await new CommonUtilityController().getAutoNotification()
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
    { title: 'Notification Name', key: 'NotificationName', dataIndex: 'NotificationName', sorter: (a, b) => a.NotificationName.localeCompare(b.NotificationName), ...new TableHelper().getColumnSearchProps('NotificationName') },
    { title: 'Notification Type', key: 'NotificationType', dataIndex: 'NotificationType', sorter: (a, b) => a.NotificationType.localeCompare(b.NotificationType), ...new TableHelper().getColumnSearchProps('NotificationType') },
    { title: 'Activity Type', key: 'ActivityType', dataIndex: 'ActivityType', sorter: (a, b) => a.ActivityType.localeCompare(b.ActivityType), ...new TableHelper().getColumnSearchProps('ActivityType') },
    { title: 'Days', key: 'Days', dataIndex: 'Days', sorter: (a, b) => a.Days - b.Days, ...new TableHelper().getColumnSearchProps('Days') },
    { title: 'Remarks', key: 'Remarks', dataIndex: 'Remarks', sorter: (a, b) => a.Remarks.localeCompare(b.Remarks), ...new TableHelper().getColumnSearchProps('Remarks') },
  ];

  gridColumns = [
    { field: 'NotificationName', headerName: 'Notification Name', flex: 1.4, minWidth: 180 },
    { field: 'NotificationType', headerName: 'Notification Type', flex: 1.2, minWidth: 160 },
    { field: 'ActivityType', headerName: 'Activity Type', flex: 1.2, minWidth: 150 },
    { field: 'Days', headerName: 'Days', type: 'number', align: 'right', headerAlign: 'right', width: 90 },
    { field: 'Remarks', headerName: 'Remarks', flex: 1.4, minWidth: 180 },
  ];

  render() {
    const { data, loading, snackbar } = this.state;
    const count = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;
    return (
      <PageContainer>
        <PageHeader title="Auto Notification" subtitle="View auto notification settings" />
        <DataCard title="Notification Details" count={data.length ? count : null} countLabel="Records">
          <AppDataGrid rows={data} columns={this.gridColumns} loading={loading}
            getRowId={(row) => row.AutoNotificationId} emptyTitle="No notifications found"
            emptyDescription="Try adjusting your search." />
        </DataCard>
        <ReportPdfFooter columnHeader={this.columns} tableData={data}
          orientation="portrait" tableHeader="Notification Details" fileName="NotificationDetails" />
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

export default ViewAutoNotification;
