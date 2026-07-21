import moment from 'moment';
import React, { Component } from 'react';
import { TextField, MenuItem, Grid, Switch as MuiSwitch, Backdrop, CircularProgress } from '@mui/material';
import Box from '@mui/material/Box';
import MuiButton from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Stack from '@mui/material/Stack';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import LoginState from '../../authentication/loginState'
import CommonUtilityController from "../controller/common-utility-controller";
import { fillSelectList } from '../../helper/common-utility';
import ExcelJS from 'exceljs';
import FileHelper from '../../helper/file-helper';
import { differenceDates, compareDate } from '../../helper/common-utility';
import { ACTIVITY_SAMPLE_DOC_PATH } from '../../helper/constants';
import { PageContainer, PageHeader, DataCard, FormDialog, ConfirmDialog, AppDataGrid } from '../../components/ui';
import { activityLength, contractLength } from '../../helper/form-helper'
var count = 0;
//file upload input data
const inputJson = [{ name: "ActivityCode", type: "string", required: true }, { name: "ActivityName", type: "string", required: true }, { name: "ParentActivityCode", type: "string", required: false }, { name: "Weightage", type: "number", required: true }, { name: "Quantity", type: "number", required: true }]

class Activity extends Component {

    constructor(props) {
      super(props);
     this.state = {
        data: [],
        searchData:{
          ProjectId:"",
          ContractId:"" ,
          ActivityGroupId:"",
        },
        activityData:{
          ActivityId:0,
          ActivityCode:"",
          ActivityName:"",
          ActivityGroupId:"",
          ProjectId:"",
          ContractId:"",
          ActivityParentId:"" ,
          Duration: 0,
          IsCritical: false,
          Quantity: 0,
          Weightage: "",
          StartDate: "",
          EndDate: "",
          Remarks:"",
          UnitId:"",
          Status:0,
          ReferenceCode:""
        },
        loading:false,
        visible:false,
        activityGroupList:[],
        projectList:[],
        contractList:[],
        projectId:"" ,
        activityParentList:[],
        excelRows:[],
        activityUploadList:[],
        editable:false,
        isUpload:true,
        enableUpload:false,
        isNew:false,
        filteredTotal: null,
        confirmOpen: false,
        pendingDelete: null,
        snackbar: { open: false, severity: 'success', message: '' },
      };

  }
    //load initial data
   componentDidMount() {
    this.getProjects();
    }

  notify = (severity, message) => {
    this.setState({ snackbar: { open: true, severity, message } });
  };

