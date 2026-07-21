import {fillSelectList,fillRadioList} from '../helper/common-utility'
import currencyList from '../master/common/currencyList'

//file size
//audit notification signature uplaod file size in byte 
const SIGN_FILE_PROP={size:50000,description:'50 kb',fileType:'image/jpeg,image/png'} //50 kb
const NTF_FILE_PROP={size:10000000,description:'10 mb',fileType:'pdf'} //10 mb
// audit check list  uplaod file size in byte 
const CHECKLIST_FILE_PROP={size:50000,description:'50 kb',fileType:'image/jpeg,image/png'} //50 kb
// audit CAR  uplaod file size in byte 
const CAR_FILE_PROP={size:50000,description:'50 kb',fileType:'image/jpeg,image/png'} //50 kb
// NCR uplaod file size in byte
const NCR_FILE_PROP={size:50000,description:'50 kb',fileType:'image/jpeg,image/png'} //50 kb
// IP check list  uplaod file size in byte 
const IPCHECKLIST_FILE_PROP={size:50000,description:'50 kb',fileType:'image/jpeg,image/png'} //50 kb
// comment uplaod file size in byte 
const COMMENT_FILE_PROP={size:50000,description:'50 kb',fileType:'image/jpeg,image/png'} //50 kb
//audit report signature uplaod file size in byte 
const AR_SIGN_FILE_PROP={size:50000,description:'50 kb',fileType:'image/jpeg,image/png'} //50 kb
const AR_FILE_PROP={size:10000000,description:'10 mb',fileType:'pdf'} //10 mb
//inspection Plan uplaod file size in byte 
const IP_FILE_PROP={size:10000000,description:'10 mb',fileType:'pdf'} //10 mb
//-------------------------------------------------
const ACTIVITY_SAMPLE_DOC_PATH="storage//master//sample//ActivityMaster.xlsx";
const ACTIVITY_PROGRESS_DOC_PATH="storage//program//sample//ActivityProgress.xlsx";
const BOQ_SAMPLE_DOC_PATH="storage//finance//sample//BoqItem.xlsx";
const UNIT_SAMPLE_DOC_PATH= "storage//master//sample//UnitMaster.xlsx"
const DEPARTMENT_SAMPLE_DOC_PATH= "storage//master//sample//DepartmentMaster.xlsx"
const INSPECTION_PLAN_DOC_PATH="storage//quality//sample//InspectionPlan.xlsx";
const YEARS =[   
     {YearId:2018,YearName:'2018'},
     {YearId:2019,YearName:'2019'},
     {YearId:2020,YearName:'2020'},    
     {YearId:2021,YearName:'2021'},
     {YearId:2022,YearName:'2022'},
     {YearId:2023,YearName:'2023'},
     {YearId:2024,YearName:'2024'},
     {YearId:2025,YearName:'2025'},
  ];
  
