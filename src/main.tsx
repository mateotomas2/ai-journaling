import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

// Extend Window interface for PWA update function
declare global {
  interface Window {
    __updateSW?: (reloadPage?: boolean) => Promise<void>;
  }
}

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
    window.__updateSW = updateSW;
  });
}
