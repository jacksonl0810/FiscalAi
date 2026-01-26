/**
 * Invoice Status Monitoring Service
 * Automatically polls and monitors invoice status via Nuvem Fiscal API
 * 
 * Architecture:
 * - Nuvem Fiscal does NOT support configurable webhooks for NFS-e
 * - Status updates are obtained through API polling (official approach)
 * - Polling uses progressive backoff to respect rate limits
 * 
 * Features:
 * - Background polling for pending invoices
 * - Progressive backoff (poll less frequently for older invoices)
 * - Status history tracking
 * - Automatic notifications
 * - AI-friendly status updates
 */

import { prisma } from '../index.js';
import { checkNfseStatus } from './nuvemFiscal.js';
import { translateErrorForUser } from './errorTranslationService.js';

const POLLING_INTERVAL_MS = 3 * 60 * 1000;
const MAX_POLLING_ATTEMPTS = 24;
const BATCH_SIZE = 20;

function getPollingInterval(invoice) {
  const ageMinutes = (Date.now() - new Date(invoice.createdAt).getTime()) / (60 * 1000);
  
  if (ageMinutes < 10) return 2 * 60 * 1000;
  if (ageMinutes < 30) return 5 * 60 * 1000;
  if (ageMinutes < 60) return 10 * 60 * 1000;
  return 30 * 60 * 1000;
}

function shouldPollNow(invoice) {
  if (!invoice.lastStatusCheckAt) return true;
  
  const interval = getPollingInterval(invoice);
  const timeSinceLastCheck = Date.now() - new Date(invoice.lastStatusCheckAt).getTime();
  
  return timeSinceLastCheck >= interval;
}

/**
 * Poll status for a single invoice
 * 
 * @param {string} invoiceId - Invoice ID
 * @returns {Promise<object>} Polling result
 */
export async function pollInvoiceStatus(invoiceId) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      company: {
        include: {
          user: true
        }
      },
      statusHistory: {
        where: { source: 'polling' },
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  });

  if (!invoice) {
    throw new Error(`Invoice ${invoiceId} not found`);
  }

  const finalStates = ['autorizada', 'rejeitada', 'cancelada'];
  if (finalStates.includes(invoice.status)) {
    return {
      status: 'skipped',
      reason: 'Invoice already in final state',
      currentStatus: invoice.status
    };
  }

  if (!invoice.nuvemFiscalId) {
    return {
      status: 'skipped',
      reason: 'No Nuvem Fiscal ID',
      currentStatus: invoice.status
    };
  }

  if (!shouldPollNow(invoice)) {
    return {
      status: 'skipped',
      reason: 'Progressive backoff - too soon to poll again',
      currentStatus: invoice.status
    };
  }

  const pollingCount = await prisma.invoiceStatusHistory.count({
    where: {
      invoiceId: invoice.id,
      source: 'polling'
    }
  });

  if (pollingCount >= MAX_POLLING_ATTEMPTS) {
    await prisma.invoiceStatusHistory.create({
      data: {
        invoiceId: invoice.id,
        status: invoice.status,
        message: 'Polling interrompido após máximo de tentativas. Verifique manualmente.',
        source: 'polling',
        metadata: { maxAttemptsReached: true, totalAttempts: pollingCount }
      }
    });

    const { createAINotification } = await import('./aiNotificationService.js');
    await createAINotification(
      invoice.company.userId,
      'invoice_processing',
      {
        cliente: invoice.clienteNome,
        valor: parseFloat(invoice.valor)
      },
      { invoiceId: invoice.id }
    );

    return { status: 'max_attempts_reached', attempts: pollingCount };
  }

  try {
    console.log(`[InvoiceStatusMonitoring] Polling invoice ${invoice.numero || invoiceId}`);
    
    const statusResult = await checkNfseStatus(
      invoice.company.nuvemFiscalId,
      invoice.nuvemFiscalId
    );

    const newStatus = statusResult.status || invoice.status;

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { lastStatusCheckAt: new Date() }
    });

    await prisma.invoiceStatusHistory.create({
      data: {
        invoiceId: invoice.id,
        status: newStatus,
        message: statusResult.mensagem || 'Status verificado via polling',
        source: 'polling',
        metadata: {
          pollingAttempt: pollingCount + 1,
          nuvemFiscalStatus: statusResult.status,
          intervalMinutes: getPollingInterval(invoice) / 60000
        }
      }
    });

    if (newStatus !== invoice.status) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: newStatus,
          pdfUrl: statusResult.pdf_url || invoice.pdfUrl,
          xmlUrl: statusResult.xml_url || invoice.xmlUrl,
          codigoVerificacao: statusResult.codigo_verificacao || invoice.codigoVerificacao,
          numero: statusResult.numero || invoice.numero
        }
      });

      // Use AI notification service for better messages
      const { createAINotification } = await import('./aiNotificationService.js');
      
      if (newStatus === 'autorizada') {
        await createAINotification(
          invoice.company.userId,
          'invoice_authorized',
          {
            numero: invoice.numero || invoice.id,
            cliente: invoice.clienteNome,
            valor: parseFloat(invoice.valor)
          },
          { invoiceId: invoice.id }
        );
      } else if (newStatus === 'rejeitada') {
        const errorMessage = statusResult.mensagem || 'Nota fiscal rejeitada pela prefeitura';
        const translatedError = translateErrorForUser(new Error(errorMessage), {
          municipality: invoice.company.cidade
        });
        
        await createAINotification(
          invoice.company.userId,
          'invoice_rejected',
          {
            cliente: invoice.clienteNome,
            valor: parseFloat(invoice.valor),
            reason: translatedError
          },
          { invoiceId: invoice.id }
        );
      }

      console.log(`[InvoiceStatusMonitoring] Invoice ${invoice.numero} status changed: ${invoice.status} → ${newStatus}`);

      return {
        status: 'updated',
        oldStatus: invoice.status,
        newStatus: newStatus,
        attempts: pollingCount + 1
      };
    }

    return {
      status: 'no_change',
      currentStatus: invoice.status,
      attempts: pollingCount + 1
    };
  } catch (error) {
    console.error(`[InvoiceStatusMonitoring] Error polling invoice ${invoiceId}:`, error.message);

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { lastStatusCheckAt: new Date() }
    });

    await prisma.invoiceStatusHistory.create({
      data: {
        invoiceId: invoice.id,
        status: invoice.status,
        message: `Erro ao verificar status: ${error.message}`,
        source: 'polling',
        metadata: { error: error.message, pollingAttempt: pollingCount + 1 }
      }
    });

    return {
      status: 'error',
      error: error.message,
      attempts: pollingCount + 1
    };
  }
}

