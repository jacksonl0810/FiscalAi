import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { prisma } from '../index.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireActiveSubscription } from '../middleware/subscriptionAccess.js';
import { emitNfse, checkNfseStatus, cancelNfse } from '../services/nuvemFiscal.js';

const router = express.Router();

// All routes require authentication and active subscription
router.use(authenticate);
router.use(requireActiveSubscription);

/**
 * GET /api/invoices
 * List all invoices for the user's companies
 */
router.get('/', asyncHandler(async (req, res) => {
  const { status, companyId, sort = '-created_at', limit, page } = req.query;

  // Get user's company IDs
  const companies = await prisma.company.findMany({
    where: { userId: req.user.id },
    select: { id: true }
  });
  const companyIds = companies.map(c => c.id);

  // Build where clause
  const where = { companyId: { in: companyIds } };
  if (status) where.status = status;
  if (companyId && companyIds.includes(companyId)) {
    where.companyId = companyId;
  }

  // Build order by
  const orderBy = {};
  if (sort.startsWith('-')) {
    const field = sort.substring(1);
    orderBy[field === 'created_at' ? 'createdAt' : field] = 'desc';
  } else {
    orderBy[sort === 'created_at' ? 'createdAt' : sort] = 'asc';
  }

  // Pagination
  const take = limit ? parseInt(limit) : undefined;
  const skip = page && limit ? (parseInt(page) - 1) * parseInt(limit) : undefined;

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy,
    take,
    skip
  });

  // Convert Decimal fields to numbers for JSON
  const result = invoices.map(inv => ({
    ...inv,
    valor: parseFloat(inv.valor),
    aliquota_iss: parseFloat(inv.aliquotaIss),
    valor_iss: inv.valorIss ? parseFloat(inv.valorIss) : null,
    data_emissao: inv.dataEmissao,
    cliente_nome: inv.clienteNome,
    cliente_documento: inv.clienteDocumento,
    descricao_servico: inv.descricaoServico,
    company_id: inv.companyId,
    codigo_verificacao: inv.codigoVerificacao,
    pdf_url: inv.pdfUrl,
    xml_url: inv.xmlUrl
  }));

  res.json(result);
}));

/**
 * GET /api/invoices/:id
 * Get a single invoice
 */
router.get('/:id', asyncHandler(async (req, res) => {
  // Get user's company IDs
  const companies = await prisma.company.findMany({
    where: { userId: req.user.id },
    select: { id: true }
  });
  const companyIds = companies.map(c => c.id);

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: req.params.id,
      companyId: { in: companyIds }
    }
  });

  if (!invoice) {
    throw new AppError('Invoice not found', 404, 'NOT_FOUND');
  }

  res.json({
    ...invoice,
    valor: parseFloat(invoice.valor),
    aliquota_iss: parseFloat(invoice.aliquotaIss),
    valor_iss: invoice.valorIss ? parseFloat(invoice.valorIss) : null
  });
}));

/**
 * POST /api/invoices
 * Create a new invoice (draft) - DEPRECATED: Manual invoice creation is disabled
 * Invoices can only be created via AI assistant
 * This endpoint is kept for backward compatibility but returns an error
 */
router.post('/', asyncHandler(async (req, res) => {
  throw new AppError(
    'Criação manual de notas fiscais foi desabilitada. Use o assistente IA para emitir notas fiscais. Acesse a página do Assistente e diga: "Emitir nota de R$ [valor] para [cliente]"',
    403,
    'MANUAL_CREATION_DISABLED'
  );
}));

/**
 * PUT /api/invoices/:id
 * Update an invoice
 */
