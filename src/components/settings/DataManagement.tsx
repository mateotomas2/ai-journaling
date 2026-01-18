import { useState, useRef } from 'react';
import { useToast } from '@/hooks/useToast';
import type { ImportResult } from '@/services/db/import';
import { ClearDataConfirmation } from './ClearDataConfirmation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Download, Trash2, AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react';

interface DataManagementProps {
  onExport: () => Promise<void>;
  onImport: (file: File) => Promise<ImportResult>;
  onClearData: () => Promise<void>;
}

export function DataManagement({ onExport, onImport, onClearData }: DataManagementProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExport();
      showToast('Data exported successfully', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      showToast(`Failed to export data: ${message}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const result = await onImport(file);
      setImportResult(result);

      if (result.success) {
        const total = result.imported.days + result.imported.messages + result.imported.summaries;
        showToast(`Successfully imported ${total} items`, 'success');
      } else if (result.errors.length > 0) {
        showToast(`Import completed with errors: ${result.errors[0]}`, 'info');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      showToast(`Failed to import data: ${message}`, 'error');
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClearData = () => {
    setShowClearConfirm(true);
  };

  const handleConfirmClear = async () => {
    try {
      await onClearData();
      showToast('All data cleared successfully', 'success');
      setShowClearConfirm(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      showToast(`Failed to clear data: ${message}`, 'error');
    }
  };

  const handleCancelClear = () => {
    setShowClearConfirm(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>
            Export your journal data for backup, import from a previous export, or permanently delete all data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Export & Import Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Export & Import</h3>

            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <p className="text-sm text-muted-foreground mb-3">
                  <strong>Export:</strong> Download all your journal data as a JSON file for backup or migration.
                </p>
                <Button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="w-full sm:w-auto"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {isExporting ? 'Exporting...' : 'Export Data'}
                </Button>
              </div>

              <div className="flex-1 min-w-[200px]">
                <p className="text-sm text-muted-foreground mb-3">
                  <strong>Import:</strong> Restore data from a previously exported file. Duplicate entries will be skipped.
                </p>
                <Button
                  onClick={handleImportClick}
                  disabled={isImporting}
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {isImporting ? 'Importing...' : 'Import Data'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                  aria-label="Import file selector"
                />
              </div>
            </div>

            {importResult && (
              <div className="mt-4 p-4 bg-muted rounded-md border text-sm">
                <h4 className="font-semibold mb-2 flex items-center">
                  {importResult.success && importResult.errors.length === 0 ? (
                    <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 mr-2 text-amber-500" />
                  )}
                  Import Summary
                </h4>
                <div className="space-y-1 ml-6">
                  <p>
                    <span className="font-medium">Imported:</span> {importResult.imported.days} days,{' '}
                    {importResult.imported.messages} messages, {importResult.imported.summaries} summaries
                  </p>
                  <p>
                    <span className="font-medium">Skipped:</span> {importResult.skipped.days} days,{' '}
                    {importResult.skipped.messages} messages, {importResult.skipped.summaries} summaries
                  </p>
                  {importResult.errors.length > 0 && (
                    <div className="mt-2 text-destructive">
                      <span className="font-medium">Errors:</span>
                      <ul className="list-disc pl-4 mt-1 space-y-1">
                        {importResult.errors.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Danger Zone */}
          <div className="space-y-4 pt-4">
            <h3 className="text-lg font-semibold text-destructive border-b border-destructive/30 pb-2">Danger Zone</h3>
            <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive mb-4 flex items-start">
                <AlertTriangle className="h-5 w-5 mr-2 shrink-0" />
                Clearing all data will permanently delete all journal entries, messages, summaries, and settings.
                This action cannot be undone.
              </p>
              <Button
                variant="destructive"
                onClick={handleClearData}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear All Data
              </Button>
            </div>
          </div>

        </CardContent>
      </Card>

      {showClearConfirm && (
        <ClearDataConfirmation
          isOpen={showClearConfirm}
          onConfirm={handleConfirmClear}
          onCancel={handleCancelClear}
        />
      )}
    </div>
  );
}
