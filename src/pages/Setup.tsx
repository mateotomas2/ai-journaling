import { useDatabase } from '@/hooks/useDatabase';
import { PasswordSetup } from '@/components/auth';


export function Setup() {
  const { setupPassword, isLoading, error } = useDatabase();

  const handleSetup = async (password: string) => {
    await setupPassword(password);
    // If successful, App.tsx will route to the main app
  };

  return (
    <div className="h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <PasswordSetup
          onSetup={handleSetup}
          isLoading={isLoading}
          error={error}
        />
      </div>
    </div>
  );
}