router.put('/:id', asyncHandler(async (req, res) => {
  // Get user's company IDs
  const companies = await prisma.company.findMany({
    where: { userId: req.user.id },
    select: { id: true }
  });
  const companyIds = companies.map(c => c.id);

  const existing = await prisma.invoice.findFirst({
    where: {
      id: req.params.id,
      companyId: { in: companyIds }
    }
  });

  if (!existing) {
    throw new AppError('Invoice not found', 404, 'NOT_FOUND');
  }

  const updateData = {};
  const {
    cliente_nome,
    cliente_documento,
    descricao_servico,
    valor,
    aliquota_iss,
    municipio,
    status
  } = req.body;

  if (cliente_nome !== undefined) updateData.clienteNome = cliente_nome;
  if (cliente_documento !== undefined) updateData.clienteDocumento = cliente_documento;
  if (descricao_servico !== undefined) updateData.descricaoServico = descricao_servico;
  if (valor !== undefined) updateData.valor = parseFloat(valor);
  if (aliquota_iss !== undefined) updateData.aliquotaIss = parseFloat(aliquota_iss);
  if (municipio !== undefined) updateData.municipio = municipio;
  if (status !== undefined) updateData.status = status;

  // Recalculate ISS if valor or aliquota changed
  if (valor !== undefined || aliquota_iss !== undefined) {
    const newValor = valor !== undefined ? parseFloat(valor) : parseFloat(existing.valor);
    const newAliquota = aliquota_iss !== undefined ? parseFloat(aliquota_iss) : parseFloat(existing.aliquotaIss);
    updateData.valorIss = (newValor * newAliquota) / 100;
  }

  const invoice = await prisma.invoice.update({
    where: { id: req.params.id },
    data: updateData
  });

  res.json({
    ...invoice,
    valor: parseFloat(invoice.valor),
    aliquota_iss: parseFloat(invoice.aliquotaIss),
    valor_iss: invoice.valorIss ? parseFloat(invoice.valorIss) : null
  });
}));

/**
 * DELETE /api/invoices/:id
 * Delete an invoice (only drafts)
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  // Get user's company IDs
  const companies = await prisma.company.findMany({
    where: { userId: req.user.id },
    select: { id: true }
  });
  const companyIds = companies.map(c => c.id);

  const existing = await prisma.invoice.findFirst({
    where: {
      id: req.params.id,
      companyId: { in: companyIds }
    }
  });

  if (!existing) {
    throw new AppError('Invoice not found', 404, 'NOT_FOUND');
  }

  if (existing.status !== 'rascunho') {
    throw new AppError('Only draft invoices can be deleted', 400, 'CANNOT_DELETE');
  }

  await prisma.invoice.delete({ where: { id: req.params.id } });

  sendSuccess(res, 'Invoice deleted successfully');
}));

/**
 * POST /api/invoices/issue
 * Issue an invoice to fiscal authority
 * DEPRECATED: This endpoint is kept for backward compatibility
 * New invoices should be issued via /api/assistant/execute-action
 * This endpoint will be removed in a future version
 */
