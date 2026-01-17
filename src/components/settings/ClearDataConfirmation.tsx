/**
 * Clear Data Confirmation Modal
 * Requires typed confirmation to prevent accidental deletion
 */

import { useState } from 'react';
import './ClearDataConfirmation.css';

interface ClearDataConfirmationProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const CONFIRMATION_PHRASE = 'DELETE ALL DATA';

export function ClearDataConfirmation({ isOpen, onConfirm, onCancel }: ClearDataConfirmationProps) {
  const [confirmText, setConfirmText] = useState('');

  if (!isOpen) return null;

  const isConfirmed = confirmText === CONFIRMATION_PHRASE;

  const handleConfirm = () => {
    if (isConfirmed) {
      onConfirm();
      setConfirmText('');
    }
  };

  const handleCancel = () => {
    setConfirmText('');
    onCancel();
  };

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⚠️ Clear All Data</h2>
        </div>

        <div className="modal-body">
          <p className="warning-message">
            <strong>Are you sure you want to delete all your data?</strong>
          </p>
          <p className="warning-details">
            This action cannot be undone. All of the following will be permanently deleted:
          </p>
          <ul className="deletion-list">
            <li>All journal days and entries</li>
            <li>All chat messages and conversations</li>
            <li>All AI-generated summaries</li>
            <li>Your OpenRouter API key</li>
            <li>Your custom system prompt</li>
            <li>All application settings</li>
          </ul>

          <p className="confirmation-instruction">
            To confirm, type <code>{CONFIRMATION_PHRASE}</code> below:
          </p>

          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={`Type ${CONFIRMATION_PHRASE} to confirm`}
            className="confirmation-input"
            autoFocus
          />
        </div>

        <div className="modal-footer">
          <button
            type="button"
            onClick={handleCancel}
            className="btn-secondary"
            aria-label="Cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isConfirmed}
            className="btn-danger"
            aria-label="Confirm deletion"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
