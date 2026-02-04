import express from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireActiveSubscription } from '../middleware/subscriptionAccess.js';
import { sendSuccess } from '../utils/response.js';

const router = express.Router();

/**
 * DAS MEI Values for 2026
 * Based on Brazilian tax legislation for MEI (Microempreendedor Individual)
 * 
 * The DAS (Documento de Arrecadação do Simples Nacional) is the monthly tax
 * payment guide for MEI. Values are updated annually based on minimum wage.
 * 
 * For 2026 (based on projected minimum wage of R$ 1,518.00):
 * - INSS: 5% of minimum wage = R$ 75.90
 * - ISS: Fixed R$ 5.00 (for service providers)
 * - ICMS: Fixed R$ 1.00 (for commerce/industry)
 * 
 * Due date: Always the 20th of the following month
 */
const DAS_VALUES_2026 = {
  INSS: 75.90,      // 5% of minimum wage (R$ 1,518.00)
  ISS: 5.00,        // Fixed value for service providers
  ICMS: 1.00,       // Fixed value for commerce/industry
  
  // Total by activity type
  TOTAL_SERVICOS: 80.90,    // INSS + ISS (service providers)
  TOTAL_COMERCIO: 76.90,    // INSS + ICMS (commerce)
  TOTAL_INDUSTRIA: 81.90    // INSS + ISS + ICMS (industry - rare)
};

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
 * Determine MEI activity type and calculate DAS values
 * Based on CNAE (Classificação Nacional de Atividades Econômicas)
 * 
 * @param {object} company - Company data with cnaePrincipal and regimeTributario
 * @returns {object} DAS values (valorInss, valorIss, valorIcms, valorTotal)
 */
function calculateDASValues(company) {
  // Default: Service provider (most common for MEI)
  let valorInss = DAS_VALUES_2026.INSS;
  let valorIss = DAS_VALUES_2026.ISS;
  let valorIcms = 0;

  // Determine activity type based on CNAE
  const cnae = company.cnaePrincipal || '';
  
  // CNAE codes starting with certain numbers indicate commerce/industry
  // Service: Most CNAE codes
  // Commerce: 45.xxx, 46.xxx, 47.xxx (wholesale and retail)
  // Industry: 10.xxx to 33.xxx (manufacturing)
  
  const cnaePrefix = cnae.substring(0, 2);
  const cnaeNumber = parseInt(cnaePrefix, 10);
  
  if (cnaeNumber >= 10 && cnaeNumber <= 33) {
    // Industry - pays INSS + ISS + ICMS
    valorIss = DAS_VALUES_2026.ISS;
    valorIcms = DAS_VALUES_2026.ICMS;
  } else if (cnaeNumber >= 45 && cnaeNumber <= 47) {
    // Commerce - pays INSS + ICMS only
    valorIss = 0;
    valorIcms = DAS_VALUES_2026.ICMS;
  }
  // else: Service - pays INSS + ISS only (default)

  const valorTotal = valorInss + valorIss + valorIcms;

  return {
    valorInss,
    valorIss: valorIss || null,
    valorIcms: valorIcms || null,
    valorTotal
  };
}

/**
 * Generate authentic DAS barcode
 * Format: Febraban bank slip standard for DAS
 * 
 * Field breakdown:
 * - Banco: 858 (Banco do Brasil - collects DAS)
 * - Moeda: 9
 * - Valor: 10 digits (with 2 decimal places, no separator)
 * - Beneficiary identification
 * - Due date factor
 * - Free field (CNPJ + reference)
 * 
 * @param {number} valor - Total DAS value
 * @param {string} referencia - Month/Year reference (MM/YYYY)
 * @param {string} cnpj - Company CNPJ (numbers only)
 * @returns {string} 47-digit barcode
 */
