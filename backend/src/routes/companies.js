import express from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../index.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireActiveSubscription } from '../middleware/subscriptionAccess.js';
import { registerCompany, checkConnection } from '../services/nuvemFiscal.js';
import { getMEILimitStatus } from '../services/meiLimitTracking.js';
import { sendSuccess } from '../utils/response.js';

const router = express.Router();

// All routes require authentication and active subscription
router.use(authenticate);
router.use(requireActiveSubscription);

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Transform Prisma company data from camelCase to snake_case
const transformCompany = (company) => {
  if (!company) return company;
  return {
    id: company.id,
    user_id: company.userId,
    cnpj: company.cnpj,
    razao_social: company.razaoSocial,
    nome_fantasia: company.nomeFantasia,
    cidade: company.cidade,
    uf: company.uf,
    cnae_principal: company.cnaePrincipal,
    regime_tributario: company.regimeTributario,
    certificado_digital: company.certificadoDigital,
    email: company.email,
    telefone: company.telefone,
    inscricao_municipal: company.inscricaoMunicipal,
    nuvem_fiscal_id: company.nuvemFiscalId,
    created_at: company.createdAt,
    updated_at: company.updatedAt,
  };
};

/**
 * GET /api/companies
 * List all companies for the current user
 */
router.get('/', asyncHandler(async (req, res) => {
  const companies = await prisma.company.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' }
  });

  res.json(companies.map(transformCompany));
}));

/**
 * GET /api/companies/:id
 * Get a single company
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const company = await prisma.company.findFirst({
    where: {
      id: req.params.id,
      userId: req.user.id
    }
  });

  if (!company) {
    throw new AppError('Company not found', 404, 'NOT_FOUND');
  }

  res.json(transformCompany(company));
}));

/**
 * POST /api/companies
 * Create a new company
 */
