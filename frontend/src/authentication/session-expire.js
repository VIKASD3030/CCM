import React, { Component } from 'react';
import { getSession, setSession, resetSession } from '../authentication/cookie';
import { authProvider } from '../authentication/auth-provider';
import moment from 'moment';
import CommonUtilityController from '../master/controller/common-utility-controller';

class SessionExpire extends Component {
  constructor(props) {
    super(props);
    let tokenKey = "token" + getSession('UserId');
    this.state = {
      loading: false,
      userId: getSession('UserId'),
      userName: getSession('UserName'),
      tokenValue: getSession(tokenKey)
    };
  }

  extendSession = () => {
    let { userId, userName, tokenValue } = this?.state;
    if (getSession('isExternalLogin')) {
      let tokenKey = "token" + userId;
      setSession(userId, userName, tokenKey, tokenValue, true);
    } else {
      window.location.reload();
    }
  }

  saveUserLogDetails = async (userLogs) => {
    this.setState({ loading: true });
    await new CommonUtilityController().saveUserLogDetails(userLogs)
      .then((result) => {
        this.setState({ loading: false });
      })
      .catch(error => {
        this.setState({ loading: false });
      });
  }

  logOut = () => {
    let tokenKey = "token" + getSession("UserId");
    let userid = getSession("UserId");
    let token = getSession(tokenKey);
    if (getSession('isExternalLogin')) {
      resetSession();
      window.location.reload();
      window.location.href = "/";
    } else {
      authProvider.logout();
      resetSession();
      window.location.reload();
      window.location.href = "/";
    }

    let userLogs = {
      UserLogId: 0,
      UserId: userid,
      IPAddress: null,
      MACAddress: null,
      LogInStatus: 2,
      LoginDate: moment().format('YYYY-MM-DD HH:mm:ss'),
      LogOutDate: moment().format('YYYY-MM-DD HH:mm:ss'),
      CreatedBy: userid,
      CreatedDate: moment().format('YYYY-MM-DD HH:mm:ss'),
      LockedBy: userid,
      LockedDate: moment().format('YYYY-MM-DD HH:mm:ss'),
      SecurityId: userid,
      TokenValue: token
    }

    this.saveUserLogDetails(userLogs);
  }
}

export default SessionExpire;
