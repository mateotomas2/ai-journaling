import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ModelSelectorIcon } from '../settings/ModelSelectorIcon';

interface ChatHeaderProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  onNewChat: () => void;
  apiKey?: string | undefined;
}

export function ChatHeader({ selectedModel, onModelChange, onNewChat, apiKey }: ChatHeaderProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="flex justify-between items-center px-4 py-3 border-b border-border bg-card">
      <h3 className="text-sm font-medium text-muted-foreground m-0">Chat</h3>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label="New chat"
          onClick={() => setShowConfirm(true)}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <ModelSelectorIcon value={selectedModel} onChange={onModelChange} apiKey={apiKey} />
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start new chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all messages in the current chat session. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={onNewChat}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
