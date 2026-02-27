import express from 'express';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import { prisma } from '../index.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireActiveSubscription } from '../middleware/subscriptionAccess.js';
import { fiscalConnectionLimiter } from '../middleware/rateLimiter.js';
import { registerCompany, checkConnection, isAcbrApiConfigured } from '../services/acbrApi.js';
import { getMEILimitStatus } from '../services/meiLimitTracking.js';
import { sendSuccess } from '../utils/response.js';

const router = express.Router();

const certificateUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.originalname.endsWith('.pfx') || file.originalname.endsWith('.p12')) {
      cb(null, true);
    } else {
      cb(new Error('Only .pfx or .p12 certificate files are allowed'), false);
    }
  }
}).single('certificate');

// All routes require authentication and active subscription
router.use(authenticate);
router.use(asyncHandler(requireActiveSubscription));

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
// When status is 'connected' but no auth method configured on ACBr API, show not_connected
const transformCompany = (company) => {
  if (!company) return company;
  let fiscalConnectionStatus = company.fiscalConnectionStatus;
  let fiscalConnectionError = company.fiscalConnectionError ?? null;
  
  // Check if any authentication method is configured on ACBr API
  const hasAcbrApiAuth = company.certificateUploadedToAcbrApi === true || 
                          company.municipalCredentialsConfigured === true;
  
  if (fiscalConnectionStatus === 'connected' && !hasAcbrApiAuth) {
    fiscalConnectionStatus = 'not_connected';
    fiscalConnectionError = 'Configure certificado digital ou credenciais da prefeitura na aba Integração Fiscal.';
  }
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
    acbr_api_id: company.acbrApiId,
    // Address fields
    cep: company.cep,
    logradouro: company.logradouro,
    numero: company.numero,
    bairro: company.bairro,
    codigo_municipio: company.codigoMunicipio,
    fiscal_connection_status: fiscalConnectionStatus,
    fiscal_connection_error: fiscalConnectionError,
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
    inscricao_municipal,
    // Address fields
    cep,
    logradouro,
    numero,
    bairro,
    codigo_municipio
  } = req.body;

  const userId = req.user.id;

  // Validate CNPJ uniqueness per user (different users CAN register same CNPJ)
  const { validateCNPJUniqueness, checkCompanyLimit, validateTargetAudience, getUpgradeOptions, getUserPlanId, getPlanConfig } = await import('../services/planService.js');
  const cnpjCheck = await validateCNPJUniqueness(cnpj, userId);

  // Check company limit for user's plan
  const limitCheck = await checkCompanyLimit(userId);
  if (!limitCheck.allowed) {
    const planId = await getUserPlanId(userId);
    const planConfig = getPlanConfig(planId);
    const upgradeOptions = getUpgradeOptions(planId);
    
    let errorMessage = `❌ Você atingiu o limite de ${limitCheck.max} empresa${limitCheck.max > 1 ? 's' : ''} do seu plano ${planConfig.name}.`;
    errorMessage += `\n\nVocê tem ${limitCheck.current} empresa${limitCheck.current > 1 ? 's' : ''} cadastrada${limitCheck.current > 1 ? 's' : ''} e o limite é ${limitCheck.max}.`;
    
    if (upgradeOptions && upgradeOptions.length > 0) {
      errorMessage += '\n\n💡 Opções disponíveis:';
      upgradeOptions.forEach((plan, index) => {
        errorMessage += `\n${index + 1}. Faça upgrade para ${plan.name} e tenha ${plan.maxCompanies === null ? 'empresas ilimitadas' : `até ${plan.maxCompanies} empresas`}`;
      });
    }
    
    throw new AppError(
      errorMessage,
      403,
      'COMPANY_LIMIT_REACHED',
      {
        ...limitCheck,
        upgradeOptions
      }
    );
  }

  // Validate target audience (MEI/Simples Nacional) - returns warnings but doesn't block
  const targetAudienceValidation = validateTargetAudience(regime_tributario, false);
  // Note: Warnings are included in response but don't block company creation

  // Normalize CNPJ (remove formatting)
  const normalizedCnpj = cnpj.replace(/\D/g, '');

  const company = await prisma.company.create({
    data: {
      userId: userId,
      cnpj: normalizedCnpj,
      razaoSocial: razao_social,
      nomeFantasia: nome_fantasia,
      cidade,
      uf,
      cnaePrincipal: cnae_principal,
      regimeTributario: regime_tributario,
      certificadoDigital: certificado_digital || false,
      email,
      telefone,
      inscricaoMunicipal: inscricao_municipal,
      // Address fields
      cep: cep?.replace(/\D/g, ''),
      logradouro,
      numero,
      bairro,
      codigoMunicipio: codigo_municipio
    }
  });

  // Create fiscal integration status
  await prisma.fiscalIntegrationStatus.create({
    data: {
      companyId: company.id,
      status: 'verificando'
    }
  });

  // Include target audience warnings in response (if any)
  const response = transformCompany(company);
  if (targetAudienceValidation.warnings) {
    response.warnings = targetAudienceValidation.warnings;
  }

  res.status(201).json(response);
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
    inscricao_municipal,
    // Address fields
    cep,
    logradouro,
    numero,
    bairro,
    codigo_municipio
  } = req.body;

  const updateData = {};
  // CNPJ changes are not allowed after company creation (tied to fiscal integrations)
  // If frontend sends a different CNPJ, log a warning but don't update it
  if (cnpj !== undefined && cnpj !== existing.cnpj) {
    console.warn(`[Companies] Attempted to change CNPJ for company ${req.params.id} from ${existing.cnpj} to ${cnpj}. Ignoring.`);
  }
  if (razao_social !== undefined) updateData.razaoSocial = razao_social;
  if (nome_fantasia !== undefined) updateData.nomeFantasia = nome_fantasia;
  if (cidade !== undefined) updateData.cidade = cidade;
  if (uf !== undefined) updateData.uf = uf;
  // Address fields
  if (cep !== undefined) updateData.cep = cep?.replace(/\D/g, '');
  if (logradouro !== undefined) updateData.logradouro = logradouro;
  if (numero !== undefined) updateData.numero = numero;
  if (bairro !== undefined) updateData.bairro = bairro;
  if (codigo_municipio !== undefined) updateData.codigoMunicipio = codigo_municipio;
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
 * Register company in fiscal cloud (ACBr API)
 */
