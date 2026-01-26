import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Register service worker for PWA functionality
if ('serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    const updateSW = registerSW({
      onNeedRefresh() {
        // Dispatch custom event for UpdatePrompt component to handle
        window.dispatchEvent(new CustomEvent('sw-update-available'));
      },
      onOfflineReady() {
        // Dispatch custom event to notify user app is ready for offline use
        window.dispatchEvent(new CustomEvent('sw-offline-ready'));
      },
    });

    // Make updateSW available globally for UpdatePrompt component
    (window as any).__updateSW = updateSW;
  });
}
