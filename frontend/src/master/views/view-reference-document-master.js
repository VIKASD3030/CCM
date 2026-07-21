import React, { Component } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import CommonUtilityController from '../controller/common-utility-controller';
import { TableHelper } from '../../helper/table-helper';
import { fillSelectList } from '../../helper/common-utility';
import ReportPdfFooter from '../../helper/report-pdf-footer';
import { PageContainer, PageHeader, DataCard, AppDataGrid } from '../../components/ui';

class ViewReferenceDocument extends Component {
  constructor(props) {
    super(props);
    this.formRef = React.createRef();
    this.state = {
      data: [],
      referenceDocumentData: {
        DocumentId: 0, DocumentCode: '', DocumentName: '',
        ParentDocumentId: '0', Level: '', Remarks: '', Status: 0,
      },
      loading: false,
      visible: false,
      filteredTotal: null,
      documentParentList: [],
      snackbar: { open: false, severity: 'success', message: '' },
    };
  }

  componentDidMount() {
    this.getDocuments();
  }

  notify = (severity, message) => {
    this.setState({ snackbar: { open: true, severity, message } });
  };

  closeSnackbar = () => {
    this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));
  };

  async getDocuments() {
    this.setState({ loading: true, documentList: [] });
    await new CommonUtilityController().getDocuments(0)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) {
          let documentParentList = fillSelectList(data, 'DocumentName', 'DocumentId');
          this.setState({ data, documentParentList });
        }
      })
      .catch((error) => {
        this.setState({ loading: false });
        this.notify('error', error.toString());
      });
  }

  columns = [
    { title: 'Document Code', key: 'DocumentCode', dataIndex: 'DocumentCode', sorter: (a, b) => a.DocumentCode.localeCompare(b.DocumentCode), ...new TableHelper().getColumnSearchProps('DocumentCode') },
    { title: 'Document Name', key: 'DocumentName', dataIndex: 'DocumentName', sorter: (a, b) => a.DocumentName.localeCompare(b.DocumentName), ...new TableHelper().getColumnSearchProps('DocumentName') },
    { title: 'Parent Document', key: 'ParentDocumentName', dataIndex: 'ParentDocumentName', sorter: (a, b) => a.ParentDocumentName.localeCompare(b.ParentDocumentName), ...new TableHelper().getColumnSearchProps('ParentDocumentName') },
    { title: 'Remarks', key: 'Remarks', dataIndex: 'Remarks', sorter: (a, b) => a?.Remarks?.localeCompare(b?.Remarks), ...new TableHelper().getColumnSearchProps('Remarks') },
  ];

  gridColumns = [
    { field: 'DocumentCode', headerName: 'Document Code', flex: 1, minWidth: 150 },
    { field: 'DocumentName', headerName: 'Document Name', flex: 1.6, minWidth: 200 },
    { field: 'ParentDocumentName', headerName: 'Parent Document', flex: 1.2, minWidth: 170 },
    { field: 'Remarks', headerName: 'Remarks', flex: 1.4, minWidth: 180 },
  ];

  render() {
    const { data, loading, snackbar } = this.state;
    const count = this.state.filteredTotal !== null ? this.state.filteredTotal : data.length;
    return (
      <PageContainer>
        <PageHeader title="Reference Document" subtitle="View reference documents and their hierarchy" />
        <DataCard title="Reference Document Details" count={data.length ? count : null} countLabel="Records">
          <AppDataGrid rows={data} columns={this.gridColumns} loading={loading}
            getRowId={(row) => row.DocumentId} emptyTitle="No reference documents found"
            emptyDescription="Try adjusting your search." />
        </DataCard>
        <ReportPdfFooter columnHeader={this.columns} tableData={data}
          orientation="portrait" tableHeader="Reference Document Details" fileName="ReferenceDocumentDetails" />
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

export default ViewReferenceDocument;
