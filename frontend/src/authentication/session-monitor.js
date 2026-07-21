import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import { getSession, setSession, resetSession } from '../authentication/cookie';
import { authProvider } from '../authentication/auth-provider';
import moment from 'moment';
import CommonUtilityController from '../master/controller/common-utility-controller';
import env from "react-dotenv";

export function SessionMonitor() {
  const [idleModal, setIdleModal] = useState(false);
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');
  const [tokenValue, setTokenValue] = useState('');
  const [isExternalLogin, setIsExternalLogin] = useState(false);

  let idleTimeout = 1000 * 60 * (parseInt(env.SESSION_REMINDER) || 2998);
  let idleLogout = 1000 * 60 * (parseInt(env.SESSION_TIMEOUT) || 3000);
  let idleEvent;
  let idleLogoutEvent;

  const events = ['mousemove', 'click', 'keypress'];

  const sessionTimeout = () => {
    if (!!idleEvent) clearTimeout(idleEvent);
    if (!!idleLogoutEvent) clearTimeout(idleLogoutEvent);
    idleEvent = setTimeout(() => setIdleModal(true), idleTimeout);
    idleLogoutEvent = setTimeout(() => logOut(), idleLogout);
  };

  const extendSession = () => {
    if (getSession('isExternalLogin')) {
      let tokenKey = "token" + userId;
      setSession(userId, userName, tokenKey, tokenValue, true);
    } else {
      window.location.reload();
    }
    setIdleModal(false);
  }

  const saveUserLogDetails = async (userLogs) => {
    try {
      await new CommonUtilityController().saveUserLogDetails(userLogs);
    } catch (error) {
      // best-effort audit log; ignore failures
    }
  };

  const logOut = () => {
    let tokenKey = "token" + getSession("UserId");
    let userid = getSession("UserId");
    let token = getSession(tokenKey);
    if (getSession('isExternalLogin')) {
      resetSession();
      window.location.reload();
    } else {
      authProvider.logout();
      resetSession();
      window.location.reload();
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

    saveUserLogDetails(userLogs);
    setIdleModal(false);
  }

  useEffect(() => {
    setUserId(getSession('UserId'));
    setUserName(getSession('UserName'));
    let tokenKey = "token" + getSession('UserId');
    setTokenValue(getSession(tokenKey));
    setIsExternalLogin(getSession('isExternalLogin'));
    for (let e in events) {
      window.addEventListener(events[e], sessionTimeout);
    }
    return () => {
      for (let e in events) {
        window.removeEventListener(events[e], sessionTimeout);
      }
    }
  }, []);

  return (
    <Dialog open={idleModal} onClose={() => logOut()}>
      <DialogTitle>Session expire warning</DialogTitle>
      <DialogContent>
        Your session will expire in {idleLogout / 60 / 1000} minutes. Do you want to extend the session?
      </DialogContent>
      <DialogActions>
        <Button variant="contained" color="info" onClick={() => logOut()}>Logout</Button>
        <Button variant="contained" color="success" onClick={() => extendSession()}>Extend session</Button>
      </DialogActions>
    </Dialog>
  );
}
