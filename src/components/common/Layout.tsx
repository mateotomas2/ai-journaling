import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { OfflineIndicator } from './OfflineIndicator';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { ModeToggle } from '@/components/mode-toggle';

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
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-muted/30 to-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/today" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">DJ</span>
              </div>
              <h1 className="text-xl font-bold tracking-tight">Daily Journal</h1>
            </Link>
            <div className="flex items-center gap-2">
              <nav className="flex items-center gap-1" role="navigation" aria-label="Main navigation">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        buttonVariants({ variant: isActive ? 'default' : 'ghost', size: 'sm' }),
                        'transition-all duration-200',
                        isActive && 'shadow-sm'
                      )}
                      title={`${item.label} (Press ${item.shortcut})`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="w-px h-6 bg-border mx-2" />
              <ModeToggle />
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </div>
      </main>
      <OfflineIndicator />
    </div>
  );
}
