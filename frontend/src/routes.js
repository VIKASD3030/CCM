import React from 'react';

const Login = React.lazy(() => import('./authentication/login'));

const CcmDashboard = React.lazy(() => import('./ccm/views/dashboard'));
const CcmAiDrafting = React.lazy(() => import('./ccm/views/ai-drafting'));


const Project = React.lazy(() => import('./master/views/project-master'));
const ProjectDetails = React.lazy(() => import('./master/views/project-master-details'));
// const VariationOrder = React.lazy(() => import('./master/views/variation-order-master'));
// const ViewVariationOrder = React.lazy(() => import('./master/views/view-variation-order-master'));
// const MonthlyBreakUp = React.lazy(() => import('./master/views/monthly-breakup-master'));
// const ManageMonthlyBreakupDetails = React.lazy(() => import('./master/views/modify-monthly-breakup-master'));
// const Contract = React.lazy(() => import('./master/views/contract-master'));
// const Contractor = React.lazy(() => import('./master/views/contractor-master'));
// const ActivityGroup = React.lazy(() => import('./master/views/activity-group-master'));
// const Activity = React.lazy(() => import('./master/views/activity-master'));
const Department = React.lazy(() => import('./master/views/department-master'));
// const Location = React.lazy(() => import('./master/views/location-master'));
const ModuleGroup = React.lazy(() => import('./master/views/module-group-master'));
const Module = React.lazy(() => import('./master/views/module-master'));
const Role = React.lazy(() => import('./master/views/role-master'));
// const ReferenceDocument = React.lazy(() => import('./master/views/reference-document-master'));
const RoleRight = React.lazy(() => import('./master/views/role-right-master'));
const UserRole = React.lazy(() => import('./master/views/user-role-master'));
const ViewUserRole = React.lazy(() => import('./master/views/view-user-role-master'));
// const Unit = React.lazy(() => import('./master/views/unit-master'));
const Designation = React.lazy(() => import('./master/views/designation-master'));
const User = React.lazy(() => import('./master/views/user-master'));
// const AutoNotification = React.lazy(() => import('./master/views/autonotification-master'));
// const LookupMaster = React.lazy(() => import('./master/views/lookup-master'));

// const ViewActivityGroup = React.lazy(() => import('./master/views/view-activity-group-master'));
const ViewProject = React.lazy(() => import('./master/views/view-project-master'));
const ViewProjectDetails = React.lazy(() => import('./master/views/view-project-master-details'));
// const ViewContract = React.lazy(() => import('./master/views/view-contract-master'));
// const ViewContractor = React.lazy(() => import('./master/views/view-contractor-master'));
// const ViewActivity = React.lazy(() => import('./master/views/view-activity-master'));
const ViewDepartment = React.lazy(() => import('./master/views/view-department-master'));
// const ViewLocation = React.lazy(() => import('./master/views/view-location-master'));
const ViewModuleGroup = React.lazy(() => import('./master/views/view-module-group-master'));
const ViewModule = React.lazy(() => import('./master/views/view-module-master'));
const ViewRole = React.lazy(() => import('./master/views/view-role-master'));
// const ViewReferenceDocument = React.lazy(() => import('./master/views/view-reference-document-master'));
const ViewRoleRight = React.lazy(() => import('./master/views/view-role-right-master'));
// const ViewUnit = React.lazy(() => import('./master/views/view-unit-master'));
const ViewDesignation = React.lazy(() => import('./master/views/view-designation-master'));
const ViewUser = React.lazy(() => import('./master/views/view-user-master'));
// const ViewAutoNotification = React.lazy(() => import('./master/views/view-autonotification-master'));
const ApiTest = React.lazy(() => import('./master/views/api-test'));
const ViewUserLogs = React.lazy(() => import('./master/views/view-user-logs'));
const ViewUserErrors = React.lazy(() => import('./master/views/view-user-errors'));


