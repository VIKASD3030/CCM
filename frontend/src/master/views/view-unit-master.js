import React, { Component } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import CommonUtilityController from '../controller/common-utility-controller';
import { TableHelper } from '../../helper/table-helper';
import { fillSelectList } from '../../helper/common-utility';
import ReportPdfFooter from '../../helper/report-pdf-footer';
import { PageContainer, PageHeader, DataCard, AppDataGrid } from '../../components/ui';

class ViewUnit extends Component {
  constructor(props) {
    super(props);
    this.formRef = React.createRef();
    this.state = {
      data: [],
      unitData: {
        UnitId: 0,
        UnitCode: '',
        UnitName: '',
        ParentUnitId: '',
        Remarks: '',
      },
      loading: false,
      visible: false,
      filteredTotal: null,
      snackbar: { open: false, severity: 'success', message: '' },
    };
  }

  componentDidMount() {
    this.getUnits();
  }

  notify = (severity, message) => {
    this.setState({ snackbar: { open: true, severity, message } });
  };

  closeSnackbar = () => {
    this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));
  };

  async getUnits() {
    this.setState({ loading: true });
    await new CommonUtilityController()
      .getUnits()
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) {
          let unitList = fillSelectList(data, 'UnitName', 'UnitId');
          this.setState({ data: data, unitList: unitList });
        }
      })
      .catch((error) => {
        this.setState({ loading: false });
        this.notify('error', error.toString());
      });
  }

  columns = [
    { title: 'Unit Code', key: 'UnitCode', dataIndex: 'UnitCode', sorter: (a, b) => a.UnitCode.localeCompare(b.UnitCode), ...new TableHelper().getColumnSearchProps('UnitCode') },
    { title: 'Unit Name', key: 'UnitName', dataIndex: 'UnitName', sorter: (a, b) => a.UnitName.localeCompare(b.UnitName), ...new TableHelper().getColumnSearchProps('UnitName') },
    { title: 'Parent Unit', key: 'ParentUnitName', dataIndex: 'ParentUnitName', sorter: (a, b) => a.UnitName.localeCompare(b.ParentUnitName), ...new TableHelper().getColumnSearchProps('ParentUnitName') },
    { title: 'Remarks', key: 'Remarks', dataIndex: 'Remarks', sorter: (a, b) => a?.Remarks?.localeCompare(b?.Remarks), ...new TableHelper().getColumnSearchProps('Remarks') },
  ];

  gridColumns = [
    { field: 'UnitCode', headerName: 'Unit Code', flex: 1, minWidth: 120 },
    { field: 'UnitName', headerName: 'Unit Name', flex: 1.4, minWidth: 160 },
    { field: 'ParentUnitName', headerName: 'Parent Unit', flex: 1.2, minWidth: 150 },
    { field: 'Remarks', headerName: 'Remarks', flex: 1.4, minWidth: 180 },
  ];

  render() {
    const { data, loading, snackbar } = this.state;
    const count = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;
    return (
      <PageContainer>
        <PageHeader title="Unit" subtitle="View measurement units" />

        <DataCard title="Unit Details" count={data.length ? count : null} countLabel="Records">
          <AppDataGrid
            rows={data}
            columns={this.gridColumns}
            loading={loading}
            getRowId={(row) => row.UnitId}
            emptyTitle="No units found"
            emptyDescription="Try adjusting your search."
          />
        </DataCard>

        <ReportPdfFooter
          columnHeader={this.columns}
          tableData={data}
          orientation="portrait"
          tableHeader="Unit Details"
          fileName="UnitDetails"
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

export default ViewUnit;
