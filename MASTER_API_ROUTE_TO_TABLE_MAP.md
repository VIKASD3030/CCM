# Master/Admin API Route To Table Map

This file maps the current backend Master/Admin API routes to the SQLAlchemy model and the physical database table they use.

Notes:
- Unless explicitly marked otherwise, the table is in the `Master` schema.
- "Physical table" means `<schema>.<table>`.
- Some routes are not table-backed. Those are called out separately.
- `public.*` tables are application/runtime tables, not Master/Admin panel master-data tables.

## `/common` Master Data Routes

| Method | Route | Model | Physical Table | Notes |
|---|---|---|---|---|
| GET/POST | `/common/getLookupDetails` | `Lookup` | `Master.lookups` | Reference lookup values |
| POST | `/common/saveLookupDetails` | `Lookup` | `Master.lookups` | |
| POST | `/common/deleteLookupDetails` | `Lookup` | `Master.lookups` | Hard delete helper |
| GET/POST | `/common/getDepartments` | `Department` | `Master.departments` | |
| POST | `/common/saveDepartmentDetails` | `Department` | `Master.departments` | |
| POST | `/common/saveDepartmentBulkDetails` | `Department` | `Master.departments` | Bulk upsert |
| POST | `/common/deleteDepartmentDetails` | `Department` | `Master.departments` | Hard delete helper |
| GET | `/common/getLocations` | `Location` | `Master.locations` | |
| POST | `/common/saveLocationDetails` | `Location` | `Master.locations` | |
| POST | `/common/deleteLocationDetails` | `Location` | `Master.locations` | Hard delete helper |
| GET/POST | `/common/getDesignations` | `Designation` | `Master.designations` | |
| POST | `/common/saveDesignationDetails` | `Designation` | `Master.designations` | |
| POST | `/common/deleteDesignationDetails` | `Designation` | `Master.designations` | Hard delete helper |
| GET | `/common/getUnits` | `Unit` | `Master.units` | |
| POST | `/common/saveUnitDetails` | `Unit` | `Master.units` | |
| POST | `/common/SaveUnitBulkDetails` | `Unit` | `Master.units` | Bulk upsert |
| POST | `/common/deleteUnitDetails` | `Unit` | `Master.units` | Hard delete helper |

## Activities / Work Packages

| Method | Route | Model | Physical Table | Notes |
|---|---|---|---|---|
| GET | `/common/getActivityGroup` | `ActivityGroup` | `Master.activity_groups` | |
| POST | `/common/saveActivityGroupDetails` | `ActivityGroup` | `Master.activity_groups` | Soft delete pattern via `status` |
| POST | `/common/deleteActivityGroupDetails` | `ActivityGroup` | `Master.activity_groups` | Soft delete |
| GET | `/common/getActivity` | `Activity` | `Master.activities` | |
| GET | `/common/getSubActivity` | `Activity` | `Master.activities` | Filtered by `IsSubActivity` |
| POST | `/common/saveActivityDetails` | `Activity` | `Master.activities` | |
| POST | `/common/saveActivityBulkDetails` | `Activity` | `Master.activities` | Bulk upsert |
| POST | `/common/deleteActivityDetails` | `Activity` | `Master.activities` | Soft delete |
| GET | `/common/getWorkPackage` | `WorkPackage` | `Master.work_packages` | |

## Contractors / Contracts

| Method | Route | Model | Physical Table | Notes |
|---|---|---|---|---|
| GET | `/common/getContractors` | `Contractor` | `Master.contractors` | |
| POST | `/common/saveContractorDetails` | `Contractor` | `Master.contractors` | |
| POST | `/common/deleteContractorDetails` | `Contractor` | `Master.contractors` | Soft delete |
| POST | `/common/getContracts` | `Contract` | `Master.contracts` | |
| POST | `/common/saveContractDetails` | `Contract` | `Master.contracts` | |
| POST | `/common/deleteContractDetails` | `Contract` | `Master.contracts` | Soft delete |

## Roles / Role Rights (Admin Panel Layer)

These are the admin-panel/master-data role tables, not the auth RBAC tables.

| Method | Route | Model | Physical Table | Notes |
|---|---|---|---|---|
| GET | `/common/getRoles` | `CommonRole` | `Master.common_roles` | Admin role master |
| POST | `/common/saveRoles` | `CommonRole` | `Master.common_roles` | |
| POST | `/common/deleteRoles` | `CommonRole` | `Master.common_roles` | Soft delete |
| GET | `/common/getRoleRightDetails` | `RoleRight` | `Master.role_rights` | |
| POST | `/common/saveRoleRightDetails` | `RoleRight` | `Master.role_rights` | |
| POST | `/common/deleteRoleRightDetails` | `RoleRight` | `Master.role_rights` | Soft delete |

