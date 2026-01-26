import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DatabaseProvider } from './db/DatabaseContext';
import { Layout } from './components/common/Layout';
import { JournalPage } from './pages/JournalPage';
import { EntriesPage } from './pages/EntriesPage';
import { DayPage } from './pages/DayPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { UnlockPage } from './pages/UnlockPage';
import { Setup } from './pages/Setup';
import { useDatabase } from './hooks/useDatabase';
import { useEmbeddingService } from './hooks/useEmbeddingService';
import { Loading } from './components/common/Loading';

function AppRoutes() {
  const { isUnlocked, isLoading, isFirstTime } = useDatabase();

  // Initialize embedding service when user is unlocked
  const { isInitializing: embeddingInitializing, error: embeddingError } = useEmbeddingService({
    autoInitialize: isUnlocked && !isFirstTime,
  });

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

  // Show loading while embedding service initializes
  if (embeddingInitializing) {
    return <Loading message="Loading AI models..." />;
  }

  // Show error if embedding service failed to initialize (but don't block the app)
  if (embeddingError) {
    console.error('[App] Embedding service initialization failed:', embeddingError);
    // Continue to app anyway - embeddings will be disabled but app is usable
  }

  // Authenticated user: show main app
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/journal" replace />} />
        <Route path="/journal" element={<JournalPage />} />
        <Route path="/entries" element={<EntriesPage />} />
        <Route path="/day/:date" element={<DayPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Layout>
  );
}

import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { UpdatePrompt } from "@/components/pwa/UpdatePrompt"

export function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <DatabaseProvider>
          <AppRoutes />
          <Toaster />
          <UpdatePrompt />
        </DatabaseProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
