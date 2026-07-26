import {
  BarChart3,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  MessageSquareText,
  Moon,
  Share2,
  Shield,
  Sun,
  Users,
} from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { titleCase } from '../../lib/format';

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/map', label: 'Hotspot Map', icon: MapIcon },
  { to: '/network', label: 'Link Analysis', icon: Share2 },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/offenders', label: 'Offenders', icon: Users },
  { to: '/assistant', label: 'AI Assistant', icon: MessageSquareText },
];

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Command Overview', subtitle: 'State-wide crime intelligence at a glance' },
  '/map': { title: 'Geospatial Hotspots', subtitle: 'Incident density and district drilldowns' },
  '/network': { title: 'Criminal Link Analysis', subtitle: 'Accomplice networks and hub detection' },
  '/analytics': { title: 'Correlation Analytics', subtitle: 'Socio-economic crime drivers' },
  '/offenders': { title: 'Repeat Offender Registry', subtitle: 'Predictive recidivism risk scoring' },
  '/assistant': { title: 'Investigation Assistant', subtitle: 'Bilingual conversational intelligence' },
};

export function AppShell() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const meta =
    PAGE_META[location.pathname] ??
    (location.pathname.startsWith('/offenders/')
      ? { title: 'Offender Dossier', subtitle: 'Confidential intelligence profile' }
      : PAGE_META['/']);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="sidebar__brand-mark">
            <Shield size={18} />
          </span>
          <div className="sidebar__brand-text">
            <div className="sidebar__brand-name">Vyuha Network</div>
            <div className="sidebar__brand-sub">KSP · SCRB Suite</div>
          </div>
        </div>

        <div className="sidebar__section">Intelligence</div>
        <nav className="sidebar__nav" aria-label="Primary">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="nav-item">
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          {user && (
            <div className="user-chip">
              <span className="user-chip__avatar">{user.username.slice(0, 2)}</span>
              <div className="user-chip__meta">
                <div className="user-chip__name">{user.username}</div>
                <div className="user-chip__role">{titleCase(user.role)}</div>
              </div>
            </div>
          )}
          <button className="btn btn--ghost btn--sm" onClick={logout} style={{ justifyContent: 'flex-start' }}>
            <LogOut size={14} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <div className="shell__main">
        <header className="topbar">
          <div>
            <div className="topbar__title">{meta.title}</div>
            <div className="topbar__subtitle">{meta.subtitle}</div>
          </div>
          <div className="topbar__actions">
            <span className="live-dot">Live feed</span>
            <button
              className="btn btn--ghost btn--icon"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  );
}
