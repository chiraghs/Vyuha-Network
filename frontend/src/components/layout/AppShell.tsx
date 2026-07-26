import {
  BarChart3,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  MessageSquareText,
  Moon,
  Share2,
  Sun,
  Users,
} from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useI18n } from '../../context/LanguageContext';
import { LangToggle } from '../ui/LangToggle';
import { titleCase } from '../../lib/format';
import kspSeal from '../../assets/karnataka-seal.svg';

const NAV_ITEMS = [
  { to: '/', key: 'nav.overview', icon: LayoutDashboard, end: true },
  { to: '/map', key: 'nav.map', icon: MapIcon },
  { to: '/network', key: 'nav.network', icon: Share2 },
  { to: '/analytics', key: 'nav.analytics', icon: BarChart3 },
  { to: '/offenders', key: 'nav.offenders', icon: Users },
  { to: '/assistant', key: 'nav.assistant', icon: MessageSquareText },
];

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'page.overview.title', subtitle: 'page.overview.subtitle' },
  '/map': { title: 'page.map.title', subtitle: 'page.map.subtitle' },
  '/network': { title: 'page.network.title', subtitle: 'page.network.subtitle' },
  '/analytics': { title: 'page.analytics.title', subtitle: 'page.analytics.subtitle' },
  '/offenders': { title: 'page.offenders.title', subtitle: 'page.offenders.subtitle' },
  '/assistant': { title: 'page.assistant.title', subtitle: 'page.assistant.subtitle' },
};

export function AppShell() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useI18n();
  const location = useLocation();
  const meta =
    PAGE_META[location.pathname] ??
    (location.pathname.startsWith('/offenders/')
      ? { title: 'page.offenders.title', subtitle: 'page.offenders.subtitle' }
      : PAGE_META['/']);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="sidebar__brand-mark sidebar__brand-mark--seal">
            <img src={kspSeal} alt="Karnataka State Police" />
          </span>
          <div className="sidebar__brand-text">
            <div className="sidebar__brand-name">Vyuha Network</div>
            <div className="sidebar__brand-sub">{t('brand.sub')}</div>
          </div>
        </div>

        <div className="sidebar__section">{t('nav.section')}</div>
        <nav className="sidebar__nav" aria-label="Primary">
          {NAV_ITEMS.map(({ to, key, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="nav-item">
              <Icon size={16} />
              <span>{t(key)}</span>
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
            <span>{t('common.signOut')}</span>
          </button>
        </div>
      </aside>

      <div className="shell__main">
        <header className="topbar">
          <div>
            <div className="topbar__title">{t(meta.title)}</div>
            <div className="topbar__subtitle">{t(meta.subtitle)}</div>
          </div>
          <div className="topbar__actions">
            <span className="live-dot">{t('common.liveFeed')}</span>
            <LangToggle />
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