  closeSnackbar = () => {
    this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));
  };

  handleFieldChange = (field, value) => {
    this.setState((prev) => ({
      activityData: { ...prev.activityData, [field]: value }
    }));
  }

  handleSubmitForm = (e) => {
    e.preventDefault();
    this.handleSubmit(this.state.activityData);
  }

    updateSearchState=(key,value)=> {
      const {searchData}=this.state;
      searchData[key]=value;
      this.setState({searchData: searchData });
    }
     //fetch activitys
     async getActivities(activityGroupId) {
      this.setState({loading: true,data:[],activityParentList:[]});
      await new CommonUtilityController().getActivities(activityGroupId)
                                        .then(data =>{

                                                this.setState({loading: false, });
                                                if(data !=undefined)
                                                {
                                                  let activityParentList=fillSelectList(data,"ActivityName",'ActivityId');

                                                  this.setState({data:data,activityParentList:activityParentList });
                                                }
                                              })
                                         .catch(error =>{
                                                    this.setState({loading: false, });
                                                    this.notify('error', error.toString());
                                              });

    }

    //fetch projects
    async getProjects() {
      this.setState({loading: true,projectList: [] });
      let reqData = {
        UserId: LoginState.UserId
      }
      await new CommonUtilityController().getProjects(reqData)
                                        .then(data =>{
                                                this.setState({loading: false, });
                                                if(data !=undefined)
                                                {
                                                //fill drop down list
                                                  let projectList=fillSelectList(data,"ProjectName",'ProjectMasterId');
                                                  this.setState({projectList: projectList });
                                                }
                                              })
                                        .catch(error =>{
                                                    this.setState({loading: false, });
                                                    this.notify('error', error.toString());
                                              });

    }

     //fetch contracts
     getcontracts=async (data) => {

      this.setState({loading: true,contractList:[] });
      await new CommonUtilityController().getContracts(data)
                                        .then(data =>{
                                                this.setState({loading: false, });
                                                if(data !=undefined)
                                                {
                                                //  alert(JSON.stringify(data))
                                                //fill drop down list
                                                  let contractList=fillSelectList(data,"ContractName",'ContractId');
                                                  this.setState({contractList: contractList,contractDataSource:data });
                                                }
                                              })
                                        .catch(error =>{
                                                    this.setState({loading: false, });
                                                    this.notify('error', error.toString());
                                              });

      }

    projectChange=(value)=> {

      this.setState({projectId:value});
      let{isNew,activityData,searchData}=this.state;
      if(isNew)
      {
        activityData.ProjectId=value;
        activityData.ContractId='';
        activityData.ActivityGroupId='';
        activityData.ActivityParentId='';
        this.setState({activityData:activityData});
      }

      var data= {
        "projectId":value ,
        "workPackageId":0,
        "contractorId": 0
      }
      if(value!="")
      {
        this.getcontracts(data);
      }
      searchData.ProjectId = value;
      searchData.ContractId = '';
      searchData.ActivityGroupId = '';
      this.setState({searchData: searchData});

      this.setState({data:[],activityParentList:[],activityGroupList:[],contractList:[]});
    }

    contractChange=(value)=> {
      let{isNew,activityData,searchData}  =this.state;
        if(value!="")
        {
          let{projectId}=this.state;
          this.getActivityGroups(projectId,value);
        }
        searchData.ContractId = value;
        searchData.ActivityGroupId = '';
        this.setState({searchData: searchData});
        if(isNew)
        {
          activityData.ContractId=value;
          activityData.ActivityGroupId='';
          activityData.ActivityParentId='';
          this.setState({activityData:activityData});
        }

        this.setState({data:[],activityParentList:[],activityGroupList:[]});
    }

    activityGroupChange=(value)=> {
      let{isNew,activityData,searchData}=this.state;
      this.setState({data:[],activityParentList:[]});
      if(value!="")
      {
        this.getActivities(value);
      }
      searchData.ActivityGroupId = value;
      this.setState({searchData: searchData});
      if(isNew)
      {
        activityData.ActivityGroupId=value;
        activityData.ActivityParentId='';
        this.setState({activityData:activityData});
      }

  }
         //fetch activityGroups
    async getActivityGroups(projectId,contractId) {
          this.setState({loading: true,activityGroupList: [] });
          await new CommonUtilityController().getActivityGroups(projectId,contractId)
                                            .then(data =>{
                                                    this.setState({loading: false, });
                                                    if(data !=undefined)
                                                    {
                                                      let activityGroupList=fillSelectList(data,"ActivityGroupName",'ActivityGroupId');
                                                      this.setState({activityGroupList: activityGroupList});

                                                    }
                                                  })
                                             .catch(error =>{
                                                        this.setState({loading: false, });
                                                        this.notify('error', error.toString());
                                                  });

        }

  get gridColumns() {
    return [
      {
        field: 'action',
        headerName: 'Action',
        width: 110,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) => {
          const record = params.row;
          const disabled = record.Status == "9";
          return (
            <Stack direction="row" spacing={0.5}>
              <Tooltip title="Edit record">
                <span>
                  <IconButton size="small" color="primary" disabled={disabled} onClick={() => this.editRecord(record)}>
                    <EditRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Delete record">
                <span>
                  <IconButton size="small" color="error" disabled={disabled} onClick={() => this.requestDelete(record)}>
                    <DeleteRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          );
        },
      },
      { field: 'Sno', headerName: 'Sno', width: 70, sortable: false, filterable: false, renderCell: (params) => params.api.getAllRowIds().indexOf(params.id) + 1 },
      { field: 'ActivityCode', headerName: 'Activity Code', flex: 1, minWidth: 130 },
      {
        field: 'ActivityName', headerName: 'Activity', flex: 1.4, minWidth: 180,
        renderCell: (params) => (
          <Tooltip title={params.row.ActivityName || ''}>
            <span>{params.row?.ActivityName?.slice(0, activityLength)}......</span>
          </Tooltip>
        ),
      },
      { field: 'ActivityGroupName', headerName: 'Activity Group', flex: 1.2, minWidth: 150 },
      { field: 'ProjectName', headerName: 'Project Name', flex: 1.2, minWidth: 150 },
      {
        field: 'ContractName', headerName: 'Contract', flex: 1.2, minWidth: 150,
        renderCell: (params) => (
          <Tooltip title={params.row.ContractName || ''}>
            <span>{params.row?.ContractName?.slice(0, contractLength)}......</span>
          </Tooltip>
        ),
      },
      { field: 'Duration', headerName: 'Duration', type: 'number', align: 'right', headerAlign: 'right', width: 100 },
      { field: 'Quantity', headerName: 'Quantity', type: 'number', align: 'right', headerAlign: 'right', width: 100 },
      { field: 'Weightage', headerName: 'Weightage %', type: 'number', align: 'right', headerAlign: 'right', width: 120 },
      { field: 'StartDate', headerName: 'Start Date', width: 120 },
      { field: 'EndDate', headerName: 'End Date', width: 120 },
      { field: 'Remarks', headerName: 'Remarks', flex: 1.2, minWidth: 150 },
    ];
  }

  get uploadGridColumns() {
    return [
      { field: 'Sno', headerName: 'Sno', width: 70 },
      { field: 'ActivityCode', headerName: 'Code', width: 120 },
      {
        field: 'ActivityName', headerName: 'Activity', flex: 1, minWidth: 200,
        renderCell: (params) => (
          <Tooltip title={params.row.ActivityName || ''}>
            <span>{params.row?.ActivityName?.slice(0, 80)}......</span>
          </Tooltip>
        ),
      },
      { field: 'ParentActivityCode', headerName: 'Parent Activity Code', width: 170 },
      { field: 'Weightage', headerName: 'Weightage', type: 'number', align: 'right', headerAlign: 'right', width: 110 },
      { field: 'Quantity', headerName: 'Quantity', type: 'number', align: 'right', headerAlign: 'right', width: 110 },
    ];
  }

 //New record
 newRecord = () => {
  const { activityData} = this.state;
    activityData.ActivityGroupId="";
    activityData.ProjectId="";
    activityData.ContractId="";
    activityData.ActivityParentId="" ;
    activityData.ActivityId=0;
    activityData.ActivityCode="";
    activityData.ActivityName="";
    activityData.Duration= 0;
    activityData.IsCritical= false;
    activityData.Quantity= 0;
    activityData.Weightage= 0;
    activityData.StartDate= "";
    activityData.EndDate= "";
    activityData.Remarks="";
    activityData.Status=0;

  this.setState({loading: false,isNew:true,  editable: true, isUpload:false,  visible:true,activityData:activityData,activityParentList:[] });
}
  //edit record
  editRecord =async (activityData) => {
    let activity= JSON.parse(JSON.stringify(activityData));
    activity.StartDate= moment(activity.StartDate,'YYYY-MM-DD')
    activity.EndDate= moment(activity.EndDate,'YYYY-MM-DD')
    if(activity.ActivityParentId==0)
    activity.ActivityParentId='';
      this.setState({ editable: true,isNew:true, isUpload:false,  visible:true ,activityData:activity});

  }

  requestDelete = (activity) => {
    this.setState({ confirmOpen: true, pendingDelete: activity });
  };

  cancelDelete = () => {
    this.setState({ confirmOpen: false, pendingDelete: null });
  };

  confirmDelete = () => {
    const activity = this.state.pendingDelete;
    this.setState({ confirmOpen: false, pendingDelete: null });
    if (activity) this.deleteRecord(activity);
  };

