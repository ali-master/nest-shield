import { HttpException, HttpStatus } from "@nestjs/common";

export class ShieldException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.TOO_MANY_REQUESTS,
    public readonly retryAfter?: number,
    public readonly metadata?: Record<string, any>,
  ) {
    super(
      {
        statusCode,
        message,
        error: "Shield Protection",
        retryAfter,
        ...metadata,
      },
      statusCode,
    );
  }
}

export class CircuitBreakerException extends ShieldException {
  constructor(message: string = "Circuit breaker is OPEN", metadata?: Record<string, any>) {
    super(message, HttpStatus.SERVICE_UNAVAILABLE, undefined, {
      type: "circuit-breaker",
      ...metadata,
    });
  }
}

export class RateLimitException extends ShieldException {
  constructor(
    message: string = "Rate limit exceeded",
    retryAfter?: number,
    metadata?: Record<string, any>,
  ) {
    super(message, HttpStatus.TOO_MANY_REQUESTS, retryAfter, {
      type: "rate-limit",
      ...metadata,
    });
  }
}

export class ThrottleException extends ShieldException {
  constructor(
    message: string = "Too many requests",
    retryAfter?: number,
    metadata?: Record<string, any>,
  ) {
    super(message, HttpStatus.TOO_MANY_REQUESTS, retryAfter, {
      type: "throttle",
      ...metadata,
    });
  }
}

export class OverloadException extends ShieldException {
  constructor(message: string = "Server is overloaded", metadata?: Record<string, any>) {
    super(message, HttpStatus.SERVICE_UNAVAILABLE, undefined, {
      type: "overload",
      ...metadata,
    });
  }
}

export class StorageException extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "StorageException";
  }
}

export class ConfigurationException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationException";
  }
}