router.post('/:id/register-fiscal', asyncHandler(async (req, res) => {
  // Check if ACBr API is configured
  if (!isAcbrApiConfigured()) {
    return sendSuccess(res, 'ACBr API não configurado. Configure as credenciais para habilitar a integração fiscal.', {
      status: 'not_configured',
      message: 'Para usar a integração fiscal, configure ACBR_API_CLIENT_ID e ACBR_API_CLIENT_SECRET nas variáveis de ambiente.'
    }, 200);
  }

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

  // Validate required fields before attempting registration
  const missingFields = [];
  const cleanCnpj = (company.cnpj || '').replace(/\D/g, '');
  const cleanCep = (company.cep || '').replace(/\D/g, '');
  const cleanCodigoMunicipio = (company.codigoMunicipio || '').replace(/\D/g, '');

  if (!cleanCnpj || cleanCnpj.length !== 14) {
    missingFields.push('CNPJ (deve ter 14 dígitos)');
  }
  if (!company.razaoSocial) {
    missingFields.push('Razão Social');
  }
  if (!company.email) {
    missingFields.push('Email');
  }
  if (!company.telefone) {
    missingFields.push('Telefone');
  }
  if (!company.cidade) {
    missingFields.push('Cidade');
  }
  if (!company.uf) {
    missingFields.push('UF');
  }
  if (!company.inscricaoMunicipal) {
    missingFields.push('Inscrição Municipal');
  }
  if (!cleanCep || cleanCep.length !== 8) {
    missingFields.push('CEP (deve ter 8 dígitos)');
  }
  if (!cleanCodigoMunicipio || cleanCodigoMunicipio.length !== 7) {
    missingFields.push('Código do Município IBGE (deve ter exatamente 7 dígitos)');
  }

  if (missingFields.length > 0) {
    const errorMessage = `Campos obrigatórios faltando para registro fiscal:\n\n${missingFields.map(f => `• ${f}`).join('\n')}\n\nComplete os dados da empresa antes de registrar na ACBr API.`;
    throw new AppError(errorMessage, 400, 'MISSING_REQUIRED_FIELDS', { missingFields });
  }

  try {
    // Check if another user already registered this CNPJ in ACBr API
    // This allows sharing the same fiscal company across multiple users
    const cleanCnpj = (company.cnpj || '').replace(/\D/g, '');
    const otherCompanyWithSameCnpj = await prisma.company.findFirst({
      where: {
        cnpj: cleanCnpj,
        userId: { not: req.user.id },
        acbrApiId: { not: null }
      },
      select: { acbrApiId: true }
    });

    let registrationResult;
    
    if (otherCompanyWithSameCnpj?.acbrApiId) {
      // Another user already has this CNPJ registered on ACBr API
      // Reuse the same acbrApiId (legacy field) - no need to re-register
      console.log('[Companies] CNPJ already registered by another user, reusing acbrApiId:', otherCompanyWithSameCnpj.acbrApiId);
      registrationResult = {
        acbrApiId: otherCompanyWithSameCnpj.acbrApiId,
        status: 'not_connected',
        message: 'Empresa já registrada na ACBr API. Configure o certificado digital para conectar.',
        alreadyExists: true
      };
    } else {
      // Register company in ACBr API (handles duplicate detection internally)
      registrationResult = await registerCompany(company);
    }

    // Update company with ACBr API ID (legacy field name acbrApiId)
    await prisma.company.update({
      where: { id: req.params.id },
      data: { acbrApiId: registrationResult.acbrApiId }
    });

    // Map status from registration result to database status
    // 'not_connected' means company exists but needs credentials (NOT an error)
    // 'conectado' means company is fully connected
    const dbStatus = registrationResult.status === 'conectado' ? 'conectado' : 'not_connected';

    // Update fiscal integration status
    // IMPORTANT: 'not_connected' is NOT a failure - it means company exists but needs credentials
    await prisma.fiscalIntegrationStatus.upsert({
      where: { companyId: req.params.id },
      update: {
        status: dbStatus,
        mensagem: registrationResult.message,
        ultimaVerificacao: new Date()
      },
      create: {
        companyId: req.params.id,
        status: dbStatus,
        mensagem: registrationResult.message,
        ultimaVerificacao: new Date()
      }
    });

    // Update company's fiscal connection status
    // IMPORTANT: Company registration alone is NOT enough to be "connected"
    // According to ACBr API docs: company + certificate + settings are required
    // So we set 'not_connected' with a message indicating certificate is needed next
    await prisma.company.update({
      where: { id: req.params.id },
      data: {
        fiscalConnectionStatus: 'not_connected',
        fiscalConnectionError: 'Empresa registrada. Configure o certificado digital para completar a integração.'
      }
    });

    // For existing companies, certificate verification is REQUIRED for security
    // This ensures the user actually owns the company before linking it
    const requiresCertificateVerification = registrationResult.alreadyExists === true;
    
    sendSuccess(res, registrationResult.message, {
      acbrApiId: registrationResult.acbrApiId,
      status: 'not_connected', // Company registered but certificate still needed
      message: requiresCertificateVerification
        ? 'Empresa já existe na ACBr API. Para vincular esta empresa à sua conta, faça upload do certificado digital (e-CNPJ) para verificar a propriedade.'
        : 'Empresa registrada na ACBr API com sucesso. Agora configure o certificado digital para habilitar a emissão de notas fiscais.',
      nextStep: 'upload_certificate',
      alreadyExists: registrationResult.alreadyExists || false,
      requiresCertificateVerification: requiresCertificateVerification
    });
  } catch (error) {
    console.error('[Companies] Error registering in ACBr API:', error);
    console.error('[Companies] Error name:', error?.name);
    console.error('[Companies] Error message:', error?.message);
    console.error('[Companies] Error status:', error?.status);
    console.error('[Companies] Error statusCode:', error?.statusCode);
    console.error('[Companies] Error code:', error?.code);
    console.error('[Companies] Error stack:', error?.stack);
    
    // Extract error message safely
    let errorMessage = 'Erro desconhecido ao registrar empresa';
    let statusCode = 500;
    let errorCode = 'FISCAL_REGISTRATION_ERROR';
    let errorData = null;
    
    if (typeof error === 'string') {
      errorMessage = error;
    } else if (error instanceof Error) {
      errorMessage = error.message || 'Erro desconhecido ao registrar empresa';
      errorCode = error.code || 'FISCAL_REGISTRATION_ERROR';
      statusCode = error.statusCode || error.status || 500;
      errorData = error.data || null;
      
      // Check if it's a validation error (should be 400, not 500)
      if (errorMessage.includes('inválido') || 
          errorMessage.includes('deve conter') || 
          errorMessage.includes('faltando') ||
          errorMessage.includes('obrigatório')) {
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
      }
    } else if (error && typeof error === 'object') {
      errorMessage = error.message || error.error || JSON.stringify(error);
      errorCode = error.code || 'FISCAL_REGISTRATION_ERROR';
      statusCode = error.statusCode || error.status || 500;
      errorData = error.data || null;
    }
    
    // Only update status to 'falha' for actual errors (not for existing companies)
    // Existing companies are handled above and set to 'not_connected'
    try {
      await prisma.fiscalIntegrationStatus.upsert({
        where: { companyId: req.params.id },
        update: {
          status: 'falha',
          mensagem: errorMessage.substring(0, 500),
          ultimaVerificacao: new Date()
        },
        create: {
          companyId: req.params.id,
          status: 'falha',
          mensagem: errorMessage.substring(0, 500),
          ultimaVerificacao: new Date()
        }
      });
    } catch (dbError) {
      console.error('[Companies] Error updating fiscal status:', dbError);
    }

    throw new AppError(errorMessage, statusCode, errorCode, errorData);
  }
}));