//delete record
 deleteRecord = async (activity) => {
  activity.CreatedBy=LoginState.UserId;
  activity.CreatedDate=moment().format('YYYY-MM-DD HH:mm:ss');
  this.setState({loading: true});

 await new CommonUtilityController().deleteActivityDetails(activity)
                                  .then(data =>{
                                        this.setState({loading: false, });

                                        if(data !=undefined)
                                        {
                                          let activityParentList=fillSelectList(data,"ActivityName",'ActivityId');

                                          this.setState({data:data,activityParentList:activityParentList });

                                        }
                                        this.notify('success', 'Data successfully deleted.');
                                  })
                                 .catch(error =>{
                                        this.setState({loading: false, });
                                        this.notify('error', 'Data deletion issue!');
                                });

  }

  toggleModal= () => {
    this.setState({
      visible: !this.state.visible,isNew:false
    });
  }
  handleSubmit =async (activity) => {


     //********** Duplicate entry validation*/
     if (activity.ActivityParentId =="") {activity.ActivityParentId = "0";}
     let isexist = false;
     let reqData = {
         "Record": activity,
         "TableName": "ActivityMaster"
     }

     this.setState({ loading: true });
     await new CommonUtilityController().isRecordExists(reqData)
         .then((result) => {
             this.setState({ loading: false });
             if (result?.status == 1) {
                 isexist = true;
                 this.notify('error', 'Record already exists');
             }
         })
         .catch(error => {
             isexist = true;
             this.setState({ loading: false });
             this.notify('error', 'Error found while validate the Record');
         });
     if (isexist)
         return false;
     ///********** Duplicate entry validation*/

    let flag=compareDate(activity.StartDate, activity.EndDate);
    if(flag)
    {
      this.notify('error', 'Start Date should be less than or equal to end date.');
      return false;
    }
    this.setState({loading: true, });

    let days=differenceDates( activity.StartDate, activity.EndDate,'days');

    activity.StartDate=moment(activity.StartDate).format('YYYY-MM-DD HH:mm:ss');
    activity.EndDate=moment(activity.EndDate).format('YYYY-MM-DD HH:mm:ss');

    activity.Duration=days;
    activity.CreatedBy=LoginState.UserId;
    activity.CreatedDate=moment().format('YYYY-MM-DD HH:mm:ss');
    activity.LockedBy=LoginState.LockedBy;
    activity.LockedDate=moment().format('YYYY-MM-DD HH:mm:ss');
    activity.SecurityId=LoginState.SecurityId;
    activity.Status=1;
    this.setState({loading: true});
   await new CommonUtilityController().saveActivityDetails(activity)
                                    .then(data =>{
                                          this.setState({loading: false, });
                                          if(data !=undefined)
                                          {
                                            let activityParentList=fillSelectList(data,"ActivityName",'ActivityId');

                                            this.setState({data:data,activityParentList:activityParentList,visible:false ,isNew:false});


                                          }
                                          this.notify('success', 'Data submitted successfully.');
                                    })
                                   .catch(error =>{
                                          this.setState({loading: false, });
                                          this.notify('error', 'Data insertion issue!');
                                  });
  }


  startDateChange=(val)=> {
   const { activityData} = this.state;
   activityData.StartDate=val;

   if(activityData.EndDate!=null ||activityData.EndDate!='')
   {
       let days=differenceDates( activityData.StartDate, activityData.EndDate,'days');
       activityData.Duration=days;

   }

   this.setState({activityData:activityData});
  }


  endDateChange=(val)=> {
   const { activityData} = this.state;
   activityData.EndDate=val;

   if(activityData.StartDate!=null ||activityData.StartDate!='')
   {
      let days=differenceDates( activityData.StartDate, activityData.EndDate,'days');
      activityData.Duration=days;
   }
   this.setState({activityData:activityData});
   }

