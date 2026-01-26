/**
 * Monitoring Routes
 * Endpoints for invoice status monitoring and certificate lifecycle management
 */

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { sendSuccess } from '../utils/response.js';
import { 
  pollInvoiceStatus, 
  pollAllPendingInvoices,
  getPollingStatus 
} from '../services/invoiceStatusMonitoring.js';
import {
  checkCertificateExpiration,
  checkAllCertificates
} from '../services/certificateLifecycleService.js';
import { prisma } from '../index.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * POST /api/monitoring/invoices/poll/:invoiceId
 * Manually trigger status polling for a specific invoice
 */
router.post('/invoices/poll/:invoiceId', asyncHandler(async (req, res) => {
  const { invoiceId } = req.params;

  // Verify invoice belongs to user
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      company: {
        userId: req.user.id
      }
    }
  });

  if (!invoice) {
    throw new AppError('Invoice not found', 404, 'NOT_FOUND');
  }

  const result = await pollInvoiceStatus(invoiceId);

  sendSuccess(res, 'Invoice status polled', result);
}));

/**
 * POST /api/monitoring/invoices/poll-all
 * Manually trigger polling for all pending invoices
 * (Admin/System use - rate limited)
 */
router.post('/invoices/poll-all', asyncHandler(async (req, res) => {
  // Note: In production, this should be admin-only or system-only
  const result = await pollAllPendingInvoices();

  sendSuccess(res, 'Polling cycle completed', result);
}));

/**
 * GET /api/monitoring/invoices/:invoiceId/status
 * Get polling status for an invoice
 */
router.get('/invoices/:invoiceId/status', asyncHandler(async (req, res) => {
  const { invoiceId } = req.params;

  // Verify invoice belongs to user
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      company: {
        userId: req.user.id
      }
    }
  });

  if (!invoice) {
    throw new AppError('Invoice not found', 404, 'NOT_FOUND');
  }

  const status = await getPollingStatus(invoiceId);

  sendSuccess(res, 'Polling status retrieved', status);
}));

/**
 * GET /api/monitoring/certificates/check/:companyId
 * Check certificate expiration for a company
 */
router.get('/certificates/check/:companyId', asyncHandler(async (req, res) => {
  const { companyId } = req.params;

  // Verify company belongs to user
  const company = await prisma.company.findFirst({
    where: {
      id: companyId,
      userId: req.user.id
    }
  });

  if (!company) {
    throw new AppError('Company not found', 404, 'NOT_FOUND');
  }

  const status = await checkCertificateExpiration(companyId);

  sendSuccess(res, 'Certificate expiration checked', status);
}));

/**
 * POST /api/monitoring/certificates/check-all
 * Check all certificates (Admin/System use)
 */
router.post('/certificates/check-all', asyncHandler(async (req, res) => {
  const result = await checkAllCertificates();

  sendSuccess(res, 'Certificate check completed', result);
}));

export default router;
