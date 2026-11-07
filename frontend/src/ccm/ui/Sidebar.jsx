/**
 * CCM sidebar — dark rail from the design: logo, the six CCM work areas, a
 * collapsible Settings group that holds the role-driven Master/Admin pages,
 * and the signed-in user with a sign-out menu.
 */
import React from 'react';
import {
  LayoutDashboard, FolderKanban, Inbox, Sparkles, ClipboardCheck, BookOpen, Settings, ChevronDown, LogOut,
} from 'lucide-react';
import { ROUTES, go, humanize } from './kit';

const PRIMARY = [
  { label: 'Dashboard', url: ROUTES.dashboard, icon: LayoutDashboard },
  { label: 'Projects', url: ROUTES.projects, icon: FolderKanban, match: ['/ccm/project'] },
  { label: 'Letters', url: ROUTES.letters, icon: Inbox },
  { label: 'AI Drafting', url: '/master/ai-drafting', icon: Sparkles },
  { label: 'My Drafts', url: '/ccm/review', icon: ClipboardCheck },
  { label: 'Knowledge Base', url: ROUTES.knowledge, icon: BookOpen },
];
const PRIMARY_URLS = new Set(PRIMARY.map((p) => p.url));

const currentPath = () => window.location.hash.replace(/^#/, '').split('?')[0] || '/';

function flatten(items) {
  const out = [];
  (items || []).forEach((it) => {
    if (it.url && !PRIMARY_URLS.has(it.url)) out.push(it);
    if (it.children) out.push(...flatten(it.children));
  });
  return out;
}

export default function Sidebar({ menuItems = [], userName, userRole, onSignOut }) {
  const [path, setPath] = React.useState(currentPath);
  const [open, setOpen] = React.useState(false);       // mobile drawer
  const [menuOpen, setMenuOpen] = React.useState(false); // user menu

  // Role-driven Master/Admin pages, grouped by their module group.
  const groups = React.useMemo(() => (menuItems || [])
    .map((g) => ({ name: g.name, items: flatten(g.children) }))
    .filter((g) => g.items.length > 0), [menuItems]);
  const settingsActive = groups.some((g) => g.items.some((i) => i.url === path));
  const [settingsOpen, setSettingsOpen] = React.useState(settingsActive);

  React.useEffect(() => {
    const onHash = () => { setPath(currentPath()); setOpen(false); };
    const onToggle = () => setOpen((v) => !v);
    window.addEventListener('hashchange', onHash);
    window.addEventListener('cx-toggle-sidebar', onToggle);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('cx-toggle-sidebar', onToggle);
    };
  }, []);

  React.useEffect(() => { if (settingsActive) setSettingsOpen(true); }, [settingsActive]);

  const isOn = (item) => item.url === path || (item.match || []).some((m) => path.startsWith(m));
  const initials = (userName || 'U').split(/\s+/).map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <>
      <aside className={`cx-sidebar ${open ? 'open' : ''}`} aria-label="Main navigation">
        <button type="button" className="cx-logo" onClick={() => go(ROUTES.dashboard)}>
          <span className="cx-logo-mark">C</span>
          <span className="cx-logo-text"><b>CCM</b><span>Correspondence Contract Mgmt</span></span>
        </button>

        {PRIMARY.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.url} type="button" className={`cx-nav-item ${isOn(item) ? 'on' : ''}`}
              aria-current={isOn(item) ? 'page' : undefined} onClick={() => go(item.url)}>
              <Icon />{item.label}
            </button>
          );
        })}

        {groups.length > 0 && (
          <>
            <button type="button" className={`cx-nav-item ${settingsActive && !settingsOpen ? 'on' : ''}`}
              aria-expanded={settingsOpen} onClick={() => setSettingsOpen((v) => !v)}>
              <Settings />Settings
              <ChevronDown className={`cx-chev ${settingsOpen ? 'open' : ''}`} />
            </button>
            {settingsOpen && (
              <div className="cx-nav-sub">
                {groups.map((g) => (
                  <React.Fragment key={g.name}>
                    <div className="cx-nav-group">{g.name}</div>
                    {g.items.map((item) => (
                      <button key={item.url} type="button" className={`cx-nav-item ${item.url === path ? 'on' : ''}`}
                        onClick={() => go(item.url)}>
                        {item.name}
                      </button>
                    ))}
                  </React.Fragment>
                ))}
              </div>
            )}
          </>
        )}

        <div className="cx-user">
          {menuOpen && (
            <div className="cx-user-menu" role="menu">
              <button type="button" role="menuitem" onClick={(e) => { setMenuOpen(false); onSignOut?.(e); }}>
                <LogOut size={14} style={{ verticalAlign: '-2px', marginRight: 8 }} />Sign out
              </button>
            </div>
          )}
          <button type="button" className="cx-user-btn" aria-haspopup="menu" aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}>
            <span className="cx-avatar">{initials}</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName || 'Signed in'}</span>
              <small>{userRole ? humanize(userRole) : 'Signed in'}</small>
            </span>
          </button>
        </div>
      </aside>
      {open && <div className="cx-scrim" style={{ zIndex: 35, background: 'rgba(10,12,16,.4)' }} onClick={() => setOpen(false)} />}
    </>
  );
}
