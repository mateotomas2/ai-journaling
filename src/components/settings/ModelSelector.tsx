import { useState, useEffect } from 'react';
import {
  fetchModels,
  FALLBACK_MODELS,
  FEATURED_MODEL_IDS,
  isFreeModel,
  formatPrice,
  sortModels,
  filterModels,
  type SortOption,
  type FilterOption,
} from '@/services/ai/models.service';
import type { AIModel } from '@/types/entities';
import { Check, ChevronsUpDown, ArrowUp, ArrowDown } from "lucide-react"

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
import { Label } from "@/components/ui/label"
import { OpenRouterPrivacyButton } from '@/components/common/OpenRouterPrivacyModal';

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  apiKey?: string | undefined;
}

export function ModelSelector({ value, onChange, apiKey }: ModelSelectorProps) {
  const [open, setOpen] = useState(false)
  const [models, setModels] = useState<AIModel[]>(FALLBACK_MODELS);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [filter, setFilter] = useState<FilterOption>('all');
  const [sort, setSort] = useState<SortOption>('default');
  const [providerFilter, setProviderFilter] = useState<string>('');

  useEffect(() => {
    async function loadModels() {
      try {
        setIsLoading(true);
        setHasError(false);
        const fetchedModels = await fetchModels(apiKey);
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
  }, [apiKey]);

  const selectedModel = models.find((model) => model.id === value)
  const providers = [...new Set(models.map(m => m.provider))].sort();
  const filtered = filterModels(models, filter);
  const byProvider = providerFilter ? filtered.filter(m => m.provider === providerFilter) : filtered;
  const displayModels = sortModels(byProvider, sort);

  const freeCount = models.filter(isFreeModel).length;
  const topCount = models.filter(m => FEATURED_MODEL_IDS.has(m.id)).length;

  function toggleSort(direction: 'price-asc' | 'price-desc') {
    setSort(prev => prev === direction ? 'default' : direction);
  }

  return (
    <div className="flex flex-col space-y-2 mb-4">
      <Label>Select Model</Label>

      {hasError && (
        <div className="text-sm text-destructive mb-2">
          Unable to load models from API. Showing fallback list.
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select AI Model"
            className="w-full justify-between"
            disabled={isLoading}
          >
            {isLoading ? "Loading models..." : (selectedModel
              ? `${selectedModel.name} — ${formatPrice(selectedModel.pricing.prompt)}`
              : "Select model...")}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[360px] min-w-[90%] p-0" align="start">
          <div className="flex items-center gap-1 p-2 border-b flex-wrap">
            {((['all', 'top', 'free'] as FilterOption[])).map(f => (
              <Button
                key={f}
                variant="ghost"
                size="sm"
                className={cn(
                  "h-6 px-2 text-xs",
                  filter === f && "bg-accent text-accent-foreground"
                )}
                onClick={() => setFilter(f)}
              >
                {f === 'all' && 'All'}
                {f === 'top' && `⭐ Top ${topCount}`}
                {f === 'free' && `Free ${freeCount}`}
              </Button>
            ))}
            <div className="ml-auto flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-6 px-2 text-xs", sort === 'price-asc' && "bg-accent text-accent-foreground")}
                onClick={() => toggleSort('price-asc')}
                title="Sort by price ascending"
              >
                <ArrowUp className="h-3 w-3 mr-1" />Price
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-6 px-2 text-xs", sort === 'price-desc' && "bg-accent text-accent-foreground")}
                onClick={() => toggleSort('price-desc')}
                title="Sort by price descending"
              >
                <ArrowDown className="h-3 w-3 mr-1" />Price
              </Button>
            </div>
          </div>
          <div className="flex gap-1 p-2 border-b overflow-x-auto">
            <Button
              key="all-providers"
              variant="ghost"
              size="sm"
              className={cn("h-6 px-2 text-xs", providerFilter === '' && "bg-accent text-accent-foreground")}
              onClick={() => setProviderFilter('')}
            >
              All providers
            </Button>
            {providers.map(p => (
              <Button
                key={p}
                variant="ghost"
                size="sm"
                className={cn("h-6 px-2 text-xs", providerFilter === p && "bg-accent text-accent-foreground")}
                onClick={() => setProviderFilter(prev => prev === p ? '' : p)}
              >
                {p}
              </Button>
            ))}
          </div>
          <Command>
            <CommandInput placeholder="Search models..." />
            <CommandList>
              <CommandEmpty>No model found.</CommandEmpty>
              <CommandGroup>
                {displayModels.map((model) => (
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
                    <div className="flex flex-col flex-1 min-w-0">
                      <span>{model.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {model.provider}
                        {isFreeModel(model) ? (
                          <span className="ml-1 text-green-600 font-medium">Free</span>
                        ) : (
                          <> • {formatPrice(model.pricing.prompt)} prompt · {formatPrice(model.pricing.completion)} completion</>
                        )}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          <div className="border-t p-2 flex justify-end">
            <OpenRouterPrivacyButton variant="icon" />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
