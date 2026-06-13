/**
 * Bolna API — Custom Error Classes
 *
 * Each error maps to an HTTP status code and machine-readable error code.
 * Used by the global error handler in route middleware.
 */

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Array<{ field: string; message: string }>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends ApiError {
  constructor(
    message: string = 'Request validation failed',
    details?: Array<{ field: string; message: string }>
  ) {
    super(400, 'validation_error', message, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = 'Invalid or missing API key') {
    super(401, 'authentication_error', message);
    this.name = 'AuthenticationError';
  }
}

export class PermissionDeniedError extends ApiError {
  constructor(message: string = 'Insufficient permissions') {
    super(403, 'permission_denied', message);
    this.name = 'PermissionDeniedError';
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string = 'Resource') {
    super(404, 'resource_not_found', `${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends ApiError {
  constructor(message: string = 'Resource already exists') {
    super(409, 'conflict', message);
    this.name = 'ConflictError';
  }
}

export class UnprocessableError extends ApiError {
  constructor(message: string = 'Business logic validation failed') {
    super(422, 'unprocessable_entity', message);
    this.name = 'UnprocessableError';
  }
}

export class RateLimitError extends ApiError {
  public readonly retryAfter: number;

  constructor(retryAfter: number = 300) {
    super(429, 'rate_limit_exceeded', `Rate limit exceeded. Retry after ${retryAfter} seconds.`);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class QuotaExceededError extends ApiError {
  constructor(message: string = 'Account quota exceeded') {
    super(429, 'quota_exceeded', message);
    this.name = 'QuotaExceededError';
  }
}

export class ProviderError extends ApiError {
  constructor(provider: string, message: string = 'Third-party provider failure') {
    super(502, 'provider_error', `${provider}: ${message}`);
    this.name = 'ProviderError';
  }
}

export class InternalError extends ApiError {
  constructor(message: string = 'An unexpected error occurred') {
    super(500, 'internal_error', message);
    this.name = 'InternalError';
  }
}
