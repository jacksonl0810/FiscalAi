/**
 * Webhook Routes
 * Handles webhooks from Nuvem Fiscal and Pagar.me
 */

import express from 'express';
import crypto from 'crypto';
import { prisma } from '../index.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { sendSuccess } from '../utils/response.js';
import { checkNfseStatus } from '../services/nuvemFiscal.js';
import { translateErrorForUser } from '../services/errorTranslationService.js';

const router = express.Router();

/**
 * Verify webhook signature (supports multiple signature formats)
 * @param {string} payload - Request body as string
 * @param {string} signature - Signature from header
 * @param {string} secret - Webhook secret
 * @returns {boolean} True if signature is valid
 */
function verifyWebhookSignature(payload, signature, secret) {
  if (!secret) {
    console.warn('[Webhook] No webhook secret configured, skipping signature verification');
    console.warn('[Webhook] Set NUVEM_FISCAL_WEBHOOK_SECRET in your .env file for production');
    return true; // Allow in development if no secret set
  }

  if (!signature) {
    console.error('[Webhook] No signature provided in request');
    return false;
  }

  try {
    // Generate expected signature using HMAC-SHA256
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    // Nuvem Fiscal may send signature in different formats:
    // 1. Plain hex: "abc123..."
    // 2. With prefix: "sha256=abc123..."
    // 3. With prefix: "v1=abc123..."
    let signatureToCompare = signature;
    
    // Remove common prefixes
    if (signature.startsWith('sha256=')) {
      signatureToCompare = signature.substring(7);
    } else if (signature.startsWith('v1=')) {
      signatureToCompare = signature.substring(3);
    }

    // Ensure both signatures are same length for constant-time comparison
    if (signatureToCompare.length !== expectedSignature.length) {
      console.error('[Webhook] Signature length mismatch');
      return false;
    }

    // Constant-time comparison
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signatureToCompare, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );

    if (!isValid) {
      console.error('[Webhook] Signature mismatch');
    }

    return isValid;
  } catch (error) {
    console.error('[Webhook] Signature verification error:', error.message);
    return false;
  }
}

/**
 * Extract event timestamp from webhook payload
 * Used to prevent replay attacks
 * @param {object} event - Parsed webhook event
 * @returns {Date|null} Event timestamp
 */
function getEventTimestamp(event) {
  const timestamp = event.timestamp || 
                    event.created_at || 
                    event.createdAt || 
                    event.data?.created_at;
  
  if (!timestamp) return null;
  
  try {
    return new Date(timestamp);
  } catch {
    return null;
  }
}

/**
 * Check if webhook event is too old (potential replay attack)
 * @param {object} event - Parsed webhook event
 * @param {number} maxAgeSeconds - Maximum age in seconds (default: 5 minutes)
 * @returns {boolean} True if event is within acceptable time window
 */
function isEventFresh(event, maxAgeSeconds = 300) {
  const eventTime = getEventTimestamp(event);
  if (!eventTime) return true; // If no timestamp, allow (backward compatibility)
  
  const ageSeconds = (Date.now() - eventTime.getTime()) / 1000;
  return ageSeconds <= maxAgeSeconds;
}

/**
 * POST /api/webhooks/nuvem-fiscal
 * Handle webhooks from Nuvem Fiscal
 * 
 * Events handled:
 * - invoice.status_changed - Invoice status update
 * - municipality.offline - Municipality system offline
 * - certificate.expiration_warning - Certificate expiring soon
 */
router.post('/nuvem-fiscal', express.raw({ type: 'application/json' }), asyncHandler(async (req, res) => {
  const signature = req.headers['x-nuvem-fiscal-signature'] || req.headers['x-signature'];
  const webhookSecret = process.env.NUVEM_FISCAL_WEBHOOK_SECRET;

  // Get raw body for signature verification
  const payload = req.body.toString();

  // Verify signature
  if (webhookSecret && signature) {
    const isValid = verifyWebhookSignature(payload, signature, webhookSecret);
    if (!isValid) {
      console.error('[Webhook] Invalid signature');
      throw new AppError('Invalid webhook signature', 401, 'INVALID_SIGNATURE');
    }
  }

  // Parse webhook payload
  let event;
  try {
    event = JSON.parse(payload);
  } catch (error) {
    throw new AppError('Invalid webhook payload', 400, 'INVALID_PAYLOAD');
  }

  console.log('[Webhook] Received Nuvem Fiscal event:', {
    type: event.type || event.event_type,
    id: event.id || event.event_id,
    timestamp: event.timestamp || event.created_at
  });

  // Handle different event types
  const eventType = event.type || event.event_type || 'unknown';

  switch (eventType) {
    case 'invoice.status_changed':
    case 'nfse.status_changed':
      await handleInvoiceStatusChanged(event);
      break;

    case 'municipality.offline':
    case 'municipio.offline':
      await handleMunicipalityOffline(event);
      break;

    case 'certificate.expiration_warning':
    case 'certificado.expiracao':
      await handleCertificateExpirationWarning(event);
      break;

    default:
      console.warn('[Webhook] Unknown event type:', eventType);
      // Don't throw error - just log and acknowledge
  }

  // Always return 200 to acknowledge receipt
  sendSuccess(res, 'Webhook received and processed');
}));

