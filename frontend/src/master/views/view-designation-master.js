import React, { Component } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import CommonUtilityController from '../controller/common-utility-controller';
import { TableHelper } from '../../helper/table-helper';
import { fillSelectList } from '../../helper/common-utility';
import ReportPdfFooter from '../../helper/report-pdf-footer';
import { PageContainer, PageHeader, DataCard, AppDataGrid } from '../../components/ui';

class ViewDesignation extends Component {
  constructor(props) {
    super(props);
    this.formRef = React.createRef();
    this.state = {
      data: [],
      designationData: {
        DesignationId: 0,
        DesignationCode: '',
        DesignationName: '',
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
    this.getDesignations();
  }

  notify = (severity, message) => {
    this.setState({ snackbar: { open: true, severity, message } });
  };

  closeSnackbar = () => {
    this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));
  };

  async getDesignations() {
    this.setState({ loading: true });
    await new CommonUtilityController()
      .getDesignations()
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) {
          let designationList = fillSelectList(data, 'DesignationName', 'DesignationId');
          this.setState({ data: data, designationList: designationList });
        }
      })
      .catch((error) => {
        this.setState({ loading: false });
        this.notify('error', error.toString());
      });
  }

  columns = [
    { title: 'Designation Code', key: 'DesignationCode', dataIndex: 'DesignationCode', sorter: (a, b) => a.DesignationCode.localeCompare(b.DesignationCode), ...new TableHelper().getColumnSearchProps('DesignationCode') },
    { title: 'Designation Name', key: 'DesignationName', dataIndex: 'DesignationName', sorter: (a, b) => a.DesignationName.localeCompare(b.DesignationName), ...new TableHelper().getColumnSearchProps('DesignationName') },
    { title: 'Parent Designation Name', key: 'ParentDesignationName', dataIndex: 'ParentDesignationName', sorter: (a, b) => a.DesignationName.localeCompare(b.ParentDesignationName), ...new TableHelper().getColumnSearchProps('ParentDesignationName') },
    { title: 'Remarks', key: 'Remarks', dataIndex: 'Remarks', sorter: (a, b) => a?.Remarks?.localeCompare(b?.Remarks), ...new TableHelper().getColumnSearchProps('Remarks') },
  ];

  gridColumns = [
    { field: 'DesignationCode', headerName: 'Designation Code', flex: 1, minWidth: 150 },
    { field: 'DesignationName', headerName: 'Designation Name', flex: 1.4, minWidth: 180 },
    { field: 'ParentDesignationName', headerName: 'Parent Designation', flex: 1.2, minWidth: 160 },
    { field: 'Remarks', headerName: 'Remarks', flex: 1.4, minWidth: 180 },
  ];

  render() {
    const { data, loading, snackbar } = this.state;
    const count = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;
    return (
      <PageContainer>
        <PageHeader title="Designation" subtitle="View organizational designations" />

        <DataCard title="Designation Details" count={data.length ? count : null} countLabel="Records">
          <AppDataGrid
            rows={data}
            columns={this.gridColumns}
            loading={loading}
            getRowId={(row) => row.DesignationId}
            emptyTitle="No designations found"
            emptyDescription="Try adjusting your search."
          />
        </DataCard>

        <ReportPdfFooter
          columnHeader={this.columns}
          tableData={data}
          orientation="portrait"
          tableHeader="Designation Details"
          fileName="DesignationDetails"
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

export default ViewDesignation;