//--------upload file ------------------------
/*
declare excelRows:[],
*/

renderFileData = async (fileObj, inputJson) => {
  const { searchData } = this.state;

  this.setState({
    loading: true,
    excelRows: [],
    enableUpload: false
  });

  try {
    const buffer = await fileObj.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0]; // first sheet
    if (!worksheet) {
      this.setState({ loading: false });
      return;
    }

    // Convert worksheet rows to array
    const excelData = [];
    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const rowValues = row.values;
      rowValues.shift(); // ExcelJS row.values is 1-based, remove first undefined
      excelData.push(rowValues);
    });

    if (!excelData || excelData.length === 0) {
      this.setState({ loading: false });
      return;
    }

    // Validate columns
    const cols = excelData[0];
    if (inputJson.length !== cols.length) {
      this.notify('error', 'No. of columns should be equal as given sample excel !!');
      this.setState({ loading: false });
      return;
    }

    for (let i = 0; i < inputJson.length; i++) {
      if (cols[i] !== inputJson[i].name) {
        this.notify('error', `${inputJson[i].name} column is invalid or not in sequence !!`);
        this.setState({ loading: false });
        return;
      }
    }

    let jdata = [];
    let strMsg = '';
    let rowCount = 0;

    for (let i = 1; i < excelData.length; i++) {
      const rowVal = excelData[i];
      if (!rowVal || rowVal.length === 0) continue;

      if (inputJson.length !== rowVal.length) {
        strMsg += `Row ${i + 1} cell values should not be empty, `;
        continue;
      }

      let rowData = {};
      let flag = false;

      for (let c = 0; c < inputJson.length; c++) {
        if (inputJson[c].required && (rowVal[c] === null || rowVal[c] === undefined || rowVal[c] === '')) {
          if (!(inputJson[c].type === 'number' && rowVal[c] === 0)) {
            strMsg += `Row ${i + 1}, Cell ${c + 1} should not be empty, `;
            flag = true;
            break;
          }
        }

        if (inputJson[c].type === 'number') {
          if (isNaN(rowVal[c])) {
            strMsg += `${rowVal[c]} is not numeric in Row ${i + 1}, Cell ${c + 1}, `;
            flag = true;
            break;
          } else {
            rowData[inputJson[c].name] = rowVal[c];
          }
        } else {
          rowData[inputJson[c].name] = rowVal[c];
        }
      }

      if (!flag) {
        rowCount++;
        rowData.Sno = rowCount;
        rowData.CreatedBy = LoginState.UserId;
        rowData.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
        rowData.LockedBy = LoginState.LockedBy;
        rowData.LockedDate = moment().format('YYYY-MM-DD HH:mm:ss');
        rowData.SecurityId = LoginState.SecurityId;
        rowData.Status = 1;
        rowData.ReferenceCode = typeof rowData.ParentActivityCode === 'number'
          ? rowData.ParentActivityCode
          : rowData.ParentActivityCode?.trim();
        rowData.ActivityGroupId = searchData.ActivityGroupId;

        jdata.push(rowData);
      }
    }

    this.setState({
      loading: false,
      excelRows: jdata,
      enableUpload: jdata.length > 0
    });

    if (strMsg) {
      this.notify('error', `${strMsg}!!`);
    }

  } catch (error) {
    this.notify('error', 'Error reading Excel file.');
    this.setState({ loading: false });
  }
};