/**
 * Handle invoice status changed event
 */
async function handleInvoiceStatusChanged(event) {
  const invoiceData = event.data || event;
  const nfseId = invoiceData.nfse_id || invoiceData.id;
  const companyId = invoiceData.company_id;
  const newStatus = invoiceData.status || invoiceData.novo_status;
  const oldStatus = invoiceData.status_anterior || invoiceData.old_status;

  if (!nfseId) {
    console.error('[Webhook] Invoice status changed event missing nfse_id');
    return;
  }

  // Find invoice by nuvemFiscalId
  const invoice = await prisma.invoice.findFirst({
    where: {
      nuvemFiscalId: nfseId.toString()
    },
    include: {
      company: {
        include: {
          user: true
        }
      }
    }
  });

  if (!invoice) {
    console.warn(`[Webhook] Invoice not found for nfse_id: ${nfseId}`);
    return;
  }

  // Map Nuvem Fiscal status to our status
  const statusMap = {
    'autorizada': 'autorizada',
    'rejeitada': 'rejeitada',
    'cancelada': 'cancelada',
    'processando': 'processando',
    'pendente': 'rascunho'
  };

  const mappedStatus = statusMap[newStatus?.toLowerCase()] || newStatus || invoice.status;

  // Create status history entry
  await prisma.invoiceStatusHistory.create({
    data: {
      invoiceId: invoice.id,
      status: mappedStatus,
      message: invoiceData.mensagem || invoiceData.message || `Status alterado de ${oldStatus} para ${newStatus}`,
      source: 'webhook',
      metadata: {
        nfse_id: nfseId,
        old_status: oldStatus,
        new_status: newStatus,
        event_id: event.id || event.event_id,
        timestamp: event.timestamp || event.created_at
      }
    }
  });

  // Update invoice status
  const updatedInvoice = await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status: mappedStatus,
      updatedAt: new Date()
    }
  });

  // Use AI notification service for better messages
  const { createAINotification } = await import('../services/aiNotificationService.js');
  
  if (mappedStatus === 'autorizada') {
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
  } else if (mappedStatus === 'rejeitada') {
    const errorMessage = invoiceData.mensagem || invoiceData.message || 'Nota fiscal rejeitada';
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
  } else if (mappedStatus === 'cancelada') {
    await createAINotification(
      invoice.company.userId,
      'invoice_cancelled',
      {
        numero: invoice.numero || invoice.id,
        cliente: invoice.clienteNome
      },
      { invoiceId: invoice.id }
    );
  }

  console.log(`[Webhook] Invoice ${invoice.id} status updated to ${mappedStatus}`);
}

/**
 * Handle municipality offline event
 */
async function handleMunicipalityOffline(event) {
  const eventData = event.data || event;
  const codigoMunicipio = eventData.codigo_municipio || eventData.municipio;

  if (!codigoMunicipio) {
    console.error('[Webhook] Municipality offline event missing codigo_municipio');
    return;
  }

  // Find all companies in this municipality
  const companies = await prisma.company.findMany({
    where: {
      codigoMunicipio: codigoMunicipio.toString()
    },
    include: {
      user: true
    }
  });

  // Update connection status for all affected companies
  for (const company of companies) {
    await prisma.company.update({
      where: { id: company.id },
      data: {
        fiscalConnectionStatus: 'failed',
        fiscalConnectionError: 'Sistema da prefeitura temporariamente indisponível',
        lastConnectionCheck: new Date()
      }
    });

    // Notify user with AI-generated message
    const { createAINotification } = await import('../services/aiNotificationService.js');
    await createAINotification(
      company.userId,
      'municipality_offline',
      {
        city: company.cidade
      }
    );
  }

  console.log(`[Webhook] Updated ${companies.length} companies for municipality ${codigoMunicipio} offline`);
}

/**
 * Handle certificate expiration warning
 */
async function handleCertificateExpirationWarning(event) {
  const eventData = event.data || event;
  const companyId = eventData.company_id;
  const expiresAt = eventData.expires_at || eventData.expiresAt;

  if (!companyId) {
    console.error('[Webhook] Certificate expiration warning missing company_id');
    return;
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      user: true,
      fiscalCredential: true
    }
  });

  if (!company || !company.fiscalCredential) {
    return;
  }

  // Update company connection status
  await prisma.company.update({
    where: { id: companyId },
    data: {
      fiscalConnectionStatus: 'expired',
      fiscalConnectionError: 'Certificado digital expirando em breve',
      lastConnectionCheck: new Date()
    }
  });

  // Notify user with AI-generated message
  const daysUntilExpiration = expiresAt 
    ? Math.ceil((new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  const { createAINotification } = await import('../services/aiNotificationService.js');
  await createAINotification(
    company.userId,
    daysUntilExpiration !== null && daysUntilExpiration <= 0 ? 'certificate_expired' : 'certificate_expiring',
    {
      days: daysUntilExpiration !== null ? daysUntilExpiration : 0
    }
  );

  console.log(`[Webhook] Certificate expiration warning for company ${companyId}`);
}

export default router;
