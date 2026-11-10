import * as React from 'react';
import './login.css';
import { AzureAD, LoginType, AuthenticationState } from 'react-aad-msal';
import { basicReduxStore } from '../reduxStore';
import { setSession, setNewSession } from './cookie';
import LoginState from './loginState';
import PrivateRoute from '../private-route';
import ExternalDashboard from '../external-dashboard';
import { authProvider } from './auth-provider';
import CommonUtilityController from '../master/controller/common-utility-controller';
import config from '../config/config';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import '../ccm/ui/ccm-ui.css';
import { jwtDecode } from 'jwt-decode';

class Login extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      users: {
        userid: 0,
        username: '',
        adusername: '',
        password: '',
        emailid: '',
        isapprover: false,
        approverid: 0,
        approveremployeeno: '',
        approveremployeename: '',
        approveremailid: '',
        loginmsg: '',
        islogin: false,
        visible: false,
        loading: false,
        isExternalLogin: false,
        UserName: '',
        UserId: '',
        otp: '',
        tokenValue: '',
        loginEnabled: false,
        TourStatus: 0
      },
      loginValues: { UserName: '', Password: '' },
      loginErrors: {},
      snackbar: { open: false, severity: 'success', message: '' },
    };

    const options = authProvider.getProviderOptions();
    options.loginType = LoginType.Popup;
    authProvider.setProviderOptions(options);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  validateToken = (token) => {
    if (!token) return false;
    try {
      const decoded = jwtDecode(token);
      const now = Math.floor(Date.now() / 1000);
      return decoded.exp && decoded.exp > now;
    } catch (err) {
      return false;
    }
  }

  async componentDidMount() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.setState({ isExternalLogin: false });
    await this.verifyDbConnection();
  }

  async verifyDbConnection() {
    if (config.authMode !== 'legacy') {
      // One-backend mode: sign-in doesn't depend on the old backend being up.
      this.setState({ loginEnabled: true, loading: false });
      return;
    }
    this.setState({ loading: true });
    setNewSession("emailUrl", "");
    await new CommonUtilityController().verifyDbConnection()
      .then((result) => {
        this.setState({ loginEnabled: true, loading: false });
        if (result != null) {
          let url = window.location.href;
          let path = url.split("#");
          if (path.length > 1) {
            if (path[1] !== '/' && path[1] !== '/dashboard') {
              setNewSession("emailUrl", path[1]);
            }
          }
        }
      })
      .catch(error => {
        this.setState({ loginEnabled: false });
        this.notify('error', 'Database/API Connection Issue!');
      });
  }

  notify = (severity, message) => this.setState({ snackbar: { open: true, severity, message } });
  closeSnackbar = () => this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));

  handleLoginField = (field) => (e) => {
    const value = e.target.value;
    this.setState((s) => ({
      loginValues: { ...s.loginValues, [field]: value },
      loginErrors: { ...s.loginErrors, [field]: undefined },
    }));
  };

  validateLoginForm = () => {
    const { loginValues } = this.state;
    const errors = {};
    if (!loginValues.UserName?.trim()) errors.UserName = 'Username is required';
    if (!loginValues.Password?.trim()) errors.Password = 'OTP is required';
    this.setState({ loginErrors: errors });
    return Object.keys(errors).length === 0;
  };

  onLogin = async (e) => {
    e.preventDefault();
    if (!this.validateLoginForm()) return;
    const { loginValues, otp, UserId, tokenValue } = this.state;
    if (loginValues.Password == otp) {
      let tokenKey = "token" + UserId;
      const now = new Date();
      const formattedNow = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0') + ' ' +
        String(now.getHours()).padStart(2, '0') + ':' +
        String(now.getMinutes()).padStart(2, '0') + ':' +
        String(now.getSeconds()).padStart(2, '0');
      let userLogs = {
        UserLogId: 0,
        UserId: UserId,
        IPAddress: null,
        MACAddress: null,
        LogInStatus: 1,
        LoginDate: formattedNow,
        LogOutDate: formattedNow,
        CreatedBy: UserId,
        CreatedDate: formattedNow,
        LockedBy: UserId,
        LockedDate: formattedNow,
        SecurityId: UserId,
        TokenValue: tokenValue
      }
      setSession(UserId, loginValues.UserName, tokenKey, tokenValue, true);
      setNewSession("EmployeeName", LoginState.EmployeeName)
      setNewSession("TourStatus", this.state.TourStatus)
      this.saveUserLogDetails(userLogs);
      this.setState({ isExternalLogin: true });
    }
    else {
      this.notify('error', 'Invalid OTP!');
    }
  };

  // ===== TEMPORARY DEV-ONLY BYPASS — REMOVE THIS METHOD =====
  // Logs straight in as vdwivedi2@systra.info via backend POST /api/auth/dev-login,
  // skipping the Microsoft popup entirely. To revert: change the "Login" button's
  // onClick back to {login} and delete this method + the dev-login backend route.
  devLogin = async () => {
    this.setState({ loading: true });
    try {
      const response = await fetch(`${config.apiUrl}/api/auth/dev-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'vdwivedi2@systra.info' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || 'Dev login failed');
      setSession(data.user.id, data.user.email, 'token' + data.user.id, data.access_token, true, data.user.name);
      this.setState({ isExternalLogin: true, loading: false });
    } catch (err) {
      this.setState({ loading: false });
      this.notify('error', err.message || 'Dev login failed');
    }
  }
  // ===== END TEMPORARY DEV-ONLY BYPASS =====

  // Local testing without Microsoft sign-in (development builds only, when
  // VITE_DEV_LOGIN_EMAIL is set). Starts a session for that email; no backend call.
  localLogin = () => {
    const email = config.devLoginEmail;
    if (!email) return;
    setSession(email, email, 'token' + email, '', true, email.split('@')[0]);
    this.setState({ isExternalLogin: true });
  }

  sendOTP = () => {
    let { loginValues } = this.state;
    if (!loginValues.UserName?.trim()) {
      this.notify('error', 'User Name is required!');
      return false;
    }
    this.getUserInfo(loginValues.UserName);
  }

  async getUserInfo(userName) {
    this.setState({ loading: true, tokenValue: '' });
    let regData = { 'UserName': userName, 'UserType': 'External' };
    await new CommonUtilityController().getUserInfo(regData)
      .then((result) => {
        this.setState({ loading: false });
        if (result.length > 0) {
          LoginState.UserId = result[0].UserId;
          LoginState.EmployeeName = result[0].EmployeeName;
          LoginState.TourStatus = result[0].TourStatus;

          const expires = new Date();
          expires.setDate(expires.getDate() + 365);
          document.cookie = `TourStatus=${LoginState.TourStatus}; expires=${expires.toUTCString()}; path=/`;

          this.setState({ otp: result[0].OTP, UserId: result[0].UserId, TourStatus: result[0].TourStatus, tokenValue: result[0].TokenValue })
          this.notify('success', `OTP has been sent to ${result[0].EmailId}`);
        }
        else {
          this.notify('error', 'Unauthorized user!');
        }
      })
      .catch(error => {
        this.setState({ loading: false });
        this.notify('error', 'Unauthorized user!');
      });
  }

  async saveUserLogDetails(userLogs) {
    this.setState({ loading: true });
    await new CommonUtilityController().saveUserLogDetails(userLogs)
      .then((result) => {
        this.setState({ loading: false });
      })
      .catch(error => {
        this.setState({ loading: false });
      });
  }

  render() {
    let { loginEnabled, isExternalLogin, loading, loginValues, loginErrors, snackbar, otp } = this.state;
    const legacy = config.authMode === 'legacy';

    if (isExternalLogin) {
      return (
        <div className="App">
          <React.Fragment>
            <PrivateRoute path='/' component={ExternalDashboard} />
          </React.Fragment>
        </div>
      )
    }

    return (
      <div>
        <AzureAD provider={authProvider} reduxStore={basicReduxStore}>
          {({ login, authenticationState }) => {
            const isInProgress = authenticationState === AuthenticationState.InProgress;
            const isUnauthenticated = authenticationState === AuthenticationState.Unauthenticated;
            if (!(isUnauthenticated || isInProgress)) return null;

            return (
              <div className="cx-login">
                <section className="cx-login-brand">
                  <span className="cx-logo-mark">C</span>
                  <h1>Draft the right reply, grounded in the project contract.</h1>
                  <p>CCM reads your contract volumes, outgoing and incoming letters per project, then drafts responses with the exact clauses cited.</p>
                  {[
                    ['Project-scoped knowledge', 'Every answer comes only from that project’s records'],
                    ['Clause citations', 'Each clause is verified against the source text'],
                    ['Review before send', 'Drafter, reviewer and approver audit trail'],
                  ].map(([title, text]) => (
                    <div className="cx-login-value" key={title}><i /><div><b>{title}</b><span>{text}</span></div></div>
                  ))}
                </section>

                <section className="cx-login-form">
                  <form onSubmit={this.onLogin} noValidate>
                    <div>
                      <h2>Sign in</h2>
                      <p className="cx-muted" style={{ margin: '6px 0 0' }}>Use your company account to continue.</p>
                    </div>
                    {legacy && !loginEnabled && !loading && (
                      <div className="cx-banner bad"><span className="cx-s12">Can't reach the CCM server. Check that the backend is running.</span></div>
                    )}
                    {/* Legacy mode keeps the temporary FastAPI dev-login bypass; one-backend mode uses real Microsoft sign-in. */}
                    <button type="button" className="cx-btn primary block" onClick={legacy ? this.devLogin : login} disabled={isInProgress || !loginEnabled}>
                      {isInProgress ? 'Signing in…' : 'Continue with Microsoft SSO'}
                    </button>
                    {config.devLoginEmail && (
                      <button type="button" className="cx-btn block" onClick={this.localLogin} title="Development builds only (VITE_DEV_LOGIN_EMAIL)">
                        Continue as {config.devLoginEmail} (local testing)
                      </button>
                    )}

                    {legacy && <>
                    <div className="cx-or">or sign in as an external user</div>

                    <div className="cx-field">
                      <label htmlFor="login-user">Username</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input id="login-user" className="cx-input" autoComplete="username" placeholder="name@company.com"
                          value={loginValues.UserName} onChange={this.handleLoginField('UserName')} />
                        <button type="button" className="cx-btn" onClick={this.sendOTP} disabled={!loginEnabled || loading}>
                          {otp ? 'Resend OTP' : 'Send OTP'}
                        </button>
                      </div>
                      {loginErrors.UserName && <span className="cx-s12" style={{ color: 'var(--cx-bad)' }}>{loginErrors.UserName}</span>}
                    </div>
                    <div className="cx-field">
                      <label htmlFor="login-otp">One-time password</label>
                      <input id="login-otp" className="cx-input" type="password" autoComplete="one-time-code" placeholder="••••••"
                        value={loginValues.Password} onChange={this.handleLoginField('Password')} />
                      {loginErrors.Password && <span className="cx-s12" style={{ color: 'var(--cx-bad)' }}>{loginErrors.Password}</span>}
                    </div>
                    <button type="submit" className="cx-btn block" disabled={!loginEnabled || loading}>
                      {loading ? 'Please wait…' : 'Sign in'}
                    </button>
                    </>}
                  </form>
                </section>
              </div>
            );
          }}
        </AzureAD>

        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={this.closeSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <Alert onClose={this.closeSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </div>
    );
  }
}
export default Login;