router.post('/issue', [
  body('companyId').notEmpty().withMessage('Company ID is required'),
  body('cliente_nome').notEmpty().withMessage('Client name is required'),
  body('cliente_documento').notEmpty().withMessage('Client document is required'),
  body('descricao_servico').notEmpty().withMessage('Service description is required'),
  body('valor').isNumeric().withMessage('Value must be a number')
], asyncHandler(async (req, res) => {
  // Log warning about deprecated endpoint
  console.warn('[DEPRECATED] POST /api/invoices/issue called. Use /api/assistant/execute-action instead.');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ status: 'error', message: 'Validation failed', errors: errors.array() });
  }

  const {
    companyId,
    cliente_nome,
    cliente_documento,
    descricao_servico,
    valor,
    aliquota_iss = 5,
    municipio,
    data_prestacao,
    codigo_servico
  } = req.body;

  // Verify company ownership
  const company = await prisma.company.findFirst({
    where: { id: companyId, userId: req.user.id }
  });

  if (!company) {
    throw new AppError('Company not found', 404, 'NOT_FOUND');
  }

  // Calculate ISS
  const valorIss = (parseFloat(valor) * parseFloat(aliquota_iss)) / 100;

  try {
    // Emit NFS-e via Nuvem Fiscal API
    const invoiceData = {
      cliente_nome,
      cliente_documento,
      descricao_servico,
      valor: parseFloat(valor),
      aliquota_iss: parseFloat(aliquota_iss),
      municipio: municipio || company.cidade,
      data_prestacao: data_prestacao || new Date().toISOString().split('T')[0],
      codigo_servico: codigo_servico,
      iss_retido: false
    };

    const nfseResult = await emitNfse(invoiceData, company);

    // Save invoice to database
    const invoice = await prisma.invoice.create({
      data: {
        companyId,
        clienteNome: cliente_nome,
        clienteDocumento: cliente_documento,
        descricaoServico: descricao_servico,
        valor: parseFloat(valor),
        aliquotaIss: parseFloat(aliquota_iss),
        valorIss,
        municipio: municipio || company.cidade,
        status: nfseResult.nfse.status || 'autorizada',
        numero: nfseResult.nfse.numero,
        codigoVerificacao: nfseResult.nfse.codigo_verificacao,
        dataEmissao: new Date(),
        dataPrestacao: data_prestacao ? new Date(data_prestacao) : new Date(),
        codigoServico: codigo_servico,
        pdfUrl: nfseResult.nfse.pdf_url,
        xmlUrl: nfseResult.nfse.xml_url,
        nuvemFiscalId: nfseResult.nfse.nuvem_fiscal_id
      }
    });

    // Create success notification
    await prisma.notification.create({
      data: {
        userId: req.user.id,
        titulo: 'Nota Fiscal Emitida',
        mensagem: `Nota fiscal ${invoice.numero} emitida com sucesso para ${cliente_nome}`,
        tipo: 'sucesso',
        invoiceId: invoice.id
      }
    });

    sendSuccess(res, 'Nota fiscal emitida com sucesso', {
      invoice: {
        id: invoice.id,
        numero: invoice.numero,
        status: invoice.status,
        codigo_verificacao: invoice.codigoVerificacao,
        pdf_url: invoice.pdfUrl,
        xml_url: invoice.xmlUrl
      }
    }, 201);
  } catch (error) {
    console.error('Error emitting invoice:', error);
    
    // Create error notification
    await prisma.notification.create({
      data: {
        userId: req.user.id,
        titulo: 'Erro ao Emitir Nota Fiscal',
        mensagem: `Falha ao emitir nota fiscal: ${error.message}`,
        tipo: 'erro'
      }
    });

    throw new AppError(
      error.message || 'Falha ao emitir nota fiscal na Nuvem Fiscal',
      500,
      'INVOICE_EMISSION_ERROR'
    );
  }
}));

/**
 * POST /api/invoices/:id/check-status
 * Check invoice status with fiscal authority
 */
router.post('/:id/check-status', asyncHandler(async (req, res) => {
  // Get user's company IDs
  const companies = await prisma.company.findMany({
    where: { userId: req.user.id },
    select: { id: true }
  });
  const companyIds = companies.map(c => c.id);

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: req.params.id,
      companyId: { in: companyIds }
    }
  });

  if (!invoice) {
    throw new AppError('Invoice not found', 404, 'NOT_FOUND');
  }

  // Get company to access nuvemFiscalId
  const company = await prisma.company.findFirst({
    where: { id: invoice.companyId }
  });

  try {
    // Check status with Nuvem Fiscal API if invoice has nuvemFiscalId
    if (invoice.nuvemFiscalId && company?.nuvemFiscalId) {
      const statusResult = await checkNfseStatus(company.nuvemFiscalId, invoice.nuvemFiscalId);
      
      // Update invoice status if changed
      if (statusResult.status !== invoice.status) {
        await prisma.invoice.update({
          where: { id: req.params.id },
          data: {
            status: statusResult.status,
            pdfUrl: statusResult.pdf_url || invoice.pdfUrl,
            xmlUrl: statusResult.xml_url || invoice.xmlUrl
          }
        });
        
        invoice.status = statusResult.status;
        invoice.pdfUrl = statusResult.pdf_url || invoice.pdfUrl;
        invoice.xmlUrl = statusResult.xml_url || invoice.xmlUrl;
      }

      sendSuccess(res, 'Status consultado com sucesso', {
        invoiceStatus: statusResult.status,
        numero: statusResult.numero,
        codigo_verificacao: statusResult.codigo_verificacao,
        pdf_url: statusResult.pdf_url,
        xml_url: statusResult.xml_url,
        mensagem: statusResult.mensagem
      });
    } else {
      // No Nuvem Fiscal ID, return current database status
      sendSuccess(res, 'Status verificado', {
        invoiceStatus: invoice.status
      });
    }
  } catch (error) {
    console.error('Error checking invoice status:', error);
    throw new AppError(
      error.message || 'Falha ao consultar status da nota fiscal',
      500,
      'INVOICE_STATUS_ERROR'
    );
  }
}));

