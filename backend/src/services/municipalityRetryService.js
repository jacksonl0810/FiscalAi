/**
 * Municipality Retry Service
 * Handles automatic retry of failed invoice submissions when municipality is offline
 * 
 * Features:
 * - Queue invoices when municipality is unavailable
 * - Automatic retry with exponential backoff
 * - Notifications when municipality comes back online
 */

import { prisma } from '../index.js';
import { emitNfse, checkConnection } from './nuvemFiscal.js';
import { translateErrorForUser } from './errorTranslationService.js';
import { isDatabaseConnectionError } from '../utils/databaseConnection.js';

// Retry configuration
const RETRY_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_RETRY_ATTEMPTS = 24; // Max 4 hours of retrying (24 * 10 min)
const RETRY_BACKOFF_MULTIPLIER = 1.5;

/**
 * Queue an invoice for retry when municipality is offline
 * 
 * @param {object} invoiceData - Invoice data to submit
 * @param {object} company - Company data
 * @param {string} userId - User ID
 * @param {string} reason - Reason for queueing
 * @returns {Promise<object>} Queue entry
 */
export async function queueInvoiceForRetry(invoiceData, company, userId, reason) {
  console.log(`[RetryQueue] Queueing invoice for company ${company.id}:`, reason);

  // Check if already queued
  const existing = await prisma.invoiceRetryQueue.findFirst({
    where: {
      companyId: company.id,
      status: 'pending',
      invoiceData: {
        path: ['cliente_nome'],
        equals: invoiceData.cliente_nome
      }
    }
  });

  if (existing) {
    console.log(`[RetryQueue] Invoice already queued: ${existing.id}`);
    return existing;
  }

  // Create queue entry
  const queueEntry = await prisma.invoiceRetryQueue.create({
    data: {
      companyId: company.id,
      userId: userId,
      invoiceData: invoiceData,
      status: 'pending',
      reason: reason,
      attempts: 0,
      nextRetryAt: new Date(Date.now() + RETRY_INTERVAL_MS)
    }
  });

  // Notify user
  await prisma.notification.create({
    data: {
      userId: userId,
      titulo: 'Nota Fiscal em Fila de Espera',
      mensagem: `A prefeitura de ${company.cidade} está temporariamente indisponível. Sua nota fiscal para ${invoiceData.cliente_nome} será enviada automaticamente quando o sistema voltar ao normal.`,
      tipo: 'alerta'
    }
  });

  return queueEntry;
}

/**
 * Process the retry queue
 * 
 * @returns {Promise<object>} Processing results
 */
