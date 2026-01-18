import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

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
    <Card className="border-destructive/50">
      <CardHeader>
        <div className="flex items-center gap-2 text-destructive mb-2">
          <AlertTriangle className="h-6 w-6" />
          <CardTitle>Important: No Password Recovery</CardTitle>
        </div>
        <CardDescription>
          Please read this carefully before proceeding.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Irreversible Action</AlertTitle>
          <AlertDescription>
            Your password cannot be recovered if forgotten. If you lose it, your journal data will be permanently inaccessible.
          </AlertDescription>
        </Alert>

        <div className="text-sm text-muted-foreground space-y-2">
          <p>Your journal is encrypted using a key derived from your password. This means:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Only you can access your journal entries</li>
            <li>Your data is protected even if someone accesses your device</li>
          </ul>
          <p className="font-medium text-foreground mt-4">
            We recommend writing down your password and storing it in a safe place.
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between gap-4">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Go Back
        </Button>
        <Button
          variant="destructive"
          onClick={onConfirm}
          disabled={isLoading}
        >
          {isLoading ? 'Creating...' : 'I Understand, Create My Journal'}
        </Button>
      </CardFooter>
    </Card>
  );
}
