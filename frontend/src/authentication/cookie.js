// cookie.js
export function setCookie(cname, cvalue, minuts) {
  let d = new Date();
  d.setTime(d.getTime() + (minuts * 60 * 1000));
  let expires = 'expires=' + d.toUTCString();
  document.cookie = cname + '=' + cvalue + ';' + expires + ';path=/';
}

export function getSession(cname) {
  let name = cname + '=';
  let ca = document.cookie.split(';');
  
  for(let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) === 0) {
      return c.substring(name.length, c.length);
    }
  }

  return '';
}

// ✅ ADD THIS BACK
export function checkSession() {    
  let userId = getSession('UserId');
  let tokenKey = "token" + userId;
  let user = getSession(tokenKey);
  if (user !== '') {
    return user;
  } else {
    return null;
  }
}

// ✅ ADD THIS HELPER (recommended from previous fix)
export function isExternalLoginActive() {
  const value = getSession('isExternalLogin');
  return value === 'true';
}

export function resetSession() {
  let userId = getSession('UserId');
  let tokenKey = "token" + userId;
  
  // Only clear external login cookies
  setCookie(tokenKey, "", 0);
  setCookie('UserId', '', 0);
  setCookie('UserName', '', 0);
  setCookie('isExternalLogin', '', 0);
  setCookie('IsRights', '', 0);
  setCookie('EmployeeName', '', 0);
  
  // Don't clear MSAL cookies for Azure login
  sessionStorage.clear();
}

export function resetInternalSession() {  
  setCookie('msal.69d0a1d2-9fca-4ef5-a0bc-7b24e925b59d.idtoken', "", 0);
  setCookie('msal.idtoken', '', 0);
  setCookie('msal.client.info', '', 0);
  setCookie('msal.69d0a1d2-9fca-4ef5-a0bc-7b24e925b59d.client.info', '', 0);
}

export function setSession(UserId, UserName, tokenKey, tokenValue, isExternalLogin, EmployeeName) {
  const timeout = import.meta.env.SESSION_TIMEOUT || 480; // Default 8 hours
  
  setCookie('UserId', UserId, timeout);
  setCookie(tokenKey, tokenValue, timeout);
  setCookie('UserName', UserName, timeout);
  setCookie('isExternalLogin', isExternalLogin, timeout);
  setCookie('EmployeeName', EmployeeName, timeout);
}

export function setNewSession(key, value) {
  const timeout = import.meta.env.SESSION_TIMEOUT || 480; // Default 8 hours
  setCookie(key, value, timeout); 
}