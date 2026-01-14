import express from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../index.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { createCustomer, createPlan, createSubscription, getSubscription, cancelSubscription } from '../services/pagarMe.js';
import { sendSuccess } from '../utils/response.js';
import { emitNfse } from '../services/nuvemFiscal.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

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

/**
 * POST /api/subscriptions/create-customer
 * Create or update Pagar.me customer for current user
 */
router.post('/create-customer', [
  body('cpf_cnpj').notEmpty().withMessage('CPF or CNPJ is required'),
  body('phone').optional()
], validateRequest, asyncHandler(async (req, res) => {
  const { cpf_cnpj, phone } = req.body;

  // Get user
  const user = await prisma.user.findUnique({
    where: { id: req.user.id }
  });

  if (!user) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }

  try {
    // Create or update customer in Pagar.me
    const customerResult = await createCustomer({
      externalId: user.id,
      name: user.name,
      email: user.email,
      cpfCnpj: cpf_cnpj,
      phone: phone || ''
    });

    // Update user with Pagar.me customer ID
    await prisma.user.update({
      where: { id: user.id },
      data: {
        pagarMeCustomerId: customerResult.customerId,
        cpfCnpj: cpf_cnpj.replace(/\D/g, '') // Store numbers only
      }
    });

    sendSuccess(res, 'Cliente criado com sucesso no Pagar.me', {
      customerId: customerResult.customerId
    });
  } catch (error) {
    throw new AppError(error.message || 'Falha ao criar cliente no Pagar.me', 500, 'CUSTOMER_CREATION_ERROR');
  }
}));

/**
 * POST /api/subscriptions/create-plan
 * Create a subscription plan (admin function, or use dashboard)
 * This is typically done once in Pagar.me dashboard, but can be done via API
 */
router.post('/create-plan', [
  body('name').notEmpty().withMessage('Plan name is required'),
  body('amount').isNumeric().withMessage('Amount is required (in cents)'),
  body('days').optional().isInt({ min: 1 }).withMessage('Days must be a positive integer')
], validateRequest, asyncHandler(async (req, res) => {
  const { name, amount, days = 30 } = req.body;

  try {
    const planResult = await createPlan({
      name,
      amount: parseInt(amount),
      days: parseInt(days)
    });

    sendSuccess(res, 'Plano criado com sucesso', {
      planId: planResult.planId,
      name: planResult.name,
      amount: planResult.amount
    });
  } catch (error) {
    throw new AppError(error.message || 'Falha ao criar plano', 500, 'PLAN_CREATION_ERROR');
  }
}));

/**
 * POST /api/subscriptions/create
 * Create a subscription for the current user
 */
router.post('/create', [
  body('plan_id').notEmpty().withMessage('Plan ID is required'),
  body('payment_method').isObject().withMessage('Payment method is required'),
  body('payment_method.type').isIn(['credit_card', 'boleto', 'pix']).withMessage('Invalid payment method type')
], validateRequest, asyncHandler(async (req, res) => {
  const { plan_id, payment_method } = req.body;

  // Get user with Pagar.me customer ID
  const user = await prisma.user.findUnique({
    where: { id: req.user.id }
  });

  if (!user) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }

  if (!user.pagarMeCustomerId) {
    throw new AppError('Cliente não criado no Pagar.me. Complete seu cadastro primeiro.', 400, 'CUSTOMER_NOT_CREATED');
  }

  // Check if user already has an active subscription
  const existingSubscription = await prisma.subscription.findUnique({
    where: { userId: user.id }
  });

  if (existingSubscription && existingSubscription.status !== 'cancelado') {
    throw new AppError('Usuário já possui uma assinatura ativa', 400, 'SUBSCRIPTION_EXISTS');
  }

  try {
    // Create subscription in Pagar.me
    const subscriptionResult = await createSubscription({
      customerId: user.pagarMeCustomerId,
      planId: plan_id,
      paymentMethod: payment_method
    });

    // Create subscription in database
    const subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        pagarMeSubscriptionId: subscriptionResult.subscriptionId,
        pagarMePlanId: plan_id,
        status: subscriptionResult.status === 'paid' ? 'ativo' : 'trial',
        currentPeriodStart: subscriptionResult.currentPeriodStart,
        currentPeriodEnd: subscriptionResult.currentPeriodEnd,
        trialEndsAt: subscriptionResult.status === 'trial' ? subscriptionResult.currentPeriodEnd : null
      }
    });

    sendSuccess(res, 'Assinatura criada com sucesso', {
      subscriptionId: subscription.id,
      pagarMeSubscriptionId: subscription.pagarMeSubscriptionId,
      status: subscription.status
    }, 201);
  } catch (error) {
    throw new AppError(error.message || 'Falha ao criar assinatura', 500, 'SUBSCRIPTION_CREATION_ERROR');
  }
}));

