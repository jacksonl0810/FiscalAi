/**
 * Application Constants
 * Centralized constants for the entire application
 */

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

// Error Codes
export const ERROR_CODES = {
  // Authentication
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_FIELD: 'MISSING_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  
  // Resources
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',
  
  // Business Logic
  FISCAL_NOT_CONNECTED: 'FISCAL_NOT_CONNECTED',
  SUBSCRIPTION_REQUIRED: 'SUBSCRIPTION_REQUIRED',
  PLAN_LIMIT_EXCEEDED: 'PLAN_LIMIT_EXCEEDED',
  CERTIFICATE_VERIFICATION_FAILED: 'CERTIFICATE_VERIFICATION_FAILED',
  CERTIFICATE_EXPIRED: 'CERTIFICATE_EXPIRED',
  CERTIFICATE_INVALID: 'CERTIFICATE_INVALID',
  
  // External Services
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  NUVEM_FISCAL_ERROR: 'NUVEM_FISCAL_ERROR',
  STRIPE_ERROR: 'STRIPE_ERROR',
  
  // System
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
};

// Fiscal Connection Status
export const FISCAL_STATUS = {
  CONNECTED: 'connected',
  NOT_CONNECTED: 'not_connected',
  FAILED: 'failed',
  EXPIRED: 'expired',
  PENDING: 'pending',
};

// Subscription Status
export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'ativo',
  INACTIVE: 'inativo',
  CANCELED: 'cancelado',
  PENDING: 'pending',
  TRIAL: 'trial',
};

// Invoice Status
export const INVOICE_STATUS = {
  DRAFT: 'rascunho',
  ISSUED: 'emitida',
  CANCELED: 'cancelada',
  ERROR: 'erro',
};

// Payment Status
export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded',
};

// User Roles
export const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  ACCOUNTANT: 'accountant',
};

// File Upload Limits
export const UPLOAD_LIMITS = {
  CERTIFICATE_SIZE: 10 * 1024 * 1024, // 10MB
  CERTIFICATE_TYPES: ['.pfx', '.p12'],
  AUDIO_SIZE: 25 * 1024 * 1024, // 25MB
  AUDIO_TYPES: ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/webm', 'audio/ogg'],
};

// Rate Limiting
export const RATE_LIMITS = {
  API: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // requests
  },
  AUTH: {
    windowMs: 15 * 60 * 1000,
    max: 5,
  },
  FISCAL_CONNECTION: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
  },
};

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

// Date Formats
export const DATE_FORMATS = {
  ISO: 'YYYY-MM-DD',
  BR: 'DD/MM/YYYY',
  DATETIME_BR: 'DD/MM/YYYY HH:mm:ss',
  DATETIME_ISO: 'YYYY-MM-DD HH:mm:ss',
};

// Brazilian Tax Regimes
export const TAX_REGIMES = {
  MEI: 'MEI',
  SIMPLES_NACIONAL: 'Simples Nacional',
  LUCRO_PRESUMIDO: 'Lucro Presumido',
  LUCRO_REAL: 'Lucro Real',
};

// DAS Values (2026 - based on projected minimum wage)
export const DAS_VALUES_2026 = {
  MINIMUM_WAGE: 1540.00, // Projected
  INSS: 154.00, // 10% of minimum wage
  ISS: 5.00, // Fixed for most municipalities
  ICMS: 0.00, // Usually 0 for MEI
  TOTAL: 159.00, // INSS + ISS
};

// Environment
export const ENV = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  TEST: 'test',
};

export default {
  HTTP_STATUS,
  ERROR_CODES,
  FISCAL_STATUS,
  SUBSCRIPTION_STATUS,
  INVOICE_STATUS,
  PAYMENT_STATUS,
  USER_ROLES,
  UPLOAD_LIMITS,
  RATE_LIMITS,
  PAGINATION,
  DATE_FORMATS,
  TAX_REGIMES,
  DAS_VALUES_2026,
  ENV,
};
