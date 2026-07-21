import React, { Component } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import CommonUtilityController from '../controller/common-utility-controller';
import { TableHelper } from '../../helper/table-helper';
import ReportPdfFooter from '../../helper/report-pdf-footer';
import { PageContainer, PageHeader, DataCard, AppDataGrid } from '../../components/ui';

class ViewContractor extends Component {
  constructor(props) {
    super(props);
    this.formRef = React.createRef();
    this.state = {
      data: [],
      contractorData: {
        ContractorId: 0,
        ContractorCode: '',
        ContractorName: '',
        Remarks: '',
        Status: 0,
      },
      loading: false,
      visible: false,
      filteredTotal: null,
      snackbar: { open: false, severity: 'success', message: '' },
    };
  }

  componentDidMount() {
    this.getContractors();
  }

  notify = (severity, message) => {
    this.setState({ snackbar: { open: true, severity, message } });
  };

  closeSnackbar = () => {
    this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));
  };

  async getContractors() {
    this.setState({ loading: true, contractorList: [] });
    await new CommonUtilityController()
      .getContractors()
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

  columns = [
    { title: 'Contractor Code', key: 'ContractorCode', dataIndex: 'ContractorCode', sorter: (a, b) => a.ContractorCode.localeCompare(b.ContractorCode), ...new TableHelper().getColumnSearchProps('ContractorCode') },
    { title: 'Contractor Name', key: 'ContractorName', dataIndex: 'ContractorName', sorter: (a, b) => a.ContractorName.localeCompare(b.ContractorName), ...new TableHelper().getColumnSearchProps('ContractorName') },
    { title: 'Remarks', key: 'Remarks', dataIndex: 'Remarks', sorter: (a, b) => a.Remarks.localeCompare(b.Remarks), ...new TableHelper().getColumnSearchProps('Remarks') },
  ];

  gridColumns = [
    { field: 'ContractorCode', headerName: 'Contractor Code', flex: 1, minWidth: 150 },
    { field: 'ContractorName', headerName: 'Contractor Name', flex: 1.6, minWidth: 200 },
    { field: 'Remarks', headerName: 'Remarks', flex: 1.4, minWidth: 180 },
  ];

  render() {
    const { data, loading, snackbar } = this.state;
    const count = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;
    return (
      <PageContainer>
        <PageHeader title="Contractor" subtitle="View contractor details" />

        <DataCard title="Contractor Details" count={data.length ? count : null} countLabel="Records">
          <AppDataGrid
            rows={data}
            columns={this.gridColumns}
            loading={loading}
            getRowId={(row) => row.ContractorId}
            emptyTitle="No contractors found"
            emptyDescription="Try adjusting your search."
          />
        </DataCard>

        <ReportPdfFooter
          columnHeader={this.columns}
          tableData={data}
          orientation="portrait"
          tableHeader="Contractor Details"
          fileName="ContractorDetails"
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

export default ViewContractor;
