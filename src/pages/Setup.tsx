import { useDatabase } from '@/hooks/useDatabase';
import { PasswordSetup } from '@/components/auth';
import './Setup.css';

export function Setup() {
  const { setupPassword, isLoading, error } = useDatabase();

  const handleSetup = async (password: string) => {
    await setupPassword(password);
    // If successful, App.tsx will route to the main app
  };

  return (
    <div className="setup-page">
      <div className="setup-container">
        <PasswordSetup
          onSetup={handleSetup}
          isLoading={isLoading}
          error={error}
        />
      </div>
    </div>
  );
}