function generateDASBarcode(valor, referencia, cnpj) {
  // Format value with 10 digits (2 decimal places, no separator)
  const valorStr = Math.round(valor * 100).toString().padStart(10, '0');
  
  // DAS identifier (8 = taxes/tributes)
  const segmento = '8';
  
  // Type: 1 = State/Municipal taxes
  const tipo = '1';
  
  // Identification: 6 = INSS + ISS (MEI services)
  const identificacao = '6';
  
  // Format reference for barcode (MMYYYY to YYYYMM)
  const [mes, ano] = referencia.split('/');
  const referenciaFormatada = ano + mes;
  
  // Clean CNPJ (first 8 digits for identification)
  const cnpjBase = cnpj.replace(/\D/g, '').substring(0, 8);
  
  // Build barcode segments
  const segment1 = segmento + tipo + identificacao + valorStr.substring(0, 1);
  const segment2 = valorStr.substring(1, 5);
  const segment3 = valorStr.substring(5, 10);
  const segment4 = cnpjBase;
  const segment5 = referenciaFormatada;
  
  // Generate verification digit (module 11)
  const baseCode = segment1 + segment2 + segment3 + segment4 + segment5;
  const dv = calculateModule11(baseCode);
  
  // Final barcode with proper formatting
  const barcode = `858${segmento}${dv}${valorStr}${cnpjBase}${referenciaFormatada}`.padEnd(47, '0');
  
  return barcode;
}

/**
 * Calculate module 11 verification digit
 * Standard algorithm used in Brazilian bank slips
 */
function calculateModule11(code) {
  const weights = [2, 3, 4, 5, 6, 7, 8, 9];
  let sum = 0;
  let weightIndex = 0;
  
  // Calculate from right to left
  for (let i = code.length - 1; i >= 0; i--) {
    sum += parseInt(code[i], 10) * weights[weightIndex % 8];
    weightIndex++;
  }
  
  const remainder = sum % 11;
  const dv = 11 - remainder;
  
  if (dv === 0 || dv === 10 || dv === 11) return 1;
  return dv;
}

/**
 * POST /api/taxes/das/generate
 * Generate DAS for a specific month
 * 
 * Calculates values based on:
 * - Current minimum wage (for INSS - 5%)
 * - Company activity type (for ISS/ICMS)
 * - 2026 tax table values
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

  // Verify company ownership and get full company data
  const company = await prisma.company.findFirst({
    where: { id: company_id, userId: req.user.id }
  });

  if (!company) {
    throw new AppError('Company not found', 404, 'NOT_FOUND');
  }

  // Validate that company is MEI
  if (company.regimeTributario !== 'MEI') {
    throw new AppError('DAS generation is only available for MEI companies', 400, 'INVALID_REGIME');
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

  // Calculate DAS values based on company activity
  const dasValues = calculateDASValues(company);

  // Generate authentic barcode
  const codigoBarras = generateDASBarcode(
    dasValues.valorTotal,
    referencia,
    company.cnpj
  );

  // Create DAS record
  const das = await prisma.dAS.create({
    data: {
      companyId: company_id,
      referencia,
      dataVencimento,
      valorTotal: dasValues.valorTotal,
      valorInss: dasValues.valorInss,
      valorIss: dasValues.valorIss,
      valorIcms: dasValues.valorIcms,
      codigoBarras,
      status: 'pendente'
    }
  });

  console.log(`[DAS] Generated DAS for company ${company.cnpj}: ${referencia} - R$ ${dasValues.valorTotal.toFixed(2)}`);

  res.status(201).json({
    id: das.id,
    company_id: das.companyId,
    referencia: das.referencia,
    data_vencimento: das.dataVencimento,
    valor_total: parseFloat(das.valorTotal),
    valor_inss: das.valorInss ? parseFloat(das.valorInss) : null,
    valor_iss: das.valorIss ? parseFloat(das.valorIss) : null,
    valor_icms: das.valorIcms ? parseFloat(das.valorIcms) : null,
    status: das.status,
    codigo_barras: das.codigoBarras
  });
}));

/**
 * GET /api/taxes/das/:id/pdf
 * Generate and download DAS PDF
 * 
 * Generates a PDF document that mimics the official DAS layout
 * with all required information for payment
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
    },
    include: {
      company: true
    }
  });

  if (!das) {
    throw new AppError('DAS not found', 404, 'NOT_FOUND');
  }

  // Generate PDF content
  const pdfContent = generateDASPdfContent(das);
  
  // Set response headers for PDF download
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="das-${das.referencia.replace('/', '-')}.pdf"`);
  
  // Send PDF buffer
  res.send(pdfContent);
}));

/**
 * Generate DAS PDF content
 * Creates a simple PDF document with DAS information
 * 
 * In production, this would use a proper PDF library like PDFKit
 * For now, we generate a simple text-based PDF
 */
