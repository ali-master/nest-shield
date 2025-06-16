/**
 * Shared header generation utility for rate limiting and throttling
 */
export class HeaderGeneratorUtil {
  /**
   * Generates rate limit headers for HTTP responses
   * @param options - Header generation options
   * @param options.limit - The rate limit
   * @param options.remaining - The remaining requests
   * @param options.reset - The reset date
   * @param options.retryAfter - Optional retry after value
   * @param options.prefix - Optional header prefix
   * @returns Object containing rate limit headers
   */
  static generateRateLimitHeaders(options: {
    limit: number;
    remaining: number;
    reset: Date;
    retryAfter?: number;
    prefix?: string;
  }): Record<string, string> {
    const prefix = options.prefix || "X-RateLimit";
    const headers: Record<string, string> = {
      [`${prefix}-Limit`]: String(options.limit),
      [`${prefix}-Remaining`]: String(Math.max(0, options.remaining)),
      [`${prefix}-Reset`]: String(Math.floor(options.reset.getTime() / 1000)),
    };

    if (options.retryAfter !== undefined && options.retryAfter > 0) {
      headers["Retry-After"] = String(Math.ceil(options.retryAfter / 1000));
    }

    return headers;
  }

  /**
   * Generates throttle headers for HTTP responses
   * @param options - Header generation options
   * @param options.limit - The throttle limit
   * @param options.ttl - Time to live in seconds
   * @param options.remaining - The remaining requests
   * @param options.reset - The reset date
   * @returns Object containing throttle headers
   */
  static generateThrottleHeaders(options: {
    limit: number;
    ttl: number;
    remaining: number;
    reset: Date;
  }): Record<string, string> {
    return {
      "X-Throttle-Limit": String(options.limit),
      "X-Throttle-TTL": String(options.ttl),
      "X-Throttle-Remaining": String(Math.max(0, options.remaining)),
      "X-Throttle-Reset": String(Math.floor(options.reset.getTime() / 1000)),
    };
  }

  /**
   * Generates circuit breaker headers for HTTP responses
   * @param options - Header generation options
   * @param options.state - The circuit breaker state
   * @param options.nextAttempt - Optional next attempt date
   * @param options.failureCount - Optional failure count
   * @returns Object containing circuit breaker headers
   */
  static generateCircuitBreakerHeaders(options: {
    state: "open" | "half-open" | "closed";
    nextAttempt?: Date;
    failureCount?: number;
  }): Record<string, string> {
    const headers: Record<string, string> = {
      "X-Circuit-Breaker-State": options.state,
    };

    if (options.nextAttempt) {
      headers["X-Circuit-Breaker-Next-Attempt"] = String(
        Math.floor(options.nextAttempt.getTime() / 1000),
      );
    }

    if (options.failureCount !== undefined) {
      headers["X-Circuit-Breaker-Failures"] = String(options.failureCount);
    }

    return headers;
  }

  /**
   * Merges multiple header objects into one
   * @param headerSets - Array of header objects to merge
   * @returns Merged headers
   */
  static mergeHeaders(...headerSets: Record<string, string>[]): Record<string, string> {
    return Object.assign({}, ...headerSets);
  }
}
