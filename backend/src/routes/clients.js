import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { prisma } from '../index.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireActiveSubscription } from '../middleware/subscriptionAccess.js';
import { sendSuccess } from '../utils/response.js';

const router = express.Router();

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

// Transform Prisma client data from camelCase to snake_case for frontend
const transformClient = (client) => {
  if (!client) return client;
  return {
    id: client.id,
    user_id: client.userId,
    nome: client.nome,
    documento: client.documento,
    tipo_pessoa: client.tipoPessoa,
    email: client.email,
    telefone: client.telefone,
    cep: client.cep,
    logradouro: client.logradouro,
    numero: client.numero,
    complemento: client.complemento,
    bairro: client.bairro,
    cidade: client.cidade,
    uf: client.uf,
    codigo_municipio: client.codigoMunicipio,
    apelido: client.apelido,
    notas: client.notas,
    ativo: client.ativo,
    created_at: client.createdAt,
    updated_at: client.updatedAt,
  };
};

// Validate CPF (11 digits, valid checksum)
const isValidCPF = (cpf) => {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return false;
  
  // Check for known invalid CPFs (all same digit)
  if (/^(\d)\1+$/.test(cleaned)) return false;
  
  // Calculate first check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(cleaned[9])) return false;
  
  // Calculate second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(cleaned[10])) return false;
  
  return true;
};

// Validate CNPJ (14 digits, valid checksum)
const isValidCNPJ = (cnpj) => {
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length !== 14) return false;
  
  // Check for known invalid CNPJs (all same digit)
  if (/^(\d)\1+$/.test(cleaned)) return false;
  
  // Calculate first check digit
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned[i]) * weights1[i];
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (digit1 !== parseInt(cleaned[12])) return false;
  
  // Calculate second check digit
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned[i]) * weights2[i];
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  if (digit2 !== parseInt(cleaned[13])) return false;
  
  return true;
};

// Validate document (CPF or CNPJ)
const validateDocument = (documento, tipoPessoa) => {
  const cleaned = documento.replace(/\D/g, '');
  
  if (tipoPessoa === 'pf') {
    if (cleaned.length !== 11) {
      return { valid: false, message: 'CPF deve ter 11 dígitos' };
    }
    if (!isValidCPF(cleaned)) {
      return { valid: false, message: 'CPF inválido' };
    }
  } else if (tipoPessoa === 'pj') {
    if (cleaned.length !== 14) {
      return { valid: false, message: 'CNPJ deve ter 14 dígitos' };
    }
    if (!isValidCNPJ(cleaned)) {
      return { valid: false, message: 'CNPJ inválido' };
    }
  } else {
    return { valid: false, message: 'Tipo de pessoa inválido (use pf ou pj)' };
  }
  
  return { valid: true, cleaned };
};

/**
 * GET /api/clients
 * List all clients for the current user
 * Query params: 
 *   - search: search by name, document, or nickname
 *   - ativo: filter by active status (true/false)
 *   - limit: max number of results (default 50)
 */
router.get('/', asyncHandler(async (req, res) => {
  const { search, ativo, limit = '50' } = req.query;
  
  const where = {
    userId: req.user.id,
  };
  
  // Filter by active status
  if (ativo !== undefined) {
    where.ativo = ativo === 'true';
  }
  
  // Search by name, document, or nickname
  if (search) {
    const searchTerm = search.trim();
    const cleanedSearch = searchTerm.replace(/\D/g, '');
    
    where.OR = [
      { nome: { contains: searchTerm, mode: 'insensitive' } },
      { apelido: { contains: searchTerm, mode: 'insensitive' } },
    ];
    
    // If search term looks like a document, also search by cleaned document
    if (cleanedSearch.length >= 3) {
      where.OR.push({ documento: { contains: cleanedSearch } });
    }
  }
  
  const clients = await prisma.client.findMany({
    where,
    orderBy: [
      { nome: 'asc' }
    ],
    take: Math.min(parseInt(limit) || 50, 200)
  });

  sendSuccess(res, 'Clients list', { clients: clients.map(transformClient) });
}));

/**
 * GET /api/clients/search
 * Quick search for clients (used by AI assistant)
 * Returns matching clients for auto-completion
 */
router.get('/search', asyncHandler(async (req, res) => {
  const { q, limit = '10' } = req.query;
  
  if (!q || q.trim().length < 2) {
    return sendSuccess(res, 'Clients search', { clients: [] });
  }
  
  const searchTerm = q.trim();
  const cleanedSearch = searchTerm.replace(/\D/g, '');
  
  const where = {
    userId: req.user.id,
    ativo: true,
    OR: [
      { nome: { contains: searchTerm, mode: 'insensitive' } },
      { apelido: { contains: searchTerm, mode: 'insensitive' } },
    ]
  };
  
  // If search term looks like a document, also search by cleaned document
  if (cleanedSearch.length >= 3) {
    where.OR.push({ documento: { contains: cleanedSearch } });
  }
  
  const clients = await prisma.client.findMany({
    where,
    orderBy: [
      { nome: 'asc' }
    ],
    take: Math.min(parseInt(limit) || 10, 20)
  });

  sendSuccess(res, 'Clients search', { clients: clients.map(transformClient) });
}));

