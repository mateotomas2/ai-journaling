/**
 * Settings Page
 * Main container for all settings sections
 */

import { ApiKeySection } from '@/components/settings/ApiKeySection';
import { PromptCustomization } from '@/components/settings/PromptCustomization';
import { DataManagement } from '@/components/settings/DataManagement';
import { exportAllData, importData, clearAllData } from '@/services/settings/data-management.service';
import './SettingsPage.css';

export function SettingsPage() {
  return (
    <div className="settings-page">
      <h1>Settings</h1>
      <p>Configure your journal preferences</p>

      <ApiKeySection />
      <PromptCustomization />
      <DataManagement
        onExport={exportAllData}
        onImport={importData}
        onClearData={clearAllData}
      />
    </div>
  );
}
