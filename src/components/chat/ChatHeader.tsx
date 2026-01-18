import { ModelSelectorIcon } from '../settings/ModelSelectorIcon';

interface ChatHeaderProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
}

export function ChatHeader({ selectedModel, onModelChange }: ChatHeaderProps) {
  return (
    <div className="flex justify-between items-center px-4 py-3 border-b border-border bg-card">
      <h3 className="text-sm font-medium text-muted-foreground m-0">Chat</h3>
      <ModelSelectorIcon value={selectedModel} onChange={onModelChange} />
    </div>
  );
}