/**
 * GET /api/companies/:id/fiscal-status
 * Get fiscal integration status
 */
router.get('/:id/fiscal-status', asyncHandler(async (req, res) => {
  const company = await prisma.company.findFirst({
    where: {
      id: req.params.id,
      userId: req.user.id
    },
    include: {
      fiscalCredential: {
        select: { type: true, expiresAt: true }
      }
    }
  });

  if (!company) {
    throw new AppError('Company not found', 404, 'NOT_FOUND');
  }

  // Use Company as source of truth for connection status (not FiscalIntegrationStatus)
  let statusValue = company.fiscalConnectionStatus || 'not_connected';
  let mensagem = company.fiscalConnectionError || null;

  // Check if any valid authentication method is configured (certificate OR municipal credentials)
  const hasAcbrApiAuth = company.certificateUploadedToAcbrApi === true || 
                          company.municipalCredentialsConfigured === true;

  // If status is connected but no auth configured, override to not_connected
  if (statusValue === 'connected' && !hasAcbrApiAuth) {
    statusValue = 'not_connected';
    mensagem = 'Configure certificado digital ou credenciais da prefeitura na aba Integração Fiscal.';
  }

  if (!mensagem) {
    if (!isAcbrApiConfigured()) {
      statusValue = 'not_configured';
      mensagem = 'ACBr API não configurado no servidor';
    } else if (!company.acbrApiId) {
      statusValue = 'not_connected';
      mensagem = 'Empresa não registrada na ACBr API. Registre a empresa para habilitar a emissão.';
    } else if (!company.fiscalCredential) {
      statusValue = 'not_connected';
      mensagem = 'Configure certificado digital ou credenciais da prefeitura para conectar.';
    } else if (company.fiscalCredential.type !== 'certificate' && company.fiscalCredential.type !== 'municipal_credentials') {
      // Only reject if credential type is neither certificate nor municipal_credentials
      statusValue = 'not_connected';
      mensagem = 'Configure certificado digital ou credenciais da prefeitura na aba Integração Fiscal.';
    } else if (statusValue === 'connected') {
      mensagem = 'Conexão fiscal ativa. Pronto para emitir notas fiscais.';
    } else if (statusValue === 'not_connected') {
      mensagem = mensagem || 'Configure o certificado digital ou credenciais da prefeitura e clique em Salvar.';
    } else if (statusValue === 'expired') {
      mensagem = mensagem || 'Certificado digital expirado. Renove e faça upload novamente.';
    } else {
      mensagem = mensagem || 'Verificando status da conexão com a prefeitura.';
    }
  }

  // Frontend expects status: 'conectado' | 'connected' for green, 'not_connected' for orange, 'falha'|'failed' for red
  const responseStatus = statusValue === 'connected' ? 'conectado' : statusValue;

  return sendSuccess(res, 'Status fiscal consultado', {
    companyId: req.params.id,
    status: responseStatus,
    mensagem,
    ultima_verificacao: company.lastConnectionCheck || null
  });
}));

