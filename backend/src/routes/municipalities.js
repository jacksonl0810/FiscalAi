/**
 * Municipality Routes
 * Handles municipality coverage checking and validation
 */

import express from 'express';
import { query, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { 
  checkMunicipalitySupport, 
  checkAndUpdateMunicipalitySupport,
  getMunicipalitySupportStatus
} from '../services/municipalityService.js';
import { prisma } from '../index.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/municipalities/check
 * Check if a municipality is supported for NFS-e issuance
 * 
 * Query params:
 * - codigo_municipio: IBGE municipality code (7 digits)
 * - company_id: (optional) Company ID to check and update
 */
router.get('/check', [
  query('codigo_municipio').optional().isLength({ min: 7, max: 7 }).withMessage('Código do município deve ter 7 dígitos'),
  query('company_id').optional().isUUID().withMessage('Company ID inválido')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 'Validation failed', { errors: errors.array() }, 400);
  }

  const { codigo_municipio, company_id } = req.query;

  // If company_id is provided, check and update that company
  if (company_id) {
    // Verify company belongs to user
    const company = await prisma.company.findFirst({
      where: {
        id: company_id,
        userId: req.user.id
      }
    });

    if (!company) {
      throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
    }

    const supportStatus = await checkAndUpdateMunicipalitySupport(company_id);
    
    return sendSuccess(res, 'Municipality support checked', {
      supported: supportStatus.supported,
      message: supportStatus.message,
      checked_at: supportStatus.checkedAt,
      codigo_municipio: company.codigoMunicipio,
      data: supportStatus.data
    });
  }

  // If codigo_municipio is provided directly, check it
  if (codigo_municipio) {
    const supportStatus = await checkMunicipalitySupport(codigo_municipio);
    
    return sendSuccess(res, 'Municipality support checked', {
      supported: supportStatus.supported,
      message: supportStatus.message,
      checked_at: supportStatus.checkedAt,
      codigo_municipio: codigo_municipio.replace(/\D/g, ''),
      data: supportStatus.data
    });
  }

  // If neither provided, return error
  throw new AppError(
    'Either codigo_municipio or company_id must be provided',
    400,
    'MISSING_PARAMETER'
  );
}));

/**
 * GET /api/municipalities/company/:companyId/status
 * Get municipality support status for a specific company
 */
router.get('/company/:companyId/status', asyncHandler(async (req, res) => {
  const { companyId } = req.params;

  // Verify company belongs to user
  const company = await prisma.company.findFirst({
    where: {
      id: companyId,
      userId: req.user.id
    }
  });

  if (!company) {
    throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
  }

  const status = await getMunicipalitySupportStatus(companyId);
  
  return sendSuccess(res, 'Municipality status retrieved', status);
}));

export default router;
