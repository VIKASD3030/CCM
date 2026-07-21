import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Joyride, { STATUS, EVENTS } from 'react-joyride';
import LoginState from '../../authentication/loginState';
import CommonUtilityController from '../../master/controller/common-utility-controller';
import TourManager from '../../helper/TourManager';
import {
  ChevronDown,
  LayoutDashboard,
  Database,
  FileText,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  HelpCircle,
  Layers,
  Droplets,
  Edit,
  Grid,
  BarChart3,
} from 'lucide-react'
import './modern-sidebar.css'

const iconMap = {
  'icon-speedometer': LayoutDashboard,
  'icon-layers': Layers,
  'icon-drop': Droplets,
  'icon-pencil': Edit,
  'icon-grid': Grid,
  'icon-chart': BarChart3,
  'Database': Database,
  'FileText': FileText,
  'LayoutDashboard': LayoutDashboard,
  'Layers': Layers,
  'Droplets': Droplets,
  'Edit': Edit,
}

const getIconComponent = (iconName) => {
  if (!iconName) return LayoutDashboard
  return iconMap[iconName] || FileText
}

export function ModernSidebar({ isOpen = true, onToggle, menuItems = [], onNavigate }) {
  const [expandedItems, setExpandedItems] = useState([])
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [tourRunning, setTourRunning] = useState(false)
  const [tourKey, setTourKey] = useState(0)

  const items = menuItems || []

  const tourSteps = [
    {
      target: '.modern-sidebar-nav-group:nth-of-type(1) .modern-sidebar-nav-button',
      content: 'Master - Manage all master data including projects, departments, and configurations.',
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '.modern-sidebar-nav-group:nth-of-type(2) .modern-sidebar-nav-button',
      content: 'Admin - Control user access, roles, and system settings here.',
      placement: 'right',
    }
  ]

  const toggleItem = (itemName) => {
    setExpandedItems((prev) => {
      if (prev.includes(itemName)) {
        return prev.filter((item) => !item.startsWith(itemName))
      }

      const isSubItem = itemName.includes('-')
      if (!isSubItem) {
        return [itemName]
      } else {
        const parentName = itemName.split('-')[0]
        return [parentName, itemName]
      }
    })
  }

  const goToHome = () => {
    window.location.hash = '/master/project-master'
  }

  const handleItemClick = (url, menuItem = {}) => {
    if (onNavigate) {
      onNavigate(url, menuItem || {})
    }
  }

  // ✅ REPLACE handleJoyrideCallback with this:
  const handleJoyrideCallback = async ({ status }) => {

    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      setTourRunning(false);

      const code = status === STATUS.FINISHED ? 1 : 2;

      const result = await TourManager.complete(code);
    }
  };

  // ✅ REPLACE useEffect with this:
  // ✅ REPLACE useEffect with this:
  React.useEffect(() => {
    const checkAndRunTour = async () => {
      if (TourManager.canRun()) {
        const tourStatus = await TourManager.getStatus();

        // ✅ FIX: Only run if tourStatus is 0 (pending)
        if (tourStatus === 0) {
          const timer = setTimeout(() => {
            setTourRunning(true);
            setTourKey(Date.now());
          }, 1000);
          return () => clearTimeout(timer);
        } else {
        }
      }
    };

    checkAndRunTour();
  }, []);


  const sidebarContent = (
    <div className="modern-sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="modern-sidebar-header" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          {isOpen ? (
            <div
              className="modern-sidebar-logo"
              style={{ cursor: 'pointer' }}
              onClick={goToHome}
              title="Go to Home"
            >
              <img
                src="/systra_logo.svg"
                alt="Systra Logo"
                style={{ width: '115px', height: '30px', objectFit: 'contain' }}
              />
            </div>
          ) : (
            <div
              className="modern-sidebar-logo"
              style={{ marginRight: '30px', cursor: 'pointer' }}
              onClick={goToHome}
              title="Go to Home"
            >
              <img
                src="./public/img/s_logo.png"
                alt="Systra Logo"
                style={{ width: '30px', height: '20px', objectFit: 'contain' }}
              />
            </div>
          )}

          {isOpen && (
            <button
              onClick={onToggle}
              style={{ padding: '0.5rem', background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgb(148, 163, 184)' }}
              title="Collapse sidebar"
            >
              <PanelLeftClose size={20} />
            </button>
          )}
        </div>
        {isOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center' }}>
          </motion.div>
        )}
        {!isOpen && (
          <button
            onClick={onToggle}
            style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgb(148, 163, 184)' }}
            title="Expand sidebar"
          >
            <PanelLeftOpen size={20} />
          </button>
        )}
      </div>

      <nav className="modern-sidebar-nav">
        {items.map((menuItem, index) => {
          const isExpanded = expandedItems.includes(menuItem.name)
          const hasChildren = menuItem.children && menuItem.children.length > 0
          const isHighlighted = index === 0
          const IconComponent = getIconComponent(menuItem.icon)

          return (
            <motion.div key={menuItem.name || index} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }} className="modern-sidebar-nav-group">
              <button
                onClick={() => {
                  if (hasChildren) {
                    toggleItem(menuItem.name)
                  } else {
                    handleItemClick(menuItem.url, menuItem)
                  }
                }}
                className={`modern-sidebar-nav-button ${isHighlighted ? 'active' : ''}`}
                style={!isOpen ? { justifyContent: 'center' } : {}}
                title={!isOpen ? menuItem.name : ''}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <IconComponent size={20} />
                    {isOpen && <span style={{ fontWeight: '500', fontSize: '0.875rem' }}>{menuItem.name}</span>}
                  </div>
                  {isOpen && hasChildren && (
                    <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.3 }}>
                      <ChevronDown size={16} />
                    </motion.div>
                  )}
                </div>
              </button>

              {isOpen && hasChildren && isExpanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} style={{ overflow: 'hidden' }}>
                  <div className="modern-sidebar-nav-submenu">
                    {menuItem.children.map((subItem, subIndex) => {
                      const hasSubChildren = subItem.children && subItem.children.length > 0
                      const subIsExpanded = expandedItems.includes(`${menuItem.name}-${subItem.name}`)
                      const SubIconComponent = getIconComponent(subItem.icon)

                      return (
                        <div key={`${menuItem.name}-${subItem.name}`}>
                          <motion.button
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: subIndex * 0.05 }}
                            onClick={() => {
                              if (hasSubChildren) {
                                toggleItem(`${menuItem.name}-${subItem.name}`)
                              } else {
                                handleItemClick(subItem.url, subItem)
                              }
                            }}
                            className="modern-sidebar-nav-submenu-item"
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <SubIconComponent size={16} />
                              <span>{subItem.name}</span>
                            </div>
                            {hasSubChildren && (
                              <motion.div animate={{ rotate: subIsExpanded ? 180 : 0 }} transition={{ duration: 0.3 }}>
                                <ChevronDown size={12} />
                              </motion.div>
                            )}
                          </motion.button>

                          {hasSubChildren && subIsExpanded && (
                            <AnimatePresence>
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden', marginLeft: '1rem', marginTop: '0.25rem', paddingLeft: '1rem', borderLeft: '2px solid rgba(71, 85, 105, 0.3)' }}>
                                {subItem.children.map((childItem, childIndex) => (
                                  <motion.button
                                    key={childItem.name}
                                    initial={{ opacity: 0, x: -5 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: childIndex * 0.03 }}
                                    onClick={() => handleItemClick(childItem.url, childItem)}
                                    className="modern-sidebar-nav-submenu-item"
                                    style={{ fontSize: '0.75rem', paddingLeft: '0.5rem' }}
                                  >
                                    {childItem.name}
                                  </motion.button>
                                ))}
                              </motion.div>
                            </AnimatePresence>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )
        })}
      </nav>

      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="modern-sidebar-footer" style={{ flexShrink: 0 }}>
          {/* <div className="modern-sidebar-footer-card">
            <p className="modern-sidebar-footer-text">Need Help?</p>
            <button className="modern-sidebar-footer-button">Contact Support →</button>
          </div> */}
        </motion.div>
      )}
    </div>
  )

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
        spotlightPadding={10}
        callback={handleJoyrideCallback}
        locale={{
          back: 'Back',
          close: 'Close',
          last: 'Got it!',
          next: 'Next',
          skip: 'Skip'
        }}
        styles={{
          options: {
            zIndex: 10000,
            primaryColor: '#1890ff',
            backgroundColor: '#fff',
            textColor: '#333',
            arrowColor: '#fff',
          },
          overlay: {
            zIndex: 9999,
          },
          buttonNext: {
            minWidth: '80px',
          },
          buttonBack: {
            marginRight: '10px',
            minWidth: '80px',
          },
        }}
      />
      <button onClick={() => setIsMobileOpen(!isMobileOpen)} className="modern-sidebar-mobile-button">
        {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

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

      <aside
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          height: '100vh',
          zIndex: 30,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          transition: 'all 0.3s ease',
          width: isOpen ? '288px' : '80px',
          overflow: 'hidden',
        }}
        className="hidden lg:block"
      >
        {sidebarContent}
      </aside>

      <aside
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: '288px',
          height: '100vh',
          zIndex: 40,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          transform: isMobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s ease',
          overflow: 'hidden',
        }}
        className="lg:hidden"
      >
        {sidebarContent}
      </aside>

      {/* <style>{`
        @media (min-width: 1024px) {
          aside:nth-of-type(1) {
            display: block !important;
          }
        }
        @media (max-width: 1023px) {
          aside:nth-of-type(2) {
            display: block !important;
          }
        }
      `}</style> */}
      <style>{`
  /* Extra small devices */
  @media (max-width: 479px) {
    aside:nth-of-type(2) {
      display: block !important;
    }
  }

  /* Small devices */
  @media (min-width: 480px) and (max-width: 767px) {
    aside:nth-of-type(2) {
      display: block !important;
    }
  }

  /* Medium devices / tablets */
  @media (min-width: 768px) and (max-width: 1023px) {
    aside:nth-of-type(2) {
      display: block !important;
    }
  }

  /* Your existing desktop rule */
  @media (min-width: 1024px) {
    aside:nth-of-type(1) {
      display: block !important;
    }
  }

  /* Large desktop */
  @media (min-width: 1280px) {
    aside:nth-of-type(1) {
      display: block !important;
    }
  }

  /* Extra large screens */
  @media (min-width: 1536px) {
    aside:nth-of-type(1) {
      display: block !important;
    }
  }

  /* Your existing mobile/tablet rule */
  @media (max-width: 1023px) {
    aside:nth-of-type(2) {
      display: block !important;
    }
  }
`}</style>
    </>
  )
}

export default ModernSidebar