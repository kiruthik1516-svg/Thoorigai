export class RbacError extends Error {
  public readonly status: number
  public readonly code: string
  public readonly details?: unknown

  constructor(message: string, status = 500, code = 'INTERNAL_ERROR', details?: unknown) {
    super(message)
    this.name = this.constructor.name
    this.status = status
    this.code = code
    this.details = details
  }
}

export class UnauthorizedError extends RbacError {
  constructor(message = 'Authentication is required.') {
    super(message, 401, 'UNAUTHORIZED')
  }
}

export class ForbiddenError extends RbacError {
  constructor(message = 'You do not have permission to perform this action.') {
    super(message, 403, 'FORBIDDEN')
  }
}

export class AccountPendingApprovalError extends RbacError {
  constructor(message = 'Your account is pending administrator approval.') {
    super(message, 403, 'ACCOUNT_PENDING_APPROVAL')
  }
}

export class ValidationError extends RbacError {
  constructor(message = 'Invalid request parameters.', details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details)
  }
}

export class RateLimitError extends RbacError {
  public readonly retryAfterSeconds: number

  constructor(message = 'Too many requests.', retryAfterSeconds = 60) {
    super(message, 429, 'RATE_LIMITED')
    this.retryAfterSeconds = retryAfterSeconds
  }
}
