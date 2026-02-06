/**
 * Validation Schemas
 * Centralized validation using express-validator
 */

import { body, param, query } from 'express-validator';

// Common validators
export const validateId = param('id')
  .isUUID()
  .withMessage('ID must be a valid UUID');

export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

// Company validators
export const validateCompanyCreate = [
  body('razao_social')
    .trim()
    .notEmpty()
    .withMessage('Razão social is required')
    .isLength({ min: 3, max: 255 })
    .withMessage('Razão social must be between 3 and 255 characters'),
  body('nome_fantasia')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Nome fantasia must be less than 255 characters'),
  body('cnpj')
    .trim()
    .notEmpty()
    .withMessage('CNPJ is required')
    .matches(/^\d{14}$/)
    .withMessage('CNPJ must be 14 digits'),
  body('regime_tributario')
    .optional()
    .isIn(['MEI', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real'])
    .withMessage('Invalid tax regime'),
  body('cnae_principal')
    .optional()
    .trim()
    .matches(/^\d{7}$/)
    .withMessage('CNAE must be 7 digits'),
];

export const validateCompanyUpdate = [
  validateId,
  ...validateCompanyCreate.map(v => v.optional()),
];

// Client validators
export const validateClientCreate = [
  body('nome')
    .trim()
    .notEmpty()
    .withMessage('Nome is required')
    .isLength({ min: 2, max: 255 })
    .withMessage('Nome must be between 2 and 255 characters'),
  body('cpf')
    .optional()
    .trim()
    .matches(/^\d{11}$/)
    .withMessage('CPF must be 11 digits'),
  body('cnpj')
    .optional()
    .trim()
    .matches(/^\d{14}$/)
    .withMessage('CNPJ must be 14 digits'),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Email must be valid'),
];

// Invoice validators
export const validateInvoiceCreate = [
  body('company_id')
    .isUUID()
    .withMessage('Company ID must be a valid UUID'),
  body('cliente_id')
    .optional()
    .isUUID()
    .withMessage('Client ID must be a valid UUID'),
  body('servico')
    .trim()
    .notEmpty()
    .withMessage('Service description is required'),
  body('valor')
    .isFloat({ min: 0.01 })
    .withMessage('Value must be a positive number'),
];

// Certificate validators
export const validateCertificateUpload = [
  validateId,
  body('password')
    .notEmpty()
    .withMessage('Certificate password is required')
    .isLength({ min: 1 })
    .withMessage('Password cannot be empty'),
];

// Auth validators
export const validateRegister = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Email must be valid'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and number'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 255 })
    .withMessage('Name must be between 2 and 255 characters'),
];

export const validateLogin = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Email must be valid'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

// DAS validators
export const validateDASGenerate = [
  body('company_id')
    .isUUID()
    .withMessage('Company ID must be a valid UUID'),
  body('month')
    .isInt({ min: 1, max: 12 })
    .withMessage('Month must be between 1 and 12'),
  body('year')
    .isInt({ min: 2020, max: 2100 })
    .withMessage('Year must be valid'),
];

export const validateDASMarkPaid = [
  validateId,
  body('payment_date')
    .notEmpty()
    .withMessage('Payment date is required')
    .isISO8601()
    .withMessage('Payment date must be a valid ISO date'),
];

export default {
  validateId,
  validatePagination,
  validateCompanyCreate,
  validateCompanyUpdate,
  validateClientCreate,
  validateInvoiceCreate,
  validateCertificateUpload,
  validateRegister,
  validateLogin,
  validateDASGenerate,
  validateDASMarkPaid,
};
