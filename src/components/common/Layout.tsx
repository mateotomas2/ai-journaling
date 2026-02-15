import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { OfflineIndicator } from './OfflineIndicator';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { MemorySearch } from '../search/MemorySearch';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { ModeToggle } from '@/components/mode-toggle';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { Search, BookOpen, List, Settings } from 'lucide-react';
import { SyncStatusIndicator } from './SyncStatusIndicator';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Cmd+K / Ctrl+K to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Global keyboard shortcuts
  useKeyboardNavigation({
    shortcuts: [
      { key: 'j', action: () => navigate('/journal'), description: 'Go to journal' },
      { key: 'e', action: () => navigate('/entries'), description: 'Go to entries' },
      { key: 's', action: () => navigate('/settings'), description: 'Go to settings' },
    ],
  });

  const navItems = [
    { path: '/journal', label: 'Journal', shortcut: 'J', icon: BookOpen },
    { path: '/entries', label: 'Entries', shortcut: 'E', icon: List },
    { path: '/settings', label: 'Settings', shortcut: 'S', icon: Settings },
  ];

  return (
    <div className="flex flex-col h-dvh overflow-hidden bg-gradient-to-b from-muted/30 to-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-4 lg:px-8">
          <div className="flex justify-end items-center h-16">
            <Link to="/journal" className="hidden sm:flex flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">DJ</span>
              </div>
              <h1 className="text-xl font-bold tracking-tight">Reflekt</h1>
            </Link>
            <div className="flex items-center gap-2">
              <nav className="flex items-center gap-1" role="navigation" aria-label="Main navigation">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                  const Icon = item.icon;
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
                      <Icon className="w-4 h-4" />
                      <span className="hidden sm:inline">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
              <div className="w-px h-6 bg-border mx-2" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSearchOpen(true)}
                className="flex items-center gap-2"
                title="Search journal (⌘K)"
              >
                <Search className="w-4 h-4" />
                <span className="hidden sm:inline">Search</span>
                <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </Button>
              <SyncStatusIndicator />
              <div className="w-px h-6 bg-border mx-2" />
              <ModeToggle />
              <InstallPrompt />
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="max-w-5xl mx-auto p-2">
          {children}
        </div>
      </main>
      <OfflineIndicator />

      {/* Memory Search Dialog */}
      <MemorySearch
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        onResultSelect={(entityType, entityId, dayId) => {
          if (entityType === 'note') {
            navigate(`/journal/${dayId}?noteId=${entityId}`);
          } else {
            navigate(`/journal/${dayId}`);
          }
        }}
      />
    </div>
  );
}
