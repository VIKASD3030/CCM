import React from 'react';
import base from './base-controller';

class CommonUtilityController extends React.Component {

      /*******************Api calling******************************/
        //database verification
         //get  projects
      async verifyDbConnection() {
            return await new base().httpGet("/verifyDbConnection");
      }

      // //get  projects
      // async getProjects() {
      //       return await new base().httpGet("/common/getProjects");
      // }

      //get  projects
      async getProjects(param) {
            return await new base().httpPost("/common/getProjects", param);
      }



      //get Work Package
      async getWorkPackages(projectId) {
            return await new base().httpGet("/common/getWorkPackage?projectId=" + projectId);
      }
      //get Activity Group 
      async getActivityGroups(projectId, contractId) {
            return await new base().httpGet("/common/getActivityGroup?projectId=" + projectId + "&contractId=" + contractId);
      }
      //get contractors
      async getContractors() {
            return await new base().httpGet("/common/getContractors");
      }

      //get Activity
      async getActivities(activityGroupId) {
            return await new base().httpGet("/common/getActivity?activityGroupId=" + activityGroupId);
      }

      //get Sub Activity
      async GetSubActivity(activityGroupId) {
            return await new base().httpGet("/common/getSubActivity?activityGroupId=" + activityGroupId);
      }
      //get Locations
      async getLocations() {
            return await new base().httpGet("/common/getLocations");
      }
      //get Departments
      async getDepartments(departmentId) {
            return await new base().httpGet("/common/getDepartments?DepartmentId=" + departmentId);
      }
      //get Contracts
      async getContracts(data) {
            return await new base().httpPost("/common/getContracts", data);
      }

      //get  roles
      async getApproverRoles() {
            return await new base().httpGet("/common/getApproverRoles?userId=" + 0);
      }

      //get  user rights
      async getUserRights(data) {
            return await new base().httpPost("/common/getUserRights", data);
      }
      //get  users
      async getUsers() {
            return await new base().httpPost("/common/getUsers");
      }

      //get  user details
      async getUserInfo(data) {
            return await new base().httpPost("/common/getUserDetails", data);
      }

      //update tour status
      async updateTourStatus(data) {
            return await new base().httpPost("/common/updateTourStatus", data);
}

      //get ModuleGroups
      async getModuleGroups(moduleGroupId) {
            return await new base().httpGet("/common/getModuleGroups?moduleGroupId=" + moduleGroupId);
      }

      //get Modules
      async getModules(data) {
            return await new base().httpPost("/common/getModules", data);
      }

      //get Roles
      async getRoles(roleId) {
            return await new base().httpGet("/common/getRoles?roleId=" + roleId);
      }

      //get Role Right
      async getRoleRightDetails(roleId) {
            return await new base().httpGet("/common/getRoleRightDetails?roleId=" + roleId);
      }

      //get  roles
      async getEstimationMonths() {
            return await new base().httpGet("/common/getEstimationMonths");
      }

      //send email 
      async sendEMail(data) {
            return await new base().httpPost("/email/sendEmail", data);
      }

      async getProjectDetails(data) {
            return await new base().httpPost("/common/getProjectDetails", data);
      }

      async saveProjectDetailsData(data) {
            return await new base().httpPost("/common/saveProjectDetailsData", data);
      }

      async deleteProjectDetailsData(data) {
            return await new base().httpPost("/common/deleteProjectDetailsData", data);
      }

      async getVariationOrderDetails(data) {
            return await new base().httpGet("/common/getVariationOrderDetails", data);
      }

      async saveVariationOrderData(data) {
            return await new base().httpPost("/common/saveVariationOrderData", data);
      }

      async deleteVariationOrderData(data) {
            return await new base().httpPost("/common/deleteVariationOrderData", data);
      }

      async saveMonthlyBreakUpDetailsData(data) {
            return await new base().httpPost("/common/saveMonthlyBreakUpDetailsData", data);
      }

      async deleteMontlyBreakUpDetailsData(data) {
            return await new base().httpPost("/common/deleteMontlyBreakUpDetailsData", data);
      }