## Modules / Module Groups (Admin UI Menu Layer)

These are the admin-editable UI menu tables, not the auth RBAC `Master.modules` table.

| Method | Route | Model | Physical Table | Notes |
|---|---|---|---|---|
| POST | `/common/getModules` | `UiModule` | `Master.ui_modules` | |
| POST | `/common/saveModuleDetails` | `UiModule` | `Master.ui_modules` | |
| POST | `/common/deleteModuleDetails` | `UiModule` | `Master.ui_modules` | Soft delete |
| GET/POST | `/common/getModuleGroups` | `ModuleGroup` | `Master.module_groups` | Both GET and POST variants exist |
| POST | `/common/saveModuleGroupDetails` | `ModuleGroup` | `Master.module_groups` | |
| POST | `/common/deleteModuleGroupDetails` | `ModuleGroup` | `Master.module_groups` | Soft delete |

## Projects / PMO

| Method | Route | Model | Physical Table | Notes |
|---|---|---|---|---|
| GET/POST | `/common/getProjects` | `ProjectMaster` | `Master.project_master` | Admin/master project list |
| POST | `/common/saveProjectDetails` | `ProjectMaster` | `Master.project_master` | |
| POST | `/common/deleteProjectDetails` | `ProjectMaster` | `Master.project_master` | Soft delete |
| POST | `/common/getProjectDetails` | `ProjectDetail` | `Master.project_details` | PMO/project detail rows |
| POST | `/common/saveProjectDetailsData` | `ProjectDetail` | `Master.project_details` | |
| POST | `/common/deleteProjectDetailsData` | `ProjectDetail` | `Master.project_details` | Soft delete |

## User Directory / User Roles / Filters

These are the admin-panel directory tables, not the actual auth login user table.

| Method | Route | Model | Physical Table | Notes |
|---|---|---|---|---|
| POST | `/common/getUsers` | `DirectoryUser` | `Master.user_directory` | Admin directory users |
| POST | `/common/getUserDetails` | `DirectoryUser` | `Master.user_directory` | If `UserName` is passed for OTP login, this route instead reads `Master.users` auth users and returns token/OTP payload |
| POST | `/common/saveUserDetails` | `DirectoryUser` | `Master.user_directory` | |
| POST | `/common/deleteUserDetails` | `DirectoryUser` | `Master.user_directory` | Soft delete |
| GET | `/common/getUserRoles` | `UserRole` + `UserAccessFilter` | `Master.user_roles` + `Master.user_access_filters` | Returns aggregated BusinessUnitIds / BusinessLineIds / ProjectIds |
| POST | `/common/saveUserRoles` | `UserRole` + `UserAccessFilter` | `Master.user_roles` + `Master.user_access_filters` | Saves role row and replaces filter rows |
| POST | `/common/saveUserRoleDetails` | `UserRole` + `UserAccessFilter` | `Master.user_roles` + `Master.user_access_filters` | Alias kept for frontend compatibility |
| POST | `/common/deleteUserRoles` | `UserRole` + `UserAccessFilter` | `Master.user_roles` + `Master.user_access_filters` | Soft delete role row, delete filter rows |
| POST | `/common/deleteUserRoleDetails` | `UserRole` + `UserAccessFilter` | `Master.user_roles` + `Master.user_access_filters` | Alias kept for frontend compatibility |
| POST | `/common/GetUserAccessFilters` | `UserAccessFilter` | `Master.user_access_filters` | Raw filter rows |
| GET | `/common/getApproverRoles` | `ApproverRole` | `Master.approver_roles` | Currently just lists rows |

## Logs

| Method | Route | Model | Physical Table | Notes |
|---|---|---|---|---|
| POST | `/common/getUserLogs` | `UserLog` | `Master.user_logs` | `UserName` is enriched from auth users where possible |
| POST | `/common/saveUserLogDetails` | `UserLog` | `Master.user_logs` | Used by auth/session flows |
| POST | `/common/getErrorLogs` | `ErrorLog` | `Master.error_logs` | |

## Reference Documents / Misc

