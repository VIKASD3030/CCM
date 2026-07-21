import React from 'react';
import moment from 'moment';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import { contractLength } from '../../helper/form-helper';
import CommonUtilityController from '../controller/common-utility-controller';
import ViewMonthlyBreakUp from './view-monthly-breakup-master';
import MonthlyBreakUp from './monthly-breakup-master'
import LoginState from '../../authentication/loginState'
import ReportFooter from '../../helper/report-html-pdf-footer'
import ReportPdfFooter from '../../helper/report-pdf-footer'
import { PageContainer, PageHeader, DataCard, FormDialog, ConfirmDialog, AppDataGrid } from '../../components/ui';

class ManageMonthlyBreakupDetails extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      data: [],
      loading: false,
      editable: false,
      monthlyBreakUp: {},
      monthlyBreakUpDetails: [],
      filteredTotal: null,
      visible: false,
      confirmOpen: false,
      pendingDelete: null,
      snackbar: { open: false, severity: 'success', message: '' },
    };
  }
  componentDidMount() {
    this.getMonthlyBreakUpDetailsData();
  }

  notify = (severity, message) => {
    this.setState({ snackbar: { open: true, severity, message } });
  };

  closeSnackbar = () => {
    this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));
  };

  async getMonthlyBreakUpDetailsData() {
    let data = {
      ProjectId: 0,
      ContractId: 0
    }
    await new CommonUtilityController().getMonthlyBreakUpDetailsData(data)
      .then(result => {
        this.setState({ loading: false, visible: false });
        if (result != undefined) {
          let monthlyBreakUpData = this.monthlyBreakUpNestedData(result);
          this.setState({ data: monthlyBreakUpData });
        }
      })
      .catch(error => {
        this.setState({ loading: false, });
        this.notify('error', error.toString());
      });

  }

  monthlyBreakUpNestedData = (result) => {
    let breakUpData = result.parentData;
    let breakUpDataDetails = result.childData;
    breakUpData.forEach(obj => {
      obj.monthlyBreakUpDetails = breakUpDataDetails.filter(i => i.MonthlyBreakUpMasterId == obj.MonthlyBreakUpMasterId);
    });
    return breakUpData;
  }

  //view record
  viewRecord = (monthlyBreakUp) => {
    let monthlyBreakUpData = JSON.parse(JSON.stringify(monthlyBreakUp))
    monthlyBreakUpData.EntryDate = moment(monthlyBreakUpData.EntryDate, 'DD-MM-YYYY');
    monthlyBreakUpData.RevisionDate = moment(monthlyBreakUpData.RevisionDate, 'DD-MM-YYYY');
    // var k = 1;
    // monthlyBreakUp.monthlyBreakUpDetails.forEach(obj => {
    //   obj.key = k;
    //   k++;
    // });

    this.setState({ loading: false, editable: false, visible: true, monthlyBreakUp: monthlyBreakUpData, monthlyBreakUpDetails: monthlyBreakUpData.monthlyBreakUpDetails });
  }

  //edit record
  editRecord = (monthlyBreakUp) => {
    let monthlyBreakUpData = JSON.parse(JSON.stringify(monthlyBreakUp))
    monthlyBreakUpData.EntryDate = moment(monthlyBreakUpData.EntryDate, 'DD-MM-YYYY');
    monthlyBreakUpData.RevisionDate = moment(monthlyBreakUpData.RevisionDate, 'DD-MM-YYYY');
    var k = 1;
    monthlyBreakUpData.monthlyBreakUpDetails.forEach(obj => {
      obj.key = k;
      k++;
    });

    this.setState({ loading: false, editable: true, visible: true, monthlyBreakUp: monthlyBreakUpData, monthlyBreakUpDetails: monthlyBreakUpData.monthlyBreakUpDetails });
  }

  requestDelete = (monthlyBreakUp) => {
    this.setState({ confirmOpen: true, pendingDelete: monthlyBreakUp });
  };

  cancelDelete = () => {
    this.setState({ confirmOpen: false, pendingDelete: null });
  };

  confirmDelete = () => {
    const record = this.state.pendingDelete;
    this.setState({ confirmOpen: false, pendingDelete: null });
    if (record) this.deleteRecord(record);
  };

  //delete record
  deleteRecord = async (monthlyBreakUp) => {
    delete monthlyBreakUp["monthlyBreakUpDetails"];
    monthlyBreakUp.CreatedBy = LoginState.UserId;
    monthlyBreakUp.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');

    await new CommonUtilityController().deleteMontlyBreakUpDetailsData(monthlyBreakUp)
      .then(result => {
        this.setState({ loading: false, });

        if (result != undefined) {
          let monthlyBreakUpData = this.monthlyBreakUpNestedData(result);
          this.setState({ data: monthlyBreakUpData });
        }
        this.notify('success', 'Data successfully deleted.');
      })
      .catch(() => {
        this.setState({ loading: false, });
        this.notify('error', 'Data deletion issue!');
      });

  }

  toggleModal = () => {
    let { data } = this.state;
    this.setState({
      visible: !this.state.visible,
      data: data
    });
  }

  closemonthlyBreakUpModal = () => {
    this.getMonthlyBreakUpDetailsData();
    this.setState({
      visible: !this.state.visible
    });
  }

  // antd-shaped columns retained for ReportPdfFooter (Excel/PDF export)
  get columns() {
    return [
      { title: 'Project Code', key: 'ProjectCode', dataIndex: 'ProjectCode' },
      { title: 'Contract', key: 'ContractName', dataIndex: 'ContractName' },
      { title: 'Revision No.', key: 'RevisionNo', dataIndex: 'RevisionNo' },
      { title: 'Entry Date', key: 'EntryDate', dataIndex: 'EntryDate' },
      { title: 'Revision Date', key: 'RevisionDate', dataIndex: 'RevisionDate' },
      { title: 'Remarks', key: 'Remarks', dataIndex: 'Remarks' },
    ];
  }

  get gridColumns() {
    return [
      {
        field: 'action',
        headerName: 'Action',
        width: 140,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) => {
          const record = params.row;
          return (
            <Stack direction="row" spacing={0.5}>
              <Tooltip title="Edit record">
                <span>
                  <IconButton size="small" color="primary" onClick={() => this.editRecord(record)}>
                    <EditRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Delete record">
                <span>
                  <IconButton size="small" color="error" disabled={record.Status != "0"} onClick={() => this.requestDelete(record)}>
                    <DeleteRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="View record">
                <span>
                  <IconButton size="small" color="primary" onClick={() => this.viewRecord(record)}>
                    <VisibilityRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          );
        },
      },
      { field: 'ProjectCode', headerName: 'Project Code', flex: 1, minWidth: 130 },
      {
        field: 'ContractName',
        headerName: 'Contract',
        flex: 1.4,
        minWidth: 180,
        renderCell: (params) => (
          <Tooltip title={params.row?.ContractName || ''}>
            <span>{params.row?.ContractName?.slice(0, contractLength)}......</span>
          </Tooltip>
        ),
      },
      { field: 'RevisionNo', headerName: 'Revision No.', flex: 0.8, minWidth: 120 },
      { field: 'EntryDate', headerName: 'Entry Date', flex: 1, minWidth: 130 },
      { field: 'RevisionDate', headerName: 'Revision Date', flex: 1, minWidth: 130 },
      { field: 'Remarks', headerName: 'Remarks', flex: 1.4, minWidth: 160 },
    ];
  }

  render() {
    const { data, editable, loading, visible, monthlyBreakUp, monthlyBreakUpDetails, confirmOpen, snackbar } = this.state;
    const count = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;

    return (
      <PageContainer>
        <PageHeader title="Monthly Break up" subtitle="Manage monthly break-up entries and revisions" />

        <DataCard title="Monthly BreakUp" count={data.length ? count : null} countLabel="Records">
          <AppDataGrid
            rows={data}
            columns={this.gridColumns}
            loading={loading}
            getRowId={(row) => row.MonthlyBreakUpMasterId}
            emptyTitle="No monthly break-up records"
            emptyDescription="Records will appear here once created."
          />
          <ReportPdfFooter
            columnHeader={this.columns}
            tableData={data}
            orientation="portrait"
            tableHeader="Monthly BreakUp"
            fileName="MonthlyBreakup"
            excludedColumns={['action']}
          />
        </DataCard>

        <FormDialog
          open={visible}
          onClose={this.toggleModal}
          title="Monthly BreakUp Details"
          maxWidth="lg"
          actions={null}
        >
          <div hidden={!editable}>
            <MonthlyBreakUp monthlyBreakUp={monthlyBreakUp} monthlyBreakUpDetails={monthlyBreakUpDetails} closemonthlyBreakUpModal={this.closemonthlyBreakUpModal} />
          </div>
          <Box id='jspdf' hidden={editable}>
              <ViewMonthlyBreakUp monthlyBreakUp={monthlyBreakUp} monthlyBreakUpDetails={monthlyBreakUpDetails} />
          </Box>
          <div hidden={editable}>
            <ReportFooter reportHeader="Monthly BreakUp Details" fileName="MonthlyBreakupAmount" />
          </div>
        </FormDialog>

        <ConfirmDialog
          open={confirmOpen}
          title="Delete record?"
          message="Are you sure you want to delete this record? This action cannot be undone."
          confirmText="Delete"
          onConfirm={this.confirmDelete}
          onCancel={this.cancelDelete}
        />

        <Backdrop open={loading && visible} sx={{ position: 'absolute', zIndex: (t) => t.zIndex.modal + 1 }}>
          <CircularProgress color="inherit" />
        </Backdrop>

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
export default ManageMonthlyBreakupDetails;
