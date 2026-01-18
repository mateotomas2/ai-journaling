import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DatabaseProvider } from './db/DatabaseContext';
import { Layout } from './components/common/Layout';
import { TodayPage } from './pages/TodayPage';
import { DayPage } from './pages/DayPage';
import { HistoryPage } from './pages/HistoryPage';
import { CalendarPage } from './pages/CalendarPage';
import { SettingsPage } from './pages/SettingsPage';
import { UnlockPage } from './pages/UnlockPage';
import { Setup } from './pages/Setup';
import { useDatabase } from './hooks/useDatabase';
import { Loading } from './components/common/Loading';

function AppRoutes() {
  const { isUnlocked, isLoading, isFirstTime } = useDatabase();

  if (isLoading) {
    return <Loading message="Loading..." />;
  }

  // First-time user: show setup page
  if (isFirstTime) {
    return <Setup />;
  }

  // Returning user who hasn't unlocked: show unlock page
  if (!isUnlocked) {
    return <UnlockPage />;
  }

  // Authenticated user: show main app
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/today" replace />} />
        <Route path="/today" element={<TodayPage />} />
        <Route path="/day/:date" element={<DayPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Layout>
  );
}

import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"

export function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <BrowserRouter>
        <DatabaseProvider>
          <AppRoutes />
          <Toaster />
        </DatabaseProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