/**
 * GET /api/subscriptions/current
 * Get current user's subscription
 */
router.get('/current', asyncHandler(async (req, res) => {
  const subscription = await prisma.subscription.findUnique({
    where: { userId: req.user.id },
    include: {
      payments: {
        orderBy: { createdAt: 'desc' },
        take: 10
      }
    }
  });

  if (!subscription) {
    return sendSuccess(res, 'Usuário não possui assinatura', {
      status: 'trial',
      hasSubscription: false
    });
  }

  sendSuccess(res, 'Assinatura consultada com sucesso', subscription);
}));

/**
 * POST /api/subscriptions/cancel
 * Cancel current user's subscription
 */
router.post('/cancel', asyncHandler(async (req, res) => {
  const subscription = await prisma.subscription.findUnique({
    where: { userId: req.user.id }
  });

  if (!subscription) {
    throw new AppError('Assinatura não encontrada', 404, 'NOT_FOUND');
  }

  if (subscription.status === 'cancelado') {
    throw new AppError('Assinatura já está cancelada', 400, 'ALREADY_CANCELED');
  }

  try {
    // Cancel in Pagar.me
    await cancelSubscription(subscription.pagarMeSubscriptionId);

    // Update in database
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'cancelado',
        canceledAt: new Date()
      }
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: req.user.id,
        titulo: 'Assinatura Cancelada',
        mensagem: 'Sua assinatura foi cancelada. Você ainda terá acesso até o final do período pago.',
        tipo: 'info'
      }
    });

    sendSuccess(res, 'Assinatura cancelada com sucesso');
  } catch (error) {
    throw new AppError(error.message || 'Falha ao cancelar assinatura', 500, 'SUBSCRIPTION_CANCEL_ERROR');
  }
}));

/**
 * POST /api/subscriptions/webhook
 * Webhook endpoint for Pagar.me events
 * This endpoint should be publicly accessible (no auth middleware)
 * 
 * Pagar.me webhook events:
 * - subscription.created: New subscription created
 * - subscription.paid: Subscription payment successful
 * - subscription.payment_failed: Subscription payment failed
 * - subscription.canceled: Subscription canceled
 * - transaction.paid: Transaction paid (recurring payment)
 * - transaction.refused: Transaction refused
 */
