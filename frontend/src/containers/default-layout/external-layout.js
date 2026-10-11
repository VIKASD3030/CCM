import React, { Component, Suspense } from 'react'
import { Navigate, Routes, Route } from 'react-router-dom'
import { authProvider } from '../../authentication/auth-provider'
import { setNewSession, getSession, resetSession } from '../../authentication/cookie';
import { cilLayers, cilSpeedometer, cilPuzzle } from './icon-constants'
import routes from '../../routes';
import navData from '../../_nav'

import Login from '../../authentication/login'
import LoginState from '../../authentication/loginState'

import CommonUtilityController from '../../master/controller/common-utility-controller'

import RouteErrorBoundary from '../../components/ui/RouteErrorBoundary'
import Sidebar from '../../ccm/ui/Sidebar'
import { ToastHost } from '../../ccm/ui/kit'
import CCM from '../../ccm/ccm-api'
import '../../ccm/ui/ccm-ui.css'

class ExternalLayout extends Component {
  constructor(props) {
    super(props)
    this.state = {
      navItems: { items: [] },
      isExternalLogout: false,
      loading: false,
      routeItems: [],
      dashboard: '/master/dashboard',
      renderStop: false,
      unauthorized: false,
      moduleMenuData: [],
      userRole: '',
    }

    this.initializeLoginState();
  }

  initializeLoginState() {
    const storedUserId = getSession('UserId');
    const storedUserName = getSession('UserName');
    const storedEmployeeName = getSession('EmployeeName');

    if (storedUserId && storedUserName) {
      LoginState.UserId = storedUserId;
      LoginState.SecurityId = storedUserId;
      LoginState.LockedBy = storedUserId;
      LoginState.UserName = storedUserName;
      LoginState.EmployeeName = storedEmployeeName;
    } else {
      const options = authProvider.getProviderOptions()
      authProvider.setProviderOptions(options)
      const accountInfo = authProvider.getAccountInfo()

      if (accountInfo) {
        LoginState.UserName = accountInfo.account.userName
        LoginState.AdUserName = accountInfo.account.userName
        LoginState.EmployeeName = accountInfo.account.name

        setNewSession('UserName', accountInfo.account.userName);
        setNewSession('EmployeeName', accountInfo.account.name);
      }
    }
  }

  componentDidMount() {
    CCM.auth.me()
      .then((d) => { const u = d.user || d; this.setState({ userRole: u.role_name || u.role || '' }) })
      .catch(() => {});
    const userId = getSession('UserId') || LoginState.UserId;
    const userName = getSession('UserName') || LoginState.UserName;

    if (!userId || userId === '0') {
      if (userName) {
        this.getUserInfo(userName);
      } else {
        this.setState({ unauthorized: true });
        resetSession();
      }
    } else {
      LoginState.UserId = userId;
      LoginState.SecurityId = userId;
      LoginState.LockedBy = userId;
      LoginState.UserName = getSession('UserName');
      LoginState.EmployeeName = getSession('EmployeeName');

      this.getUserRights(userId);
    }
  }

  async getUserInfo(userName) {
    this.setState({ unauthorized: false, loading: true })
    const regData = { UserName: userName, UserType: 'Internal' }

    try {
      const result = await new CommonUtilityController().getUserInfo(regData)
      if (result && result.length > 0) {
        const userId = result[0].UserId;
        const employeeName = result[0].EmployeeName;

        LoginState.UserId = userId;
        LoginState.SecurityId = userId;
        LoginState.LockedBy = userId;
        LoginState.EmployeeName = employeeName;

        setNewSession('UserId', userId);
        setNewSession('UserName', userName);
        setNewSession('EmployeeName', employeeName);

        this.getUserRights(userId);
      } else {
        this.setState({ unauthorized: true })
        resetSession()
      }
    } catch (error) {
      this.setState({ unauthorized: true })
      resetSession()
    } finally {
      this.setState({ loading: false })
    }
  }

