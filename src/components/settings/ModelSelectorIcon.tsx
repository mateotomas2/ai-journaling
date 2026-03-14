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
import { Check, ChevronDown, ArrowUp, ArrowDown } from "lucide-react"
import { OpenRouterPrivacyButton } from '@/components/common/OpenRouterPrivacyModal';

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
  apiKey?: string | undefined;
}

export function ModelSelectorIcon({ value, onChange, apiKey }: ModelSelectorIconProps) {
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          aria-label="Select AI Model"
          className="!p-1 h-auto"
          disabled={isLoading}
        >
          <p className="text-xs text-muted-foreground max-w-[100px] truncate">{selectedModel?.name}</p>
          <ChevronDown size={1} className='text-muted-foreground' />
          <span className="sr-only">Select model</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(400px,calc(100vw-1rem))] p-0" align="end">
        {hasError && (
          <div className="text-xs text-destructive p-3 border-b">
            Unable to load models from API. Showing fallback list.
          </div>
        )}
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
        <div className="flex flex-wrap gap-1 p-2 border-b">
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
                    <span className="text-sm">{model.name}</span>
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

        {selectedModel && (
          <div className="border-t p-2 bg-muted/30 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Current: <span className="font-medium text-foreground">{selectedModel.name}</span>
              {!isFreeModel(selectedModel) && (
                <span className="ml-1">— {formatPrice(selectedModel.pricing.prompt)}</span>
              )}
              {isFreeModel(selectedModel) && (
                <span className="ml-1 text-green-600 font-medium">Free</span>
              )}
            </p>
            <OpenRouterPrivacyButton variant="icon" />
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
