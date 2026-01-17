interface PasswordWarningProps {
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function PasswordWarning({
  onConfirm,
  onCancel,
  isLoading = false,
}: PasswordWarningProps) {
  return (
    <div className="password-warning">
      <div className="warning-icon">⚠️</div>
      <h2>Important: No Password Recovery</h2>

      <div className="warning-content">
        <p>
          <strong>Your password cannot be recovered if forgotten.</strong>
        </p>
        <p>
          Your journal is encrypted using a key derived from your password. This
          means:
        </p>
        <ul>
          <li>Only you can access your journal entries</li>
          <li>Your data is protected even if someone accesses your device</li>
          <li>
            <strong>
              If you forget your password, your journal data will be permanently
              inaccessible
            </strong>
          </li>
        </ul>
        <p>
          We recommend writing down your password and storing it in a safe place.
        </p>
      </div>

      <div className="warning-actions">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="secondary"
        >
          Go Back
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
          className="primary"
        >
          {isLoading ? 'Creating...' : 'I Understand, Create My Journal'}
        </button>
      </div>
    </div>
  );
}
