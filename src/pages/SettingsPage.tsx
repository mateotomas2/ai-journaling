import { ApiKeySection } from '@/components/settings/ApiKeySection';
import { ModelSelectionSection } from '@/components/settings/ModelSelectionSection';
import { PromptCustomization } from '@/components/settings/PromptCustomization';
import { DataManagement } from '@/components/settings/DataManagement';
import { exportAllData, importData, clearAllData } from '@/services/settings/data-management.service';
import { Settings } from 'lucide-react';

export function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-border">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight m-0">Settings</h1>
          <p className="text-sm text-muted-foreground m-0">Configure your journal preferences</p>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        <ApiKeySection />
        <ModelSelectionSection />
        <PromptCustomization />
        <DataManagement
          onExport={exportAllData}
          onImport={importData}
          onClearData={clearAllData}
        />
      </div>
    </div>
  );
}