fileHandler = (event) => {
    if(event.target.files.length){
      let fileObj = event.target.files[0];
      let fileName = fileObj.name;

      //check for file extension and pass only if it is .xlsx and display error message otherwise
      if(fileName?.slice(fileName.lastIndexOf('.')+1) === "xlsx"){

        this.renderFileData(fileObj,inputJson);
      }
      else{
        this.notify('error', 'Invalid File!! ');
        this.setState({
          excelCols:[],
          excelRows: []
        })
      }
    }
}

//---------Upload File end--------------------

handleUploadSubmit =async () => {
 // alert(JSON.stringify(data))
 this.setState({visible:true,isUpload:true,enableUpload:false,loading: false,excelRows: []});
}

saveUploadData =async () => {
  let{excelRows}=this.state;
  this.setState({loading: true });
  await new CommonUtilityController().saveActivityBulkDetails(excelRows)
  .then(data =>{
        this.setState({loading: false, });
        if(data !=undefined)
        {

          let activityParentList=fillSelectList(data,"ActivityName",'ActivityId');

          this.setState({data:data,activityParentList:activityParentList,visible:false });


        }
        this.notify('success', 'Data successfully Inserted.');
  })
 .catch(error =>{
        this.setState({loading: false, });
        this.notify('error', 'Data insertion issue!');
});
 }