const MONTHS =[
  {MonthId:"1",MonthName:'January'},
  {MonthId:"2",MonthName:'Febuary'},
  {MonthId:"3",MonthName:'March'},
  {MonthId:"4",MonthName:'April'},
  {MonthId:"5",MonthName:'May'},
  {MonthId:"6",MonthName:'June'},
  {MonthId:"7",MonthName:'July'},
  {MonthId:"8",MonthName:'August'},
  {MonthId:"9",MonthName:'September'},
  {MonthId:"10",MonthName:'October'},
  {MonthId:"11",MonthName:'November'},
  {MonthId:"12",MonthName:'December'},
]
 
  const QUARTER =[
    {QuarterId:'Quarter1',QuarterName:'Quarter1'}, 
    {QuarterId:'Quarter2',QuarterName:'Quarter2'},
    {QuarterId:'Quarter3',QuarterName:'Quarter3'},
    {QuarterId:'Quarter4',QuarterName:'Quarter4'},
  ]
  const LEVEL =[
    {LevelId:'1',LevelName:'1'}, 
    {LevelId:'2',LevelName:'2'}, 
    {LevelId:'3',LevelName:'3'}, 
    {LevelId:'4',LevelName:'4'}, 
    {LevelId:'5',LevelName:'5'}, 
    {LevelId:'6',LevelName:'6'}, 
    {LevelId:'7',LevelName:'7'}, 
    {LevelId:'8',LevelName:'8'}, 
    {LevelId:'9',LevelName:'9'}, 
    {LevelId:'10',LevelName:'10'}, 
  ]
  const ACTIONTYPE=[
    {ActionTypeId:'Immediate',ActionTypeName:'Immediate'},
    {ActionTypeId:'Root Cause',ActionTypeName:'Root Cause'},
    {ActionTypeId:'Corrective',ActionTypeName:'Corrective'},
    {ActionTypeId:'Preventive',ActionTypeName:'Preventive'},
  ]
  const GRADE=[
    {GradeId:'Major',GradeName:'Major'},
    {GradeId:'Minor',GradeName:'Minor'},
  ]
  const AUDITSCOPE=[
    {AuditScopeId:'1',AuditScopeName:'Scope1'},
    {AuditScopeId:'2',AuditScopeName:'Scope2'},
    {AuditScopeId:'3',AuditScopeName:'Scope3'},
  ]
  const ROOTCAUSETYPE=[
    {RootCauseTypeId:'Lack of/ Inadequate Documentation',RootCauseTypeName:'Lack of/ Inadequate Documentation'},
    {RootCauseTypeId:'Inadequate Tool/Equipment',RootCauseTypeName:'Inadequate Tool/Equipment'},
    {RootCauseTypeId:'Unapproved Deviation / Method',RootCauseTypeName:'Unapproved Deviation / Method'},
    {RootCauseTypeId:'Poor Workmanship',RootCauseTypeName:'Poor Workmanship'},
    {RootCauseTypeId:'Incorrect / Unapproved Material',RootCauseTypeName:'Incorrect / Unapproved Material'},
    {RootCauseTypeId:'Others',RootCauseTypeName:'Others'},
  ]
  const CLOSURESTATUS=[
    {ClosureStatusId:'Accepted',ClosureStatusName:'Accepted'},
    {ClosureStatusId:'Rejected',ClosureStatusName:'Rejected'},
  ]
  const ITP_TYPE=[
    {ITPTypeId:'FAT',ITPTypeName:'Factory Acceptance'},
    {ITPTypeId:'ITP',ITPTypeName:'Inspection Test'},
    {ITPTypeId:'SITE',ITPTypeName:'Site Activity'},
  ]
  const VERIFICATION_METHOD=[
    {VerificationMethodId:'Not Applicable',VerificationMethodName:'Not Applicable'},
    {VerificationMethodId:'Hold Point(H)',VerificationMethodName:'Hold Point(H)'},
    {VerificationMethodId:'Witness(W)',VerificationMethodName:'Witness(W)'},
    {VerificationMethodId:'Review(R)',VerificationMethodName:'Review(R)'},
    {VerificationMethodId:'Inspect(I)',VerificationMethodName:'Inspect(I)'},
    {VerificationMethodId:'Test(T)',VerificationMethodName:'Test(T)'},
    {VerificationMethodId:'Surveillance(S)',VerificationMethodName:'Surveillance(S)'},
  ]  
  // approval status 
  const APPROVAL_STATUS=[
    {Status:1,Description:'Pending',Color:'blue'},
    {Status:2,Description:'Approved',Color:'green'},    
    {Status:3,Description:'Rework',Color:'yellow'},
    {Status:4,Description:'Rejected',Color:'red'}, 
    {Status:5,Description:'Approved',Color:'green'}, 
  ]

  // view approval status 
  const APPROVAL_VIEW_STATUS=[
    {Status:1,Description:'B-No Objection with Comment',Color:'blue'},
    {Status:2,Description:'A-No Objection  Inspection checks',Color:'green'},    
    {Status:3,Description:'C-Revise & Resubmit',Color:'yellow'},
    {Status:4,Description:'D-Rejected',Color:'red'}, 
    {Status:5,Description:'A-No Objection  Inspection checks',Color:'green'}, 
  ]
//===========================Audit Plan======================================
// audit plan 
const AUDIT_STATUS=[
  {Status:1,Description:'Submitted',Color:'orange'},
  {Status:2,Description:'Planned',Color:'blue'},  
  {Status:3,Description:'Cancel',Color:'red'},
  {Status:4,Description:'Reschedule',Color:'yellow'},
  {Status:5,Description:'Conducted',Color:'green'}, 
]
const AUDIT_TYPE =[
  {AuditTypeId:'Internal',AuditTypeName:'Internal'}, 
  {AuditTypeId:'External',AuditTypeName:'External'}, 
]

