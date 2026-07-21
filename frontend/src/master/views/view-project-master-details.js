import React, { Component } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import CommonUtilityController from '../controller/common-utility-controller';
import { TableHelper } from '../../helper/table-helper';
import ReportPdfFooter from '../../helper/report-pdf-footer';
import { PageContainer, PageHeader, DataCard, AppDataGrid } from '../../components/ui';

class ViewProjectDetails extends Component {
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
    this.getProjectDetails();
  }

  notify = (severity, message) => {
    this.setState({ snackbar: { open: true, severity, message } });
  };

  closeSnackbar = () => {
    this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));
  };

  async getProjectDetails() {
    const reqData = { projectId: 0, contractorId: 0 };
    this.setState({ loading: true });
    await new CommonUtilityController().getProjectDetails(reqData)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) this.setState({ data });
      })
      .catch((error) => {
        this.setState({ loading: false });
        this.notify('error', error.toString());
      });
  }

  valueWithComma(value) {
    return value?.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ',') || '';
  }

  valueWithPercentage(value) {
    return value + '%';
  }

  columns = [
    { title: 'Project No.', key: 'ProjectCode', dataIndex: 'ProjectCode', sorter: (a, b) => a.ProjectCode.localeCompare(b.ProjectCode), ...new TableHelper().getColumnSearchProps('ProjectCode') },
    { title: 'Contract Name', key: 'ContractName', dataIndex: 'ContractName', sorter: (a, b) => a.ContractName.localeCompare(b.ContractName), ...new TableHelper().getColumnSearchProps('ContractName') },
    { title: 'LOA Date', key: 'LOADate', dataIndex: 'LOADate', sorter: (a, b) => a.LOADate.localeCompare(b.LOADate), ...new TableHelper().getColumnSearchProps('LOADate') },
    { title: 'Currency', key: 'Currency', dataIndex: 'Currency', sorter: (a, b) => a.Currency.localeCompare(b.Currency), ...new TableHelper().getColumnSearchProps('Currency') },
    { title: 'Start Date', key: 'StartDate', dataIndex: 'StartDate', sorter: (a, b) => a.StartDate.localeCompare(b.StartDate), ...new TableHelper().getColumnSearchProps('StartDate') },
    { title: 'End Date', key: 'EndDate', dataIndex: 'EndDate', sorter: (a, b) => a.EndDate.localeCompare(b.EndDate), ...new TableHelper().getColumnSearchProps('EndDate') },
    { title: 'Original Contract Value', align: 'right', key: 'OriginalContractValue', dataIndex: 'OriginalContractValue', ...new TableHelper().getColumnSearchProps('OriginalContractValue') },
    { title: 'Margin (%age)', align: 'right', key: 'Margin', dataIndex: 'Margin', ...new TableHelper().getColumnSearchProps('Margin') },
    { title: 'Client Name', key: 'ClientName', dataIndex: 'ClientName', sorter: (a, b) => a.ClientName.localeCompare(b.ClientName), ...new TableHelper().getColumnSearchProps('ClientName') },
    { title: 'Contract Type', key: 'ContractType', dataIndex: 'ContractType', sorter: (a, b) => a.ContractType.localeCompare(b.ContractType), ...new TableHelper().getColumnSearchProps('ContractType') },
    { title: 'Description', key: 'ProjectDescription', dataIndex: 'ProjectDescription', sorter: (a, b) => a.ProjectDescription.localeCompare(b.ProjectDescription), ...new TableHelper().getColumnSearchProps('ProjectDescription') },
    { title: 'Remarks', key: 'Remarks', dataIndex: 'Remarks', sorter: (a, b) => a.Remarks.localeCompare(b.Remarks), ...new TableHelper().getColumnSearchProps('Remarks') },
  ];

  gridColumns = [
    { field: 'ProjectCode', headerName: 'Project No.', flex: 1, minWidth: 130 },
    { field: 'ContractName', headerName: 'Contract Name', flex: 1.6, minWidth: 200 },
    { field: 'LOADate', headerName: 'LOA Date', width: 120 },
    { field: 'Currency', headerName: 'Currency', width: 100 },
    { field: 'StartDate', headerName: 'Start Date', width: 120 },
    { field: 'EndDate', headerName: 'End Date', width: 120 },
    {
      field: 'OriginalContractValue', headerName: 'Original Contract Value',
      type: 'number', align: 'right', headerAlign: 'right', width: 180,
      renderCell: (params) => <span>{this.valueWithComma(params.row.OriginalContractValue)}</span>,
    },
    {
      field: 'Margin', headerName: 'Margin (%age)',
      type: 'number', align: 'right', headerAlign: 'right', width: 130,
      renderCell: (params) => <span>{this.valueWithPercentage(params.row.Margin)}</span>,
    },
    { field: 'ClientName', headerName: 'Client Name', flex: 1.2, minWidth: 160 },
    { field: 'ContractType', headerName: 'Contract Type', flex: 1, minWidth: 140 },
    { field: 'ProjectDescription', headerName: 'Description', flex: 1.4, minWidth: 180 },
    { field: 'Remarks', headerName: 'Remarks', flex: 1.2, minWidth: 150 },
  ];

  render() {
    const { data, loading, snackbar } = this.state;
    const count = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;
    return (
      <PageContainer>
        <PageHeader title="PMO Details" subtitle="View project master details" />
        <DataCard title="PMO Details" count={data.length ? count : null} countLabel="Records">
          <AppDataGrid rows={data} columns={this.gridColumns} loading={loading}
            getRowId={(row) => row.ProjectDetailId || row.ProjectCode}
            emptyTitle="No project details found" emptyDescription="Try adjusting your search." height={650} />
        </DataCard>
        <ReportPdfFooter columnHeader={this.columns} tableData={data}
          orientation="portrait" tableHeader="PMO Details" fileName="PMODetails" />
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

export default ViewProjectDetails;