      async getMonthlyBreakUpDetailsData(data) {
            return await new base().httpPost("/common/getMonthlyBreakUpDetailsData", data);
      }


      //********************Master************************************
      //save project
      async saveProjectDetails(data) {
            return await new base().httpPost("/common/saveProjectDetails", data);
      }
      //delete project
      async deleteProjectDetails(data) {
            return await new base().httpPost("/common/deleteProjectDetails", data);
      }

      //File Attachment
      async saveProjectAttachment(data) {
            return await new base().httpPostFormData("/common/saveProjectAttachment", data);
      }

      //File Attachment
      async saveContractorAttachment(data) {
            return await new base().httpPostFormData("/common/saveContractorAttachment", data);
      }

      //save activity
      async saveActivityDetails(data) {
            return await new base().httpPost("/common/saveActivityDetails", data);
      }
      //save upload activity
      async saveActivityBulkDetails(data) {
            return await new base().httpPost("/common/saveActivityBulkDetails", data);
      }

      //save unit bulk upload 
      async SaveUnitBulkDetails(data) {
            return await new base().httpPost("/common/SaveUnitBulkDetails", data)
      }

      //save unit bulk upload 
      async SaveDepartmentBulkDetails(data) {
            return await new base().httpPost("/common/saveDepartmentBulkDetails", data)
      }

      //delete activity
      async deleteActivityDetails(data) {
            return await new base().httpPost("/common/deleteActivityDetails", data);
      }
      //save activity group
      async saveActivityGroupDetails(data) {
            return await new base().httpPost("/common/saveActivityGroupDetails", data);
      }
      //delete activity group
      async deleteActivityGroupDetails(data) {
            return await new base().httpPost("/common/deleteActivityGroupDetails", data);
      }
      //save contract
      async saveContractDetails(data) {
            return await new base().httpPost("/common/saveContractDetails", data);
      }
      //delete contract
      async deleteContractDetails(data) {
            return await new base().httpPost("/common/deleteContractDetails", data);
      }
      //File Attachment
      async saveContractAttachment(data) {
            return await new base().httpPostFormData("/common/saveContractAttachment", data);
      }


      //save contractor
      async saveContractorDetails(data) {
            return await new base().httpPost("/common/saveContractorDetails", data);
      }
      //delete contractor
      async deleteContractorDetails(data) {
            return await new base().httpPost("/common/deleteContractorDetails", data);
      }

      //save Location Details
      async saveLocationDetails(data) {
            return await new base().httpPost("/common/saveLocationDetails", data);
      }
      //delete Location Details
      async deleteLocationDetails(data) {
            return await new base().httpPost("/common/deleteLocationDetails", data);
      }

      //save Department Details
      async saveDepartmentDetails(data) {
            return await new base().httpPost("/common/saveDepartmentDetails", data);
      }
      //delete Department Details
      async deleteDepartmentDetails(data) {
            return await new base().httpPost("/common/deleteDepartmentDetails", data);
      }
      //save Roles
      async saveRoles(data) {
            return await new base().httpPost("/common/saveRoles", data);
      }
      //delete Roles
      async deleteRoles(data) {
            return await new base().httpPost("/common/deleteRoles", data);
      }
      //save Role Right
      async saveRoleRightDetails(data) {
            return await new base().httpPost("/common/saveRoleRightDetails", data);
      }
      //delete Role Right
      async deleteRoleRightDetails(data) {
            return await new base().httpPost("/common/deleteRoleRightDetails", data);
      }
      //save ModuleGroup
      async saveModuleGroupDetails(data) {
            return await new base().httpPost("/common/saveModuleGroupDetails", data);
      }
      //delete ModuleGroup
      async deleteModuleGroupDetails(data) {
            return await new base().httpPost("/common/deleteModuleGroupDetails", data);
      }
      //save Module
      async saveModuleDetails(data) {
            return await new base().httpPost("/common/saveModuleDetails", data);
      }
      //delete Module
      async deleteModuleDetails(data) {
            return await new base().httpPost("/common/deleteModuleDetails", data);
      }

