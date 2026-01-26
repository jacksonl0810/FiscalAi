/**
 * Pay Per Use Service
 * Handles pay-per-use invoice payment flow
 */

import { prisma } from '../index.js';
import { getPlanConfig } from '../config/plans.js';
import * as pagarmeSDKService from './pagarMeSDK.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Create invoice usage record for pay-per-use
 * @param {string} userId - User ID
 * @param {string} companyId - Company ID
 * @returns {Promise<object>} InvoiceUsage record
 */
export async function createInvoiceUsage(userId, companyId) {
  const now = new Date();
  const planConfig = getPlanConfig('pay_per_use');

  if (!planConfig || !planConfig.perInvoicePrice) {
    throw new AppError('Pay-per-use plan not configured', 500, 'PLAN_NOT_CONFIGURED');
  }

  const invoiceUsage = await prisma.invoiceUsage.create({
    data: {
      userId,
      companyId,
      planId: 'pay_per_use',
      periodYear: now.getFullYear(),
      periodMonth: now.getMonth() + 1,
      amount: planConfig.perInvoicePrice, // R$9.00 = 900 cents
      status: 'pending_payment'
    }
  });

  return invoiceUsage;
}

/**
 * Process pay-per-use payment
 * @param {string} invoiceUsageId - InvoiceUsage ID
 * @param {object} paymentData - Payment data (method, card, etc.)
 * @returns {Promise<object>} Payment result
 */
export async function processPayPerUsePayment(invoiceUsageId, paymentData) {
  const invoiceUsage = await prisma.invoiceUsage.findUnique({
    where: { id: invoiceUsageId },
    include: { 
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          cpfCnpj: true
        }
      },
      company: {
        select: {
          id: true,
          razaoSocial: true,
          cnpj: true
        }
      }
    }
  });

  if (!invoiceUsage) {
    throw new AppError('Invoice usage not found', 404, 'NOT_FOUND');
  }

  if (invoiceUsage.status !== 'pending_payment') {
    throw new AppError('Payment already processed', 400, 'PAYMENT_ALREADY_PROCESSED');
  }

  // Prepare customer data for Pagar.me
  const customerData = {
    name: invoiceUsage.user.name,
    email: invoiceUsage.user.email,
    type: 'individual'
  };

  if (invoiceUsage.user.cpfCnpj) {
    const cpfCnpj = invoiceUsage.user.cpfCnpj.replace(/\D/g, '');
    customerData.document = cpfCnpj;
    customerData.type = cpfCnpj.length === 11 ? 'individual' : 'company';
  }

  // Create Pagar.me order for pay-per-use payment (one-time payment, not subscription)
  // Uses Orders API for one-time payments
  const orderResult = await pagarmeSDKService.createOrder({
    amount: invoiceUsage.amount,
    planName: 'Pay per Use - Invoice',
    customer: customerData,
    payment: paymentData,
    metadata: {
      invoice_usage_id: invoiceUsageId,
      type: 'pay_per_use',
      user_id: invoiceUsage.user.id,
      company_id: invoiceUsage.companyId
    }
  });

  // Update invoice usage with payment order ID
  const updatedUsage = await prisma.invoiceUsage.update({
    where: { id: invoiceUsageId },
    data: {
      paymentOrderId: orderResult.orderId,
      status: orderResult.status === 'paid' ? 'paid' : 'pending_payment'
    }
  });

  return {
    invoiceUsage: updatedUsage,
    orderResult
  };
}

/**
 * Complete invoice creation after payment confirmation (webhook)
 * @param {string} invoiceUsageId - InvoiceUsage ID
 * @param {object} invoiceData - Invoice data to create
 * @returns {Promise<object>} Created invoice
 */
export async function completeInvoiceAfterPayment(invoiceUsageId, invoiceData) {
  const invoiceUsage = await prisma.invoiceUsage.findUnique({
    where: { id: invoiceUsageId },
    include: { company: true }
  });

  if (!invoiceUsage) {
    throw new AppError('Invoice usage not found', 404, 'NOT_FOUND');
  }

  if (invoiceUsage.status !== 'paid') {
    throw new AppError('Payment not confirmed', 400, 'PAYMENT_NOT_CONFIRMED');
  }

  if (invoiceUsage.invoiceId) {
    // Invoice already created
    return await prisma.invoice.findUnique({
      where: { id: invoiceUsage.invoiceId }
    });
  }

  // Create invoice
  const invoice = await prisma.invoice.create({
    data: {
      ...invoiceData,
      companyId: invoiceUsage.companyId,
      invoiceUsageId: invoiceUsageId,
      paymentStatus: 'paid',
      paymentOrderId: invoiceUsage.paymentOrderId
    }
  });

  // Link invoice to usage
  await prisma.invoiceUsage.update({
    where: { id: invoiceUsageId },
    data: { invoiceId: invoice.id }
  });

  return invoice;
}

/**
 * Mark invoice usage as failed
 * @param {string} invoiceUsageId - InvoiceUsage ID
 * @returns {Promise<object>} Updated invoice usage
 */
export async function markInvoiceUsageAsFailed(invoiceUsageId) {
  return await prisma.invoiceUsage.update({
    where: { id: invoiceUsageId },
    data: { status: 'failed' }
  });
}
