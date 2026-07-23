import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Joyride, { STATUS } from 'react-joyride'
import LoginState from '../../authentication/loginState'
import TourManager from '../../helper/TourManager'
import {
  ChevronDown,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import {
  DashboardRounded,
  AutoAwesomeRounded,
  FolderOpenRounded,
  ApartmentRounded,
  BadgeRounded,
  GroupRounded,
  SecurityRounded,
  AdminPanelSettingsRounded,
  ManageAccountsRounded,
  ViewModuleRounded,
  Inventory2Rounded,
  SettingsRounded,
  HelpOutlineRounded,
  AppsRounded,
} from '@mui/icons-material'
import './modern-sidebar.css'

/* ── Icon resolver ────────────────────────────────────────────────────── */
const sectionIcons = {
  CCM: <DashboardRounded sx={{ fontSize: 18 }} />,
  Master: <AppsRounded sx={{ fontSize: 18 }} />,
  Admin: <SettingsRounded sx={{ fontSize: 18 }} />,
}

const itemIconMap = {
  '/master/dashboard': <DashboardRounded sx={{ fontSize: 18 }} />,
  '/master/ai-drafting': <AutoAwesomeRounded sx={{ fontSize: 18 }} />,
  '/master/project-master': <FolderOpenRounded sx={{ fontSize: 18 }} />,
  '/master/view-project-master': <FolderOpenRounded sx={{ fontSize: 18 }} />,
  '/master/department-master': <ApartmentRounded sx={{ fontSize: 18 }} />,
  '/master/view-department-master': <ApartmentRounded sx={{ fontSize: 18 }} />,
  '/master/designation-master': <BadgeRounded sx={{ fontSize: 18 }} />,
  '/master/view-designation-master': <BadgeRounded sx={{ fontSize: 18 }} />,
  '/master/user-master': <GroupRounded sx={{ fontSize: 18 }} />,
  '/master/view-user-master': <GroupRounded sx={{ fontSize: 18 }} />,
  '/master/role-master': <SecurityRounded sx={{ fontSize: 18 }} />,
  '/master/view-role-master': <SecurityRounded sx={{ fontSize: 18 }} />,
  '/master/user-role-master': <ManageAccountsRounded sx={{ fontSize: 18 }} />,
  '/master/view-user-role-master': <ManageAccountsRounded sx={{ fontSize: 18 }} />,
  '/master/role-right-master': <AdminPanelSettingsRounded sx={{ fontSize: 18 }} />,
  '/master/view-role-right-master': <AdminPanelSettingsRounded sx={{ fontSize: 18 }} />,
  '/master/module-group-master': <Inventory2Rounded sx={{ fontSize: 18 }} />,
  '/master/view-module-group-master': <Inventory2Rounded sx={{ fontSize: 18 }} />,
  '/master/module-master': <ViewModuleRounded sx={{ fontSize: 18 }} />,
  '/master/view-module-master': <ViewModuleRounded sx={{ fontSize: 18 }} />,
}

const fallbackIcon = <SettingsRounded sx={{ fontSize: 18 }} />

function getItemIcon(url) {
  if (url && itemIconMap[url]) return itemIconMap[url]
  return fallbackIcon
}

function getSubIcon(url) {
  return getItemIcon(url)
}

/* ── Component ─────────────────────────────────────────────────────────── */
export function ModernSidebar({ isOpen = true, onToggle, menuItems = [], onNavigate }) {
  const [expandedItems, setExpandedItems] = useState([])
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [tourRunning, setTourRunning] = useState(false)
  const [tourKey, setTourKey] = useState(0)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true')

  const items = menuItems || []

  const tourSteps = [
    {
      target: '.modern-sidebar-nav-group:nth-of-type(1) .modern-sidebar-nav-button',
      content: 'CCM - Dashboard, AI Drafting and more.',
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '.modern-sidebar-nav-group:nth-of-type(2) .modern-sidebar-nav-button',
      content: 'Masters - Manage all master data.',
      placement: 'right',
    },
    {
      target: '.modern-sidebar-nav-group:nth-of-type(3) .modern-sidebar-nav-button',
      content: 'Admin - Users, roles and system settings.',
      placement: 'right',
    },
  ]

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('sidebarCollapsed', next)
      return next
    })
  }

  const toggleItem = (itemName) => {
    setExpandedItems((prev) => {
      if (prev.includes(itemName)) {
        return prev.filter((item) => !item.startsWith(itemName))
      }
      const isSubItem = itemName.includes('-')
      if (!isSubItem) return [itemName]
      const parentName = itemName.split('-')[0]
      return [parentName, itemName]
    })
  }

  const goToHome = () => {
    window.location.hash = '/master/project-master'
  }

  const handleItemClick = (url, menuItem = {}) => {
    if (onNavigate) onNavigate(url, menuItem || {})
    setIsMobileOpen(false)
  }

  const handleJoyrideCallback = async ({ status }) => {
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      setTourRunning(false)
      const code = status === STATUS.FINISHED ? 1 : 2
      await TourManager.complete(code)
    }
  }

  React.useEffect(() => {
    const checkAndRunTour = async () => {
      if (TourManager.canRun()) {
        const tourStatus = await TourManager.getStatus()
        if (tourStatus === 0) {
          const timer = setTimeout(() => {
            setTourRunning(true)
            setTourKey(Date.now())
          }, 1000)
          return () => clearTimeout(timer)
        }
      }
    }
    checkAndRunTour()
  }, [])

  const isActive = (url) => {
    if (!url) return false
    const hash = window.location.hash.replace('#', '')
    return hash === url || hash.startsWith(url + '?') || hash.startsWith(url + '/')
  }

  /* ── Sidebar inner content ────────────────────────────────────────── */
  const sidebarContent = (
    <div className={`modern-sidebar ${collapsed ? 'collapsed' : ''}`} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Branding */}
      <div className="modern-sidebar-header">
        <div className="modern-sidebar-logo">
          {collapsed ? (
            <img
              src="./public/img/s_logo.png"
              alt="Systra"
              onClick={goToHome}
              style={{ cursor: 'pointer' }}
              title="Go to Home"
            />
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 424.6 80.7"
              height="28"
              onClick={goToHome}
              style={{ cursor: 'pointer' }}
              title="Go to Home"
            >
              <path d="M183.6 3.3V1.7c0-.3-.2-.5-.5-.5h-22c-.6 0-.8.1-1.2.5-2.8 3-4.8 6.9-4.8 12.1 0 4.7 1.3 8.9 4.9 12.9 8.3 9.3 26.3 14.4 33.3 20.2 2.6 2.2 4.2 4.6 4.2 7.4 0 6.3-4.4 11-17.8 11-7.8 0-14.4-1.5-23-3.2-.4-.1-.4.1-.4.3v13.3c0 .4.1.5.4.6 7.6 2.6 16.8 4.3 25.3 4.3 20.8 0 34.8-10.9 34.8-27.1 0-7.4-3-13.1-8.3-17.9-7.7-7-20.6-11.5-28-16-2.5-1.5-5.7-4-5.7-8.2.1-3.4 2.2-6.8 8.8-8.1zm95 76c-1.5.3-6.7 1.3-13.5 1.3-20.2 0-30.2-9.1-30.2-29.3V16.4h-22.7c-.3 0-.5-.1-.6-.5l-2.5-14.3c0-.3.1-.5.4-.5h69.1c.3 0 .5.2.5.5V16c0 .3-.2.5-.5.5h-24.8v35.3c0 10 5 14.1 16.2 14.1 4.6 0 7.5-.3 8.6-.5.3 0 .5.1.5.4v13c0 .3-.1.5-.5.5zm65.2-78.1C342.1.9 336.2 0 328.6 0c-18.7 0-34.1 7.7-34.1 29.8V79c0 .3.2.5.5.5h18c.3 0 .5-.2.5-.5V30.5c0-9.7 5.3-15.5 19.6-15.5 4.3 0 9 .4 10.8.6.3 0 .5-.1.5-.4V1.8c-.2-.3-.3-.5-.6-.6zm72.3 29.7C412.5 10.5 402.8 0 384.1 0s-28.4 10.5-32 30.9c0 0-8.4 47.8-8.5 48.1-.1.4.2.5.4.5h17.9c.4 0 .5-.1.5-.5.1-.3 3.2-18.4 3.2-18.4h27c.3 0 .5-.1.6-.5l2.5-14.3c0-.3-.1-.5-.4-.5h-27l2.6-14.5c1.7-9.6 4.2-15.8 13.2-15.8s11.5 6.2 13.2 15.8c0 0 8.4 47.8 8.5 48.1.1.3.2.5.5.5h17.9c.2 0 .5-.1.4-.5 0-.3-8.5-48-8.5-48zM116.7 79.5c.3 0 .5-.2.5-.5V57.1c14.6-2.8 21.6-12.9 24.6-30l4.4-25.5c0-.3-.1-.5-.4-.5h-17.5c-.4 0-.5.1-.5.5l-4.5 25.5c-1.7 9.6-6.2 16-15.2 16s-13.5-6.4-15.2-16L88.4 1.6c-.1-.3-.2-.5-.6-.5H70.2c-.3 0-.4.2-.4.5l4.4 25.5c3 17.1 9.9 27.2 24.6 30V79c0 .3.2.5.5.5h17.4zM37.2 38.8c-12.4-5.9-17.5-9-17.5-14.3 0-6.1 4.1-9.4 15.7-9.4 6.2 0 14.5 1 21.4 2.5.3.1.4 0 .4-.3V4.1c0-.3-.1-.5-.4-.6C48.9 1.3 42.2 0 33.1 0 12 0 0 10.3 0 24.7 0 31 2.1 36.1 6.4 40.6 14.8 49.3 33.1 55 39 60.7c2.7 2.6 3.5 4.9 3.5 7.3 0 6-4.5 8.6-9.8 9.6-.3.1-.8.1-1.2.2V79c0 .3.2.5.5.5h24.3c.6 0 .8-.1 1.2-.5 2.8-3.1 4.6-8.6 4.6-12.7 0-9.9-4.9-18-24.9-27.5z" fill="#d22328" />
            </svg>
          )}
          {!collapsed && (
            <button className="sidebar-collapse-trigger" onClick={toggleCollapse} title="Collapse sidebar" style={{ marginLeft: 'auto' }}>
              <PanelLeftClose size={18} />
            </button>
          )}
        </div>
        {collapsed && (
          <button className="sidebar-collapse-trigger" onClick={toggleCollapse} title="Expand sidebar" style={{ width: '100%', marginTop: 8 }}>
            <PanelLeftOpen size={18} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="modern-sidebar-nav">
        {items.map((menuItem, index) => {
          const isExpanded = expandedItems.includes(menuItem.name)
          const hasChildren = menuItem.children && menuItem.children.length > 0
          const groupActive = hasChildren && menuItem.children.some(
            (c) => isActive(c.url) || (c.children && c.children.some((cc) => isActive(cc.url)))
          )
          const sectionIcon = sectionIcons[menuItem.name] || <AppsRounded sx={{ fontSize: 18 }} />

          return (
            <div key={menuItem.name || index} className="modern-sidebar-nav-group">
              <div className="sidebar-section-label">{menuItem.name}</div>

              {hasChildren && menuItem.children.map((subItem, subIndex) => {
                const subExpanded = expandedItems.includes(`${menuItem.name}-${subItem.name}`)
                const hasSubChildren = subItem.children && subItem.children.length > 0
                const subActive = isActive(subItem.url)
                const subIcon = getSubIcon(subItem.url)

                return (
                  <div key={`${menuItem.name}-${subItem.name}`}>
                    <motion.button
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: subIndex * 0.04 }}
                      onClick={() => {
                        if (hasSubChildren) toggleItem(`${menuItem.name}-${subItem.name}`)
                        else handleItemClick(subItem.url, subItem)
                      }}
                      className={`modern-sidebar-nav-button ${subActive && !hasSubChildren ? 'active' : ''}`}
                      style={collapsed ? { justifyContent: 'center' } : {}}
                      title={collapsed ? subItem.name : ''}
                    >
                      <span className="nav-icon">{subIcon}</span>
                      {!collapsed && <span>{subItem.name}</span>}
                      {!collapsed && hasSubChildren && (
                        <span className={`nav-chevron ${subExpanded ? 'open' : ''}`}>
                          <ChevronDown size={14} />
                        </span>
                      )}
                      {collapsed && <span className="sidebar-tooltip">{subItem.name}</span>}
                    </motion.button>

                    {!collapsed && hasSubChildren && subExpanded && (
                      <AnimatePresence>
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22 }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div className="modern-sidebar-nav-submenu">
                            {subItem.children.map((childItem, ci) => (
                              <motion.button
                                key={childItem.name}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: ci * 0.03 }}
                                onClick={() => handleItemClick(childItem.url, childItem)}
                                className={`modern-sidebar-nav-submenu-item ${isActive(childItem.url) ? 'active' : ''}`}
                              >
                                <span className="sub-icon">{getSubIcon(childItem.url)}</span>
                                <span>{childItem.name}</span>
                              </motion.button>
                            ))}
                          </div>
                        </motion.div>
                      </AnimatePresence>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="modern-sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.15)' }}>
            <HelpOutlineRounded sx={{ fontSize: 16, color: '#60A5FA' }} />
            <span style={{ fontSize: 12, color: '#94A3B8' }}>Need help? <span style={{ color: '#60A5FA', cursor: 'pointer' }}>Contact Support</span></span>
          </div>
        </div>
      )}
    </div>
  )

  /* ── Render ────────────────────────────────────────────────────────── */
  return (
    <>
      <Joyride
        key={tourKey}
        steps={tourSteps}
        run={tourRunning}
        continuous
        scrollToFirstStep
        showSkipButton
        disableOverlayClose
        callback={handleJoyrideCallback}
        locale={{ back: 'Back', close: 'Close', last: 'Got it!', next: 'Next', skip: 'Skip' }}
        styles={{
          options: { zIndex: 10000, primaryColor: '#2563EB', backgroundColor: '#fff', textColor: '#111827', arrowColor: '#fff' },
          overlay: { zIndex: 9999 },
        }}
      />

      {/* Mobile toggle */}
      <button onClick={() => setIsMobileOpen(!isMobileOpen)} className="modern-sidebar-mobile-button">
        {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:block ${isMobileOpen ? 'mobile-open' : ''}`}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          height: '100vh',
          zIndex: 30,
          transition: 'width 0.28s cubic-bezier(.4,0,.2,1)',
          width: collapsed ? 72 : 280,
        }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile sidebar */}
      <aside
        className="lg:hidden"
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: 280,
          height: '100vh',
          zIndex: 40,
          transform: isMobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.28s ease',
        }}
      >
        {sidebarContent}
      </aside>
    </>
  )
}

export default ModernSidebar
