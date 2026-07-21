import React, { Component } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import CommonUtilityController from '../controller/common-utility-controller';
import { TableHelper } from '../../helper/table-helper';
import ReportPdfFooter from '../../helper/report-pdf-footer';
import { PageContainer, PageHeader, DataCard, AppDataGrid } from '../../components/ui';

class ViewVariationOrder extends Component {
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
    this.getVariationOrderDetails();
  }

  notify = (severity, message) => {
    this.setState({ snackbar: { open: true, severity, message } });
  };

  closeSnackbar = () => {
    this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));
  };

  async getVariationOrderDetails() {
    const reqData = { projectId: 0, contractorId: 0 };
    this.setState({ loading: true });
    await new CommonUtilityController().getVariationOrderDetails(reqData)
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

  columns = [
    { title: 'Project No.', key: 'ProjectCode', dataIndex: 'ProjectCode', sorter: (a, b) => a.ProjectCode.localeCompare(b.ProjectCode), ...new TableHelper().getColumnSearchProps('ProjectCode') },
    { title: 'Contract Name', key: 'ContractName', dataIndex: 'ContractName', sorter: (a, b) => a.ContractName.localeCompare(b.ContractName), ...new TableHelper().getColumnSearchProps('ContractName') },
    { title: 'Variation No.', key: 'VariationNo', dataIndex: 'VariationNo', sorter: (a, b) => a.VariationNo.localeCompare(b.VariationNo), ...new TableHelper().getColumnSearchProps('VariationNo') },
    { title: 'Variation Date', key: 'VariationDate', dataIndex: 'VariationDate', sorter: (a, b) => a.VariationDate.localeCompare(b.VariationDate), ...new TableHelper().getColumnSearchProps('VariationDate') },
    { title: 'Extension Date', key: 'ExtentionDate', dataIndex: 'ExtentionDate', sorter: (a, b) => a.ExtentionDate.localeCompare(b.ExtentionDate), ...new TableHelper().getColumnSearchProps('ExtentionDate') },
    { title: 'Order Value', align: 'right', key: 'OrderValue', dataIndex: 'OrderValue', sorter: (a, b) => a.OrderValue - b.OrderValue, ...new TableHelper().getColumnSearchProps('OrderValue') },
    { title: 'Description', key: 'VariationOrderDescription', dataIndex: 'VariationOrderDescription', sorter: (a, b) => a.VariationOrderDescription.localeCompare(b.VariationOrderDescription), ...new TableHelper().getColumnSearchProps('VariationOrderDescription') },
    { title: 'Remarks', key: 'Remarks', dataIndex: 'Remarks', sorter: (a, b) => a.Remarks.localeCompare(b.Remarks), ...new TableHelper().getColumnSearchProps('Remarks') },
  ];

  gridColumns = [
    { field: 'ProjectCode', headerName: 'Project No.', flex: 1, minWidth: 130 },
    { field: 'ContractName', headerName: 'Contract Name', flex: 1.6, minWidth: 200 },
    { field: 'VariationNo', headerName: 'Variation No.', flex: 1, minWidth: 130 },
    { field: 'VariationDate', headerName: 'Variation Date', width: 130 },
    { field: 'ExtentionDate', headerName: 'Extension Date', width: 130 },
    {
      field: 'OrderValue', headerName: 'Order Value', type: 'number', align: 'right', headerAlign: 'right', width: 140,
      renderCell: (params) => <span>{this.valueWithComma(params.row.OrderValue)}</span>,
    },
    { field: 'VariationOrderDescription', headerName: 'Description', flex: 1.4, minWidth: 180 },
    { field: 'Remarks', headerName: 'Remarks', flex: 1.2, minWidth: 150 },
  ];

  render() {
    const { data, loading, snackbar } = this.state;
    const count = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;
    return (
      <PageContainer>
        <PageHeader title="Variation Order" subtitle="View variation order details" />
        <DataCard title="Variation Order Details" count={data.length ? count : null} countLabel="Records">
          <AppDataGrid rows={data} columns={this.gridColumns} loading={loading}
            getRowId={(row) => row.VariationOrderId} emptyTitle="No variation orders found"
            emptyDescription="Try adjusting your search." height={650} />
        </DataCard>
        <ReportPdfFooter columnHeader={this.columns} tableData={data}
          orientation="portrait" tableHeader="Variation Order Details" fileName="VariationOrderDetails" />
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

export default ViewVariationOrder;
