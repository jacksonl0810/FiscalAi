import express from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../index.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireActiveSubscription } from '../middleware/subscriptionAccess.js';
import { sendSuccess } from '../utils/response.js';

const router = express.Router();

// All routes require authentication and active subscription
router.use(authenticate);
router.use(asyncHandler(requireActiveSubscription));

/**
 * GET /api/taxes/das
 * List all DAS payments for the user's companies
 */
router.get('/das', asyncHandler(async (req, res) => {
  const { companyId, status, year, sort = '-data_vencimento' } = req.query;

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
  if (year) {
    const startDate = new Date(parseInt(year), 0, 1);
    const endDate = new Date(parseInt(year), 11, 31);
    where.dataVencimento = {
      gte: startDate,
      lte: endDate
    };
  }

  // Build order by
  const orderBy = {};
  if (sort.startsWith('-')) {
    const field = sort.substring(1);
    orderBy[field === 'data_vencimento' ? 'dataVencimento' : field] = 'desc';
  } else {
    orderBy[sort === 'data_vencimento' ? 'dataVencimento' : sort] = 'asc';
  }

  const dasPayments = await prisma.dAS.findMany({
    where,
    orderBy
  });

  // Map to frontend format
  const result = dasPayments.map(das => ({
    id: das.id,
    company_id: das.companyId,
    referencia: das.referencia,
    data_vencimento: das.dataVencimento,
    valor_total: parseFloat(das.valorTotal),
    valor_inss: das.valorInss ? parseFloat(das.valorInss) : null,
    valor_icms: das.valorIcms ? parseFloat(das.valorIcms) : null,
    valor_iss: das.valorIss ? parseFloat(das.valorIss) : null,
    status: das.status,
    codigo_barras: das.codigoBarras,
    pdf_url: das.pdfUrl,
    data_pagamento: das.dataPagamento,
    created_at: das.createdAt,
    updated_at: das.updatedAt
  }));

  res.json(result);
}));

/**
 * GET /api/taxes/das/:id
 * Get a single DAS payment
 */
router.get('/das/:id', asyncHandler(async (req, res) => {
  // Get user's company IDs
  const companies = await prisma.company.findMany({
    where: { userId: req.user.id },
    select: { id: true }
  });
  const companyIds = companies.map(c => c.id);

  const das = await prisma.dAS.findFirst({
    where: {
      id: req.params.id,
      companyId: { in: companyIds }
    }
  });

  if (!das) {
    throw new AppError('DAS not found', 404, 'NOT_FOUND');
  }

  res.json({
    id: das.id,
    company_id: das.companyId,
    referencia: das.referencia,
    data_vencimento: das.dataVencimento,
    valor_total: parseFloat(das.valorTotal),
    valor_inss: das.valorInss ? parseFloat(das.valorInss) : null,
    valor_icms: das.valorIcms ? parseFloat(das.valorIcms) : null,
    valor_iss: das.valorIss ? parseFloat(das.valorIss) : null,
    status: das.status,
    codigo_barras: das.codigoBarras,
    pdf_url: das.pdfUrl,
    data_pagamento: das.dataPagamento,
    created_at: das.createdAt,
    updated_at: das.updatedAt
  });
}));

/**
 * POST /api/taxes/das/:id/pay
 * Mark DAS as paid
 */
router.post('/das/:id/pay', asyncHandler(async (req, res) => {
  const { data_pagamento } = req.body;

  // Get user's company IDs
  const companies = await prisma.company.findMany({
    where: { userId: req.user.id },
    select: { id: true }
  });
  const companyIds = companies.map(c => c.id);

  const existing = await prisma.dAS.findFirst({
    where: {
      id: req.params.id,
      companyId: { in: companyIds }
    }
  });

  if (!existing) {
    throw new AppError('DAS not found', 404, 'NOT_FOUND');
  }

  if (existing.status === 'pago') {
    throw new AppError('DAS already paid', 400, 'ALREADY_PAID');
  }

  const das = await prisma.dAS.update({
    where: { id: req.params.id },
    data: {
      status: 'pago',
      dataPagamento: data_pagamento ? new Date(data_pagamento) : new Date()
    }
  });

  res.json({
    id: das.id,
    company_id: das.companyId,
    referencia: das.referencia,
    data_vencimento: das.dataVencimento,
    valor_total: parseFloat(das.valorTotal),
    status: das.status,
    data_pagamento: das.dataPagamento
  });
}));

/**
 * POST /api/taxes/das/generate
 * Generate DAS for a specific month
 */
