import { useState } from 'react';
import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface OpenRouterPrivacyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRIVACY_SETTINGS = [
  {
    recommended: false,
    label: 'Enable paid endpoints that may train on inputs',
    action: 'TURN OFF',
    description: 'Prevents paid AI providers from using your entries for model training.',
  },
  {
    recommended: false,
    label: 'Enable free endpoints that may train on inputs',
    action: 'TURN OFF',
    description: 'Free providers often retain and train on your prompts by default.',
  },
  {
    recommended: false,
    label: 'Enable free endpoints that may publish prompts',
    action: 'TURN OFF',
    description: 'Stops your journal entries from appearing in public datasets.',
  },
  {
    recommended: false,
    label: 'Enable 1% discount on all LLMs',
    action: 'TURN OFF',
    description: "Don't trade your privacy for a small discount.",
  },
  {
    recommended: true,
    label: 'ZDR Endpoints Only',
    action: 'TURN ON',
    description: "Only routes to Zero Data Retention endpoints — your data won't be stored.",
  },
];

export function OpenRouterPrivacyModal({ open, onOpenChange }: OpenRouterPrivacyModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>OpenRouter Privacy Settings</DialogTitle>
          <DialogDescription>
            Control how AI providers handle your journal data.
          </DialogDescription>
        </DialogHeader>

        <img
          src="/ai-journaling/images/open-router-privacy-settings.png"
          alt="OpenRouter Privacy & Guardrails settings page"
          className="w-full rounded-md border"
        />

        <div className="space-y-3">
          <p className="text-sm font-medium">Recommended settings:</p>
          {PRIVACY_SETTINGS.map((setting) => (
            <div key={setting.label} className="flex items-start gap-3">
              <span className="text-base shrink-0">{setting.recommended ? '✅' : '❌'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm">{setting.label}</span>
                  <span className="text-xs font-semibold bg-muted px-1.5 py-0.5 rounded shrink-0">
                    {setting.action}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{setting.description}</p>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button asChild>
            <a
              href="https://openrouter.ai/settings/privacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Privacy Settings on OpenRouter →
            </a>
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface OpenRouterPrivacyButtonProps {
  variant?: 'icon' | 'text';
}

export function OpenRouterPrivacyButton({ variant = 'text' }: OpenRouterPrivacyButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === 'icon' ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => setOpen(true)}
          title="OpenRouter privacy settings"
          aria-label="OpenRouter privacy settings"
        >
          <Shield className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="h-auto py-1 px-2 text-xs"
          onClick={() => setOpen(true)}
        >
          <Shield className="h-3 w-3 mr-1" />
          Privacy settings
        </Button>
      )}
      <OpenRouterPrivacyModal open={open} onOpenChange={setOpen} />
    </>
  );
}
