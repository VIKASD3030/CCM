"""Static admin menu tree for the MASTER/ADMIN sub-app.

`getUserRights` returns { parentData, childData } that the frontend's
external-layout menu-builder consumes:
  - parentData = module groups (ModuleGroupId, ModuleGroupName)
  - childData  = modules (ModuleGroupId, ModuleId, ParentModuleId=0 for top-level,
                 UserShownName, ModulePath) whose ModulePath matches routes.js

Kept as a plain data structure (not DB-backed) so the whole admin subsystem
stays self-contained and removable.
"""

# Two menu groups: Masters (construction/PM data) and Admin (users/roles/system).
# (group_id, group_name, [(label, route_path), ...]). Paths match frontend/src/routes.js.
_GROUPS = [
    (10, "CCM", [
        ("Dashboard", "/master/dashboard"),
        ("AI Drafting", "/master/ai-drafting"),
    ]),
    (1, "Masters", [
        ("Project", "/master/project-master"),
        ("Contract", "/master/contract-master"),
        ("Contractor", "/master/contractor-master"),
        ("Activity Group", "/master/activity-group-master"),
        ("Activity", "/master/activity-master"),
        ("Variation Order", "/master/variation-order-master"),
        ("Monthly BreakUp", "/master/monthly-breakup-master"),
        ("Department", "/master/department-master"),
        ("Designation", "/master/designation-master"),
        ("Location", "/master/location-master"),
        ("Unit", "/master/unit-master"),
        ("Lookup", "/master/lookup-master"),
        ("Reference Document", "/master/reference-document-master"),
        ("Auto Notification", "/master/autonotification-master"),
    ]),
    (2, "Admin", [
        ("User", "/master/user-master"),
        ("User Role", "/master/user-role-master"),
        ("Role", "/master/role-master"),
        ("Role Right", "/master/role-right-master"),
        ("Module Group", "/master/module-group-master"),
        ("Module", "/master/module-master"),
        ("User Logs", "/master/view-user-logs"),
        ("User Errors", "/master/view-user-errors"),
        ("Fire Query", "/master/api-test"),
    ]),
]


def build_user_rights() -> dict:
    """Return { parentData, childData } for the admin menu."""
    parent_data = []
    child_data = []
    module_id = 0
    for group_id, group_name, modules in _GROUPS:
        parent_data.append({
            "ModuleGroupId": group_id,
            "ModuleGroupName": group_name,
            "BusinessUnitName": "",
            "key": group_id,
        })
        for label, path in modules:
            module_id += 1
            child_data.append({
                "ModuleGroupId": group_id,
                "ModuleId": module_id,
                "ParentModuleId": 0,
                "UserShownName": label,
                "ModulePath": path,
                "BusinessUnitName": "",
                "BusinessLineName": label,
                "key": module_id,
            })
    return {"parentData": parent_data, "childData": child_data}