  async getUserRights(userId) {
    this.setState({ loading: true })
    let reqData = { UserId: userId }

    if (!userId) {
      this.setState({ loading: false });
      return;
    }

    try {
      const result = await new CommonUtilityController().getUserRights(reqData);
      if (result !== undefined) {
        this.setState({ moduleMenuData: result?.childData || [] });
        this.userRightsData(result);

        setNewSession('IsRights', 'true');
      }
    } catch (error) {
      console.error('Error fetching user rights:', error);
    } finally {
      this.setState({ loading: false });
    }
  }

  loading = () => <div className="animated fadeIn pt-1 text-center">Loading...</div>

  handleSidebarNavigate = (url, menuItem = {}) => {
    if (url) {
      const finalUrl = this.buildDashboardURL(url, menuItem)
      window.location.hash = finalUrl.replace('#', '')
    }
  }

  userRightsData = (result) => {
    let moduleGroup = result?.parentData;
    let moduleMenu = result?.childData;

    let { navItems } = this.state;
    let routeItems = [];

    moduleGroup.forEach(obj => {
      let modules = {
        name: obj.ModuleGroupName,
        icon: cilLayers,
        children: [],
        businessUnit: obj.BusinessUnitName || obj.BusinessUnit || '',
        moduleGroupId: obj.ModuleGroupId
      };

      let childItem = moduleMenu?.filter(c => c.ModuleGroupId == obj.ModuleGroupId && c.ParentModuleId == 0);
      if (childItem.length == 0) {
        return;
      }

      let children = [];
      childItem.forEach(menuItem => {
        // ✅ Get BU and BL from the menu item
        const businessUnit = menuItem.BusinessUnitName || menuItem.BusinessUnit || obj.BusinessUnitName || '';
        const businessLine = menuItem.BusinessLineName || menuItem.BusinessLine || menuItem.UserShownName || '';

        let parentItem = {
          name: menuItem.UserShownName,
          url: menuItem.ModulePath,
          icon: cilSpeedometer,
          children: [],
          businessUnit: businessUnit,
          businessLine: businessLine,
          moduleId: menuItem.ModuleId
        };

        let parentChildren = [];
        let parentChildItem = moduleMenu?.filter(c => c.ParentModuleId == menuItem.ModuleId);

        if (parentChildItem.length > 0) {
          parentChildItem.forEach(objP => {
            const childBU = objP.BusinessUnitName || objP.BusinessUnit || businessUnit;
            const childBL = objP.BusinessLineName || objP.BusinessLine || objP.UserShownName || '';

            let childP = {
              name: objP.UserShownName,
              url: objP.ModulePath,
              icon: cilPuzzle,
              businessUnit: childBU,
              businessLine: childBL
            };
            parentChildren.push(childP);

            let routeItem = routes?.filter(r => r.path == objP.ModulePath);
            if (routeItem && routeItem[0]) routeItems.push(routeItem[0]);
          });

          parentItem.children = parentChildren;
          children.push(parentItem);

          let routeItem = routes?.filter(r => r.path == menuItem.ModulePath);
          if (routeItem && routeItem[0]) routeItems.push(routeItem[0]);
        } else {
          let child = {
            name: menuItem.UserShownName,
            url: menuItem.ModulePath,
            icon: cilSpeedometer,
            businessUnit: businessUnit,
            businessLine: businessLine
          };
          children.push(child);

          let routeItem = routes?.filter(r => r.path == menuItem.ModulePath);
          if (routeItem && routeItem[0]) routeItems.push(routeItem[0]);
        }
      });

      modules.children = children;
      navItems.items.push(modules);
    });

    this.setState({ navItems: navItems, routeItems: routeItems });
  }

  signOutEverywhere = (e) => {
    this.signOut(e)
    try {
      authProvider.logout({ postLogoutRedirectUri: window.location.origin })
    } catch (err) {
      // Not an Azure session (dev or external login): the local sign-out above is enough.
    }
  }

