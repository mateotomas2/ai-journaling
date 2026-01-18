import { useState, useEffect } from 'react';
import { fetchModels, FALLBACK_MODELS } from '@/services/ai/models.service';
import type { AIModel } from '@/types/entities';
import { Check, Cpu } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface ModelSelectorIconProps {
  value: string;
  onChange: (modelId: string) => void;
}

export function ModelSelectorIcon({ value, onChange }: ModelSelectorIconProps) {
  const [open, setOpen] = useState(false)
  const [models, setModels] = useState<AIModel[]>(FALLBACK_MODELS);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    async function loadModels() {
      try {
        setIsLoading(true);
        setHasError(false);
        const fetchedModels = await fetchModels();
        setModels(fetchedModels);
      } catch (error) {
        console.error('Failed to load models:', error);
        setHasError(true);
        setModels(FALLBACK_MODELS);
      } finally {
        setIsLoading(false);
      }
    }

    loadModels();
  }, []);

  const selectedModel = models.find((model) => model.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          role="combobox"
          aria-expanded={open}
          aria-label="Select AI Model"
          disabled={isLoading}
          className="h-9 w-9"
        >
          <Cpu className="h-4 w-4" />
          <span className="sr-only">Select model</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="end">
        {hasError && (
          <div className="text-xs text-destructive p-3 border-b">
            Unable to load models from API. Showing fallback list.
          </div>
        )}
        <Command>
          <CommandInput placeholder="Search models..." />
          <CommandList>
            <CommandEmpty>No model found.</CommandEmpty>
            <CommandGroup>
              {models.map((model) => (
                <CommandItem
                  key={model.id}
                  value={model.name + " " + model.provider + " " + model.id}
                  onSelect={() => {
                    onChange(model.id)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === model.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="text-sm">{model.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {model.provider} • ${model.pricing.prompt}/tok
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>

        {selectedModel && (
          <div className="border-t p-2 bg-muted/30">
            <p className="text-xs text-muted-foreground">
              Current: <span className="font-medium text-foreground">{selectedModel.name}</span>
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
