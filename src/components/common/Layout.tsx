import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { OfflineIndicator } from './OfflineIndicator';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

  // Global keyboard shortcuts
  useKeyboardNavigation({
    shortcuts: [
      { key: 't', action: () => navigate('/today'), description: 'Go to today' },
      { key: 'c', action: () => navigate('/calendar'), description: 'Go to calendar' },
      { key: 'h', action: () => navigate('/history'), description: 'Go to history' },
      { key: 's', action: () => navigate('/settings'), description: 'Go to settings' },
    ],
  });

  const navItems = [
    { path: '/today', label: 'Today', shortcut: 'T' },
    { path: '/calendar', label: 'Calendar', shortcut: 'C' },
    { path: '/history', label: 'History', shortcut: 'H' },
    { path: '/settings', label: 'Settings', shortcut: 'S' },
  ];

  return (
    <div className="layout">
      <header className="layout-header">
        <h1>Daily Journal</h1>
        <nav className="layout-nav" role="navigation" aria-label="Main navigation">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={location.pathname === item.path ? 'active' : ''}
              title={`${item.label} (Press ${item.shortcut})`}
              aria-current={location.pathname === item.path ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="layout-main">{children}</main>
      <OfflineIndicator />
    </div>
  );
}
