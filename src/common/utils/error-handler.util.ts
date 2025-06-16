import { Logger } from "@nestjs/common";

/**
 * Common error handling utility
 */
export class ErrorHandlerUtil {
  private static readonly defaultLogger = new Logger("ErrorHandler");

  /**
   * Handles errors with consistent logging and re-throwing
   * @param error - The error to handle
   * @param context - Context for logging
   * @param logger - Optional logger instance
   * @param rethrow - Whether to re-throw the error
   */
  static handle(
    error: unknown,
    context: string,
    logger: Logger = this.defaultLogger,
    rethrow = true,
  ): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error(`Error in ${context}: ${errorMessage}`, errorStack);

    if (rethrow) {
      throw error;
    }
  }

  /**
   * Handles errors with a fallback value
   * @param error - The error to handle
   * @param context - Context for logging
   * @param fallbackValue - Value to return if error occurs
   * @param logger - Optional logger instance
   * @returns The fallback value
   */
  static handleWithFallback<T>(
    error: unknown,
    context: string,
    fallbackValue: T,
    logger: Logger = this.defaultLogger,
  ): T {
    this.handle(error, context, logger, false);
    return fallbackValue;
  }

  /**
   * Wraps an async function with error handling
   * @param fn - The async function to wrap
   * @param context - Context for logging
   * @param logger - Optional logger instance
   * @returns Wrapped function
   */
  static wrapAsync<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    context: string,
    logger: Logger = this.defaultLogger,
  ): T {
    return (async (...args: Parameters<T>) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handle(error, context, logger);
      }
    }) as T;
  }

  /**
   * Creates a standardized error message
   * @param operation - The operation that failed
   * @param details - Additional error details
   * @returns Formatted error message
   */
  static createErrorMessage(operation: string, details?: string): string {
    return details ? `${operation} failed: ${details}` : `${operation} failed`;
  }

  /**
   * Checks if an error is retriable
   * @param error - The error to check
   * @returns Whether the error is retriable
   */
  static isRetriableError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    // Common retriable error patterns
    const retriablePatterns = [
      /ECONNREFUSED/i,
      /ETIMEDOUT/i,
      /ENOTFOUND/i,
      /ENETUNREACH/i,
      /EAI_AGAIN/i,
      /socket hang up/i,
      /EPIPE/i,
    ];

    return retriablePatterns.some((pattern) => pattern.test(error.message));
  }
}