| Method | Route | Model | Physical Table | Notes |
|---|---|---|---|---|
| GET | `/common/getDocuments` | `ReferenceDocument` | `Master.reference_documents` | |
| POST | `/common/saveDocuments` | `ReferenceDocument` | `Master.reference_documents` | |
| POST | `/common/deleteDocuments` | `ReferenceDocument` | `Master.reference_documents` | Soft delete |

## Variation Orders

| Method | Route | Model | Physical Table | Notes |
|---|---|---|---|---|
| GET | `/common/getVariationOrderDetails` | `VariationOrder` | `Master.variation_orders` | |
| POST | `/common/saveVariationOrderData` | `VariationOrder` | `Master.variation_orders` | |
| POST | `/common/deleteVariationOrderData` | `VariationOrder` | `Master.variation_orders` | Soft delete |

## Auto Notifications

| Method | Route | Model | Physical Table | Notes |
|---|---|---|---|---|
| GET | `/common/GetAutoNotification` | `AutoNotification` | `Master.auto_notifications` | Supports both `NotificationName` and legacy `NotificaionName` payload key |
| POST | `/common/saveAutoNotificationDetails` | `AutoNotification` | `Master.auto_notifications` | |
| POST | `/common/deleteAutoNotificationDetails` | `AutoNotification` | `Master.auto_notifications` | Soft delete |

## Monthly Breakup

| Method | Route | Model | Physical Table | Notes |
|---|---|---|---|---|
| POST | `/common/getMonthlyBreakUpDetailsData` | `MonthlyBreakup` + `EstimationMonth` | `Master.monthly_breakups` + `Master.estimation_months` | Returns `{ parentData, childData }` |
| POST | `/common/saveMonthlyBreakUpDetailsData` | `MonthlyBreakup` + `EstimationMonth` | `Master.monthly_breakups` + `Master.estimation_months` | Saves parent, replaces child rows |
| POST | `/common/deleteMontlyBreakUpDetailsData` | `MonthlyBreakup` + `EstimationMonth` | `Master.monthly_breakups` + `Master.estimation_months` | Soft deletes parent and child rows |
| GET | `/common/getEstimationMonths` | `EstimationMonth` | `Master.estimation_months` | Flat child row list |

## Auth RBAC API (`/api/roles`)

These are not the admin-panel `common_roles` / `role_rights` tables. They are the real auth/RBAC tables used by permission enforcement.

| Method | Route | Model | Physical Table | Notes |
|---|---|---|---|---|
| GET | `/api/roles` | `Role` + `RolePermission` | `Master.roles` + `Master.role_permissions` | Returns roles with permission matrix |
| GET | `/api/roles/modules` | `Module` | `Master.modules` | Auth permission modules |
| POST | `/api/roles` | `Role` | `Master.roles` | Create auth role |
| PUT | `/api/roles/{name}` | `Role` | `Master.roles` | Update auth role |
| DELETE | `/api/roles/{name}` | `Role` | `Master.roles` | Delete auth role |
| PUT | `/api/roles/{name}/permissions` | `RolePermission` | `Master.role_permissions` | Bulk upsert permission matrix |

## Non-Table-Backed / Utility Routes

| Method | Route | Backing | Notes |
|---|---|---|---|
| GET | `/verifyDbConnection` | direct `SELECT 1` | Health/connection check |
| GET | `/common/verifyDbConnection` | direct `SELECT 1` | Alias |
| POST | `/common/getTestApi` | none | Echo/test endpoint |
| POST | `/common/isRecordExists` | helper over current relational master routes | Duplicate-check helper, no direct table |
| POST/GET | `/common/getUserRights` | `_menu.py` static builder | Not DB-backed |
| POST | `/common/updateTourStatus` | none | Stub returns `{"status": 1}` |
| POST | `/common/saveProjectAttachment` | file upload service | Not a table CRUD endpoint |
| POST | `/common/saveContractAttachment` | file upload service | Not a table CRUD endpoint |
| POST | `/common/saveContractorAttachment` | file upload service | Not a table CRUD endpoint |
| POST | `/common/saveDocumentAttachment` | file upload service | Not a table CRUD endpoint |
| POST | `/email/sendEmail` | email service | Not DB-backed CRUD |

## Important Distinctions

- `Master.project_master` is different from `public.projects`.
- `Master.user_directory` is different from `Master.users`.
- `Master.common_roles` is different from `Master.roles`.
- `Master.ui_modules` is different from `Master.modules`.

If you are adding data from the Master/Admin panel, you usually want the `Master.*` tables listed in the `/common` sections above, not the `public.*` operational tables.
