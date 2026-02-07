import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ShieldX, Trash2 } from 'lucide-react';
import { ClearDataConfirmation } from '@/components/settings/ClearDataConfirmation';
import { forceDeleteAllData } from '@/services/settings/data-management.service';

export function ForgotPasswordPage() {
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleClearData = async () => {
    setIsClearing(true);
    try {
      await forceDeleteAllData();
      // forceDeleteAllData reloads the page, so we won't reach here
    } catch {
      setIsClearing(false);
      setShowClearConfirmation(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/50 to-background p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl border-border/50">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
              <ShieldX className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle className="text-lg">Password Cannot Be Recovered</CardTitle>
            <CardDescription className="text-left mt-4 space-y-3">
              <p>
                Your journal data is encrypted locally on your device using your password.
                We never store your password or have any way to access your data.
              </p>
              <p>
                This means <strong>there is no way to recover a forgotten password</strong>.
                Without your password, your encrypted data cannot be decrypted.
              </p>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 rounded-lg bg-destructive/10 text-sm">
              <p className="font-medium text-destructive mb-1">Your only option:</p>
              <p className="text-muted-foreground">
                Clear all data and start fresh with a new password. This will permanently
                delete all your journal entries, conversations, and settings.
              </p>
            </div>

            <Button
              variant="destructive"
              className="w-full"
              onClick={() => setShowClearConfirmation(true)}
              disabled={isClearing}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {isClearing ? 'Clearing...' : 'Clear All Data & Start Over'}
            </Button>

            <Link to="/" className="block">
              <Button variant="ghost" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Unlock
              </Button>
            </Link>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          This is by design to protect your privacy
        </p>
      </div>

      <ClearDataConfirmation
        isOpen={showClearConfirmation}
        onConfirm={handleClearData}
        onCancel={() => setShowClearConfirmation(false)}
      />
    </div>
  );
}