router.post('/webhook', express.raw({ type: 'application/json' }), asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  // Get signature from header (Pagar.me uses x-hub-signature-256)
  const signature = req.headers['x-hub-signature-256'] || 
                    req.headers['x-pagar-me-signature'] ||
                    req.headers['x-signature'];
  
  const payload = req.body.toString();
  const eventId = req.headers['x-event-id'] || 'unknown';

  // Log webhook receipt
  console.log(`[Webhook] Received event: ${eventId}`, {
    headers: Object.keys(req.headers),
    payloadLength: payload.length
  });

  // Validate webhook signature
  const { validateWebhookSignature } = await import('../services/pagarMe.js');
  if (!validateWebhookSignature(signature, payload)) {
    console.error(`[Webhook] Invalid signature for event: ${eventId}`);
    return res.status(401).json({
      status: 'error',
      message: 'Invalid webhook signature'
    });
  }

  // Parse webhook payload
  let event;
  try {
    event = JSON.parse(payload);
  } catch (error) {
    console.error(`[Webhook] Error parsing payload for event: ${eventId}`, error);
    return res.status(400).json({
      status: 'error',
      message: 'Invalid JSON payload'
    });
  }

  const eventType = event.type || event.event || 'unknown';
  const eventData = event.data || event;
  const eventObjectId = event.id || eventData.id || eventId;

  console.log(`[Webhook] Processing event: ${eventType}`, {
    eventId: eventObjectId,
    type: eventType
  });

  // Check for idempotency (prevent duplicate processing)
  // In a production system, you'd store processed event IDs in a cache/database
  // For now, we'll rely on database constraints and webhook retry logic

  try {
    let result = null;

    // Handle different event types
    switch (eventType) {
      case 'subscription.created':
        result = await handleSubscriptionCreated(event);
        break;

      case 'subscription.paid':
      case 'transaction.paid':
        result = await handlePaymentApproved(event);
        break;

      case 'subscription.payment_failed':
      case 'transaction.refused':
        result = await handlePaymentFailed(event);
        break;

      case 'subscription.canceled':
        result = await handleSubscriptionCanceled(event);
        break;

      case 'subscription.updated':
        // Handle subscription updates (plan changes, etc.)
        console.log(`[Webhook] Subscription updated: ${eventObjectId}`);
        result = await handleSubscriptionUpdated(event);
        break;

      default:
        console.log(`[Webhook] Unhandled event type: ${eventType}`, {
          eventId: eventObjectId,
          event: event
        });
        // Return success for unhandled events to prevent retries
        result = { handled: false, message: 'Event type not handled' };
    }

    const processingTime = Date.now() - startTime;
    console.log(`[Webhook] Event processed successfully: ${eventType}`, {
      eventId: eventObjectId,
      processingTime: `${processingTime}ms`,
      result
    });

    // Always return 200 to acknowledge receipt
    // Pagar.me will retry if we return non-200 status
    res.status(200).json({
      status: 'success',
      message: 'Webhook processed',
      eventId: eventObjectId,
      eventType: eventType,
      processingTime: `${processingTime}ms`
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[Webhook] Error processing event: ${eventType}`, {
      eventId: eventObjectId,
      error: error.message,
      stack: error.stack,
      processingTime: `${processingTime}ms`
    });

    // Log error details for debugging
    console.error('[Webhook] Event data:', JSON.stringify(event, null, 2));

    // Return 200 to acknowledge receipt and prevent infinite retries
    // In production, you might want to implement a dead letter queue
    // or return 500 for transient errors that should be retried
    res.status(200).json({
      status: 'error',
      message: 'Webhook processing failed',
      eventId: eventObjectId,
      error: error.message,
      processingTime: `${processingTime}ms`
    });
  }
}));

/**
 * Handle subscription.created event
 */
async function handleSubscriptionCreated(event) {
  const subscriptionData = event.data || event;
  const externalId = subscriptionData.customer?.external_id;

  if (!externalId) {
    console.warn('No external_id in subscription.created event');
    return;
  }

  // Find user by external_id (which is our user ID)
  const user = await prisma.user.findFirst({
    where: { id: externalId }
  });

  if (!user) {
    console.warn(`User not found for external_id: ${externalId}`);
    return;
  }

  // Update or create subscription
  await prisma.subscription.upsert({
    where: { userId: user.id },
    update: {
      pagarMeSubscriptionId: subscriptionData.id,
      pagarMePlanId: subscriptionData.plan?.id || subscriptionData.plan_id,
      status: mapSubscriptionStatus(subscriptionData.status),
      currentPeriodStart: subscriptionData.current_period_start 
        ? new Date(subscriptionData.current_period_start * 1000) 
        : null,
      currentPeriodEnd: subscriptionData.current_period_end 
        ? new Date(subscriptionData.current_period_end * 1000) 
        : null
    },
    create: {
      userId: user.id,
      pagarMeSubscriptionId: subscriptionData.id,
      pagarMePlanId: subscriptionData.plan?.id || subscriptionData.plan_id,
      status: mapSubscriptionStatus(subscriptionData.status),
      currentPeriodStart: subscriptionData.current_period_start 
        ? new Date(subscriptionData.current_period_start * 1000) 
        : null,
      currentPeriodEnd: subscriptionData.current_period_end 
        ? new Date(subscriptionData.current_period_end * 1000) 
        : null
    }
  });
}

/**
 * Handle payment approved event
 */
async function handlePaymentApproved(event) {
  const transactionData = event.data || event;
  const subscriptionId = transactionData.subscription_id || 
                         transactionData.subscription?.id;
  const transactionId = transactionData.id;

  if (!subscriptionId) {
    throw new Error('Subscription ID not found in payment approved event');
  }

  if (!transactionId) {
    throw new Error('Transaction ID not found in payment approved event');
  }

  // Check if payment already processed (idempotency)
  const existingPayment = await prisma.payment.findUnique({
    where: { pagarMeTransactionId: transactionId }
  });

  if (existingPayment && existingPayment.status === 'paid') {
    console.log(`[Webhook] Payment already processed: ${transactionId}`);
    return {
      paymentId: existingPayment.id,
      status: 'already_processed'
    };
  }

  // Find subscription
  const subscription = await prisma.subscription.findFirst({
    where: { pagarMeSubscriptionId: subscriptionId },
    include: { user: true }
  });

  if (!subscription) {
    throw new Error(`Subscription not found for Pagar.me ID: ${subscriptionId}`);
  }

  // Extract amount (Pagar.me sends amount in cents)
  const amount = transactionData.amount 
    ? parseFloat(transactionData.amount) / 100 
    : parseFloat(transactionData.value || 0) / 100;

  if (amount <= 0) {
    throw new Error(`Invalid payment amount: ${amount}`);
  }

  // Extract payment method
  const paymentMethod = transactionData.payment_method || 
                       transactionData.payment_method_type || 
                       'credit_card';

  // Extract dates
  const paidAt = transactionData.date_created 
    ? new Date(transactionData.date_created * 1000)
    : transactionData.paid_at
    ? new Date(transactionData.paid_at * 1000)
    : new Date();

  const periodStart = transactionData.date_created 
    ? new Date(transactionData.date_created * 1000)
    : new Date();
  const periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + 1); // Add 1 month

  // Update subscription status
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: 'ativo',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd
    }
  });

  // Create or update payment record
  const payment = await prisma.payment.upsert({
    where: { pagarMeTransactionId: transactionId },
    update: {
      status: 'paid',
      amount: amount,
      paymentMethod: paymentMethod,
      paidAt: paidAt
    },
    create: {
      subscriptionId: subscription.id,
      pagarMeTransactionId: transactionId,
      amount: amount,
      status: 'paid',
      paymentMethod: paymentMethod,
      paidAt: paidAt
    }
  });

  // Create success notification
  await prisma.notification.create({
    data: {
      userId: subscription.userId,
      titulo: 'Pagamento Aprovado',
      mensagem: `Seu pagamento de R$ ${(payment.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} foi aprovado.`,
      tipo: 'sucesso'
    }
  });

  // Trigger NFS-e emission for the payment
  try {
    await emitInvoiceForPayment(subscription, payment, transactionData);
  } catch (error) {
    console.error('Error emitting invoice for payment:', error);
    // Don't fail the webhook if invoice emission fails
  }
}

/**
 * Handle payment failed event
 */
async function handlePaymentFailed(event) {
  const transactionData = event.data || event;
  const subscriptionId = transactionData.subscription_id || 
                         transactionData.subscription?.id;
  const transactionId = transactionData.id;

  if (!subscriptionId) {
    throw new Error('Subscription ID not found in payment failed event');
  }

  if (!transactionId) {
    throw new Error('Transaction ID not found in payment failed event');
  }

  // Find subscription
  const subscription = await prisma.subscription.findFirst({
    where: { pagarMeSubscriptionId: subscriptionId }
  });

  if (!subscription) {
    throw new Error(`Subscription not found for Pagar.me ID: ${subscriptionId}`);
  }

  // Extract amount
  const amount = transactionData.amount 
    ? parseFloat(transactionData.amount) / 100 
    : parseFloat(transactionData.value || 0) / 100;

  // Extract payment method
  const paymentMethod = transactionData.payment_method || 
                       transactionData.payment_method_type || 
                       'credit_card';

  // Extract failure reason
  const failureReason = transactionData.refuse_reason || 
                       transactionData.status_reason || 
                       'Payment failed';

  // Update subscription status
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: 'inadimplente'
    }
  });

  // Create or update payment record
  const payment = await prisma.payment.upsert({
    where: { pagarMeTransactionId: transactionId },
    update: {
      status: 'failed',
      amount: amount,
      paymentMethod: paymentMethod,
      failedAt: new Date()
    },
    create: {
      subscriptionId: subscription.id,
      pagarMeTransactionId: transactionId,
      amount: amount,
      status: 'failed',
      paymentMethod: paymentMethod,
      failedAt: new Date()
    }
  });

  // Create error notification
  await prisma.notification.create({
    data: {
      userId: subscription.userId,
      titulo: 'Pagamento Recusado',
      mensagem: `Seu pagamento foi recusado. Motivo: ${failureReason}. Por favor, atualize seu método de pagamento.`,
      tipo: 'erro'
    }
  });

  console.log(`[Webhook] Payment failed processed: ${transactionId}`, {
    paymentId: payment.id,
    subscriptionId: subscription.id,
    reason: failureReason
  });

  return {
    paymentId: payment.id,
    transactionId: transactionId,
    status: 'processed',
    reason: failureReason
  };
}

/**
 * Handle subscription canceled event
 */
async function handleSubscriptionCanceled(event) {
  const subscriptionData = event.data || event;
  const subscriptionId = subscriptionData.id;

  if (!subscriptionId) {
    throw new Error('Subscription ID not found in canceled event');
  }

  // Find subscription
  const subscription = await prisma.subscription.findFirst({
    where: { pagarMeSubscriptionId: subscriptionId }
  });

  if (!subscription) {
    throw new Error(`Subscription not found for Pagar.me ID: ${subscriptionId}`);
  }

  // Extract cancellation date
  const canceledAt = subscriptionData.canceled_at 
    ? new Date(subscriptionData.canceled_at * 1000)
    : new Date();

  // Update subscription status
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: 'cancelado',
      canceledAt: canceledAt
    }
  });

  // Create notification
  await prisma.notification.create({
    data: {
      userId: subscription.userId,
      titulo: 'Assinatura Cancelada',
      mensagem: 'Sua assinatura foi cancelada. Você ainda terá acesso até o final do período pago.',
      tipo: 'info'
    }
  });

  console.log(`[Webhook] Subscription canceled: ${subscriptionId}`, {
    subscriptionId: subscription.id,
    userId: subscription.userId
  });

  return {
    subscriptionId: subscription.id,
    pagarMeSubscriptionId: subscriptionId,
    status: 'canceled'
  };
}

/**
 * Handle subscription updated event
 */
async function handleSubscriptionUpdated(event) {
  const subscriptionData = event.data || event;
  const subscriptionId = subscriptionData.id;

  if (!subscriptionId) {
    throw new Error('Subscription ID not found in updated event');
  }

  // Find subscription
  const subscription = await prisma.subscription.findFirst({
    where: { pagarMeSubscriptionId: subscriptionId }
  });

  if (!subscription) {
    throw new Error(`Subscription not found for Pagar.me ID: ${subscriptionId}`);
  }

  // Update subscription with new data
  const updateData = {};
  
  if (subscriptionData.status) {
    updateData.status = mapSubscriptionStatus(subscriptionData.status);
  }
  
  if (subscriptionData.current_period_start) {
    updateData.currentPeriodStart = new Date(subscriptionData.current_period_start * 1000);
  }
  
  if (subscriptionData.current_period_end) {
    updateData.currentPeriodEnd = new Date(subscriptionData.current_period_end * 1000);
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: updateData
    });
  }

  console.log(`[Webhook] Subscription updated: ${subscriptionId}`, updateData);

  return {
    subscriptionId: subscription.id,
    updates: updateData
  };
}

/**
 * Map Pagar.me subscription status to our status
 */
function mapSubscriptionStatus(pagarmeStatus) {
  const statusMap = {
    'paid': 'ativo',
    'unpaid': 'inadimplente',
    'canceled': 'cancelado',
    'pending': 'trial',
    'trialing': 'trial'
  };
  return statusMap[pagarmeStatus] || 'trial';
}

/**
 * Emit NFS-e for a payment
 */
async function emitInvoiceForPayment(subscription, payment, transactionData) {
  // Get user's first company (or active company)
  const user = await prisma.user.findUnique({
    where: { id: subscription.userId },
    include: {
      settings: {
        include: {
          activeCompany: true
        }
      },
      companies: {
        take: 1
      }
    }
  });

  if (!user || (!user.settings?.activeCompany && user.companies.length === 0)) {
    console.warn('User has no company to emit invoice');
    return;
  }

  const company = user.settings?.activeCompany || user.companies[0];

  if (!company.nuvemFiscalId) {
    console.warn('Company not registered in Nuvem Fiscal');
    return;
  }

  // Emit NFS-e for the subscription payment
  // Note: For subscription payments, we typically don't emit NFS-e to the company itself
  // This is a placeholder - adjust based on your business logic
  const invoiceData = {
    cliente_nome: 'Pagar.me - Assinatura FiscalAI',
    cliente_documento: company.cnpj.replace(/\D/g, ''), // Use company's CNPJ as client
    descricao_servico: `Assinatura mensal FiscalAI - ${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`,
    valor: payment.amount,
    aliquota_iss: 5, // Default ISS rate
    municipio: company.cidade,
    data_prestacao: new Date().toISOString().split('T')[0],
    codigo_servico: '1401' // Default service code
  };

  try {
    // Convert company to the format expected by emitNfse
    const companyData = {
      nuvemFiscalId: company.nuvemFiscalId,
      cnpj: company.cnpj,
      inscricaoMunicipal: company.inscricaoMunicipal,
      cidade: company.cidade,
      uf: company.uf
    };
    
    const nfseResult = await emitNfse(invoiceData, companyData);

    // Update payment with NFS-e ID
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        nfseId: nfseResult.nfse.id
      }
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: subscription.userId,
        titulo: 'Nota Fiscal Emitida',
        mensagem: `Nota fiscal emitida para o pagamento da assinatura: ${nfseResult.nfse.numero}`,
        tipo: 'sucesso'
      }
    });
  } catch (error) {
    console.error('Error emitting invoice for payment:', error);
    // Log but don't throw - payment is still valid
  }
}

export default router;
