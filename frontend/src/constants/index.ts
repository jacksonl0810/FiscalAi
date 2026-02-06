/**
 * Frontend Constants
 * Centralized constants for the frontend application
 */

// API Endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    LOGOUT: '/api/auth/logout',
    REFRESH: '/api/auth/refresh',
    ME: '/api/auth/me',
    GOOGLE: '/api/auth/google',
    GOOGLE_CALLBACK: '/api/auth/google/callback',
  },
  COMPANIES: {
    BASE: '/api/companies',
    BY_ID: (id: string) => `/api/companies/${id}`,
    REGISTER_FISCAL: (id: string) => `/api/companies/${id}/register-fiscal`,
    FISCAL_STATUS: (id: string) => `/api/companies/${id}/fiscal-status`,
    CERTIFICATE: (id: string) => `/api/companies/${id}/certificate`,
  },
  INVOICES: {
    BASE: '/api/invoices',
    BY_ID: (id: string) => `/api/invoices/${id}`,
    ISSUE: '/api/invoices/issue',
    CHECK_STATUS: (id: string) => `/api/invoices/${id}/check-status`,
    CANCEL: (id: string) => `/api/invoices/${id}/cancel`,
    PDF: (id: string) => `/api/invoices/${id}/pdf`,
    XML: (id: string) => `/api/invoices/${id}/xml`,
  },
  CLIENTS: {
    BASE: '/api/clients',
    BY_ID: (id: string) => `/api/clients/${id}`,
  },
  TAXES: {
    DAS: '/api/taxes/das',
    DAS_BY_ID: (id: string) => `/api/taxes/das/${id}`,
    DAS_GENERATE: '/api/taxes/das/generate',
    DAS_PAY: (id: string) => `/api/taxes/das/${id}/pay`,
    DAS_PDF: (id: string) => `/api/taxes/das/${id}/pdf`,
    SUMMARY: (companyId: string) => `/api/taxes/summary/${companyId}`,
    DAS_VALUES: '/api/taxes/das-values',
  },
  NOTIFICATIONS: {
    BASE: '/api/notifications',
    MARK_ALL_READ: '/api/notifications/mark-all-read',
    UNREAD_COUNT: '/api/notifications/unread-count',
  },
  SUBSCRIPTIONS: {
    BASE: '/api/subscriptions',
    CURRENT: '/api/subscriptions/current',
    CREATE: '/api/subscriptions/create',
    CANCEL: '/api/subscriptions/cancel',
    CHECKOUT: '/api/subscriptions/checkout',
    STRIPE_WEBHOOK: '/api/subscriptions/stripe-webhook',
  },
  ASSISTANT: {
    PROCESS: '/api/assistant/process',
    SUGGESTIONS: '/api/assistant/suggestions',
  },
} as const;

// Route Names
export const ROUTES = {
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  COMPANIES: '/companies',
  COMPANY_SETUP: '/company-setup',
  INVOICES: '/invoices',
  CLIENTS: '/clients',
  TAXES: '/taxes',
  DOCUMENTS: '/documents',
  NOTIFICATIONS: '/notifications',
  SETTINGS: '/settings',
  PRICING: '/pricing',
  ASSISTANT: '/assistant',
  ADMIN: '/admin',
} as const;

// Fiscal Connection Status
export const FISCAL_STATUS = {
  CONNECTED: 'connected',
  NOT_CONNECTED: 'not_connected',
  FAILED: 'failed',
  EXPIRED: 'expired',
  PENDING: 'pending',
} as const;

// Invoice Status
export const INVOICE_STATUS = {
  DRAFT: 'rascunho',
  ISSUED: 'emitida',
  CANCELED: 'cancelada',
  ERROR: 'erro',
} as const;

// Subscription Status
export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'ativo',
  INACTIVE: 'inativo',
  CANCELED: 'cancelado',
  PENDING: 'pending',
} as const;

// Tax Regimes
export const TAX_REGIMES = {
  MEI: 'MEI',
  SIMPLES_NACIONAL: 'Simples Nacional',
  LUCRO_PRESUMIDO: 'Lucro Presumido',
  LUCRO_REAL: 'Lucro Real',
} as const;

// Date Formats
export const DATE_FORMATS = {
  BR: 'dd/MM/yyyy',
  BR_DATETIME: 'dd/MM/yyyy HH:mm:ss',
  ISO: 'yyyy-MM-dd',
  ISO_DATETIME: "yyyy-MM-dd'T'HH:mm:ss",
} as const;

// Local Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER: 'user',
  THEME: 'theme',
  LANGUAGE: 'language',
} as const;

// Query Keys (React Query)
export const QUERY_KEYS = {
  USER: ['user'],
  COMPANIES: ['companies'],
  COMPANY: (id: string) => ['company', id],
  INVOICES: ['invoices'],
  INVOICE: (id: string) => ['invoice', id],
  CLIENTS: ['clients'],
  CLIENT: (id: string) => ['client', id],
  TAXES: ['taxes'],
  TAXES_SUMMARY: (companyId: string) => ['taxes', 'summary', companyId],
  NOTIFICATIONS: ['notifications'],
  NOTIFICATIONS_UNREAD: ['notifications', 'unread'],
  SUBSCRIPTION: ['subscription'],
  FISCAL_STATUS: (companyId: string) => ['fiscal-status', companyId],
} as const;

// Toast Durations
export const TOAST_DURATION = {
  SHORT: 2000,
  MEDIUM: 4000,
  LONG: 6000,
} as const;

// File Upload Limits
export const UPLOAD_LIMITS = {
  CERTIFICATE_SIZE: 10 * 1024 * 1024, // 10MB
  CERTIFICATE_TYPES: ['.pfx', '.p12'],
  AUDIO_SIZE: 25 * 1024 * 1024, // 25MB
} as const;

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export default {
  API_ENDPOINTS,
  ROUTES,
  FISCAL_STATUS,
  INVOICE_STATUS,
  SUBSCRIPTION_STATUS,
  TAX_REGIMES,
  DATE_FORMATS,
  STORAGE_KEYS,
  QUERY_KEYS,
  TOAST_DURATION,
  UPLOAD_LIMITS,
  PAGINATION,
};
