# API Contracts: AI Vector Memory

This directory contains TypeScript interface definitions that serve as contracts for the vector memory implementation. These contracts define the public API surface that components and services will implement.

## Files

### `embedding-service.ts`
Defines interfaces for the embedding generation service:
- `IEmbeddingService`: Main service interface for generating embeddings from text
- `EmbeddingResult`: Structure of embedding generation results
- `EmbeddingServiceConfig`: Configuration options for the service
- `EmbeddingWorkerMessage`: Web Worker message types for off-thread processing

**Key Responsibilities**:
- Load and initialize the embedding model (all-MiniLM-L6-v2)
- Generate embeddings from text using Web Workers
- Manage model lifecycle and device selection (WebGPU vs WASM)

### `memory-service.ts`
Defines interfaces for semantic search and memory management:
- `IMemoryService`: Main service for search and retrieval operations
- `ISimilaritySearch`: Abstraction for vector similarity algorithms
- `IMemoryIndexer`: Interface for managing embedding lifecycle
- `MemorySearchQuery`: Search query parameters
- `MemorySearchResult`: Search result structure with scores and excerpts

**Key Responsibilities**:
- Execute semantic similarity searches across journal entries
- Retrieve relevant context for AI conversations
- Manage the embedding index (create, update, delete)
- Handle batch indexing and cleanup operations

### `hooks.ts`
Defines interfaces for React hooks used in UI components:
- `IUseMemorySearch`: Hook for manual memory search UI
- `IUseContextRetrieval`: Hook for automatic context retrieval during chat
- `IUseMemoryIndex`: Hook for monitoring index status
- `IUseEmbeddingService`: Hook for embedding service status

**Key Responsibilities**:
- Provide React-friendly API for memory operations
- Handle loading states, errors, and debouncing
- Manage service initialization in component lifecycle

## Usage Examples

### Embedding Service
```typescript
import type { IEmbeddingService } from './embedding-service';

class EmbeddingService implements IEmbeddingService {
  async initialize(): Promise<void> {
    // Load model in Web Worker
  }

  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    // Generate 384-dimension vector
  }

  // ... implement other methods
}
```

### Memory Service
```typescript
import type { IMemoryService, MemorySearchQuery } from './memory-service';

class MemoryService implements IMemoryService {
  async search(query: MemorySearchQuery): Promise<MemorySearchResult[]> {
    // 1. Generate embedding for query
    // 2. Find similar embeddings
    // 3. Fetch and return messages with scores
  }

  // ... implement other methods
}
```

### React Hook
```typescript
import type { IUseMemorySearch, UseMemorySearchReturn } from './hooks';

export const useMemorySearch: IUseMemorySearch = (): UseMemorySearchReturn => {
  const [results, setResults] = useState<MemorySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const search = async (query: MemorySearchQuery) => {
    setIsSearching(true);
    const results = await memoryService.search(query);
    setResults(results);
    setIsSearching(false);
  };

  return { results, isSearching, search, /* ... */ };
};
```

## Design Principles

### 1. Interface Segregation
Separate interfaces for different concerns:
- Embedding generation (ML model operations)
- Memory search (business logic)
- Similarity computation (algorithm abstraction)
- UI state management (React hooks)

### 2. Dependency Inversion
Services depend on interfaces, not concrete implementations:
- `IMemoryService` depends on `IEmbeddingService` interface
- Allows swapping embedding models without changing memory service
- Enables easy mocking for tests

### 3. Single Responsibility
Each interface has one clear responsibility:
- `IEmbeddingService`: Generate embeddings
- `ISimilaritySearch`: Compute similarity
- `IMemoryIndexer`: Manage index lifecycle
- Hooks: Provide UI state management

### 4. Open/Closed Principle
Interfaces are open for extension, closed for modification:
- `ISimilaritySearch` allows swapping flat search for ANN
- `IEmbeddingService` supports different models via config
- No breaking changes when adding new search filters

## Testing Strategy

### Unit Tests
Each interface implementation tested independently:
```typescript
describe('EmbeddingService', () => {
  let service: IEmbeddingService;

  beforeEach(() => {
    service = new EmbeddingService(config);
  });

  test('generates normalized embeddings', async () => {
    const result = await service.generateEmbedding('test text');
    expect(result.vector).toHaveLength(384);
    expect(isNormalized(result.vector)).toBe(true);
  });
});
```

### Integration Tests
Test interface interactions:
```typescript
describe('MemoryService integration', () => {
  let memoryService: IMemoryService;
  let embeddingService: IEmbeddingService;

  test('search uses embedding service correctly', async () => {
    const spy = jest.spyOn(embeddingService, 'generateEmbedding');
    await memoryService.search({ query: 'test' });
    expect(spy).toHaveBeenCalledWith('test');
  });
});
```

### Contract Tests
Verify implementations satisfy interface contracts:
```typescript
function testIEmbeddingService(createService: () => IEmbeddingService) {
  test('throws on empty text', async () => {
    const service = createService();
    await expect(service.generateEmbedding('')).rejects.toThrow();
  });

  // ... more contract tests
}

// Apply to all implementations
testIEmbeddingService(() => new EmbeddingService(config));
testIEmbeddingService(() => new MockEmbeddingService());
```

## Migration Path

These contracts support future enhancements without breaking changes:

### Phase 1 → Phase 2: Add ANN Search
```typescript
// Old: Flat search
class FlatSimilaritySearch implements ISimilaritySearch { }

// New: ANN search (same interface)
class EdgeVecSimilaritySearch implements ISimilaritySearch { }

// Memory service unchanged (depends on interface)
const memoryService = new MemoryService(
  embeddingService,
  new EdgeVecSimilaritySearch() // Drop-in replacement
);
```

### Future: Upgrade Embedding Model
```typescript
// Add new config option
const config: EmbeddingServiceConfig = {
  modelName: 'all-mpnet-base-v2', // Upgraded model
  modelVersion: 'v1', // Track version
  device: 'webgpu',
};

// Service interface unchanged
const service: IEmbeddingService = new EmbeddingService(config);
```

## Documentation Standards

All interface methods include:
- JSDoc comments describing purpose
- `@param` tags for all parameters
- `@returns` tag describing return value
- `@throws` tag for expected errors
- Usage examples for complex methods

This ensures contracts are self-documenting and serve as API reference for implementers.
