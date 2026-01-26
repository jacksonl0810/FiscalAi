/**
 * Rate Limiting Middleware
 * 
 * Protects API endpoints from abuse and brute force attacks
 */

import rateLimit from 'express-rate-limit';

/**
 * General API rate limiter
 * 300 requests per 15 minutes per IP (increased from 100)
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs
  message: {
    status: 'error',
    message: 'Muitas requisições deste IP. Por favor, tente novamente em alguns minutos.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting in test/development environment
    return process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';
  }
});

/**
 * Strict rate limiter for authentication endpoints
 * 5 requests per 15 minutes per IP (prevents brute force)
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: {
    status: 'error',
    message: 'Muitas tentativas de login. Por favor, tente novamente em 15 minutos.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return process.env.NODE_ENV === 'test';
  }
});

/**
 * Rate limiter for AI assistant endpoints
 * 30 requests per minute per user (prevents API abuse)
 */
export const assistantLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit to 30 requests per minute
  message: {
    status: 'error',
    message: 'Muitas requisições ao assistente. Por favor, aguarde um momento.',
    code: 'ASSISTANT_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit per user instead of IP - user ID is string, safe for IPv6
    return req.user?.id || 'anonymous';
  },
  skip: (req) => {
    return process.env.NODE_ENV === 'test';
  },
  validate: false // Disable all validations
});

/**
 * Rate limiter for invoice emission
 * 10 emissions per hour per user (prevents abuse)
 */
export const invoiceEmissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit to 10 invoice emissions per hour
  message: {
    status: 'error',
    message: 'Limite de emissões por hora atingido. Por favor, aguarde antes de emitir mais notas.',
    code: 'INVOICE_EMISSION_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?.id || 'anonymous';
  },
  skip: (req) => {
    return process.env.NODE_ENV === 'test';
  },
  validate: false // Disable all validations
});

/**
 * Rate limiter for read-only assistant endpoints (history, etc.)
 * 60 requests per minute per user (more lenient for data fetching)
 */
export const assistantReadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Limit to 60 requests per minute (more lenient than assistantLimiter)
  message: {
    status: 'error',
    message: 'Muitas requisições. Por favor, aguarde um momento.',
    code: 'ASSISTANT_READ_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit per user instead of IP
    return req.user?.id || 'anonymous';
  },
  skip: (req) => {
    return process.env.NODE_ENV === 'test';
  },
  validate: false // Disable all validations
});

/**
 * Rate limiter for webhook endpoints
 * 100 requests per minute per IP
 */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Limit to 100 webhook requests per minute
  message: {
    status: 'error',
    message: 'Webhook rate limit exceeded',
    code: 'WEBHOOK_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return process.env.NODE_ENV === 'test';
  }
});

/**
 * Rate limiter for company fiscal connection checks
 * 10 requests per minute per user (prevents excessive polling)
 */
export const fiscalConnectionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit to 10 connection checks per minute
  message: {
    status: 'error',
    message: 'Muitas verificações de conexão fiscal. Aguarde 1 minuto antes de tentar novamente.',
    code: 'FISCAL_CONNECTION_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit per user instead of IP
    return req.user?.id || 'anonymous';
  },
  skip: (req) => {
    return process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';
  },
  validate: false // Disable all validations
});
