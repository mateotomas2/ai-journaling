/**
 * Settings Page
 * Main container for all settings sections
 */

import { ApiKeySection } from '@/components/settings/ApiKeySection';
import './SettingsPage.css';

export function SettingsPage() {
  return (
    <div className="settings-page">
      <h1>Settings</h1>
      <p>Configure your journal preferences</p>

      <ApiKeySection />

      {/* Additional settings sections will be added in subsequent user story phases */}
    </div>
  );
}
