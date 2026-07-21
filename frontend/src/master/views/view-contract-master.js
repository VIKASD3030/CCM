import React, { Component } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import CommonUtilityController from '../controller/common-utility-controller';
import { TableHelper } from '../../helper/table-helper';
import { fillSelectList } from '../../helper/common-utility';
import ReportPdfFooter from '../../helper/report-pdf-footer';
import { PageContainer, PageHeader, DataCard, AppDataGrid } from '../../components/ui';

class ViewContract extends Component {
  constructor(props) {
    super(props);
    this.formRef = React.createRef();
    this.state = {
      data: [],
      contractData: {
        ContractId: 0,
        ContractNo: '',
        ContractName: '',
        ProjectId: '',
        ContractorId: '',
        ContractType: '',
        ContractStartDate: '',
        ContractEndDate: '',
        ContractValue: '',
        SectionValue: '',
        Remarks: '',
        Status: 0,
      },
      loading: false,
      visible: false,
      filteredTotal: null,
      projectList: [],
      contractorList: [],
      snackbar: { open: false, severity: 'success', message: '' },
    };
  }

  componentDidMount() {
    this.getContracts();
    this.getProjects();
    this.getContractors();
  }

  notify = (severity, message) => {
    this.setState({ snackbar: { open: true, severity, message } });
  };

  closeSnackbar = () => {
    this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));
  };

  async getContracts() {
    const reqData = { projectId: 0, workPackageId: 0, contractorId: 0 };
    this.setState({ loading: true });
    await new CommonUtilityController()
      .getContracts(reqData)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) this.setState({ data: data });
      })
      .catch((error) => {
        this.setState({ loading: false });
        this.notify('error', error.toString());
      });
  }

  async getContractors() {
    this.setState({ loading: true });
    await new CommonUtilityController()
      .getContractors()
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) {
          let contractorList = fillSelectList(data, 'ContractorName', 'ContractorId');
          this.setState({ contractorList: contractorList });
        }
      })
      .catch((error) => {
        this.setState({ loading: false });
        this.notify('error', error.toString());
      });
  }

  async getProjects() {
    this.setState({ loading: true, contractList: [] });
    await new CommonUtilityController()
      .getProjects()
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) {
          let projectList = fillSelectList(data, 'ProjectName', 'ProjectMasterId');
          this.setState({ projectList: projectList });
        }
      })
      .catch((error) => {
        this.setState({ loading: false });
        this.notify('error', error.toString());
      });
  }

  columns = [
    { title: 'Contract No.', key: 'ContractNo', dataIndex: 'ContractNo', sorter: (a, b) => a.ContractNo.localeCompare(b.ContractNo), ...new TableHelper().getColumnSearchProps('ContractNo') },
    { title: 'Contract', key: 'ContractName', dataIndex: 'ContractName', sorter: (a, b) => a.ContractName.localeCompare(b.ContractName), ...new TableHelper().getColumnSearchProps('ContractName') },
    { title: 'Project', key: 'ProjectName', dataIndex: 'ProjectName', sorter: (a, b) => a.ProjectName.localeCompare(b.ProjectName), ...new TableHelper().getColumnSearchProps('ProjectName') },
    { title: 'Contractor', key: 'ContractorName', dataIndex: 'ContractorName', sorter: (a, b) => a.ContractName.localeCompare(b.ContractorName), ...new TableHelper().getColumnSearchProps('ContractorName') },
    { title: 'Contract Type', key: 'ContractType', dataIndex: 'ContractType', sorter: (a, b) => a.ContractType.localeCompare(b.ContractType), ...new TableHelper().getColumnSearchProps('ContractType') },
    { title: 'Start Date', key: 'ContractStartDate', dataIndex: 'ContractStartDate', sorter: (a, b) => a.ContractStartDate.localeCompare(b.ContractStartDate), ...new TableHelper().getColumnSearchProps('ContractStartDate') },
    { title: 'End Date', key: 'ContractEndDate', dataIndex: 'ContractEndDate', sorter: (a, b) => a.ContractName.localeCompare(b.ContractEndDate), ...new TableHelper().getColumnSearchProps('ContractEndDate') },
    { title: 'Contract Value', align: 'right', key: 'ContractValue', dataIndex: 'ContractValue', sorter: (a, b) => a.ContractValue - b.ContractValue, ...new TableHelper().getColumnSearchProps('ContractValue') },
    { title: 'Section Value', align: 'right', key: 'SectionValue', dataIndex: 'SectionValue', sorter: (a, b) => a.SectionValue - b.SectionValue, ...new TableHelper().getColumnSearchProps('SectionValue') },
    { title: 'Remarks', key: 'Remarks', dataIndex: 'Remarks', sorter: (a, b) => a.Remarks.localeCompare(b.Remarks), ...new TableHelper().getColumnSearchProps('Remarks') },
  ];

  gridColumns = [
    { field: 'ContractNo', headerName: 'Contract No.', flex: 1, minWidth: 130 },
    { field: 'ContractName', headerName: 'Contract', flex: 1.6, minWidth: 200 },
    { field: 'ProjectName', headerName: 'Project', flex: 1.2, minWidth: 150 },
    { field: 'ContractorName', headerName: 'Contractor', flex: 1.2, minWidth: 150 },
    { field: 'ContractType', headerName: 'Contract Type', flex: 1, minWidth: 130 },
    { field: 'ContractStartDate', headerName: 'Start Date', width: 120 },
    { field: 'ContractEndDate', headerName: 'End Date', width: 120 },
    { field: 'ContractValue', headerName: 'Contract Value', type: 'number', align: 'right', headerAlign: 'right', width: 140 },
    { field: 'SectionValue', headerName: 'Section Value', type: 'number', align: 'right', headerAlign: 'right', width: 130 },
    { field: 'Remarks', headerName: 'Remarks', flex: 1.2, minWidth: 150 },
  ];

  render() {
    const { data, loading, snackbar } = this.state;
    const count = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;
    return (
      <PageContainer>
        <PageHeader title="Contract" subtitle="View contract details" />

        <DataCard title="Contract Details" count={data.length ? count : null} countLabel="Records">
          <AppDataGrid
            rows={data}
            columns={this.gridColumns}
            loading={loading}
            getRowId={(row) => row.ContractId}
            emptyTitle="No contracts found"
            emptyDescription="Try adjusting your search."
            height={650}
          />
        </DataCard>

        <ReportPdfFooter
          columnHeader={this.columns}
          tableData={data}
          orientation="portrait"
          tableHeader="Contract Details"
          fileName="ContractDetails"
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

export default ViewContract;