/**
 * GET /api/clients/:id
 * Get a single client
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const client = await prisma.client.findFirst({
    where: {
      id: req.params.id,
      userId: req.user.id
    }
  });

  if (!client) {
    throw new AppError('Cliente não encontrado', 404, 'NOT_FOUND');
  }

  sendSuccess(res, 'Client retrieved', { client: transformClient(client) });
}));

/**
 * POST /api/clients
 * Create a new client
 */
router.post('/',
  [
    body('nome').trim().notEmpty().withMessage('Nome é obrigatório'),
    body('documento').trim().notEmpty().withMessage('Documento (CPF/CNPJ) é obrigatório'),
    body('tipo_pessoa').optional().isIn(['pf', 'pj']).withMessage('Tipo de pessoa deve ser pf ou pj'),
    body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Email inválido'),
    body('telefone').optional({ nullable: true, checkFalsy: true }),
    body('cep').optional({ nullable: true, checkFalsy: true }),
    body('logradouro').optional({ nullable: true, checkFalsy: true }),
    body('numero').optional({ nullable: true, checkFalsy: true }),
    body('complemento').optional({ nullable: true, checkFalsy: true }),
    body('bairro').optional({ nullable: true, checkFalsy: true }),
    body('cidade').optional({ nullable: true, checkFalsy: true }),
    body('uf').optional({ nullable: true, checkFalsy: true }).isLength({ min: 2, max: 2 }).withMessage('UF deve ter 2 caracteres'),
    body('codigo_municipio').optional({ nullable: true, checkFalsy: true }),
    body('apelido').optional({ nullable: true, checkFalsy: true }),
    body('notas').optional({ nullable: true, checkFalsy: true }),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const {
      nome,
      documento,
      tipo_pessoa,
      email,
      telefone,
      cep,
      logradouro,
      numero,
      complemento,
      bairro,
      cidade,
      uf,
      codigo_municipio,
      apelido,
      notas
    } = req.body;
    
    // Auto-detect tipo_pessoa from document length if not provided
    const cleanedDoc = documento.replace(/\D/g, '');
    const detectedTipo = cleanedDoc.length === 11 ? 'pf' : cleanedDoc.length === 14 ? 'pj' : null;
    const tipoPessoa = tipo_pessoa || detectedTipo || 'pf';
    
    // Validate document
    const docValidation = validateDocument(documento, tipoPessoa);
    if (!docValidation.valid) {
      throw new AppError(docValidation.message, 400, 'INVALID_DOCUMENT');
    }
    
    // Check if client with same document already exists for this user
    const existingClient = await prisma.client.findFirst({
      where: {
        userId: req.user.id,
        documento: docValidation.cleaned
      }
    });
    
    if (existingClient) {
      throw new AppError(
        `Já existe um cliente cadastrado com este ${tipoPessoa === 'pf' ? 'CPF' : 'CNPJ'}`,
        400,
        'DUPLICATE_DOCUMENT'
      );
    }
    
    // Create client
    const client = await prisma.client.create({
      data: {
        userId: req.user.id,
        nome: nome.trim(),
        documento: docValidation.cleaned,
        tipoPessoa,
        email: email?.trim() || null,
        telefone: telefone?.trim() || null,
        cep: cep?.replace(/\D/g, '') || null,
        logradouro: logradouro?.trim() || null,
        numero: numero?.trim() || null,
        complemento: complemento?.trim() || null,
        bairro: bairro?.trim() || null,
        cidade: cidade?.trim() || null,
        uf: uf?.toUpperCase().trim() || null,
        codigoMunicipio: codigo_municipio?.trim() || null,
        apelido: apelido?.trim() || null,
        notas: notas?.trim() || null,
      }
    });

    sendSuccess(res, { client: transformClient(client) }, 201);
  })
);

/**
 * PUT /api/clients/:id
 * Update a client
 */