//===========================================================================

  // Comment Resolution Type
  const RESOLUTION_TYPE=[
    {ResolutionTypeId:'System',ResolutionType:'System'},
    {ResolutionTypeId:'Civil Works',ResolutionType:'Civil Works'},
  ]
  // Comment Resolution Status
  const RESOLUTION_REVIEW_STATUS=[
    {ResolutionReviewStatusId:'Level A: Notice of No Objection (NONO)',ResolutionReviewStatus:'Level A: Notice of No Objection (NONO)'},
    {ResolutionReviewStatusId:'Level B: Reviewed with comments subjected to resubmission',ResolutionReviewStatus:'Level B: Reviewed with comments subjected to resubmission'},
    {ResolutionReviewStatusId:'Level C: Reviewed with comments; Revise and Resubmit',ResolutionReviewStatus:'Level C: Reviewed with comments; Revise and Resubmit'},
    {ResolutionReviewStatusId:'Level D: Rejected',ResolutionReviewStatus:'Level D: Rejected'},
    {ResolutionReviewStatusId:'Level E: For Information Only (If review is not required as per the contract)',ResolutionReviewStatus:'Level E: For Information Only (If review is not required as per the contract)'},
  ]
  // Comment Resolution
  const SEVERITY_TYPE=[
    {SeverityId:'Minor',Severity:'Minor'},
    {SeverityId:'Major',Severity:'Major'},
    {SeverityId:'Critical',Severity:'Critical'},
  ]
  // Comment Currency
  const CURRENCY_TYPE=[
    {CurrencyId:'INR',Currency:'INR'},
    {CurrencyId:'EUR',Currency:'EUR'},
    {CurrencyId:'BIF',Currency:'BIF'},
    {CurrencyId:'USD',Currency:'USD'}, 
  ]

const DOCUMENT_TYPE = [
  { DocumentTypeId: 'Check List', DocumentType: 'Check List' },
  { DocumentTypeId: 'Previous RFI', DocumentType: 'Previous RFI' },
  { DocumentTypeId: 'Testing Report', DocumentType: 'Testing Report' },
  { DocumentTypeId: 'Drawing', DocumentType: 'Drawing' },
  { DocumentTypeId: 'Approval', DocumentType: 'Approval' },
  { DocumentTypeId: 'Inspection', DocumentType: 'Inspection' },
  { DocumentTypeId: 'Re-Inspection', DocumentType: 'Re-Inspection' },
  { DocumentTypeId: 'Other', DocumentType: 'Other' },
];

const CHECKS = [
  { ChecksId: 'Yes', ChecksName: 'Yes' },
  { ChecksId: 'No', ChecksName: 'No' },
  { ChecksId: 'NA', ChecksName: 'NA' },
]

// Primary Location 
const PRIMARY_LOCATION=[
  {PrimaryLocationId:"Viaduct Structure",PrimaryLocationName:'Viaduct Structure'},
  {PrimaryLocationId:"Viaduct Superstructure",PrimaryLocationName:'Viaduct Superstructure'},
  {PrimaryLocationId:"Casting Yard",PrimaryLocationName:'Casting Yard'},
  {PrimaryLocationId:"Station Substructure",PrimaryLocationName:'Station Substructure'},
  {PrimaryLocationId:"Station Superstructure",PrimaryLocationName:'Station Superstructure'},
  {PrimaryLocationId:"Depot",PrimaryLocationName:'Depot'},
  {PrimaryLocationId:"Other",PrimaryLocationName:'Other'},
]

// Discipline 
const DISCIPLINE=[
  {DisciplineId:"CIVIL",DisciplineName:'CIVIL'},
  {DisciplineId:"MEP",DisciplineName:'MEP'},
  {DisciplineId:"SYSTEM",DisciplineName:'SYSTEM'},
  {DisciplineId:"ROLLING STOCK",DisciplineName:'ROLLING STOCK'},
  {DisciplineId:"TRACK WORK",DisciplineName:'TRACK WORK'},
]

const CURRENCY_OPTION = currencyList.data.map(c => ({
  label: `${c.CtryNm} - ${c.CcyNm}`,
  value: `${c.CtryNm} - ${c.Ccy}`
}));