router.post('/', [
  body('cnpj').notEmpty().withMessage('CNPJ is required'),
  body('razao_social').notEmpty().withMessage('Razão Social is required'),
  body('cidade').notEmpty().withMessage('Cidade is required'),
  body('uf').isLength({ min: 2, max: 2 }).withMessage('UF must be 2 characters'),
  body('regime_tributario').notEmpty().withMessage('Regime Tributário is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('telefone').notEmpty().withMessage('Telefone is required'),
  body('inscricao_municipal').notEmpty().withMessage('Inscrição Municipal is required')
], validateRequest, asyncHandler(async (req, res) => {
  const {
    cnpj,
    razao_social,
    nome_fantasia,
    cidade,
    uf,
    cnae_principal,
    regime_tributario,
    certificado_digital,
    email,
    telefone,
    inscricao_municipal
  } = req.body;

  const company = await prisma.company.create({
    data: {
      userId: req.user.id,
      cnpj,
      razaoSocial: razao_social,
      nomeFantasia: nome_fantasia,
      cidade,
      uf,
      cnaePrincipal: cnae_principal,
      regimeTributario: regime_tributario,
      certificadoDigital: certificado_digital || false,
      email,
      telefone,
      inscricaoMunicipal: inscricao_municipal
    }
  });

  // Create fiscal integration status
  await prisma.fiscalIntegrationStatus.create({
    data: {
      companyId: company.id,
      status: 'verificando'
    }
  });

  res.status(201).json(transformCompany(company));
}));

/**
 * PUT /api/companies/:id
 * Update a company
 */
router.put('/:id', asyncHandler(async (req, res) => {
  // Check ownership
  const existing = await prisma.company.findFirst({
    where: {
      id: req.params.id,
      userId: req.user.id
    }
  });

  if (!existing) {
    throw new AppError('Company not found', 404, 'NOT_FOUND');
  }

  const {
    cnpj,
    razao_social,
    nome_fantasia,
    cidade,
    uf,
    cnae_principal,
    regime_tributario,
    certificado_digital,
    email,
    telefone,
    inscricao_municipal
  } = req.body;

  const updateData = {};
  if (cnpj !== undefined) updateData.cnpj = cnpj;
  if (razao_social !== undefined) updateData.razaoSocial = razao_social;
  if (nome_fantasia !== undefined) updateData.nomeFantasia = nome_fantasia;
  if (cidade !== undefined) updateData.cidade = cidade;
  if (uf !== undefined) updateData.uf = uf;
  if (cnae_principal !== undefined) updateData.cnaePrincipal = cnae_principal;
  if (regime_tributario !== undefined) updateData.regimeTributario = regime_tributario;
  if (certificado_digital !== undefined) updateData.certificadoDigital = certificado_digital;
  if (email !== undefined) updateData.email = email;
  if (telefone !== undefined) updateData.telefone = telefone;
  if (inscricao_municipal !== undefined) updateData.inscricaoMunicipal = inscricao_municipal;

  const company = await prisma.company.update({
    where: { id: req.params.id },
    data: updateData
  });

  res.json(transformCompany(company));
}));

/**
 * DELETE /api/companies/:id
 * Delete a company
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  // Check ownership
  const existing = await prisma.company.findFirst({
    where: {
      id: req.params.id,
      userId: req.user.id
    }
  });

  if (!existing) {
    throw new AppError('Company not found', 404, 'NOT_FOUND');
  }

  await prisma.company.delete({
    where: { id: req.params.id }
  });

  sendSuccess(res, 'Company deleted successfully');
}));

/**
 * POST /api/companies/:id/register-fiscal
 * Register company in fiscal cloud (Nuvem Fiscal)
 */
router.post('/:id/register-fiscal', asyncHandler(async (req, res) => {
  // Check ownership
  const company = await prisma.company.findFirst({
    where: {
      id: req.params.id,
      userId: req.user.id
    }
  });

  if (!company) {
    throw new AppError('Company not found', 404, 'NOT_FOUND');
  }

  try {
    // Register company in Nuvem Fiscal
    const registrationResult = await registerCompany(company);

    // Update company with Nuvem Fiscal ID
    await prisma.company.update({
      where: { id: req.params.id },
      data: { nuvemFiscalId: registrationResult.nuvemFiscalId }
    });

    // Update fiscal integration status
    await prisma.fiscalIntegrationStatus.upsert({
      where: { companyId: req.params.id },
      update: {
        status: registrationResult.status,
        mensagem: registrationResult.message,
        ultimaVerificacao: new Date()
      },
      create: {
        companyId: req.params.id,
        status: registrationResult.status,
        mensagem: registrationResult.message,
        ultimaVerificacao: new Date()
      }
    });

    sendSuccess(res, registrationResult.message, {
      nuvemFiscalId: registrationResult.nuvemFiscalId
    });
  } catch (error) {
    // Update status to failure
    await prisma.fiscalIntegrationStatus.upsert({
      where: { companyId: req.params.id },
      update: {
        status: 'falha',
        mensagem: error.message,
        ultimaVerificacao: new Date()
      },
      create: {
        companyId: req.params.id,
        status: 'falha',
        mensagem: error.message,
        ultimaVerificacao: new Date()
      }
    });

    throw new AppError(error.message || 'Falha ao registrar empresa na Nuvem Fiscal', 500, 'FISCAL_REGISTRATION_ERROR');
  }
}));

/**
 * GET /api/companies/:id/fiscal-status
 * Get fiscal integration status
 */
router.get('/:id/fiscal-status', asyncHandler(async (req, res) => {
  // Check ownership
  const company = await prisma.company.findFirst({
    where: {
      id: req.params.id,
      userId: req.user.id
    }
  });

  if (!company) {
    throw new AppError('Company not found', 404, 'NOT_FOUND');
  }

  const status = await prisma.fiscalIntegrationStatus.findUnique({
    where: { companyId: req.params.id }
  });

  if (!status) {
    return sendSuccess(res, 'Status não verificado', {
      companyId: req.params.id,
      status: 'verificando',
      mensagem: 'Status não verificado'
    });
  }

  sendSuccess(res, 'Status fiscal consultado com sucesso', status);
}));

/**
 * POST /api/companies/:id/check-fiscal-connection
 * Check fiscal connection status
 */
router.post('/:id/check-fiscal-connection', asyncHandler(async (req, res) => {
  // Check ownership
  const company = await prisma.company.findFirst({
    where: {
      id: req.params.id,
      userId: req.user.id
    }
  });

  if (!company) {
    throw new AppError('Company not found', 404, 'NOT_FOUND');
  }

  try {
    // Check connection with Nuvem Fiscal API
    const connectionResult = await checkConnection(company.nuvemFiscalId);

    // Update fiscal integration status
    await prisma.fiscalIntegrationStatus.upsert({
      where: { companyId: req.params.id },
      update: {
        status: connectionResult.status === 'conectado' ? 'conectado' : 'falha',
        mensagem: connectionResult.details || connectionResult.message,
        ultimaVerificacao: new Date()
      },
      create: {
        companyId: req.params.id,
        status: connectionResult.status === 'conectado' ? 'conectado' : 'falha',
        mensagem: connectionResult.details || connectionResult.message,
        ultimaVerificacao: new Date()
      }
    });

    const isSuccess = connectionResult.status === 'conectado';
    sendSuccess(res, connectionResult.message, {
      connectionStatus: connectionResult.status,
      message: connectionResult.message,
      details: connectionResult.details,
      data: connectionResult.data || null
    }, isSuccess ? 200 : 200); // Still 200, but status field indicates success/error
  } catch (error) {
    // Update status to failure
    await prisma.fiscalIntegrationStatus.upsert({
      where: { companyId: req.params.id },
      update: {
        status: 'falha',
        mensagem: error.message,
        ultimaVerificacao: new Date()
      },
      create: {
        companyId: req.params.id,
        status: 'falha',
        mensagem: error.message,
        ultimaVerificacao: new Date()
      }
    });

    throw new AppError(error.message || 'Falha ao verificar conexão fiscal', 500, 'FISCAL_CONNECTION_ERROR');
  }
}));

/**
 * POST /api/companies/:id/certificate
 * Upload digital certificate
 */
router.post('/:id/certificate', asyncHandler(async (req, res) => {
  // Check ownership
  const company = await prisma.company.findFirst({
    where: {
      id: req.params.id,
      userId: req.user.id
    }
  });

  if (!company) {
    throw new AppError('Company not found', 404, 'NOT_FOUND');
  }

  // TODO: Handle file upload and certificate validation
  // For now, just mark as having certificate
  await prisma.company.update({
    where: { id: req.params.id },
    data: { certificadoDigital: true }
  });

  res.json({
    status: 'success',
    message: 'Certificado digital configurado com sucesso'
  });
}));

export default router;
