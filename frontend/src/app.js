import React, { Component, Suspense } from 'react';
import { AzureAD, AuthenticationState } from 'react-aad-msal';
import { basicReduxStore } from './reduxStore';
import { authProvider } from './authentication/auth-provider';
import { isExternalLoginActive } from './authentication/cookie'; // Use new helper
import Login from './authentication/login';
import { HashRouter, Routes, Route } from 'react-router-dom';
// import Sidebar from './components/app/App.jsx'; 
import { Preloader } from './components/Preloader';

const ExternalDashboard = React.lazy(() => import('./external-dashboard'));

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isExternalLogin: isExternalLoginActive(),
    };
  }



  render() {
    const { isExternalLogin } = this.state;
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
            {({ authenticationState }) => {
              if (authenticationState === AuthenticationState.Unauthenticated) {
                return <Login />;
              } else if (authenticationState === AuthenticationState.Authenticated) {
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