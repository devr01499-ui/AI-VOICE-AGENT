// Bolna Voice Runtime Engine — Error Classes

/**
 * Base application error with HTTP status code and operational flag.
 * Operational errors are expected (bad input, not found) and handled gracefully.
 * Non-operational errors indicate bugs or infrastructure failures.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(statusCode: number, code: string, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  public readonly details: Array<{ field: string; message: string }>;

  constructor(
    message = 'Validation failed',
    details: Array<{ field: string; message: string }> = []
  ) {
    super(400, 'VALIDATION_ERROR', message);
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(404, 'NOT_FOUND', `${resource} not found`);
  }
}

export class ProviderError extends AppError {
  public readonly provider: string;

  constructor(provider: string, message: string) {
    super(502, 'PROVIDER_ERROR', `[${provider}] ${message}`);
    this.provider = provider;
  }
}

export class CallError extends AppError {
  public readonly callId: string;

  constructor(callId: string, message: string, statusCode = 500) {
    super(statusCode, 'CALL_ERROR', message);
    this.callId = callId;
  }
}

export class SessionError extends AppError {
  public readonly sessionId: string;

  constructor(sessionId: string, message: string) {
    super(500, 'SESSION_ERROR', message);
    this.sessionId = sessionId;
  }
}

export class DatabaseError extends AppError {
  constructor(message = 'Database operation failed') {
    super(500, 'DATABASE_ERROR', message, false);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, 'AUTH_ERROR', message);
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfter: number;

  constructor(retryAfter = 60) {
    super(429, 'RATE_LIMIT', `Rate limit exceeded. Retry after ${retryAfter}s`);
    this.retryAfter = retryAfter;
  }
}