/**
 * POST /api/companies/:id/check-fiscal-connection
 * Check fiscal connection status
 */
router.post('/:id/check-fiscal-connection', fiscalConnectionLimiter, asyncHandler(async (req, res) => {
  console.log('[FiscalConnection] Checking connection for company:', req.params.id);
  
  if (!isAcbrApiConfigured()) {
    console.log('[FiscalConnection] ACBr API not configured');
    return sendSuccess(res, 'ACBr API não configurado', {
      status: 'not_configured',
      connectionStatus: 'not_configured',
      message: 'Integração fiscal não configurada. Configure as credenciais da ACBr API para habilitar a emissão de notas fiscais.',
      details: 'As variáveis de ambiente ACBR_API_CLIENT_ID e ACBR_API_CLIENT_SECRET não foram configuradas.'
    }, 200);
  }

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
    const { testFiscalConnection } = await import('../services/acbrConnectionService.js');
    console.log('[FiscalConnection] Testing connection...');
    const connectionResult = await testFiscalConnection(req.params.id);

    // If connection failed, create AI notification
    if (connectionResult.status === 'failed' || connectionResult.status === 'expired' || connectionResult.status === 'not_connected') {
      const { createAINotification } = await import('../services/aiNotificationService.js');
      
      if (connectionResult.status === 'expired') {
        await createAINotification(
          req.user.id,
          'certificate_expired',
          {
            days: 0
          }
        );
      } else if (connectionResult.status === 'failed') {
        await createAINotification(
          req.user.id,
          'credential_issue',
          {
            error: connectionResult.error || connectionResult.message,
            company: company.razaoSocial || company.nomeFantasia
          }
        );
      }
    }
    console.log('[FiscalConnection] Result:', JSON.stringify(connectionResult));

    const statusMapping = {
      'connected': 'conectado',
      'not_connected': 'falha',
      'failed': 'falha',
      'expired': 'falha'
    };
    const dbStatus = statusMapping[connectionResult.status] || connectionResult.status;

    await prisma.fiscalIntegrationStatus.upsert({
      where: { companyId: req.params.id },
      update: {
        status: dbStatus,
        mensagem: connectionResult.error || connectionResult.message,
        ultimaVerificacao: new Date()
      },
      create: {
        companyId: req.params.id,
        status: dbStatus,
        mensagem: connectionResult.error || connectionResult.message,
        ultimaVerificacao: new Date()
      }
    });
    console.log('[FiscalConnection] Status updated in database');

    sendSuccess(res, connectionResult.message, {
      status: connectionResult.status,
      message: connectionResult.message,
      error: connectionResult.error,
      data: connectionResult.data || null
    });
  } catch (error) {
    console.error('[FiscalConnection] Error:', error.message);
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
 * Upload and store digital certificate securely
 * Supports both FormData (file upload) and JSON (base64)
 */
router.post('/:id/certificate', (req, res, next) => {
  certificateUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ status: 'error', message: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ status: 'error', message: err.message });
    }
    next();
  });
}, asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check ownership
  const company = await prisma.company.findFirst({
    where: {
      id,
      userId: req.user.id
    }
  });

  if (!company) {
    throw new AppError('Company not found', 404, 'NOT_FOUND');
  }

  let certificateBase64;
  let password;
  let filename = 'certificate.pfx';
  let expiresAt = null;

  // Handle FormData (file upload) - check if file was uploaded via multer
  if (req.file) {
    certificateBase64 = req.file.buffer.toString('base64');
    password = req.body.password;
    filename = req.file.originalname || filename;
  } else if (req.body.certificate) {
    // Handle JSON body (base64)
    certificateBase64 = req.body.certificate;
    password = req.body.password;
    filename = req.body.filename || filename;
    expiresAt = req.body.expiresAt;
  } else {
    throw new AppError('Certificate data is required', 400, 'MISSING_CERTIFICATE');
  }

  if (!password) {
    throw new AppError('Certificate password is required', 400, 'MISSING_PASSWORD');
  }

  // Import services
  const { storeFiscalCredential } = await import('../services/acbrCredentialService.js');
  const { verifyCertificateOwnership, parseCertificate } = await import('../services/certificateParserService.js');

  // Parse and verify certificate CNPJ matches company CNPJ
  // This is required for security - ensures user owns the company
  if (company.cnpj) {
    console.log('[Companies] Verifying certificate ownership for CNPJ:', company.cnpj);
    
    const verification = await verifyCertificateOwnership(certificateBase64, password, company.cnpj);
    
    if (!verification.verified) {
      console.error('[Companies] Certificate verification failed:', verification.error, verification.message);
      throw new AppError(verification.message, 400, verification.error || 'CERTIFICATE_VERIFICATION_FAILED');
    }
    
    console.log('[Companies] Certificate ownership verified successfully');
    
    // Set expiration date from certificate if not provided
    if (!expiresAt && verification.expiresAt) {
      expiresAt = verification.expiresAt;
    }
  } else {
    // If company has no CNPJ yet, just parse to validate the certificate format
    console.log('[Companies] Company has no CNPJ, validating certificate format only');
    try {
      const certInfo = await parseCertificate(certificateBase64, password);
      if (!certInfo.valid) {
        if (certInfo.expired) {
          throw new AppError(`Certificado expirado em ${new Date(certInfo.validity.notAfter).toLocaleDateString('pt-BR')}`, 400, 'CERTIFICATE_EXPIRED');
        }
      }
      // Set expiration from certificate
      if (!expiresAt && certInfo.validity?.notAfter) {
        expiresAt = certInfo.validity.notAfter;
      }
    } catch (parseError) {
      throw new AppError(parseError.message || 'Erro ao validar certificado', 400, 'CERTIFICATE_INVALID');
    }
  }

  // Store certificate locally
  const credential = await storeFiscalCredential(
    id,
    'certificate',
    {
      certificate: certificateBase64,
      password,
      filename
    },
    {
      expiresAt: expiresAt ? new Date(expiresAt) : null
    }
  );

  // Update company flag
  await prisma.company.update({
    where: { id },
    data: { certificadoDigital: true }
  });

  // Try to upload certificate to ACBr API if company is registered
  let acbrApiStatus = null;
  
  // If company doesn't have acbrApiId (legacy field) yet, check if another user's company with same CNPJ has it
  let effectiveAcbrApiId = company.acbrApiId;
  if (!effectiveAcbrApiId && company.cnpj) {
    const cleanCnpj = company.cnpj.replace(/\D/g, '');
    const otherCompany = await prisma.company.findFirst({
      where: {
        cnpj: cleanCnpj,
        acbrApiId: { not: null }
      },
      select: { acbrApiId: true }
    });
    if (otherCompany?.acbrApiId) {
      effectiveAcbrApiId = otherCompany.acbrApiId;
      // Update this company's acbrApiId too
      await prisma.company.update({
        where: { id },
        data: { acbrApiId: effectiveAcbrApiId }
      });
      console.log('[Companies] Linked acbrApiId from another user\'s company:', effectiveAcbrApiId);
    }
  }
  
  if (effectiveAcbrApiId && company.cnpj) {
    try {
      const { uploadCertificate, configureNfseForCertificate } = await import('../services/acbrApi.js');
      const acbrResult = await uploadCertificate(company.cnpj, certificateBase64, password);
      acbrApiStatus = {
        status: 'success',
        message: acbrResult.message
      };
      console.log('[Companies] Certificate uploaded to ACBr API successfully');

      // After uploading certificate, configure NFS-e to use certificate (not prefeitura login)
      // This is critical for certificate-only municipalities
      try {
        await configureNfseForCertificate(company.cnpj, company);
        console.log('[Companies] NFS-e configured to use certificate (removed any prefeitura credentials)');
      } catch (nfseConfigErr) {
        console.warn('[Companies] Could not auto-configure NFS-e for certificate:', nfseConfigErr.message);
        // Non-fatal — certificate is uploaded, NFS-e config may already be set correctly
      }
      
      // Certificate uploaded successfully - mark as uploaded
      // Check if municipality requires BOTH auth methods before setting CONNECTED
      const { validateMunicipalityAuthConfig } = await import('../services/acbrConnectionService.js');
      const updatedCompanyForValidation = await prisma.company.findUnique({
        where: { id },
        select: {
          codigoMunicipio: true,
          certificateUploadedToAcbrApi: true,
          municipalCredentialsConfigured: true
        }
      });
      
      // Mark certificate as uploaded first
      await prisma.company.update({
        where: { id },
        data: {
          certificateUploadedToAcbrApi: true,
          lastConnectionCheck: new Date()
        }
      });

      // Now validate if all required auth methods are configured
      const authValidation = await validateMunicipalityAuthConfig({
        ...updatedCompanyForValidation,
        certificateUploadedToAcbrApi: true // Since we just uploaded it
      });

      if (authValidation.valid) {
        // All required auth methods configured = company is connected
        await prisma.company.update({
          where: { id },
          data: {
            fiscalConnectionStatus: 'connected',
            fiscalConnectionError: null
          }
        });
        console.log('[Companies] All auth requirements met - Fiscal connection status set to connected');
      } else {
        // Still missing required auth method (likely municipal credentials)
        await prisma.company.update({
          where: { id },
          data: {
            fiscalConnectionStatus: 'not_connected',
            fiscalConnectionError: authValidation.message
          }
        });
        acbrApiStatus.message += ` Atenção: ${authValidation.message}`;
        console.log('[Companies] Missing auth requirements:', authValidation.message);
      }
    } catch (acbrError) {
      console.error('[Companies] Error uploading certificate to ACBr API:', acbrError.message);
      
      let errorMessage = acbrError.message;
      let errorStatus = 'warning';
      
      if (errorMessage.includes('CPF/CNPJ diferente')) {
        errorMessage = 'O certificado digital foi emitido para um CNPJ diferente. Verifique se você está usando o certificado correto para esta empresa.';
        errorStatus = 'error';
      }
      
      acbrApiStatus = {
        status: errorStatus,
        message: `Certificado salvo localmente, mas erro ao enviar para ACBr API: ${errorMessage}`
      };
      
      // Certificate not uploaded to ACBr API = not connected
      await prisma.company.update({
        where: { id },
        data: {
          fiscalConnectionStatus: 'not_connected',
          fiscalConnectionError: `Certificado não enviado para ACBr API: ${errorMessage}`,
          lastConnectionCheck: new Date(),
          certificateUploadedToAcbrApi: false
        }
      });
    }
  } else {
    acbrApiStatus = {
      status: 'info',
      message: 'Certificado salvo localmente. Empresa não registrada na ACBr API ainda - registre a empresa para habilitar a emissão de notas fiscais.'
    };
    
    // Certificate saved locally but company not registered = not connected
    await prisma.company.update({
      where: { id },
      data: {
        fiscalConnectionStatus: 'not_connected',
        fiscalConnectionError: 'Empresa não registrada na ACBr API. Registre a empresa para completar a configuração.',
        lastConnectionCheck: new Date(),
        certificateUploadedToAcbrApi: false
      }
    });
  }

  sendSuccess(res, 'Certificado digital armazenado com sucesso', {
    credential_id: credential.id,
    expires_at: credential.expiresAt,
    acbr_api: acbrApiStatus
  });
}));

