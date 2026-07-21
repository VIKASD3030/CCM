import * as React from 'react';
import './login.css';
import { AzureAD, LoginType, AuthenticationState } from 'react-aad-msal';
import { basicReduxStore } from '../reduxStore';
import { setSession, setNewSession } from './cookie';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LoginState from './loginState';
import PrivateRoute from '../private-route';
import ExternalDashboard from '../external-dashboard';
import { authProvider } from './auth-provider';
import CommonUtilityController from '../master/controller/common-utility-controller';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
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

  externalLogin = () => {
    this.setState({ visible: true, loading: false });
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

  toggleModal = () => {
    this.setState(prev => ({ loginValues: { UserName: '', Password: '' }, loginErrors: {}, visible: !prev.visible }));
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
    let { loginEnabled, visible, isExternalLogin, loading, loginValues, loginErrors, snackbar } = this.state;

    if (isExternalLogin) {
      return (
        <div className="App">
          <React.Fragment>
            <PrivateRoute path='/' component={ExternalDashboard} />
          </React.Fragment>
        </div>
      )
    }
    else {
      return (
        <div>
          <AzureAD provider={authProvider} reduxStore={basicReduxStore}>
            {({ login, authenticationState }) => {
              const isInProgress = authenticationState === AuthenticationState.InProgress;
              const isUnauthenticated = authenticationState === AuthenticationState.Unauthenticated;

              if (isUnauthenticated || isInProgress) {
                return (
                  <div>
                    <div className="login-page-container">
                      <Card sx={{ maxWidth: 420, mx: 'auto', borderRadius: 3, boxShadow: '0 4px 24px rgba(0,0,0,0.10)', position: 'relative', zIndex: 2 }}>
                        <CardContent sx={{ p: 4 }}>
                          <Stack spacing={3} alignItems="center">
                            <Typography variant="h4" sx={{ fontWeight: 700, color: '#2F3A67' }}>CCM</Typography>
                            <img alt='Systra Logo' className="login-logo" src={`${import.meta.env.BASE_URL}img/logo.png`} />
                            <Typography variant="body1" color="text.secondary">Sign In to your account</Typography>
                            <Stack direction="row" spacing={2}>
                              <Tooltip title="Systra Users">
                                <span>
                                  <Button variant="contained" size="large" onClick={login} disabled={isInProgress || !loginEnabled}>
                                    Login
                                  </Button>
                                </span>
                              </Tooltip>
                              <Tooltip title="Non Systra Users">
                                <span>
                                  <Button variant="outlined" size="large" onClick={this.externalLogin} disabled={!loginEnabled}>
                                    External
                                  </Button>
                                </span>
                              </Tooltip>
                            </Stack>
                          </Stack>
                        </CardContent>
                      </Card>
                    </div>

                    <Dialog open={visible} onClose={this.toggleModal} maxWidth="xs" fullWidth>
                      <DialogTitle>External Login</DialogTitle>
                      <DialogContent dividers>
                        {loading && <CircularProgress size={24} sx={{ position: 'absolute', top: 16, right: 16 }} />}
                        <Box component="form" onSubmit={this.onLogin} sx={{ mt: 1 }}>
                          <TextField
                            fullWidth size="small" label="User Name" required
                            value={loginValues.UserName}
                            onChange={this.handleLoginField('UserName')}
                            error={!!loginErrors.UserName} helperText={loginErrors.UserName}
                            placeholder="Username"
                            InputProps={{
                              startAdornment: <InputAdornment position="start"><PersonOutlinedIcon fontSize="small" /></InputAdornment>
                            }}
                            sx={{ mb: 2 }}
                          />
                          <TextField
                            fullWidth size="small" label="OTP" required type="password"
                            value={loginValues.Password}
                            onChange={this.handleLoginField('Password')}
                            error={!!loginErrors.Password} helperText={loginErrors.Password}
                            placeholder="OTP"
                            InputProps={{
                              startAdornment: <InputAdornment position="start"><LockOutlinedIcon fontSize="small" /></InputAdornment>
                            }}
                            sx={{ mb: 2 }}
                          />
                        </Box>
                      </DialogContent>
                      <DialogActions>
                        <Button variant="contained" size="small" onClick={this.onLogin}>Login</Button>
                        <Button variant="contained" size="small" onClick={this.sendOTP}>Send OTP</Button>
                        <Button size="small" onClick={this.toggleModal}>Close</Button>
                      </DialogActions>
                    </Dialog>
                  </div>
                );
              }
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
}
export default Login;