const routes = [


  { path: '/master/dashboard', name: 'Dashboard', component: CcmDashboard },
  { path: '/master/ai-drafting', name: 'AI Drafting', component: CcmAiDrafting },
  { path: '/master/project-master', name: 'Project', component: Project },
  { path: '/master/project-master-details', name: 'Project Details', component: ProjectDetails },
  // { path: '/master/variation-order-master', name: 'Variation Order', component: VariationOrder },
  // { path: '/master/view-variation-order-master', name: 'View Variation Order', component: ViewVariationOrder },
  // { path: '/master/monthly-breakup-master', name: 'Monthly BreakUp', component: MonthlyBreakUp },
  // { path: '/master/modify-monthly-breakup-master', name: 'Modify/View Monthly BreakUp', component: ManageMonthlyBreakupDetails },
  // { path: '/master/contract-master', name: 'Contract', component: Contract },
  // { path: '/master/activity-group-master', name: 'Activity Group', component: ActivityGroup },
  // { path: '/master/activity-master', name: 'Activity', component: Activity },
  // { path: '/master/contractor-master', name: 'Contractor', component: Contractor },
  { path: '/master/department-master', name: 'Department', component: Department },
  // { path: '/master/location-master', name: 'Location', component: Location },
  { path: '/master/module-group-master', name: 'Module Group', component: ModuleGroup },
  { path: '/master/module-master', name: 'Module', component: Module },
  { path: '/master/role-master', name: 'Role', component: Role },
  // { path: '/master/reference-document-master', name: 'Reference Document', component: ReferenceDocument },
  { path: '/master/role-right-master', name: 'Role Right Details', component: RoleRight },
  { path: '/master/user-role-master', name: 'User Role', component: UserRole },
  { path: '/master/view-user-role-master', name: 'View User Role', component: ViewUserRole },
  // { path: '/master/unit-master', name: 'Unit', component: Unit },
  { path: '/master/designation-master', name: 'Designation', component: Designation },
  { path: '/master/user-master', name: 'User', component: User },
  // { path: '/master/autonotification-master', AutoNotification: 'User', component: AutoNotification },
  // { path: '/master/lookup-master', name: 'Lookup', component: LookupMaster },
  // { path: '/safety/lookup', name: 'Lookup', component: LookupMaster },
  { path: '/master/view-user-logs', name: 'View User Logs', component: ViewUserLogs },
  { path: '/master/view-user-errors', name: 'View User Errors', component: ViewUserErrors },
  // { path: '/master/view-activity-group-master', name: 'View Activity Group', component: ViewActivityGroup },
  { path: '/master/view-project-master', name: 'View Project', component: ViewProject },
  { path: '/master/view-project-master-details', name: 'View Project Details', component: ViewProjectDetails },
  // { path: '/master/view-contract-master', name: 'View Contract', component: ViewContract },
  // { path: '/master/view-contractor-master', name: 'View Contractor', component: ViewContractor },
  // { path: '/master/view-activity-master', name: 'View Activity', component: ViewActivity },
  { path: '/master/view-department-master', name: 'View Department', component: ViewDepartment },
  // { path: '/master/view-location-master', name: 'View Location', component: ViewLocation },
  { path: '/master/view-module-group-master', name: 'View Module Group', component: ViewModuleGroup },
  { path: '/master/view-module-master', name: 'View Module', component: ViewModule },
  { path: '/master/view-role-master', name: 'View Role', component: ViewRole },
  // { path: '/master/view-reference-document-master', name: 'View Role', component: ViewReferenceDocument },
  { path: '/master/view-role-right-master', name: 'View Role Right Details', component: ViewRoleRight },
  // { path: '/master/view-unit-master', name: 'View Unit', component: ViewUnit },
  { path: '/master/view-designation-master', name: 'View Designation', component: ViewDesignation },
  { path: '/master/view-user-master', name: 'View User', component: ViewUser },
  // { path: '/master/view-autonotification-master', name: 'View Auto Notificaiton', component: ViewAutoNotification },
  { path: '/master/api-test', name: 'Fire Query', component: ApiTest },




];

export default routes;
