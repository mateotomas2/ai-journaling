import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"

interface ClearDataConfirmationProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const CONFIRMATION_PHRASE = 'DELETE ALL DATA';

export function ClearDataConfirmation({ isOpen, onConfirm, onCancel }: ClearDataConfirmationProps) {
  const [confirmText, setConfirmText] = useState('');

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
    <AlertDialog open={isOpen} onOpenChange={(open) => { if (!open) handleCancel() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive flex items-center gap-2">
            ⚠️ Clear All Data
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pt-2 text-foreground text-left">
              <p className="font-medium">
                Are you sure you want to delete all your data?
              </p>
              <div className="text-sm text-muted-foreground">
                This action cannot be undone. All of the following will be permanently deleted:
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>All journal days and entries</li>
                  <li>All chat messages and conversations</li>
                  <li>All AI-generated summaries</li>
                  <li>Your OpenRouter API key</li>
                  <li>Your custom system prompt</li>
                  <li>All application settings</li>
                </ul>
              </div>
              <div className="pt-2">
                <p className="text-sm mb-2">
                  To confirm, type <code className="bg-muted px-1 py-0.5 rounded font-mono font-bold text-destructive">{CONFIRMATION_PHRASE}</code> below:
                </p>
                <Input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={`Type ${CONFIRMATION_PHRASE} to confirm`}
                  className="font-mono border-destructive/50 focus-visible:ring-destructive"
                  autoFocus
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              if (isConfirmed) {
                handleConfirm();
              } else {
                e.preventDefault();
              }
            }}
            disabled={!isConfirmed}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Confirm Deletion
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
