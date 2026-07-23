import React, { Component } from 'react'
import { motion } from 'framer-motion'
import { LogOut, User, Bell } from 'lucide-react'
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

    if (hash.includes('/master/dashboard')) title = 'Dashboard'
    else if (hash.includes('/master/ai-drafting')) title = 'AI Drafting'
    else if (hash.includes('/master/project-master')) title = 'Projects'
    else if (hash.includes('/master/department-master')) title = 'Departments'
    else if (hash.includes('/master/designation-master')) title = 'Designations'
    else if (hash.includes('/master/user-master')) title = 'Users'
    else if (hash.includes('/master/role-master')) title = 'Roles'
    else if (hash.includes('/master/role-right-master')) title = 'Role Rights'
    else if (hash.includes('/master/user-role-master')) title = 'User Roles'
    else if (hash.includes('/master/module-group-master')) title = 'Module Groups'
    else if (hash.includes('/master/module-master')) title = 'Modules'
    else if (hash.includes('/master/view-user-logs')) title = 'User Logs'
    else if (hash.includes('/master/view-user-errors')) title = 'User Errors'
    else if (hash.includes('/master/api-test')) title = 'API Test'

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
    let regData = { UserName: userName, UserType: 'External' }
    try {
      const result = await new CommonUtilityController().getUserInfo(regData)
      if (result.length > 0) {
        LoginState.UserId = result[0].UserId
        LoginState.UserName = result[0].UserName
        LoginState.EmployeeName = result[0].EmployeeName
        this.forceUpdate()
      }
    } catch (err) {
      console.error('Unauthorized user:', err)
      this.handleLogout(new Event('click'))
    }
  }

  handleLogout = (e) => {
    e.preventDefault()
    this.clearLoginState()
    if (this.props.onLogout) this.props.onLogout(e)
    authProvider.logout({ postLogoutRedirectUri: window.location.origin })
  }

  toggleUserMenu = () => {
    this.setState((prev) => ({ showUserMenu: !prev.showUserMenu }))
  }

  handleClickOutside = (e) => {
    if (this.userMenuRef.current && !this.userMenuRef.current.contains(e.target)) {
      this.setState({ showUserMenu: false })
    }
  }

  render() {
    const { showUserMenu, pageTitle } = this.state
    const { sidebarOpen } = this.props
    const employeeName = LoginState.EmployeeName || 'Guest'
    const initials = employeeName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

    return (
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`modern-header ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}
      >
        <div className="modern-header-container">
          {/* Left / Center - Page Title */}
          <div className="modern-header-center">
            <div className="header-dashboard-content">
              <div className="header-text-container">
                <h2 className="modern-header-title-text">{pageTitle}</h2>
              </div>
            </div>
          </div>

          {/* Right - User Menu */}
          <div className="modern-header-right">
            {/* Notification bell */}
            <button
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 38, height: 38, borderRadius: 10, background: '#F1F5F9',
                border: '1px solid #E2E8F0', color: '#475569', cursor: 'pointer',
                transition: 'all 0.15s ease', position: 'relative',
              }}
              title="Notifications"
            >
              <Bell size={18} />
              <span style={{
                position: 'absolute', top: 6, right: 6, width: 8, height: 8,
                background: '#EF4444', borderRadius: '50%', border: '2px solid #fff',
              }} />
            </button>

            {/* User info */}
            <div className="modern-header-user-info">
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', lineHeight: 1.2 }}>
                  {employeeName}
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                  {getSession('UserId') ? 'External User' : 'SSO User'}
                </div>
              </div>

              <div style={{ position: 'relative' }} ref={this.userMenuRef}>
                <button
                  onClick={this.toggleUserMenu}
                  style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: 'linear-gradient(135deg, #1E3A8A, #2563EB)',
                    border: 'none', color: '#fff', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700, letterSpacing: '0.02em',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 2px 8px rgba(30,58,138,0.24)',
                  }}
                  title="Account menu"
                >
                  {initials}
                </button>

                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.15 }}
                    className="modern-header-user-menu"
                  >
                    <div className="modern-header-user-menu-header">
                      <p className="modern-header-user-menu-name">{employeeName}</p>
                      <p className="modern-header-user-menu-id">ID: {getSession('UserId') || 'SSO'}</p>
                    </div>
                    <button onClick={this.handleLogout} className="modern-header-user-menu-item logout">
                      <LogOut size={16} />
                      Sign out
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
