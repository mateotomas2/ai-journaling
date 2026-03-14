import { ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { formatPrice, isFreeModel } from '@/services/ai/models.service';
import { ModelSelectorPopover } from './ModelSelectorPopover';

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  apiKey?: string | undefined;
}

export function ModelSelector({ value, onChange, apiKey }: ModelSelectorProps) {
  return (
    <div className="flex flex-col space-y-2 mb-4">
      <Label>Select Model</Label>
      <ModelSelectorPopover
        value={value}
        onChange={onChange}
        apiKey={apiKey}
        popoverContentProps={{ className: 'w-[360px] min-w-[90%]', align: 'start' }}
        trigger={({ selectedModel, isLoading }) => (
          <Button
            variant="outline"
            role="combobox"
            aria-label="Select AI Model"
            className="w-full justify-between"
            disabled={isLoading}
          >
            {isLoading
              ? 'Loading models...'
              : selectedModel
                ? `${selectedModel.name} — ${isFreeModel(selectedModel) ? 'Free' : formatPrice(selectedModel.pricing.prompt)}`
                : 'Select model...'}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        )}
      />
    </div>
  );
}
