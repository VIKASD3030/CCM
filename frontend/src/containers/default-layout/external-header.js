import React, { Component } from 'react'
import { motion } from 'framer-motion'
import { LogOut, User, Settings, HelpCircle, Home } from 'lucide-react'
import PropTypes from 'prop-types'
import LoginState from '../../authentication/loginState'
import { getSession, resetSession } from '../../authentication/cookie'
import CommonUtilityController from '../../master/controller/common-utility-controller'
import { authProvider } from '../../authentication/auth-provider'
import '../default-layout/modern-sidebar.css'

const propTypes = {
  onLogout: PropTypes.func,
}

class ExternalHeader extends Component {
  constructor(props) {
    super(props)
    this.state = {
      visible: false,
      userLocation: { Location: '', Latitude: '', Longitude: '' },
      loading: false,
      showUserMenu: false,
    }
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

  goToHome = () => {
    window.location.hash = '#/master/project-master'
  }

  render() {
    const { showUserMenu } = this.state
    const employeeName = LoginState.EmployeeName || 'Guest'

    return (
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="modern-header"
      >
        <div className="modern-header-container">
          <div className="modern-header-left">
            <div className="modern-header-logo">
              <svg viewBox="0 0 200 60" xmlns="">
                <text x="100" y="40" fontFamily="Arial, sans-serif" fontSize="32" fontWeight="bold" textAnchor="middle" fill="#DC2626">
                  SYSTRA
                </text>
              </svg>
            </div>
            <div className="modern-header-title">
              <h1>Systra India</h1>
              <p>Risk Management System</p>
            </div>

            <button 
              onClick={this.goToHome}
              className="modern-header-home-button"
              title="Go to Home/Dashboard"
            >
              <Home size={20} />
            </button>
          </div>

          <div className="modern-header-right">
            <div style={{ position: 'relative' }}>
              <button onClick={this.toggleUserMenu} className="modern-header-user-button">
                <User size={16} />
                <span style={{ display: 'none' }} className="md-inline">
                  {employeeName}
                </span>
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

                  <button className="modern-header-user-menu-item">
                    <Settings size={16} />
                    Settings
                  </button>

                  <button className="modern-header-user-menu-item">
                    <HelpCircle size={16} />
                    Help & Support
                  </button>

                  <button onClick={this.handleLogout} className="modern-header-user-menu-item logout">
                    <LogOut size={16} />
                    Logout
                  </button>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </motion.header>
    )
  }
}

ExternalHeader.propTypes = propTypes
export default ExternalHeader