/**
 * Poll all pending invoices
 * Uses progressive backoff - older invoices are polled less frequently
 * 
 * @returns {Promise<object>} Polling summary
 */
export async function pollAllPendingInvoices() {
  console.log('[InvoiceStatusMonitoring] Starting polling cycle...');

  const pendingInvoices = await prisma.invoice.findMany({
    where: {
      status: {
        in: ['processando', 'rascunho']
      },
      nuvemFiscalId: {
        not: null
      },
      createdAt: {
        gte: new Date(Date.now() - 48 * 60 * 60 * 1000)
      }
    },
    include: {
      company: {
        select: {
          id: true,
          nuvemFiscalId: true,
          userId: true,
          cidade: true
        }
      }
    },
    orderBy: { createdAt: 'asc' },
    take: BATCH_SIZE
  });

  console.log(`[InvoiceStatusMonitoring] Found ${pendingInvoices.length} pending invoices`);

  const results = {
    total: pendingInvoices.length,
    updated: 0,
    errors: 0,
    skipped: 0
  };

  for (const invoice of pendingInvoices) {
    try {
      const result = await pollInvoiceStatus(invoice.id);
      
      if (result.status === 'updated') {
        results.updated++;
      } else if (result.status === 'error') {
        results.errors++;
      } else {
        results.skipped++;
      }

      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (error) {
      console.error(`[InvoiceStatusMonitoring] Error polling invoice ${invoice.id}:`, error.message);
      results.errors++;
    }
  }

  console.log('[InvoiceStatusMonitoring] Polling cycle complete:', results);
  return results;
}

/**
 * Start background polling (call this from a scheduler/cron job)
 * 
 * Usage:
 * - Set up a cron job or scheduler to call this function every 5 minutes
 * - Or use a worker process that runs continuously
 */
export async function startBackgroundPolling() {
  console.log('[InvoiceStatusMonitoring] Background polling started');
  
  // Poll immediately
  await pollAllPendingInvoices();

  // Set up interval for continuous polling
  setInterval(async () => {
    try {
      await pollAllPendingInvoices();
    } catch (error) {
      console.error('[InvoiceStatusMonitoring] Background polling error:', error);
    }
  }, POLLING_INTERVAL_MS);
}

/**
 * Get polling status for an invoice
 * 
 * @param {string} invoiceId - Invoice ID
 * @returns {Promise<object>} Polling status
 */
export async function getPollingStatus(invoiceId) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      statusHistory: {
        where: {
          source: 'polling'
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  const pollingAttempts = invoice.statusHistory.length;
  const lastPoll = invoice.statusHistory[0];

  return {
    invoiceId: invoice.id,
    currentStatus: invoice.status,
    pollingAttempts: pollingAttempts,
    maxAttempts: MAX_POLLING_ATTEMPTS,
    lastPolledAt: lastPoll?.createdAt || null,
    isPolling: pollingAttempts < MAX_POLLING_ATTEMPTS && 
               !['autorizada', 'rejeitada', 'cancelada'].includes(invoice.status),
    nextPollIn: lastPoll 
      ? Math.max(0, POLLING_INTERVAL_MS - (Date.now() - lastPoll.createdAt.getTime()))
      : 0
  };
}
