
//form layout — MUI-compatible (antd layout objects removed)

// Modal pop up setting

const modalStyle = {
  width: 'min(1050px, 92vw)',
  style:{top:55 , marginTop:55},
} 

const riskDetailsStyle = {
  width: 'min(1300px, 92vw)',
  style:{top:55 , marginTop:55},
}

const mapStyle = {
  width: 'min(900px, 92vw)',  
  style:{top:55},
  padding:0,  

} 
const modalLoginStyle = {
  width: 'min(400px, 92vw)',  
  style:{top:100},
  align:'center'
} 
const modalSmallStyle = {
  width: 'min(600px, 92vw)',
  style:{top:100},
} 

const modalDbStyle = {
  width: 'min(900px, 92vw)',
  style:{top:55},
}

// work Package Length
const workPackageLength = 35;
// contract Length
const contractLength = 35;
 // activity Length
const activityLength = 35;
// Remarks Length
const remarksLength = 35;

// Validation messages for MUI forms (plain objects, not antd-specific)
const validateMessages = {
  required: '${label} is required!',
};

const labelAlign = "left";
const rowSpan = 24;
const colSpan = 24;
const layout = {};
const tailLayout = {};
const tailLargeLayout = {};
const itemLayout = {};
const itemLayoutForPreMigitation = {};
const selectSearch = {};
const selectSearchForLookupID = {};

export {
  labelAlign,
  rowSpan,
  colSpan,
  validateMessages,
  modalStyle,
  modalSmallStyle,
  contractLength,
  remarksLength,
  activityLength,
  modalDbStyle,
  workPackageLength,
  mapStyle,
  riskDetailsStyle,
  modalLoginStyle,
  layout,
  tailLayout,
  tailLargeLayout,
  itemLayout,
  itemLayoutForPreMigitation,
  selectSearch,
  selectSearchForLookupID,
}
