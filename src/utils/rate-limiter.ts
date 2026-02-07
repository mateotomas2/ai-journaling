/**
 * Rate limiter utility to prevent API abuse
 * Uses sliding window algorithm
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 30,
  windowMs: 60000, // 1 minute
};

class RateLimiter {
  private requests: number[] = [];
  private config: RateLimitConfig;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  canMakeRequest(): boolean {
    this.cleanup();
    return this.requests.length < this.config.maxRequests;
  }

  recordRequest(): void {
    this.requests.push(Date.now());
  }

  getRemainingRequests(): number {
    this.cleanup();
    return Math.max(0, this.config.maxRequests - this.requests.length);
  }

  getResetTime(): number {
    if (this.requests.length === 0) return 0;
    const oldestRequest = this.requests[0];
    if (oldestRequest === undefined) return 0;
    return Math.max(0, oldestRequest + this.config.windowMs - Date.now());
  }

  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    this.requests = this.requests.filter((t) => t > windowStart);
  }
}

// Singleton instance for AI API calls
export const aiRateLimiter = new RateLimiter({
  maxRequests: 30,
  windowMs: 60000,
});

export class RateLimitError extends Error {
  constructor(
    public resetTime: number,
    message = 'Rate limit exceeded'
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export { RateLimiter };