router.put('/:id',
  [
    body('nome').optional().trim().notEmpty().withMessage('Nome não pode ser vazio'),
    body('documento').optional().trim().notEmpty().withMessage('Documento não pode ser vazio'),
    body('tipo_pessoa').optional().isIn(['pf', 'pj']).withMessage('Tipo de pessoa deve ser pf ou pj'),
    body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Email inválido'),
    body('telefone').optional({ nullable: true, checkFalsy: true }),
    body('cep').optional({ nullable: true, checkFalsy: true }),
    body('logradouro').optional({ nullable: true, checkFalsy: true }),
    body('numero').optional({ nullable: true, checkFalsy: true }),
    body('complemento').optional({ nullable: true, checkFalsy: true }),
    body('bairro').optional({ nullable: true, checkFalsy: true }),
    body('cidade').optional({ nullable: true, checkFalsy: true }),
    body('uf').optional({ nullable: true, checkFalsy: true }).isLength({ min: 2, max: 2 }).withMessage('UF deve ter 2 caracteres'),
    body('codigo_municipio').optional({ nullable: true, checkFalsy: true }),
    body('apelido').optional({ nullable: true, checkFalsy: true }),
    body('notas').optional({ nullable: true, checkFalsy: true }),
    body('ativo').optional().isBoolean().withMessage('Ativo deve ser true ou false'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // Check if client exists and belongs to user
    const existingClient = await prisma.client.findFirst({
      where: {
        id,
        userId: req.user.id
      }
    });
    
    if (!existingClient) {
      throw new AppError('Cliente não encontrado', 404, 'NOT_FOUND');
    }
    
    const {
      nome,
      documento,
      tipo_pessoa,
      email,
      telefone,
      cep,
      logradouro,
      numero,
      complemento,
      bairro,
      cidade,
      uf,
      codigo_municipio,
      apelido,
      notas,
      ativo
    } = req.body;
    
    // Prepare update data
    const updateData = {};
    
    if (nome !== undefined) updateData.nome = nome.trim();
    if (tipo_pessoa !== undefined) updateData.tipoPessoa = tipo_pessoa;
    if (email !== undefined) updateData.email = email?.trim() || null;
    if (telefone !== undefined) updateData.telefone = telefone?.trim() || null;
    if (cep !== undefined) updateData.cep = cep?.replace(/\D/g, '') || null;
    if (logradouro !== undefined) updateData.logradouro = logradouro?.trim() || null;
    if (numero !== undefined) updateData.numero = numero?.trim() || null;
    if (complemento !== undefined) updateData.complemento = complemento?.trim() || null;
    if (bairro !== undefined) updateData.bairro = bairro?.trim() || null;
    if (cidade !== undefined) updateData.cidade = cidade?.trim() || null;
    if (uf !== undefined) updateData.uf = uf?.toUpperCase().trim() || null;
    if (codigo_municipio !== undefined) updateData.codigoMunicipio = codigo_municipio?.trim() || null;
    if (apelido !== undefined) updateData.apelido = apelido?.trim() || null;
    if (notas !== undefined) updateData.notas = notas?.trim() || null;
    if (ativo !== undefined) updateData.ativo = ativo;
    
    // Handle document update
    if (documento !== undefined) {
      const cleanedDoc = documento.replace(/\D/g, '');
      const tipoPessoa = tipo_pessoa || (cleanedDoc.length === 11 ? 'pf' : 'pj');
      
      const docValidation = validateDocument(documento, tipoPessoa);
      if (!docValidation.valid) {
        throw new AppError(docValidation.message, 400, 'INVALID_DOCUMENT');
      }
      
      // Check for duplicates (excluding current client)
      const duplicateClient = await prisma.client.findFirst({
        where: {
          userId: req.user.id,
          documento: docValidation.cleaned,
          id: { not: id }
        }
      });
      
      if (duplicateClient) {
        throw new AppError(
          `Já existe outro cliente cadastrado com este ${tipoPessoa === 'pf' ? 'CPF' : 'CNPJ'}`,
          400,
          'DUPLICATE_DOCUMENT'
        );
      }
      
      updateData.documento = docValidation.cleaned;
      updateData.tipoPessoa = tipoPessoa;
    }
    
    // Update client
    const client = await prisma.client.update({
      where: { id },
      data: updateData
    });

    sendSuccess(res, 'Client updated', { client: transformClient(client) });
  })
);

/**
 * DELETE /api/clients/:id
 * Delete a client (or archive if has invoices)
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Check if client exists and belongs to user
  const client = await prisma.client.findFirst({
    where: {
      id,
      userId: req.user.id
    }
  });
  
  if (!client) {
    throw new AppError('Cliente não encontrado', 404, 'NOT_FOUND');
  }
  
  // Check if client has invoices (by matching documento)
  const invoiceCount = await prisma.invoice.count({
    where: {
      company: {
        userId: req.user.id
      },
      clienteDocumento: client.documento
    }
  });
  
  if (invoiceCount > 0) {
    // Archive instead of delete
    await prisma.client.update({
      where: { id },
      data: { ativo: false }
    });
    
    sendSuccess(res, 'Cliente arquivado (possui notas fiscais associadas)', { archived: true });
  } else {
    // Actually delete
    await prisma.client.delete({
      where: { id }
    });
    
    sendSuccess(res, 'Cliente excluído com sucesso', { deleted: true });
  }
}));

/**
 * POST /api/clients/:id/restore
 * Restore an archived client
 */
router.post('/:id/restore', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const client = await prisma.client.findFirst({
    where: {
      id,
      userId: req.user.id
    }
  });
  
  if (!client) {
    throw new AppError('Cliente não encontrado', 404, 'NOT_FOUND');
  }
  
  if (client.ativo) {
    throw new AppError('Cliente já está ativo', 400, 'ALREADY_ACTIVE');
  }
  
  const updatedClient = await prisma.client.update({
    where: { id },
    data: { ativo: true }
  });

  sendSuccess(res, 'Client restored', { client: transformClient(updatedClient) });
}));

export default router;
