export default {
  items: [
    // CCM module
    {
      name: 'CCM',
      url: '/master',
      icon: 'icon-speedometer',
      children: [
        {
          name: 'Dashboard',
          url: '/master/dashboard',
          icon: 'icon-drop',
        },
        {
          name: 'AI Drafting',
          url: '/master/ai-drafting',
          icon: 'icon-drop',
        },
      ],
    },
    //master module
    {
      name: 'MASTER',
      url: '/master',
      icon: 'icon-layers',
      children: [
        {
          name: 'Project',
          url: '/master/project-master',
          icon: 'icon-drop',
        },        
        {
          name: 'View Project',
          url: '/master/view-project-master',
          icon: 'icon-drop'
        },                
        // {
        //   name: 'Contractor',
        //   url: '/master/contractor-master',
        //   icon: 'icon-drop',
        // },      
        // { name: 'View Contractor',
        //   url: '/master/view-contractor-master',
        //   icon: 'icon-drop' 
        // },             

        // {
        //   name: 'Contract',
        //   url: '/master/contract-master',
        //   icon: 'icon-drop',
        // },
        // { name: 'View Contract',
        //   url: '/master/view-contract-master', 
        //   icon: 'icon-drop' 
        // },
        // {
        //   name: 'Activity Group',
        //   url: '/master/activity-group-master',
        //   icon: 'icon-drop',
        // },
        // {
        //   name: 'View Activity Group',
        //   url: '/master/view-activity-group-master',
        //   icon: 'icon-drop'
        // },
        // {
        //   name: 'Activity',
        //   url: '/master/activity-master',
        //   icon: 'icon-drop',
        // },
        // {
        //   name: 'View Activity',
        //   url: '/master/view-activity-master',
        //   icon: 'icon-drop'
        //  },
        // {
        //   name: 'Reference Document',
        //   url: '/master/reference-document-master',
        //   icon: 'icon-drop',
        // },
        // {
        //   name: 'View Reference Document',
        //   url: '/master/view-reference-document-master',
        //   icon: 'icon-drop'
        // },
        {
          name: 'Department',
          url: '/master/department-master',
          icon: 'icon-drop',
        },
        { name: 'View Department',
          url: '/master/view-department-master',
          icon: 'icon-drop' },        
        // {
        //   name: 'Location',
        //   url: '/master/location-master',
        //   icon: 'icon-drop',
        // },
        // { name: 'View Location',
        //   url: '/master/view-location-master',
        //   icon: 'icon-drop' },
        //=======UNIT=========
        // {
        //   name: 'Unit',
        //   url: '/master/unit-master',
        //   icon: 'icon-drop'
        // },
        // { name: 'View Unit',
        //   url: '/master/view-unit-master',
        //   icon: 'icon-drop' },
        //=======DESIGNATION=========
        {
          name: 'Designation',
          url: '/master/designation-master',
          icon: 'icon-drop'
        },
        { name: 'View Designation', 
          url: '/master/view-designation-master',
          icon: 'icon-drop' },
        {
          name: 'Module Group',
          url: '/master/module-group-master',
          icon: 'icon-drop',
        },
        { name: 'View Module Group', 
          url: '/master/view-module-group-master',
          icon: 'icon-drop' },
        {
          name: 'Module',
          url: '/master/module-master',
          icon: 'icon-drop',
        },
        { name: 'View Module',
          url: '/master/view-module-master',
          icon: 'icon-drop' 
        },
        // {
        //   name: 'Lookup',
        //   url: '/master/lookup-master',
        //   icon: 'icon-drop'
        // },
        // {
        //   name: 'Auto Notification',
        //   url: '/master/autonotification-master',
        //   icon: 'icon-drop'
        // },
        // {
        //   name: 'View Auto Notification',
        //   url: '/master/view-autonotification-master',
        //   icon: 'icon-drop'
        // },
      ],
    }, //end of master
   //Admin module
    {
      name: 'Admin',
      url: '/admin',
      icon: 'icon-layers',
      children: [
        {
          name: 'User',
          url: '/master/user-master',
          icon: 'icon-drop'
        },
        { name: 'View User',
          url: '/master/view-user-master',
          icon: 'icon-drop'
         } ,
        {
          name: 'Role',
          url: '/master/role-master',
          icon: 'icon-drop',
        },
        { name: 'View Role',
          url: '/master/view-role-master',
          icon: 'icon-drop' },        
        {
          name: 'User Role',
          url: '/master/user-role-master',
          icon: 'icon-drop',
        },
        {
          name: 'View User Role',
          url: '/master/view-user-role-master',
          icon: 'icon-drop',
        },

        {
          name: 'Role Right Details',
          url: '/master/role-right-master',
          icon: 'icon-drop',
        },
        { name: 'View Role Rights',
          url: '/master/view-role-right-master',
          icon: 'icon-drop'
         },  

      ],
    },//end of admin
  ],
};