/**
 * POST /api/invoices/:id/cancel
 * Cancel an invoice
 */
router.post('/:id/cancel', [
  body('reason').notEmpty().withMessage('Cancellation reason is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ status: 'error', message: 'Validation failed', errors: errors.array() });
  }

  // Get user's company IDs
  const companies = await prisma.company.findMany({
    where: { userId: req.user.id },
    select: { id: true }
  });
  const companyIds = companies.map(c => c.id);

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: req.params.id,
      companyId: { in: companyIds }
    }
  });

  if (!invoice) {
    throw new AppError('Invoice not found', 404, 'NOT_FOUND');
  }

  if (invoice.status === 'cancelada') {
    throw new AppError('Invoice is already cancelled', 400, 'ALREADY_CANCELLED');
  }

  // Get company to access nuvemFiscalId
  const company = await prisma.company.findFirst({
    where: { id: invoice.companyId }
  });

  try {
    // Cancel with Nuvem Fiscal API if invoice has nuvemFiscalId
    if (invoice.nuvemFiscalId && company?.nuvemFiscalId) {
      const { reason } = req.body;
      await cancelNfse(company.nuvemFiscalId, invoice.nuvemFiscalId, reason || 'Cancelamento solicitado pelo usuário');
    }

    // Update invoice status in database
    await prisma.invoice.update({
      where: { id: req.params.id },
      data: { status: 'cancelada' }
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: req.user.id,
        titulo: 'Nota Fiscal Cancelada',
        mensagem: `Nota fiscal ${invoice.numero || invoice.id} foi cancelada`,
        tipo: 'info',
        invoiceId: invoice.id
      }
    });

    sendSuccess(res, 'Nota fiscal cancelada com sucesso');
  } catch (error) {
    console.error('Error canceling invoice:', error);
    throw new AppError(
      error.message || 'Falha ao cancelar nota fiscal',
      500,
      'INVOICE_CANCEL_ERROR'
    );
  }
}));

/**
 * GET /api/invoices/:id/pdf
 * Download invoice PDF
 */
router.get('/:id/pdf', asyncHandler(async (req, res) => {
  // Get user's company IDs
  const companies = await prisma.company.findMany({
    where: { userId: req.user.id },
    select: { id: true }
  });
  const companyIds = companies.map(c => c.id);

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: req.params.id,
      companyId: { in: companyIds }
    }
  });

  if (!invoice) {
    throw new AppError('Invoice not found', 404, 'NOT_FOUND');
  }

  // TODO: Return actual PDF from storage or generate it
  // For now, return a placeholder response
  res.status(501).json({
    status: 'error',
    message: 'PDF download not implemented yet',
    pdfUrl: invoice.pdfUrl
  });
}));

/**
 * GET /api/invoices/:id/xml
 * Download invoice XML
 */
router.get('/:id/xml', asyncHandler(async (req, res) => {
  // Get user's company IDs
  const companies = await prisma.company.findMany({
    where: { userId: req.user.id },
    select: { id: true }
  });
  const companyIds = companies.map(c => c.id);

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: req.params.id,
      companyId: { in: companyIds }
    }
  });

  if (!invoice) {
    throw new AppError('Invoice not found', 404, 'NOT_FOUND');
  }

  // TODO: Return actual XML from storage
  res.status(501).json({
    status: 'error',
    message: 'XML download not implemented yet',
    xmlUrl: invoice.xmlUrl
  });
}));

export default router;
