/**
 * Fetch utilities with timeout and retry support
 */

export interface FetchWithTimeoutOptions extends RequestInit {
  timeout?: number;
}

export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeout = 30000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  retryOn?: (response: Response) => boolean;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 2,
  baseDelay: 1000,
  maxDelay: 10000,
  retryOn: (response) => response.status >= 500 || response.status === 429,
};

export async function fetchWithRetry(
  url: string,
  options: FetchWithTimeoutOptions & RetryOptions = {}
): Promise<Response> {
  const { maxRetries, baseDelay, maxDelay, retryOn, ...fetchOptions } = {
    ...DEFAULT_RETRY_OPTIONS,
    ...options,
  };

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, fetchOptions);

      // If response is ok or we shouldn't retry, return it
      if (response.ok || !retryOn(response)) {
        return response;
      }

      // Clone the response so we can read it for error info
      if (attempt === maxRetries) {
        return response;
      }

      // Wait before retry with exponential backoff
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      await new Promise((resolve) => setTimeout(resolve, delay));
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on abort (timeout)
      if (lastError.name === 'AbortError') {
        throw new Error('Request timed out');
      }

      // If this was the last attempt, throw
      if (attempt === maxRetries) {
        throw lastError;
      }

      // Wait before retry
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Request failed after retries');
}