/**
 * GET /api/companies/:id/certificate/status
 * Get certificate status (expiration, last used, etc.)
 */
router.get('/:id/certificate/status', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check ownership
  const company = await prisma.company.findFirst({
    where: {
      id,
      userId: req.user.id
    }
  });

  if (!company) {
    throw new AppError('Company not found', 404, 'NOT_FOUND');
  }

  const { getCredentialStatus } = await import('../services/acbrCredentialService.js');
  const status = await getCredentialStatus(id);

  sendSuccess(res, 'Certificate status retrieved', status);
}));

/**
 * DELETE /api/companies/:id/certificate
 * Revoke digital certificate
 */
router.delete('/:id/certificate', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check ownership
  const company = await prisma.company.findFirst({
    where: {
      id,
      userId: req.user.id
    }
  });

  if (!company) {
    throw new AppError('Company not found', 404, 'NOT_FOUND');
  }

  const { revokeFiscalCredential } = await import('../services/acbrCredentialService.js');
  await revokeFiscalCredential(id);

  // Update company flags
  await prisma.company.update({
    where: { id },
    data: { 
      certificadoDigital: false,
      certificateUploadedToAcbrApi: false,
      fiscalConnectionStatus: 'not_connected',
      fiscalConnectionError: 'Certificado digital revogado'
    }
  });

  sendSuccess(res, 'Certificado digital revogado com sucesso');
}));

