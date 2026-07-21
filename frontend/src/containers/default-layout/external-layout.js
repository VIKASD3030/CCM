import React, { Component, Suspense } from 'react'
import { Navigate, Routes, Route } from 'react-router-dom'
import { Container } from '@mui/material'
import { authProvider } from '../../authentication/auth-provider'
import { setNewSession, getSession, resetSession } from '../../authentication/cookie';
import { cilLayers, cilSpeedometer, cilPuzzle } from './icon-constants'
import routes from '../../routes';
import navData from '../../_nav'

import Login from '../../authentication/login'
import LoginState from '../../authentication/loginState'

import CommonUtilityController from '../../master/controller/common-utility-controller'

import ModernSidebar from './modern-sidebar'
import ModernHeader from './modern-header'
import RouteErrorBoundary from '../../components/ui/RouteErrorBoundary'

class ExternalLayout extends Component {
  constructor(props) {
    super(props)
    this.state = {
      navItems: { items: [] },
      isExternalLogout: false,
      loading: false,
      routeItems: [],
      dashboard: '/master/project-master',
      renderStop: false,
      unauthorized: false,
      moduleMenuData: [],
      sidebarOpen: true
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

  toggleSidebar = () => {
    this.setState((prev) => ({ sidebarOpen: !prev.sidebarOpen }))
  }

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

  signOut = (e) => {
    e.preventDefault()
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
    let { dashboard, navItems, isExternalLogout, unauthorized, loading, sidebarOpen } = this.state;
    const isMobile = window.innerWidth < 1024;

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

    return (
      <div className="App">
        <React.Fragment>
          <ModernHeader onLogout={this.signOut} sidebarOpen={sidebarOpen} />

          <ModernSidebar
            isOpen={sidebarOpen}
            onToggle={this.toggleSidebar}
            menuItems={navItems.items && navItems.items.length > 0 ? navItems.items : navData.items}
            onNavigate={this.handleSidebarNavigate}
          />

          <main
            className={`flex-1 transition-all duration-300 bg-gray-50 main-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}
          >
            <Container fluid className="py-6">
              <Suspense fallback={this.loading()}>
                <RouteErrorBoundary resetKey={window.location.hash}>
                  <Routes>
                    {routes.map((route, idx) =>
                      route?.component ? (
                        <Route
                          key={idx}
                          path={route.path}
                          element={<route.component />}
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
            </Container>
          </main>
        </React.Fragment>
      </div>
    )
  }
}

export default ExternalLayout;