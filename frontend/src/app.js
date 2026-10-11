import React, { Component, Suspense } from 'react';
import { AzureAD, AuthenticationState } from 'react-aad-msal';
import { basicReduxStore } from './reduxStore';
import { authProvider } from './authentication/auth-provider';
import { isExternalLoginActive, getSession, setSession } from './authentication/cookie'; // Use new helper
import Login from './authentication/login';
import { HashRouter, Routes, Route } from 'react-router-dom';
// import Sidebar from './components/app/App.jsx';
import { Preloader } from './components/Preloader';
import config from './config/config';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';

const ExternalDashboard = React.lazy(() => import('./external-dashboard'));

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isExternalLogin: isExternalLoginActive(),
      azureExchangeError: null,
    };
    this._azureExchangeStarted = false;
  }

  // Azure AD only proves who the user is to Microsoft. CCM's API still needs its
  // own JWT (same cookie-based session the OTP/"External" flow sets), so once MSAL
  // reports Authenticated we exchange the Azure ID token for a CCM session once.
  exchangeAzureToken = async (accountInfo) => {
    if (this._azureExchangeStarted) return;
    this._azureExchangeStarted = true;
    this.setState({ azureExchangeError: null });
    try {
      const response = await fetch(`${config.apiUrl}/api/auth/azure/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: accountInfo?.jwtIdToken }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || 'Azure sign-in failed.');
      }
      setSession(data.user.id, data.user.email, 'token' + data.user.id, data.access_token, false, data.user.name);
      this.forceUpdate();
    } catch (err) {
      this._azureExchangeStarted = false;
      this.setState({ azureExchangeError: err.message || 'Azure sign-in failed.' });
    }
  };

  retryAzureExchange = () => {
    this._azureExchangeStarted = false;
    this.setState({ azureExchangeError: null });
    window.location.reload();
  };

  render() {
    const { isExternalLogin, azureExchangeError } = this.state;
    const loadingFallback = <Preloader />;

    return (
      <HashRouter>
        {isExternalLogin ? (
          // External login routes
          <Suspense fallback={loadingFallback}>
            <Routes>
              <Route path="*" element={<ExternalDashboard />} />
            </Routes>
          </Suspense>
        ) : (
          // AzureAD login routes
          <AzureAD
            provider={authProvider}
            reduxStore={basicReduxStore}
            forceLogin={false} // Important: allows checking existing sessions
          >
            {({ authenticationState, accountInfo }) => {
              if (authenticationState === AuthenticationState.Unauthenticated) {
                // A CCM session can already exist here (External/OTP login, or the
                // temporary dev-login bypass) even though MSAL itself reports
                // Unauthenticated. Once that's true, hand off to the app's own
                // hash-based routing (routes.js) instead of matching hashes here —
                // otherwise every in-app navigation would fall through and bounce
                // back to the landing page.
                const hasCcmSession = !!getSession('UserId');
                if (hasCcmSession) {
                  return (
                    <Suspense fallback={loadingFallback}>
                      <Routes>
                        <Route path="*" element={<ExternalDashboard />} />
                      </Routes>
                    </Suspense>
                  );
                }
                return <Login />;
              } else if (authenticationState === AuthenticationState.Authenticated) {
                const hasCcmSession = !!getSession('UserId');
                if (!hasCcmSession) {
                  if (azureExchangeError) {
                    return (
                      <Stack spacing={2} alignItems="center" sx={{ mt: 10 }}>
                        <Alert severity="error" sx={{ maxWidth: 480 }}>{azureExchangeError}</Alert>
                        <Button variant="contained" onClick={this.retryAzureExchange}>Try again</Button>
                      </Stack>
                    );
                  }
                  this.exchangeAzureToken(accountInfo);
                  return loadingFallback;
                }
                return (
                  <Suspense fallback={loadingFallback}>
                    <Routes>
                      <Route path="*" element={<ExternalDashboard />} />
                    </Routes>
                  </Suspense>
                );
              }
              return loadingFallback;
            }}
          </AzureAD>
        )}
      </HashRouter>
    );
  }
}

export default App;