export async function processRetryQueue() {
  console.log('[RetryQueue] Processing retry queue...');

  let pendingItems;
  try {
    pendingItems = await prisma.invoiceRetryQueue.findMany({
    where: {
      status: 'pending',
      nextRetryAt: {
        lte: new Date()
      },
      attempts: {
        lt: MAX_RETRY_ATTEMPTS
      }
    },
    include: {
      company: true
    },
    take: 20
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      console.warn('[RetryQueue] Database unavailable, skipping retry queue processing');
      return {
        total: 0,
        success: 0,
        failed: 0,
        retrying: 0
      };
    }
    throw error;
  }

  console.log(`[RetryQueue] Found ${pendingItems.length} items to process`);

  const results = {
    total: pendingItems.length,
    success: 0,
    failed: 0,
    retrying: 0
  };

  // Group by municipality to check availability once per municipality
  const byMunicipality = {};
  for (const item of pendingItems) {
    const code = item.company.codigoMunicipio || 'unknown';
    if (!byMunicipality[code]) {
      byMunicipality[code] = [];
    }
    byMunicipality[code].push(item);
  }

  // Process each municipality group
  for (const [municipalityCode, items] of Object.entries(byMunicipality)) {
    // Check if municipality is back online
    const company = items[0].company;
    let isOnline = false;

    try {
      if (company.nuvemFiscalId) {
        const connectionResult = await checkConnection(company.nuvemFiscalId);
        isOnline = connectionResult.status === 'conectado';
      }
    } catch (error) {
      console.log(`[RetryQueue] Municipality ${municipalityCode} still offline:`, error.message);
    }

    if (!isOnline) {
      // Update all items for this municipality to retry later
      for (const item of items) {
        const nextRetryDelay = RETRY_INTERVAL_MS * Math.pow(RETRY_BACKOFF_MULTIPLIER, item.attempts);
        await prisma.invoiceRetryQueue.update({
          where: { id: item.id },
          data: {
            attempts: item.attempts + 1,
            nextRetryAt: new Date(Date.now() + nextRetryDelay),
            lastError: 'Municipality still offline'
          }
        });
        results.retrying++;
      }
      continue;
    }

    // Municipality is online - process each queued invoice
    console.log(`[RetryQueue] Municipality ${municipalityCode} is back online, processing ${items.length} items`);

    for (const item of items) {
      try {
        // Emit the invoice
        const nfseResult = await emitNfse(item.invoiceData, item.company);

        // Calculate ISS
        const valorIss = (parseFloat(item.invoiceData.valor) * parseFloat(item.invoiceData.aliquota_iss || 5)) / 100;

        // Create invoice in database
        const invoice = await prisma.invoice.create({
          data: {
            companyId: item.companyId,
            clienteNome: item.invoiceData.cliente_nome,
            clienteDocumento: item.invoiceData.cliente_documento || '',
            descricaoServico: item.invoiceData.descricao_servico || 'Serviço prestado',
            valor: parseFloat(item.invoiceData.valor),
            aliquotaIss: parseFloat(item.invoiceData.aliquota_iss || 5),
            valorIss: valorIss,
            municipio: item.invoiceData.municipio || item.company.cidade,
            status: nfseResult.nfse.status || 'autorizada',
            numero: nfseResult.nfse.numero,
            codigoVerificacao: nfseResult.nfse.codigo_verificacao,
            dataEmissao: new Date(),
            dataPrestacao: item.invoiceData.data_prestacao ? new Date(item.invoiceData.data_prestacao) : new Date(),
            codigoServico: item.invoiceData.codigo_servico,
            pdfUrl: nfseResult.nfse.pdf_url,
            xmlUrl: nfseResult.nfse.xml_url,
            nuvemFiscalId: nfseResult.nfse.nuvem_fiscal_id
          }
        });

        // Mark queue item as completed
        await prisma.invoiceRetryQueue.update({
          where: { id: item.id },
          data: {
            status: 'completed',
            completedAt: new Date(),
            invoiceId: invoice.id
          }
        });

        // Notify user of success
        await prisma.notification.create({
          data: {
            userId: item.userId,
            titulo: 'Nota Fiscal Emitida (Fila)',
            mensagem: `A nota fiscal para ${item.invoiceData.cliente_nome} que estava em fila de espera foi emitida com sucesso! Número: ${invoice.numero || 'processando'}`,
            tipo: 'sucesso',
            invoiceId: invoice.id
          }
        });

        results.success++;
      } catch (error) {
        console.error(`[RetryQueue] Error processing item ${item.id}:`, error);

        const attempts = item.attempts + 1;
        
        if (attempts >= MAX_RETRY_ATTEMPTS) {
          // Max attempts reached - mark as failed
          await prisma.invoiceRetryQueue.update({
            where: { id: item.id },
            data: {
              status: 'failed',
              attempts: attempts,
              lastError: error.message,
              completedAt: new Date()
            }
          });

          // Notify user of permanent failure
          const translatedError = translateErrorForUser(error, {
            municipality: item.company.cidade
          });

          await prisma.notification.create({
            data: {
              userId: item.userId,
              titulo: 'Falha ao Emitir Nota Fiscal',
              mensagem: `Não foi possível emitir a nota fiscal para ${item.invoiceData.cliente_nome} após múltiplas tentativas. ${translatedError}`,
              tipo: 'erro'
            }
          });

          results.failed++;
        } else {
          // Retry later with backoff
          const nextRetryDelay = RETRY_INTERVAL_MS * Math.pow(RETRY_BACKOFF_MULTIPLIER, attempts);
          await prisma.invoiceRetryQueue.update({
            where: { id: item.id },
            data: {
              attempts: attempts,
              nextRetryAt: new Date(Date.now() + nextRetryDelay),
              lastError: error.message
            }
          });
          results.retrying++;
        }
      }
    }
  }

  console.log('[RetryQueue] Processing complete:', results);
  return results;
}

/**
 * Get queue status for a user
 * 
 * @param {string} userId - User ID
 * @returns {Promise<object>} Queue status
 */
export async function getQueueStatus(userId) {
  const pendingCount = await prisma.invoiceRetryQueue.count({
    where: {
      userId: userId,
      status: 'pending'
    }
  });

  const recentItems = await prisma.invoiceRetryQueue.findMany({
    where: { userId: userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      company: {
        select: {
          razaoSocial: true,
          cidade: true
        }
      }
    }
  });

  return {
    pendingCount,
    recentItems: recentItems.map(item => ({
      id: item.id,
      status: item.status,
      clienteNome: item.invoiceData?.cliente_nome,
      valor: item.invoiceData?.valor,
      company: item.company?.razaoSocial,
      municipality: item.company?.cidade,
      attempts: item.attempts,
      nextRetryAt: item.nextRetryAt,
      createdAt: item.createdAt
    }))
  };
}

/**
 * Start the retry queue processor
 */
export async function startRetryQueueProcessor() {
  console.log('[RetryQueue] Starting retry queue processor...');

  const processWithErrorHandling = async () => {
    try {
      await processRetryQueue();
    } catch (error) {
      if (isDatabaseConnectionError(error)) {
        console.warn('[RetryQueue] Database unavailable, will retry on next cycle');
      } else {
        console.error('[RetryQueue] Processing error:', error);
      }
    }
  };

  await processWithErrorHandling();

  setInterval(processWithErrorHandling, RETRY_INTERVAL_MS);
}

/**
 * Check if error indicates municipality is offline
 * 
 * @param {Error} error - Error to check
 * @returns {boolean} True if municipality appears to be offline
 */
export function isMunicipalityOfflineError(error) {
  const offlineIndicators = [
    'indisponível',
    'indisponivel',
    'offline',
    'timeout',
    'unavailable',
    'manutenção',
    'manutencao',
    'fora do ar',
    'connection refused',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    '503',
    '502',
    '504'
  ];

  const errorMessage = (error.message || '').toLowerCase();
  return offlineIndicators.some(indicator => errorMessage.includes(indicator.toLowerCase()));
}
