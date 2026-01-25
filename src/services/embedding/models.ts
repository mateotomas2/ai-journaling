/**
 * Model configuration and device detection for embedding generation
 */

export const EMBEDDING_MODEL_CONFIG = {
  modelName: 'Xenova/all-MiniLM-L6-v2',
  modelVersion: 'all-MiniLM-L6-v2@v0',
  dimensions: 384,
  maxTokens: 256,
  quantization: 'q8' as const,
} as const;

export type EmbeddingDevice = 'webgpu' | 'wasm';

/**
 * Detect if WebGPU is available in the browser
 */
export async function detectWebGPUSupport(): Promise<boolean> {
  if (typeof navigator === 'undefined') {
    return false; // Server-side or non-browser environment
  }

  if (!('gpu' in navigator)) {
    return false; // WebGPU API not available
  }

  try {
    const adapter = await (navigator as any).gpu.requestAdapter();
    return adapter !== null;
  } catch (error) {
    console.warn('[Models] WebGPU detection failed:', error);
    return false;
  }
}

/**
 * Get recommended device for embedding generation
 * Checks for WebGPU support and falls back to WASM
 */
export async function getRecommendedDevice(): Promise<EmbeddingDevice> {
  const hasWebGPU = await detectWebGPUSupport();

  if (hasWebGPU) {
    console.log('[Models] WebGPU is available - using GPU acceleration');
    return 'webgpu';
  } else {
    console.log('[Models] WebGPU not available - falling back to WebAssembly');
    return 'wasm';
  }
}

/**
 * Estimate model download size in MB
 */
export function getModelSize(): number {
  return 22; // all-MiniLM-L6-v2 is ~22MB
}

/**
 * Get expected performance metrics for the model
 */
export function getPerformanceExpectations(device: EmbeddingDevice): {
  initTimeMs: number;
  embeddingTimeMs: number;
} {
  if (device === 'webgpu') {
    return {
      initTimeMs: 200, // Model initialization
      embeddingTimeMs: 35, // Average per embedding (20-50ms)
    };
  } else {
    return {
      initTimeMs: 500, // Model initialization (slower on WASM)
      embeddingTimeMs: 100, // Average per embedding (50-150ms)
    };
  }
}

/**
 * Check if the browser meets minimum requirements for embedding generation
 */
export function checkBrowserCompatibility(): {
  compatible: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check for Web Worker support
  if (typeof Worker === 'undefined') {
    issues.push('Web Workers not supported');
  }

  // Check for WebAssembly support
  if (typeof WebAssembly === 'undefined') {
    issues.push('WebAssembly not supported');
  }

  // Check for IndexedDB (required for model caching)
  if (!('indexedDB' in window)) {
    issues.push('IndexedDB not supported - model caching unavailable');
  }

  // Check for crypto.randomUUID (for generating IDs)
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
    issues.push('crypto.randomUUID not supported');
  }

  return {
    compatible: issues.length === 0,
    issues,
  };
}

/**
 * Format model version string
 */
export function formatModelVersion(version: string): string {
  return `v${version.replace(/^v/, '')}`;
}

/**
 * Check if a vector is normalized (sum of squares ≈ 1.0)
 */
export function isNormalizedVector(vector: Float32Array | number[], tolerance: number = 0.01): boolean {
  const sumOfSquares = Array.from(vector).reduce((sum, val) => sum + val * val, 0);
  return Math.abs(sumOfSquares - 1.0) < tolerance;
}

/**
 * Validate that a vector has the correct dimensions
 */
export function validateVectorDimensions(vector: Float32Array | number[]): boolean {
  return vector.length === EMBEDDING_MODEL_CONFIG.dimensions;
}
