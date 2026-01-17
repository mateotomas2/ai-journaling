/**
 * Data Management Component
 * Handles export, import, and clear all data operations
 */

import { useState, useRef } from 'react';
import { useToast } from '@/hooks/useToast';
import type { ImportResult } from '@/services/db/import';
import { ClearDataConfirmation } from './ClearDataConfirmation';
import './DataManagement.css';

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
        showToast(`Import completed with errors: ${result.errors[0]}`, 'warning');
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
    <div className="data-management">
      <h2>Data Management</h2>
      <p className="data-management-description">
        Export your journal data for backup, import from a previous export, or permanently delete all data.
      </p>

      <div className="data-management-section">
        <h3>Export & Import</h3>

        <div className="data-management-actions">
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="btn-primary"
            aria-label="Export data"
          >
            {isExporting ? 'Exporting...' : 'Export Data'}
          </button>

          <button
            type="button"
            onClick={handleImportClick}
            disabled={isImporting}
            className="btn-secondary"
            aria-label="Import data"
          >
            {isImporting ? 'Importing...' : 'Import Data'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            aria-label="Import file selector"
          />
        </div>

        {importResult && (
          <div className="import-result">
            <h4>Import Summary</h4>
            <p>
              <strong>Imported:</strong> {importResult.imported.days} days,{' '}
              {importResult.imported.messages} messages, {importResult.imported.summaries} summaries
            </p>
            <p>
              <strong>Skipped:</strong> {importResult.skipped.days} days,{' '}
              {importResult.skipped.messages} messages, {importResult.skipped.summaries} summaries
            </p>
            {importResult.errors.length > 0 && (
              <div className="import-errors">
                <strong>Errors:</strong>
                <ul>
                  {importResult.errors.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="data-management-info">
          <p>
            <strong>Export:</strong> Download all your journal data as a JSON file for backup or migration.
          </p>
          <p>
            <strong>Import:</strong> Restore data from a previously exported file. Duplicate entries will be skipped.
          </p>
        </div>
      </div>

      <div className="data-management-section danger-zone">
        <h3>Danger Zone</h3>
        <p className="warning-text">
          Clearing all data will permanently delete all journal entries, messages, summaries, and settings.
          This action cannot be undone.
        </p>

        <button
          type="button"
          onClick={handleClearData}
          className="btn-danger"
          aria-label="Clear all data"
        >
          Clear All Data
        </button>
      </div>

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