const DOCUMENT_TYPE_LIST = fillSelectList(DOCUMENT_TYPE, "DocumentType", 'DocumentTypeId');
const CHECKS_LIST = fillSelectList(CHECKS, "ChecksId", 'ChecksName');

  //set drop down list
  const YEARS_LIST=fillSelectList(YEARS,"YearName",'YearId'); 
  const MONTHS_LIST=fillSelectList(MONTHS,"MonthName",'MonthId'); 
  const AUDIT_TYPE_LIST=fillSelectList(AUDIT_TYPE,"AuditTypeName",'AuditTypeId'); 
  const QUARTER_LIST=fillSelectList(QUARTER,"QuarterName",'QuarterId');
  const LEVEL_LIST=fillSelectList(LEVEL,"LevelName",'LevelId'); 
  const ACTION_TYPE_LIST=fillSelectList(ACTIONTYPE,"ActionTypeName",'ActionTypeId');
  const GRADE_LIST=fillSelectList(GRADE,"GradeName",'GradeId');
  const AUDIT_SCOPE=fillSelectList(AUDITSCOPE,"AuditScopeName",'AuditScopeId');
  const ROOT_CAUSE_TYPE=fillSelectList(ROOTCAUSETYPE,"RootCauseTypeName",'RootCauseTypeId');
  const CLOSURE_STATUS=fillSelectList(CLOSURESTATUS,"ClosureStatusName",'ClosureStatusId');
  const ITP_TYPE_LIST=fillSelectList(ITP_TYPE,"ITPTypeName",'ITPTypeId');
  const VERIFICATION_METHOD_LIST=fillSelectList(VERIFICATION_METHOD,"VerificationMethodName",'VerificationMethodId');
  const RESOLUTION_TYPE_LIST=fillSelectList(RESOLUTION_TYPE,"ResolutionType",'ResolutionTypeId');
  const RESOLUTION_REVIEW_STATUS_LIST=fillSelectList(RESOLUTION_REVIEW_STATUS,"ResolutionReviewStatus",'ResolutionReviewStatusId');
  const SEVERITY_TYPE_LIST=fillSelectList(SEVERITY_TYPE,"Severity",'SeverityId');
  const CURRENCY_TYPE_LIST=fillSelectList(CURRENCY_TYPE,"Currency",'CurrencyId'); 
  const DISCIPLINE_LIST=fillSelectList(DISCIPLINE,"DisciplineId",'DisciplineName')
  const PRIMARY_LOCATION_LIST=fillSelectList(PRIMARY_LOCATION,"PrimaryLocationId",'PrimaryLocationName');

  //set radio list
  const ITP_TYPE_RADIO_LIST=fillRadioList(ITP_TYPE,"ITPTypeName",'ITPTypeId');
  const CURRENCY_OPTION_LIST = fillSelectList(CURRENCY_OPTION, "label", "value");

  export {
    SIGN_FILE_PROP,
    NTF_FILE_PROP,
    CHECKLIST_FILE_PROP,
    IPCHECKLIST_FILE_PROP,
    CAR_FILE_PROP,
    NCR_FILE_PROP,
    COMMENT_FILE_PROP,
    AR_SIGN_FILE_PROP,
    AR_FILE_PROP,
    IP_FILE_PROP,
    YEARS_LIST,
    MONTHS_LIST,
    MONTHS,
    AUDIT_TYPE_LIST,
    QUARTER_LIST,
    LEVEL_LIST,
    ACTION_TYPE_LIST,
    GRADE_LIST,
    AUDIT_SCOPE,
    ROOT_CAUSE_TYPE,
    CLOSURE_STATUS,
    AUDIT_STATUS,
    ITP_TYPE_LIST,
    VERIFICATION_METHOD_LIST,
    VERIFICATION_METHOD,
    APPROVAL_STATUS,
    APPROVAL_VIEW_STATUS,
    RESOLUTION_TYPE_LIST,
    RESOLUTION_REVIEW_STATUS_LIST,
    SEVERITY_TYPE_LIST,
    ITP_TYPE_RADIO_LIST,
    CURRENCY_TYPE_LIST,
    ACTIVITY_SAMPLE_DOC_PATH,
    BOQ_SAMPLE_DOC_PATH,
    UNIT_SAMPLE_DOC_PATH,
    DOCUMENT_TYPE_LIST,
    DEPARTMENT_SAMPLE_DOC_PATH,
    ACTIVITY_PROGRESS_DOC_PATH,
    INSPECTION_PLAN_DOC_PATH,
    DISCIPLINE_LIST,
    PRIMARY_LOCATION_LIST,
    CHECKS_LIST,
    CURRENCY_OPTION_LIST
  }