//--------------------------------------------
    render() {
        const { searchData, data, loading, visible, enableUpload, activityData, activityGroupList, projectList, contractList, activityParentList, excelRows, isUpload, confirmOpen, snackbar } = this.state;
        return (
          <PageContainer>
            <PageHeader
              title="Activity Details"
              subtitle="Manage project activities and bulk uploads"
              actions={
                <MuiButton variant="contained" color="primary" startIcon={<AddRoundedIcon />} onClick={() => this.newRecord()}>
                  New
                </MuiButton>
              }
            />

            <DataCard title="Filters">
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 8 }}>
                  <TextField fullWidth size="small" label="Project Name" required select
                    value={searchData.ProjectId || ''}
                    onChange={(e) => this.projectChange(e.target.value)}
                  >
                    <MenuItem value="">Select....</MenuItem>
                    {projectList.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>
              <Grid container spacing={2} sx={{ mt: 0 }}>
                <Grid size={{ xs: 12, sm: 8 }}>
                  <TextField fullWidth size="small" label="Contract Name" required select
                    value={searchData.ContractId || ''}
                    onChange={(e) => this.contractChange(e.target.value)}
                  >
                    <MenuItem value="">Select....</MenuItem>
                    {contractList.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>
              <Grid container spacing={2} sx={{ mt: 0 }}>
                <Grid size={{ xs: 12, sm: 8 }}>
                  <TextField fullWidth size="small" label="Activity Group" required select
                    value={searchData.ActivityGroupId || ''}
                    onChange={(e) => this.activityGroupChange(e.target.value)}
                  >
                    <MenuItem value="">Select....</MenuItem>
                    {activityGroupList.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 1 }}>
                  <Tooltip title="Download sample file: In ParentActivityCode cell set NA if activity is Parent Activity">
                    <span>
                      <MuiButton variant="contained" size="small" startIcon={<CloudDownloadIcon />}
                        onClick={() => new FileHelper().downloadAttachment(ACTIVITY_SAMPLE_DOC_PATH, "Sample")}
                        sx={{ minWidth: 40, px: 1 }}
                      />
                    </span>
                  </Tooltip>
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <MuiButton variant="contained" size="small" onClick={this.handleUploadSubmit}>Upload Activity</MuiButton>
                </Grid>
              </Grid>
            </DataCard>

            <DataCard title="Activity Details" count={data.length ? data.length : null} countLabel="Records">
              <AppDataGrid
                rows={data}
                columns={this.gridColumns}
                loading={loading}
                getRowId={(row) => row.ActivityId}
                emptyTitle="No records yet"
                emptyDescription="Select a project, contract and activity group to view activities."
              />
            </DataCard>

            {/* ── Create / Edit / Upload dialog (MUI controlled forms) ── */}
            <FormDialog
              open={visible}
              onClose={this.toggleModal}
              title="Activity Details"
              maxWidth={isUpload ? 'md' : 'sm'}
              actions={null}
            >
              <Backdrop open={loading} sx={{ position: 'absolute', zIndex: (t) => t.zIndex.modal + 1 }}>
                <CircularProgress />
              </Backdrop>
              <div hidden={isUpload}>
                <Box component="form" onSubmit={this.handleSubmitForm}>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12 }}>
                      <TextField fullWidth size="small" label="Project Name" required select
                        value={activityData.ProjectId || ''}
                        onChange={(e) => this.projectChange(e.target.value)}
                      >
                        <MenuItem value="">Select....</MenuItem>
                        {projectList.map((opt) => (
                          <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                  </Grid>
                  <Grid container spacing={2} sx={{ mt: 0 }}>
                    <Grid size={{ xs: 12 }}>
                      <TextField fullWidth size="small" label="Contract Name" required select
                        value={activityData.ContractId || ''}
                        onChange={(e) => this.contractChange(e.target.value)}
                      >
                        <MenuItem value="">Select....</MenuItem>
                        {contractList.map((opt) => (
                          <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                  </Grid>
                  <Grid container spacing={2} sx={{ mt: 0 }}>
                    <Grid size={{ xs: 12 }}>
                      <TextField fullWidth size="small" label="Activity Group" required select
                        value={activityData.ActivityGroupId || ''}
                        onChange={(e) => this.activityGroupChange(e.target.value)}
                      >
                        <MenuItem value="">Select....</MenuItem>
                        {activityGroupList.map((opt) => (
                          <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                  </Grid>
                  <Grid container spacing={2} sx={{ mt: 0 }}>
                    <Grid size={{ xs: 12 }}>
                      <TextField fullWidth size="small" label="Activity Name" required multiline rows={2}
                        value={activityData.ActivityName || ''}
                        onChange={(e) => this.handleFieldChange('ActivityName', e.target.value)}
                        inputProps={{ maxLength: 4000 }}
                      />
                    </Grid>
                  </Grid>
                  <Grid container spacing={2} sx={{ mt: 0 }}>
                    <Grid size={{ xs: 12 }}>
                      <TextField fullWidth size="small" label="Activity Code" required
                        value={activityData.ActivityCode || ''}
                        onChange={(e) => this.handleFieldChange('ActivityCode', e.target.value)}
                      />
                    </Grid>
                  </Grid>
                  <Grid container spacing={2} sx={{ mt: 0 }}>
                    <Grid size={{ xs: 12 }}>
                      <TextField fullWidth size="small" label="Parent Activity" select
                        value={activityData.ActivityParentId || ''}
                        onChange={(e) => this.handleFieldChange('ActivityParentId', e.target.value)}
                      >
                        <MenuItem value="">Select....</MenuItem>
                        {activityParentList.map((opt) => (
                          <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                  </Grid>
                  <Grid container spacing={2} sx={{ mt: 0 }}>
                    <Grid size={{ xs: 12 }}>
                      <TextField fullWidth size="small" label="Start Date" required type="date"
                        value={activityData.StartDate || ''}
                        onChange={(e) => this.startDateChange(e.target.value)}
                        slotProps={{ inputLabel: { shrink: true } }}
                      />
                    </Grid>
                  </Grid>
                  <Grid container spacing={2} sx={{ mt: 0 }}>
                    <Grid size={{ xs: 12 }}>
                      <TextField fullWidth size="small" label="End Date" required type="date"
                        value={activityData.EndDate || ''}
                        onChange={(e) => this.endDateChange(e.target.value)}
                        slotProps={{ inputLabel: { shrink: true } }}
                        inputProps={{ min: moment().format('YYYY-MM-DD') }}
                      />
                    </Grid>
                  </Grid>
                  <Grid container spacing={2} sx={{ mt: 0 }}>
                    <Grid size={{ xs: 12 }}>
                      <TextField fullWidth size="small" label="Duration (in days)" disabled
                        value={activityData.Duration || 0}
                      />
                    </Grid>
                  </Grid>
                  <Grid container spacing={2} sx={{ mt: 0 }}>
                    <Grid size={{ xs: 12 }}>
                      <TextField fullWidth size="small" label="Quantity" required type="number"
                        value={activityData.Quantity || ''}
                        onChange={(e) => this.handleFieldChange('Quantity', e.target.value)}
                        inputProps={{ min: 0 }}
                      />
                    </Grid>
                  </Grid>
                  <Grid container spacing={2} sx={{ mt: 0 }}>
                    <Grid size={{ xs: 12 }}>
                      <TextField fullWidth size="small" label="Weightage %" required type="number"
                        value={activityData.Weightage || ''}
                        onChange={(e) => this.handleFieldChange('Weightage', e.target.value)}
                        inputProps={{ min: 0, max: 100 }}
                      />
                    </Grid>
                  </Grid>
                  <Grid container spacing={2} sx={{ mt: 0 }}>
                    <Grid size={{ xs: 12 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <MuiSwitch
                          checked={activityData.IsCritical || false}
                          onChange={(e) => this.handleFieldChange('IsCritical', e.target.checked)}
                        />
                        <span>Is Critical</span>
                      </Stack>
                    </Grid>
                  </Grid>
                  <Grid container spacing={2} sx={{ mt: 0 }}>
                    <Grid size={{ xs: 12 }}>
                      <TextField fullWidth size="small" label="Remarks" multiline rows={2}
                        value={activityData.Remarks || ''}
                        onChange={(e) => this.handleFieldChange('Remarks', e.target.value)}
                        inputProps={{ maxLength: 4000 }}
                      />
                    </Grid>
                  </Grid>

                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, pt: 1 }}>
                    <MuiButton variant="text" color="inherit" onClick={this.toggleModal}>Close</MuiButton>
                    <MuiButton variant="contained" color="primary" type="submit">Submit</MuiButton>
                  </Box>
                </Box>
              </div>

              <div hidden={!isUpload}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12 }}>
                    <Box sx={{ py: 1 }}>
                      <MuiButton variant="outlined" component="label" size="small">
                        Upload Excel
                        <input type="file" hidden accept=".xlsx" onChange={this.fileHandler.bind(this)} />
                      </MuiButton>
                    </Box>
                  </Grid>
                </Grid>
                <Box sx={{ mt: 1 }}>
                  <AppDataGrid
                    rows={excelRows}
                    columns={this.uploadGridColumns}
                    getRowId={(row) => row.Sno}
                    emptyTitle="No rows"
                    emptyDescription="Upload an Excel file to preview activities."
                  />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, pt: 2 }}>
                  <MuiButton variant="text" color="inherit" onClick={this.toggleModal}>Close</MuiButton>
                  <MuiButton variant="contained" color="primary" disabled={!enableUpload} onClick={this.saveUploadData}>Save</MuiButton>
                </Box>
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

export default Activity;
