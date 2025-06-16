/**
 * Common time constants used throughout the application
 */
export const TIME_CONSTANTS = {
  // Milliseconds
  ONE_SECOND: 1000,
  FIVE_SECONDS: 5 * 1000,
  TEN_SECONDS: 10 * 1000,
  THIRTY_SECONDS: 30 * 1000,
  ONE_MINUTE: 60 * 1000,
  FIVE_MINUTES: 5 * 60 * 1000,
  TEN_MINUTES: 10 * 60 * 1000,
  FIFTEEN_MINUTES: 15 * 60 * 1000,
  THIRTY_MINUTES: 30 * 60 * 1000,
  ONE_HOUR: 60 * 60 * 1000,
  ONE_DAY: 24 * 60 * 60 * 1000,
  ONE_WEEK: 7 * 24 * 60 * 60 * 1000,

  // Common timeouts
  DEFAULT_TIMEOUT: 5000,
  DEFAULT_CIRCUIT_BREAKER_TIMEOUT: 10000,
  DEFAULT_HTTP_TIMEOUT: 30000,
  DEFAULT_CLEANUP_INTERVAL: 60 * 1000,

  // Window sizes
  DEFAULT_WINDOW_SIZE: 60 * 1000, // 1 minute
  DEFAULT_METRIC_WINDOW: 5 * 60 * 1000, // 5 minutes
  DEFAULT_ANOMALY_WINDOW: 15 * 60 * 1000, // 15 minutes
} as const;

/**
 * Utility functions for time calculations
 */
export class TimeUtil {
  /**
   * Converts seconds to milliseconds
   */
  static secondsToMs(seconds: number): number {
    return seconds * TIME_CONSTANTS.ONE_SECOND;
  }

  /**
   * Converts milliseconds to seconds
   */
  static msToSeconds(ms: number): number {
    return Math.floor(ms / TIME_CONSTANTS.ONE_SECOND);
  }

  /**
   * Gets the current timestamp in seconds
   */
  static currentTimestampSeconds(): number {
    return Math.floor(Date.now() / TIME_CONSTANTS.ONE_SECOND);
  }

  /**
   * Calculates the next reset time based on a duration
   */
  static calculateResetTime(duration: number, fromTime = Date.now()): Date {
    return new Date(fromTime + duration);
  }

  /**
   * Checks if a timestamp has expired
   */
  static hasExpired(timestamp: number, ttl: number): boolean {
    return Date.now() > timestamp + ttl;
  }
}