/**
 * POST /api/companies/:id/municipal-credentials
 * Store municipal credentials securely and configure on ACBr API
 */
router.post('/:id/municipal-credentials', [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
  body('token').optional().isString()
], validateRequest, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { username, password, token } = req.body;

  // Check ownership
  const company = await prisma.company.findFirst({
    where: {
      id,
      userId: req.user.id
    }
  });

  if (!company) {
    throw new AppError('Company not found', 404, 'NOT_FOUND');
  }

  // Check if same credentials are used for other companies (warning only)
  let credentialWarning = null;
  const otherCompaniesWithCredentials = await prisma.company.findMany({
    where: {
      userId: req.user.id,
      id: { not: id },
      fiscalCredential: {
        type: 'municipal_credentials'
      }
    },
    include: {
      fiscalCredential: {
        select: { metadata: true }
      }
    }
  });

  // Check if any other company has the same username hint
  const usernameHint = username.substring(0, 2) + '***';
  const companiesWithSameCredentials = otherCompaniesWithCredentials.filter(c => {
    const meta = c.fiscalCredential?.metadata;
    return meta && meta.usernameHint === usernameHint;
  });

  if (companiesWithSameCredentials.length > 0) {
    const companyNames = companiesWithSameCredentials.map(c => c.nomeFantasia || c.razaoSocial).join(', ');
    credentialWarning = {
      type: 'shared_credentials',
      message: `Atenção: As mesmas credenciais municipais parecem estar sendo usadas para outras empresas: ${companyNames}. Certifique-se de que este login está autorizado para a empresa ${company.nomeFantasia || company.razaoSocial} no sistema da prefeitura.`,
      affectedCompanies: companiesWithSameCredentials.map(c => ({
        id: c.id,
        name: c.nomeFantasia || c.razaoSocial,
        cnpj: c.cnpj
      }))
    };
  }

  const { storeFiscalCredential } = await import('../services/acbrCredentialService.js');

  // Store credentials locally (encrypted)
  const credential = await storeFiscalCredential(
    id,
    'municipal_credentials',
    { username, password },
    {
      metadata: {
        hasToken: !!token,
        tokenHint: token ? token.substring(0, 4) + '***' : null
      }
    }
  );

  // Try to send credentials to ACBr API
  let acbrApiStatus = null;

  if (company.acbrApiId && company.cnpj) {
    try {
      const { configureMunicipalCredentials } = await import('../services/acbrApi.js');
      const acbrResult = await configureMunicipalCredentials(
        company.cnpj,
        company,
        username,
        password,
        token || null
      );

      acbrApiStatus = {
        status: 'success',
        message: acbrResult.message
      };

      console.log('[Companies] Municipal credentials configured on ACBr API successfully');

      // Mark municipal credentials as configured first
      await prisma.company.update({
        where: { id },
        data: {
          municipalCredentialsConfigured: true,
          lastConnectionCheck: new Date()
        }
      });

      // Check if municipality requires BOTH auth methods before setting CONNECTED
      const { validateMunicipalityAuthConfig } = await import('../services/acbrConnectionService.js');
      const updatedCompanyForValidation = await prisma.company.findUnique({
        where: { id },
        select: {
          codigoMunicipio: true,
          certificateUploadedToAcbrApi: true,
          municipalCredentialsConfigured: true
        }
      });

      const authValidation = await validateMunicipalityAuthConfig({
        ...updatedCompanyForValidation,
        municipalCredentialsConfigured: true // Since we just configured it
      });

      if (authValidation.valid) {
        // All required auth methods configured = company is connected
        await prisma.company.update({
          where: { id },
          data: {
            fiscalConnectionStatus: 'connected',
            fiscalConnectionError: null
          }
        });
        console.log('[Companies] All auth requirements met - Fiscal connection status set to connected');
      } else {
        // Still missing required auth method (likely certificate)
        await prisma.company.update({
          where: { id },
          data: {
            fiscalConnectionStatus: 'not_connected',
            fiscalConnectionError: authValidation.message
          }
        });
        acbrApiStatus.message += ` Atenção: ${authValidation.message}`;
        console.log('[Companies] Missing auth requirements:', authValidation.message);
      }
    } catch (acbrError) {
      console.error('[Companies] Error configuring municipal credentials on ACBr API:', acbrError.message);

      acbrApiStatus = {
        status: 'warning',
        message: `Credenciais salvas localmente, mas erro ao configurar na ACBr API: ${acbrError.message}`
      };

      await prisma.company.update({
        where: { id },
        data: {
          fiscalConnectionStatus: 'not_connected',
          fiscalConnectionError: `Erro ao configurar credenciais municipais: ${acbrError.message}`,
          municipalCredentialsConfigured: false,
          lastConnectionCheck: new Date()
        }
      });
    }
  } else {
    acbrApiStatus = {
      status: 'info',
      message: 'Credenciais salvas localmente. Registre a empresa na ACBr API para habilitar a emissão de notas.'
    };
  }

  const responseData = {
    credential_id: credential.id,
    acbr_api: acbrApiStatus
  };

  // Include warning about shared credentials if detected
  if (credentialWarning) {
    responseData.warning = credentialWarning;
  }

  sendSuccess(res, 'Credenciais municipais armazenadas com sucesso', responseData);
}));

