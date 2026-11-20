/**
 * SYNFIT AI FOUNDATION - ERROR BOUNDARIES
 * Standardized, normalized error taxonomy for AI services.
 */

export type AIErrorCode =
  | "AI_CONFIG_ERROR"
  | "AI_VALIDATION_ERROR"
  | "AI_AUTH_ERROR"
  | "AI_RATE_LIMIT"
  | "AI_PROVIDER_ERROR"
  | "AI_INJECTION_DETECTED"
  | "AI_DATA_MISSING";

export class AIServiceError extends Error {
  public readonly code: AIErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(message: string, code: AIErrorCode = "AI_PROVIDER_ERROR", statusCode = 500, details?: unknown) {
    super(message);
    this.name = "AIServiceError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, AIServiceError.prototype);
  }
}

export class AIValidationError extends AIServiceError {
  constructor(message: string, details?: unknown) {
    super(message, "AI_VALIDATION_ERROR", 400, details);
    this.name = "AIValidationError";
  }
}

export class AIAuthorizationError extends AIServiceError {
  constructor(message: string = "Unauthorized to perform this AI operation") {
    super(message, "AI_AUTH_ERROR", 403);
    this.name = "AIAuthorizationError";
  }
}

export class AIRateLimitError extends AIServiceError {
  constructor(message: string = "AI query rate limit exceeded. Please try again shortly.") {
    super(message, "AI_RATE_LIMIT", 429);
    this.name = "AIRateLimitError";
  }
}

export class AIInjectionError extends AIServiceError {
  constructor(message: string = "Prompt injection or unsafe instruction detected") {
    super(message, "AI_INJECTION_DETECTED", 400);
    this.name = "AIInjectionError";
  }
}
