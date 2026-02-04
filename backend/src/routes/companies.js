import express from 'express';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import { prisma } from '../index.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireActiveSubscription } from '../middleware/subscriptionAccess.js';
import { fiscalConnectionLimiter } from '../middleware/rateLimiter.js';
import { registerCompany, checkConnection, isNuvemFiscalConfigured } from '../services/nuvemFiscal.js';
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
// When status is 'connected' but certificate was never uploaded to Nuvem Fiscal, show not_connected
const transformCompany = (company) => {
  if (!company) return company;
  let fiscalConnectionStatus = company.fiscalConnectionStatus;
  let fiscalConnectionError = company.fiscalConnectionError ?? null;
  if (fiscalConnectionStatus === 'connected' && company.certificateUploadedToNuvemFiscal === false) {
    fiscalConnectionStatus = 'not_connected';
    fiscalConnectionError = 'Certificado digital não configurado na Nuvem Fiscal. Envie o certificado na aba Integração Fiscal.';
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
    nuvem_fiscal_id: company.nuvemFiscalId,
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

  // Validate CNPJ uniqueness
  const { validateCNPJUniqueness, checkCompanyLimit, validateTargetAudience, getUpgradeOptions, getUserPlanId, getPlanConfig } = await import('../services/planService.js');
  await validateCNPJUniqueness(cnpj);

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
  if (cnpj !== undefined) updateData.cnpj = cnpj;
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
 * Register company in fiscal cloud (Nuvem Fiscal)
 */
router.post('/:id/register-fiscal', asyncHandler(async (req, res) => {
  // Check if Nuvem Fiscal is configured
  if (!isNuvemFiscalConfigured()) {
    return sendSuccess(res, 'Nuvem Fiscal não configurado. Configure as credenciais para habilitar a integração fiscal.', {
      status: 'not_configured',
      message: 'Para usar a integração fiscal, configure NUVEM_FISCAL_CLIENT_ID e NUVEM_FISCAL_CLIENT_SECRET nas variáveis de ambiente.'
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
    const errorMessage = `Campos obrigatórios faltando para registro fiscal:\n\n${missingFields.map(f => `• ${f}`).join('\n')}\n\nComplete os dados da empresa antes de registrar na Nuvem Fiscal.`;
    throw new AppError(errorMessage, 400, 'MISSING_REQUIRED_FIELDS', { missingFields });
  }

  try {
    // Register company in Nuvem Fiscal
    const registrationResult = await registerCompany(company);

    // Update company with Nuvem Fiscal ID
    await prisma.company.update({
      where: { id: req.params.id },
      data: { nuvemFiscalId: registrationResult.nuvemFiscalId }
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
    // According to Nuvem Fiscal docs: company + certificate + settings are required
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
      nuvemFiscalId: registrationResult.nuvemFiscalId,
      status: 'not_connected', // Company registered but certificate still needed
      message: requiresCertificateVerification
        ? 'Empresa já existe na Nuvem Fiscal. Para vincular esta empresa à sua conta, faça upload do certificado digital (e-CNPJ) para verificar a propriedade.'
        : 'Empresa registrada na Nuvem Fiscal com sucesso. Agora configure o certificado digital para habilitar a emissão de notas fiscais.',
      nextStep: 'upload_certificate',
      alreadyExists: registrationResult.alreadyExists || false,
      requiresCertificateVerification: requiresCertificateVerification
    });
  } catch (error) {
    console.error('[Companies] Error registering in Nuvem Fiscal:', error);
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

  if (statusValue === 'connected' && company.certificateUploadedToNuvemFiscal === false) {
    statusValue = 'not_connected';
    mensagem = 'Certificado digital não configurado na Nuvem Fiscal. Envie o certificado na aba Integração Fiscal.';
  }

  if (!mensagem) {
    if (!isNuvemFiscalConfigured()) {
      statusValue = 'not_configured';
      mensagem = 'Nuvem Fiscal não configurado no servidor';
    } else if (!company.nuvemFiscalId) {
      statusValue = 'not_connected';
      mensagem = 'Empresa não registrada na Nuvem Fiscal. Registre a empresa para habilitar a emissão.';
    } else if (!company.fiscalCredential) {
      statusValue = 'not_connected';
      mensagem = 'Certificado digital não configurado. Faça upload do certificado (.pfx ou .p12) para conectar.';
    } else if (company.fiscalCredential.type !== 'certificate') {
      statusValue = 'not_connected';
      mensagem = 'Certificado digital é obrigatório. Faça upload do certificado na aba Integração Fiscal.';
    } else if (statusValue === 'connected') {
      mensagem = 'Conexão fiscal ativa. Pronto para emitir notas fiscais.';
    } else if (statusValue === 'not_connected') {
      mensagem = mensagem || 'Configure o certificado digital e clique em Salvar para enviar à Nuvem Fiscal.';
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
  
  if (!isNuvemFiscalConfigured()) {
    console.log('[FiscalConnection] Nuvem Fiscal not configured');
    return sendSuccess(res, 'Nuvem Fiscal não configurado', {
      status: 'not_configured',
      connectionStatus: 'not_configured',
      message: 'Integração fiscal não configurada. Configure as credenciais da Nuvem Fiscal para habilitar a emissão de notas fiscais.',
      details: 'As variáveis de ambiente NUVEM_FISCAL_CLIENT_ID e NUVEM_FISCAL_CLIENT_SECRET não foram configuradas.'
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
    const { testFiscalConnection } = await import('../services/fiscalConnectionService.js');
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
  const { storeFiscalCredential } = await import('../services/fiscalCredentialService.js');
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

  // Try to upload certificate to Nuvem Fiscal if company is registered
  let nuvemFiscalStatus = null;
  if (company.nuvemFiscalId && company.cnpj) {
    try {
      const { uploadCertificate } = await import('../services/nuvemFiscal.js');
      const nuvemResult = await uploadCertificate(company.cnpj, certificateBase64, password);
      nuvemFiscalStatus = {
        status: 'success',
        message: nuvemResult.message
      };
      console.log('[Companies] Certificate uploaded to Nuvem Fiscal successfully');
      
      // Certificate uploaded successfully = company is now connected and ready to issue invoices
      await prisma.company.update({
        where: { id },
        data: {
          fiscalConnectionStatus: 'connected',
          fiscalConnectionError: null,
          lastConnectionCheck: new Date(),
          certificateUploadedToNuvemFiscal: true
        }
      });
      console.log('[Companies] Fiscal connection status set to connected');
    } catch (nuvemError) {
      console.error('[Companies] Error uploading certificate to Nuvem Fiscal:', nuvemError.message);
      
      let errorMessage = nuvemError.message;
      let errorStatus = 'warning';
      
      if (errorMessage.includes('CPF/CNPJ diferente')) {
        errorMessage = 'O certificado digital foi emitido para um CNPJ diferente. Verifique se você está usando o certificado correto para esta empresa.';
        errorStatus = 'error';
      }
      
      nuvemFiscalStatus = {
        status: errorStatus,
        message: `Certificado salvo localmente, mas erro ao enviar para Nuvem Fiscal: ${errorMessage}`
      };
      
      // Certificate not uploaded to Nuvem Fiscal = not connected
      await prisma.company.update({
        where: { id },
        data: {
          fiscalConnectionStatus: 'not_connected',
          fiscalConnectionError: `Certificado não enviado para Nuvem Fiscal: ${errorMessage}`,
          lastConnectionCheck: new Date(),
          certificateUploadedToNuvemFiscal: false
        }
      });
    }
  } else {
    nuvemFiscalStatus = {
      status: 'info',
      message: 'Certificado salvo localmente. Empresa não registrada na Nuvem Fiscal ainda - registre a empresa para habilitar a emissão de notas fiscais.'
    };
    
    // Certificate saved locally but company not registered = not connected
    await prisma.company.update({
      where: { id },
      data: {
        fiscalConnectionStatus: 'not_connected',
        fiscalConnectionError: 'Empresa não registrada na Nuvem Fiscal. Registre a empresa para completar a configuração.',
        lastConnectionCheck: new Date(),
        certificateUploadedToNuvemFiscal: false
      }
    });
  }

  sendSuccess(res, 'Certificado digital armazenado com sucesso', {
    credential_id: credential.id,
    expires_at: credential.expiresAt,
    nuvem_fiscal: nuvemFiscalStatus
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

  const { getCredentialStatus } = await import('../services/fiscalCredentialService.js');
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

  const { revokeFiscalCredential } = await import('../services/fiscalCredentialService.js');
  await revokeFiscalCredential(id);

  // Update company flags
  await prisma.company.update({
    where: { id },
    data: { 
      certificadoDigital: false,
      certificateUploadedToNuvemFiscal: false,
      fiscalConnectionStatus: 'not_connected',
      fiscalConnectionError: 'Certificado digital revogado'
    }
  });

  sendSuccess(res, 'Certificado digital revogado com sucesso');
}));

/**
 * POST /api/companies/:id/municipal-credentials
 * Store municipal credentials securely
 */
router.post('/:id/municipal-credentials', [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
], validateRequest, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { username, password } = req.body;

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

  const { storeFiscalCredential } = await import('../services/fiscalCredentialService.js');

  const credential = await storeFiscalCredential(
    id,
    'municipal_credentials',
    { username, password }
  );

  sendSuccess(res, 'Credenciais municipais armazenadas com sucesso', {
    credential_id: credential.id
  });
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

  const { getCredentialStatus } = await import('../services/fiscalCredentialService.js');
  const status = await getCredentialStatus(id);

  sendSuccess(res, 'Municipal credentials status retrieved', status);
}));

export default router;