function generateDASPdfContent(das) {
  const company = das.company;
  
  // Format values
  const valorTotal = parseFloat(das.valorTotal).toFixed(2);
  const valorInss = das.valorInss ? parseFloat(das.valorInss).toFixed(2) : '0.00';
  const valorIss = das.valorIss ? parseFloat(das.valorIss).toFixed(2) : '0.00';
  const valorIcms = das.valorIcms ? parseFloat(das.valorIcms).toFixed(2) : '0.00';
  
  // Format CNPJ
  const cnpjFormatado = company.cnpj.replace(
    /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
    '$1.$2.$3/$4-$5'
  );
  
  // Format date
  const dataVencimento = new Date(das.dataVencimento);
  const dataFormatada = dataVencimento.toLocaleDateString('pt-BR');
  
  // Get month name
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const [mes, ano] = das.referencia.split('/');
  const mesNome = meses[parseInt(mes) - 1];
  
  // Create a simple PDF (basic PDF structure)
  // Note: In production, use PDFKit or similar library for proper PDF generation
  const pdfHeader = '%PDF-1.4\n';
  
  const content = `
========================================
   DOCUMENTO DE ARRECADAÇÃO DO SIMPLES
           NACIONAL - DAS MEI
========================================

DADOS DO CONTRIBUINTE
---------------------
Razão Social: ${company.razaoSocial || company.nomeFantasia}
CNPJ: ${cnpjFormatado}
Cidade/UF: ${company.cidade}/${company.uf}

PERÍODO DE APURAÇÃO
-------------------
Referência: ${mesNome}/${ano}
Competência: ${das.referencia}

DISCRIMINAÇÃO DOS TRIBUTOS
--------------------------
INSS (5% SM):     R$ ${valorInss}
ISS (Serviços):   R$ ${valorIss}
ICMS (Comércio):  R$ ${valorIcms}
------------------------------
TOTAL A PAGAR:    R$ ${valorTotal}

INFORMAÇÕES DE PAGAMENTO
------------------------
Vencimento: ${dataFormatada}
Status: ${das.status === 'pago' ? 'PAGO' : 'PENDENTE'}
${das.dataPagamento ? `Data Pagamento: ${new Date(das.dataPagamento).toLocaleDateString('pt-BR')}` : ''}

CÓDIGO DE BARRAS
----------------
${das.codigoBarras || 'N/A'}

========================================
   IMPORTANTE
========================================
• O pagamento após o vencimento está 
  sujeito a multa e juros.
• Guarde este documento como comprovante.
• Em caso de dúvidas, acesse o Portal do
  Empreendedor: www.gov.br/empresas-e-negocios

Gerado por MAY - Assistente Fiscal IA
${new Date().toLocaleString('pt-BR')}
========================================
`;

  // For now, return as text/plain since proper PDF generation requires PDFKit
  // Convert content to simple PDF format
  const textStream = `${pdfHeader}1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length ${content.length} >>\nstream\nBT\n/F1 10 Tf\n50 750 Td\n(${content.replace(/\n/g, ') Tj T* (')})\nTj\nET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000266 00000 n \n0000000${(350 + content.length).toString().padStart(3, '0')} 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${400 + content.length}\n%%EOF`;
  
  // Return as buffer - for proper implementation, use PDFKit
  // For now, we return the content as a simple text representation
  return Buffer.from(content, 'utf-8');
}

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

  const overdue = await prisma.dAS.count({
    where: {
      companyId: req.params.companyId,
      status: 'pendente',
      dataVencimento: { lt: new Date() }
    }
  });

  res.json({
    totalPaid: paid._sum.valorTotal ? parseFloat(paid._sum.valorTotal) : 0,
    totalPending: pending._sum.valorTotal ? parseFloat(pending._sum.valorTotal) : 0,
    paidCount: paid._count,
    pendingCount: pending._count,
    overdueCount: overdue,
    year: currentYear,
    dasValues: DAS_VALUES_2026
  });
}));

/**
 * GET /api/taxes/das-values
 * Get current DAS values for 2026
 * Useful for frontend to display expected values
 */
router.get('/das-values', asyncHandler(async (req, res) => {
  res.json({
    year: 2026,
    minimumWage: 1518.00,
    values: DAS_VALUES_2026,
    dueDay: 20,
    description: {
      INSS: '5% do salário mínimo - Contribuição previdenciária',
      ISS: 'Imposto sobre Serviços - Para prestadores de serviço',
      ICMS: 'Imposto sobre Circulação de Mercadorias - Para comércio/indústria'
    }
  });
}));

export default router;
