import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModelSelectorPopover } from './ModelSelectorPopover';

interface ModelSelectorIconProps {
  value: string;
  onChange: (modelId: string) => void;
  apiKey?: string | undefined;
}

export function ModelSelectorIcon({ value, onChange, apiKey }: ModelSelectorIconProps) {
  return (
    <ModelSelectorPopover
      value={value}
      onChange={onChange}
      apiKey={apiKey}
      popoverContentProps={{ className: 'w-[min(400px,calc(100vw-1rem))]', align: 'end' }}
      trigger={({ selectedModel, isLoading }) => (
        <Button
          variant="ghost"
          role="combobox"
          aria-label="Select AI Model"
          className="!p-1 h-auto"
          disabled={isLoading}
        >
          <p className="text-xs text-muted-foreground max-w-[100px] truncate">{selectedModel?.name}</p>
          <ChevronDown size={1} className="text-muted-foreground" />
          <span className="sr-only">Select model</span>
        </Button>
      )}
    />
  );
}
