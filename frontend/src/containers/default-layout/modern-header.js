import React, { Component } from 'react'
import { motion } from 'framer-motion'
import { LogOut, User, Settings, HelpCircle, Home, StickyNote } from 'lucide-react'
import PropTypes from 'prop-types'
import LoginState from '../../authentication/loginState'
import { getSession, resetSession } from '../../authentication/cookie'
import CommonUtilityController from '../../master/controller/common-utility-controller'
import { authProvider } from '../../authentication/auth-provider'
import '../default-layout/modern-sidebar.css'


const propTypes = {
  onLogout: PropTypes.func,
  sidebarOpen: PropTypes.bool,
}

class ModernHeader extends Component {
  constructor(props) {
    super(props)
    this.state = {
      visible: false,
      userLocation: { Location: '', Latitude: '', Longitude: '' },
      loading: false,
      showUserMenu: false,
      pageTitle: 'CCM',
    }
    this.userMenuRef = React.createRef()
  }

  componentDidMount() {
    const accountInfo = authProvider.getAccountInfo()
    if (accountInfo?.account?.userName) {
      this.getUserInfo(accountInfo.account.userName)
    }

    authProvider.registerAuthenticationStateHandler((isAuthenticated) => {
      if (isAuthenticated) {
        const account = authProvider.getAccountInfo()
        if (account?.account?.userName) {
          this.getUserInfo(account.account.userName)
        }
      } else {
        this.clearLoginState()
      }
    })

    window.addEventListener('hashchange', this.updatePageTitle)
    document.addEventListener('click', this.handleClickOutside)
    this.updatePageTitle()
  }

  componentWillUnmount() {
    window.removeEventListener('hashchange', this.updatePageTitle)
    document.removeEventListener('click', this.handleClickOutside)
  }

  updatePageTitle = () => {
    const hash = window.location.hash
    let title = 'CCM'



    // Master Routes
    // else if (hash.includes('/master/project-master-details')) title = 'Project Details'
    // // else if (hash.includes('/master/project-master')) title = 'Project Master'
    // else if (hash.includes('/master/contract-master')) title = 'Contract Master'
    // else if (hash.includes('/master/activity-group-master')) title = 'Activity Group Master'
    // else if (hash.includes('/master/activity-master')) title = 'Activity Master'
    // else if (hash.includes('/master/department-master')) title = 'Department Master'
    // else if (hash.includes('/master/user-master')) title = 'User Master'
    // else if (hash.includes('/master/rbs-master')) title = 'RBS Master'

    this.setState({ pageTitle: title })
  }

  clearLoginState = () => {
    LoginState.UserId = null
    LoginState.UserName = null
    LoginState.EmployeeName = null
    resetSession()
    this.forceUpdate()
  }

  async getUserInfo(userName) {
    this.setState({ loading: true })
    let regData = { UserName: userName, UserType: 'External' }
    try {
      const result = await new CommonUtilityController().getUserInfo(regData)
      this.setState({ loading: false })
      if (result.length > 0) {
        LoginState.UserId = result[0].UserId
        LoginState.UserName = result[0].UserName
        LoginState.EmployeeName = result[0].EmployeeName
        this.forceUpdate()
      }
    } catch (err) {
      this.setState({ loading: false })
      console.error('Unauthorized user:', err)
      this.handleLogout(new Event('click'))
    }
  }

  handleLogout = (e) => {
    e.preventDefault()
    this.clearLoginState()
    if (this.props.onLogout) {
      this.props.onLogout(e)
    }
    authProvider.logout({
      postLogoutRedirectUri: window.location.origin,
    })
  }

  toggleUserMenu = () => {
    this.setState((prev) => ({ showUserMenu: !prev.showUserMenu }))
  }

  handleClickOutside = (e) => {
    if (this.userMenuRef.current && !this.userMenuRef.current.contains(e.target)) {
      this.setState({ showUserMenu: false })
    }
  }

  goToHome = () => {
    window.location.hash = '#/master/project-master'
  }

  render() {
    const { showUserMenu, pageTitle } = this.state
    const { sidebarOpen } = this.props
    const employeeName = LoginState.EmployeeName || 'Guest'

    return (
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`modern-header ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}
      >
        <div className="modern-header-container">
          {/* <div className="modern-header-left">
            <button 
              onClick={this.goToHome}
              className="modern-header-home-button"
              title="Go to Home/Dashboard"
            >
              <Home size={15} />
            </button>
          </div> */}

          <div className="modern-header-center">
            {pageTitle === 'CCM' ? (
              <div className="header-dashboard-content">
                <div className="header-text-container">
                  <h1 className="header-main-title">
                    CCM
                  </h1>

                  <p className="header-sub-title">
                    AI Contract Management
                  </p>
                </div>
              </div>
            ) : (
              <h2 className="modern-header-title-text">{pageTitle}</h2>
            )}
          </div>

          <div className="modern-header-right">
            <div className="modern-header-user-info">
              <span className="modern-header-user-name">{employeeName}</span>
              <div style={{ position: 'relative' }} ref={this.userMenuRef}>
                <button onClick={this.toggleUserMenu} className="modern-header-user-button">
                  <User size={16} />
                </button>

                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="modern-header-user-menu"
                  >
                    <div className="modern-header-user-menu-header">
                      <p className="modern-header-user-menu-name">{employeeName}</p>
                      <p className="modern-header-user-menu-id">ID: {getSession('UserId')}</p>
                    </div>

                    {/* <button className="modern-header-user-menu-item">
                      <Settings size={16} />
                      Settings
                    </button> */}

                    {/* <button className="modern-header-user-menu-item">
                      <HelpCircle size={16} />
                      Help & Support
                    </button> */}

                    <button onClick={this.handleLogout} className="modern-header-user-menu-item logout">
                      <LogOut size={16} />
                      Logout
                    </button>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.header>
    )
  }
}

ModernHeader.propTypes = propTypes
export default ModernHeader
