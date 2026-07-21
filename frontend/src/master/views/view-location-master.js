import React, { Component } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import CommonUtilityController from "../controller/common-utility-controller";
import { TableHelper } from '../../helper/table-helper';
import { fillSelectList } from '../../helper/common-utility';
import ReportPdfFooter from '../../helper/report-pdf-footer';
import { PageContainer, PageHeader, DataCard, AppDataGrid } from '../../components/ui';

class ViewLocation extends Component {

  constructor(props) {
    super(props);
    this.formRef = React.createRef();
    this.state = {
      //Grid data
      data: [],
      //page fields data
      locationData: {
        LocationId: 0,
        LocationName: "",
        ParentLocationId: "",
        Level: "",
        Remarks: "",
        Status: 0,
      },
      loading: false,
      visible: false,
      filteredTotal: null,
      //dropdownlist
      locationParentList: [],
      snackbar: { open: false, severity: 'success', message: '' },
    };

  }
  //load initial data
  componentDidMount() {
    this.getLocations();
  }

  notify = (severity, message) => {
    this.setState({ snackbar: { open: true, severity, message } });
  };

  closeSnackbar = () => {
    this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));
  };

  //fetch Locations
  async getLocations() {
    this.setState({ loading: true, locationList: [] });
    await new CommonUtilityController().getLocations(0, 0)
      .then(data => {
        this.setState({ loading: false, });
        if (data != undefined) {
          let locationParentList = fillSelectList(data, "LocationName", 'LocationId');

          this.setState({ data: data, locationParentList: locationParentList });
        }
      })
      .catch(error => {
        this.setState({ loading: false, });
        this.notify('error', error.toString());
      });

  }

  columns = [

    { title: 'Location Name', key: 'LocationName', dataIndex: 'LocationName', sorter: (a, b) => a.LocationName.localeCompare(b.LocationName), ...new TableHelper().getColumnSearchProps('LocationName') },
    { title: 'Parent Location', key: 'ParentLocationName', dataIndex: 'ParentLocationName', sorter: (a, b) => a.ParentLocationName?.localeCompare(b?.ParentLocationName), ...new TableHelper().getColumnSearchProps('ParentLocationName') },
    { title: 'Order By', align: "right", key: 'Level', dataIndex: 'Level', sorter: (a, b) => a.LocationName.localeCompare(b.Level), ...new TableHelper().getColumnSearchProps('Level') },
    { title: 'Remarks', key: 'Remarks', dataIndex: 'Remarks', sorter: (a, b) => a?.Remarks?.localeCompare(b?.Remarks), ...new TableHelper().getColumnSearchProps('Remarks') },

  ];

  gridColumns = [
    { field: 'LocationName', headerName: 'Location Name', flex: 1.2, minWidth: 160 },
    { field: 'ParentLocationName', headerName: 'Parent Location', flex: 1.2, minWidth: 160 },
    { field: 'Level', headerName: 'Order By', width: 110, type: 'number', align: 'right', headerAlign: 'right' },
    { field: 'Remarks', headerName: 'Remarks', flex: 1.4, minWidth: 180 },
  ];

  render() {
    const { data, loading, snackbar } = this.state;
    const count = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;
    return (
      <PageContainer>
        <PageHeader title="Location" subtitle="View organizational locations and their hierarchy" />

        <DataCard title="Location Details" count={data.length ? count : null} countLabel="Records">
          <AppDataGrid
            rows={data}
            columns={this.gridColumns}
            loading={loading}
            getRowId={(row) => row.LocationId}
            emptyTitle="No locations found"
            emptyDescription="Try adjusting your search."
          />
        </DataCard>

        <ReportPdfFooter
          columnHeader={this.columns}
          tableData={data}
          orientation="portrait"
          tableHeader="Location Details"
          fileName="LocationDetails"
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
export default ViewLocation;
