const LoginState = {
    UserId: 0,
    UserName: "",
    AdUserName:"",
    EmployeeNo:"",
    EmployeeName:"",
    Department:"",
    Designation:"",
    EmailId: "",    
    CurrentDate:null ,
    LockedBy:null, 
    LockedDate:null,
    SecurityId:null,  
    IsExternalUser:false,
    IsLoggedin:false,
    UserLocation:'',
    TourStatus: 0, // 0=Pending, 1=Completed, 2=Skipped
    
    // Method to get user from LoginState
    getUser: function() {
      return {
        UserId: this.UserId,
        UserName: this.UserName,
        AdUserName: this.AdUserName,
        EmployeeNo: this.EmployeeNo,
        EmployeeName: this.EmployeeName,
        Department: this.Department,
        Designation: this.Designation,
        EmailId: this.EmailId,
        IsExternalUser: this.IsExternalUser,
        IsLoggedin: this.IsLoggedin,
        UserLocation: this.UserLocation,
        TourStatus: this.TourStatus
      };
    },
    
    // Method to set user in LoginState
    setUser: function(userData) {
      if (!userData) return;
      
      this.UserId = userData.UserId || this.UserId;
      this.UserName = userData.UserName || this.UserName;
      this.AdUserName = userData.AdUserName || this.AdUserName;
      this.EmployeeNo = userData.EmployeeNo || this.EmployeeNo;
      this.EmployeeName = userData.EmployeeName || this.EmployeeName;
      this.Department = userData.Department || this.Department;
      this.Designation = userData.Designation || this.Designation;
      this.EmailId = userData.EmailId || this.EmailId;
      this.IsExternalUser = userData.IsExternalUser !== undefined ? userData.IsExternalUser : this.IsExternalUser;
      this.IsLoggedin = userData.IsLoggedin !== undefined ? userData.IsLoggedin : this.IsLoggedin;
      this.UserLocation = userData.UserLocation || this.UserLocation;
      this.TourStatus = userData.TourStatus !== undefined ? userData.TourStatus : this.TourStatus;
    }
  };

export default LoginState