/**
 * GET /api/companies/:id/municipal-credentials/status
 * Get municipal credentials status
 */
router.get('/:id/municipal-credentials/status', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check ownership
  const company = await prisma.company.findFirst({
    where: {
      id,
      userId: req.user.id
    }
  });

  if (!company) {
    throw new AppError('Company not found', 404, 'NOT_FOUND');
  }

  const { getCredentialStatus } = await import('../services/acbrCredentialService.js');
  const status = await getCredentialStatus(id);

  sendSuccess(res, 'Municipal credentials status retrieved', status);
}));

/**
 * POST /api/companies/:id/test-nfse-emission
 * Test NFS-e emission capability for a company
 * This performs a dry-run to detect configuration issues or provider bugs
 */
router.post('/:id/test-nfse-emission', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check ownership
  const company = await prisma.company.findFirst({
    where: {
      id,
      userId: req.user.id
    },
    select: {
      id: true,
      cnpj: true,
      acbrApiId: true,
      codigoMunicipio: true,
      cidade: true,
      uf: true,
      certificateUploadedToAcbrApi: true,
      municipalCredentialsConfigured: true
    }
  });

  if (!company) {
    throw new AppError('Company not found', 404, 'NOT_FOUND');
  }

  if (!company.acbrApiId) {
    return sendSuccess(res, 'Empresa não registrada na ACBr API', {
      canEmit: false,
      status: 'not_registered',
      code: 'NOT_REGISTERED',
      message: 'Empresa não está registrada na ACBr API. Complete o cadastro primeiro.',
      action: 'Registre a empresa na ACBr API antes de testar a emissão.'
    });
  }

  if (!company.certificateUploadedToAcbrApi && !company.municipalCredentialsConfigured) {
    return sendSuccess(res, 'Credenciais não configuradas', {
      canEmit: false,
      status: 'credentials_missing',
      code: 'CREDENTIALS_NOT_CONFIGURED',
      message: 'Nenhum método de autenticação configurado.',
      action: 'Configure o certificado digital ou credenciais da prefeitura.'
    });
  }

  const { testNfseEmissionCapability } = await import('../services/acbrApi.js');
  const testResult = await testNfseEmissionCapability(company.cnpj);

  // Add municipality context to the response
  testResult.municipality = {
    codigo: company.codigoMunicipio,
    cidade: company.cidade,
    uf: company.uf
  };

  sendSuccess(res, testResult.canEmit ? 'Teste de emissão bem-sucedido' : 'Problema detectado na emissão', testResult);
}));

export default router;
