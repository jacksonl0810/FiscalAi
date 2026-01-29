/**
 * Global error handler middleware
 * Returns standardized error format: {status: 'error', message: string, code?: string}
 */
export const errorHandler = (err, req, res, next) => {
  // Extract error details safely
  const errorMessage = err?.message || (typeof err === 'string' ? err : 'Internal server error');
  const errorCode = err?.code || 'INTERNAL_ERROR';
  const statusCode = err?.statusCode || err?.status || 500;
  
  // Log error with full details
  console.error('[Error Handler]', {
    method: req.method,
    path: req.path,
    statusCode,
    errorCode,
    message: errorMessage,
    errorName: err?.name,
    stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined,
    errorData: err?.data ? JSON.stringify(err.data) : undefined
  });

  // Log full error object in development for debugging
  if (process.env.NODE_ENV === 'development') {
    console.error('[Error Handler] Full error object:', err);
  }

  // Prisma errors
  if (err.code === 'P2002') {
    return res.status(409).json({
      status: 'error',
      message: 'A record with this value already exists',
      code: 'DUPLICATE_ENTRY'
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      status: 'error',
      message: 'Record not found',
      code: 'NOT_FOUND'
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      status: 'error',
      message: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      status: 'error',
      message: 'Token expired',
      code: 'TOKEN_EXPIRED'
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      status: 'error',
      message: errorMessage,
      code: 'VALIDATION_ERROR',
      errors: err.errors
    });
  }

  // Default error
  const errorResponse = {
    status: 'error',
    message: errorMessage,
    code: errorCode
  };

  // Include additional error data if available (e.g., upgradeOptions for limit errors)
  if (err.data) {
    errorResponse.data = err.data;
  }

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * Async handler wrapper to catch errors in async routes
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Custom error class
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', data = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.data = data; // Additional error data (e.g., upgradeOptions, limitCheck)
    Error.captureStackTrace(this, this.constructor);
  }
}