router.post('/das/generate', [
  body('company_id').notEmpty().withMessage('Company ID is required'),
  body('referencia').matches(/^\d{2}\/\d{4}$/).withMessage('Referencia must be in MM/YYYY format')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ status: 'error', message: 'Validation failed', errors: errors.array() });
  }

  const { company_id, referencia } = req.body;

  // Verify company ownership
  const company = await prisma.company.findFirst({
    where: { id: company_id, userId: req.user.id }
  });

  if (!company) {
    throw new AppError('Company not found', 404, 'NOT_FOUND');
  }

  // Check if DAS already exists for this month
  const existing = await prisma.dAS.findFirst({
    where: { companyId: company_id, referencia }
  });

  if (existing) {
    throw new AppError('DAS already exists for this month', 409, 'ALREADY_EXISTS');
  }

  // Calculate due date (20th of the following month)
  const [month, year] = referencia.split('/').map(Number);
  const dueMonth = month === 12 ? 1 : month + 1;
  const dueYear = month === 12 ? year + 1 : year;
  const dataVencimento = new Date(dueYear, dueMonth - 1, 20);

  // MEI values (simplified - in production, these would be calculated based on activity)
  const valorInss = 66.00; // INSS contribution
  const valorIss = company.regimeTributario === 'MEI' ? 5.00 : 0; // ISS for services
  const valorIcms = 0; // ICMS for commerce
  const valorTotal = valorInss + valorIss + valorIcms;

  // Generate barcode (simplified)
  const codigoBarras = `85890000000${valorTotal.toFixed(2).replace('.', '')}${Date.now().toString().slice(-10)}`;

  const das = await prisma.dAS.create({
    data: {
      companyId: company_id,
      referencia,
      dataVencimento,
      valorTotal,
      valorInss,
      valorIss: valorIss || null,
      valorIcms: valorIcms || null,
      codigoBarras,
      status: 'pendente'
    }
  });

  res.status(201).json({
    id: das.id,
    company_id: das.companyId,
    referencia: das.referencia,
    data_vencimento: das.dataVencimento,
    valor_total: parseFloat(das.valorTotal),
    valor_inss: das.valorInss ? parseFloat(das.valorInss) : null,
    valor_iss: das.valorIss ? parseFloat(das.valorIss) : null,
    status: das.status,
    codigo_barras: das.codigoBarras
  });
}));

/**
 * GET /api/taxes/das/:id/pdf
 * Download DAS PDF
 */
router.get('/das/:id/pdf', asyncHandler(async (req, res) => {
  // Get user's company IDs
  const companies = await prisma.company.findMany({
    where: { userId: req.user.id },
    select: { id: true }
  });
  const companyIds = companies.map(c => c.id);

  const das = await prisma.dAS.findFirst({
    where: {
      id: req.params.id,
      companyId: { in: companyIds }
    }
  });

  if (!das) {
    throw new AppError('DAS not found', 404, 'NOT_FOUND');
  }

  // TODO: Return actual PDF from storage or generate it
  res.status(501).json({
    status: 'error',
    message: 'PDF download not implemented yet',
    pdfUrl: das.pdfUrl
  });
}));

/**
 * GET /api/taxes/summary/:companyId
 * Get tax summary for a company
 */
router.get('/summary/:companyId', asyncHandler(async (req, res) => {
  const { year } = req.query;

  // Verify company ownership
  const company = await prisma.company.findFirst({
    where: { id: req.params.companyId, userId: req.user.id }
  });

  if (!company) {
    throw new AppError('Company not found', 404, 'NOT_FOUND');
  }

  const currentYear = year ? parseInt(year) : new Date().getFullYear();
  const startDate = new Date(currentYear, 0, 1);
  const endDate = new Date(currentYear, 11, 31);

  const paid = await prisma.dAS.aggregate({
    where: {
      companyId: req.params.companyId,
      status: 'pago',
      dataVencimento: { gte: startDate, lte: endDate }
    },
    _sum: { valorTotal: true },
    _count: true
  });

  const pending = await prisma.dAS.aggregate({
    where: {
      companyId: req.params.companyId,
      status: 'pendente',
      dataVencimento: { gte: startDate, lte: endDate }
    },
    _sum: { valorTotal: true },
    _count: true
  });

  res.json({
    totalPaid: paid._sum.valorTotal ? parseFloat(paid._sum.valorTotal) : 0,
    totalPending: pending._sum.valorTotal ? parseFloat(pending._sum.valorTotal) : 0,
    paidCount: paid._count,
    pendingCount: pending._count
  });
}));

export default router;