  signOut = (e) => {
    if (e && e.preventDefault) e.preventDefault()
    let tokenKey = 'token' + getSession('UserId')
    const now = new Date();
    const formattedNow = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0') + ' ' +
      String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0') + ':' +
      String(now.getSeconds()).padStart(2, '0');
    let userLogs = {
      UserLogId: 0,
      UserId: getSession('UserId'),
      IPAddress: 1,
      MACAddress: 1,
      LogInStatus: 2,
      LoginDate: formattedNow,
      LogOutDate: formattedNow,
      CreatedBy: getSession('UserId'),
      CreatedDate: formattedNow,
      LockedBy: getSession('UserId'),
      LockedDate: formattedNow,
      SecurityId: getSession('UserId'),
      TokenValue: getSession(tokenKey),
    }

    this.saveUserLogDetails(userLogs);

    resetSession();
    LoginState.UserId = null;
    LoginState.UserName = null;
    LoginState.EmployeeName = null;

    this.setState({ isExternalLogout: true });
  }

  async saveUserLogDetails(userLogs) {
    userLogs.IPAddress = null
    userLogs.MACAddress = null
    this.setState({ loading: true })
    await new CommonUtilityController().saveUserLogDetails(userLogs).finally(() =>
      this.setState({ loading: false }),
    )
  }

  buildDashboardURL = (url, item = {}) => {
    if (url === '/bl/dashboard') {
      const bu = 'Systra India';
      const bl = item?.businessLine || item?.name || '';
      if (bl && bl.trim()) {
        return `#${url}?bu=${encodeURIComponent(bu)}&bl=${encodeURIComponent(bl)}`;
      }
      return `#${url}`;
    }

    if (url === '/bu/dashboard') {
      const bu = 'Systra India';
      return `#${url}?bu=${encodeURIComponent(bu)}`;
    }

    return `#${url}`;
  };


  render() {
    let { dashboard, navItems, isExternalLogout, unauthorized, loading, userRole } = this.state;

    if (unauthorized || isExternalLogout) {
      return (
        <div className="App">
          <React.Fragment>
            <Login />
          </React.Fragment>
        </div>
      )
    }

    if (loading && navItems.items.length === 0) {
      return this.loading();
    }

    const employeeName = LoginState.EmployeeName || getSession('EmployeeName') || getSession('UserName') || ''

    return (
      <div className="cx-shell">
        <Sidebar
          menuItems={navItems.items && navItems.items.length > 0 ? navItems.items : navData.items}
          userName={employeeName}
          userRole={userRole}
          onSignOut={this.signOutEverywhere}
        />

        <main className="cx-main">
          <Suspense fallback={this.loading()}>
            <RouteErrorBoundary resetKey={window.location.hash}>
              <Routes>
                {routes.map((route, idx) =>
                  route?.component ? (
                    <Route
                      key={idx}
                      path={route.path}
                      element={route.ownTopbar ? <route.component /> : (
                        // Master/Admin pages draw their own title and breadcrumb; the shell
                        // only adds the menu button that opens the sidebar on small screens.
                        <>
                          <div className="cx-legacy-bar">
                            <button type="button" className="cx-btn ghost sm" aria-label="Open menu"
                              onClick={() => window.dispatchEvent(new Event('cx-toggle-sidebar'))}>☰ Menu</button>
                          </div>
                          <div className="cx-legacy"><route.component /></div>
                        </>
                      )}
                    />
                  ) : null
                )}

                <Route path="/" element={<Navigate to={dashboard} replace />} />

                <Route path="*" element={
                  <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <img src="/img/logo.png" alt="404 Not Found" style={{ width: '50%' }} />
                  </div>
                } />
              </Routes>
            </RouteErrorBoundary>
          </Suspense>
        </main>
        <ToastHost />
      </div>
    )
  }
}

export default ExternalLayout;