      //get Documents
      async getDocuments(documentId) {
            return await new base().httpGet("/common/getDocuments?documentId=" + documentId);
      }

      //save Documents
      async saveDocuments(data) {
            return await new base().httpPost("/common/saveDocuments", data);
      }
      //delete Documents
      async deleteDocuments(data) {
            return await new base().httpPost("/common/deleteDocuments", data);
      }
      //File Attachment
      async saveDocumentAttachment(data) {
            return await new base().httpPostFormData("/common/saveDocumentAttachment", data);
      }




      //======UNIT====
      //get unit
      async getUnits() {
            return await new base().httpGet("/common/getUnits");
      }

      //delete unit
      async deleteUnitDetails(data) {
            return await new base().httpPost("/common/deleteUnitDetails", data);
      }
      //save unit
      async saveUnitDetails(data) {
            return await new base().httpPost("/common/saveUnitDetails", data);
      }

      //======DESIGNATION======
      //get  designations
      async getDesignations() {
            return await new base().httpGet("/common/getDesignations");
      }

      //save Designation Details
      async saveDesignationDetails(data) {
            return await new base().httpPost("/common/saveDesignationDetails", data);
      }
      //delete Designation Details
      async deleteDesignationDetails(data) {
            return await new base().httpPost("/common/deleteDesignationDetails", data);
      }

      //=======AUTO NOTIFICATON======

      //get  projects
      async getAutoNotification() {
            return await new base().httpGet("/common/GetAutoNotification");
      }

      //save auto-notification
      async saveAutoNotificationDetails(data) {
            return await new base().httpPost("/common/saveAutoNotificationDetails", data);
      }
      //delete auto-notification
      async deleteAutoNotificationDetails(data) {
            return await new base().httpPost("/common/deleteAutoNotificationDetails", data);
      }

      //==========USERS=============
      //save user
      async saveUserDetails(data) {
            return await new base().httpPost("/common/saveUserDetails", data)
      }
      //delete User
      async deleteUserDetails(data) {
            return await new base().httpPost('/common/deleteUserDetails', data)
      }

      // ==============User Roles=============
      async saveUserRoles(data) {
            return await new base().httpPost("/common/saveUserRoles", data)
      }
      async getUserRoles(userId) {
            return await new base().httpGet("/common/getUserRoles?userId=" + userId);
      }
      //USER LOGS
      async getUserLogs(data) {
            return await new base().httpPost("/common/getUserLogs", data);
      }
      //USER ERRORS
      async getErrorLogs(data) {
            return await new base().httpPost("/common/getErrorLogs", data);
      }

      async deleteUserRoles(data) {
            return await new base().httpPost("/common/deleteUserRoles", data);
      }
      // ==============End User Roles=============
    //==========USER Logs=============
    async saveUserLogDetails(data) {
      return await new base().httpPost("/common/saveUserLogDetails", data)
}
     // ==============End User Logs=============
      //**************************************************************
      //************************File Upload and Download**************************************

      //file upload        
      async saveUploadFile(api, data) {
            return await new base().httpPostFormData(api, data);
      }
      //file download
      async downloadAttachment(path,type) {
            return await new base().httpGetDownload(path,type);
      }

      //api test post
      async getTestApi(data) {
            return await new base().httpPost("/common/getTestApi", data);
      }
      async isRecordExists(data) {
            return await new base().httpPost("/common/isRecordExists", data)
      }



      async GetUserAccessFilters(data) {
            return await new base().httpPost("/common/GetUserAccessFilters", data)
      }

      //======LOOKUP======
      async getLookupDetails(lookupId) {
            return await new base().httpGet("/common/getLookupDetails?LookupId=" + lookupId);
      }
      async saveLookupDetails(data) {
            return await new base().httpPost("/common/saveLookupDetails", data);
      }
      async deleteLookupDetails(data) {
            return await new base().httpPost("/common/deleteLookupDetails", data);
      }
}


export default CommonUtilityController