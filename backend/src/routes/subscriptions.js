import express from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../index.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import * as pagarmeSDKService from '../services/pagarMeSDK.js';
import { sendSuccess } from '../utils/response.js';
import { emitNfse } from '../services/nuvemFiscal.js';
import { sendEmail, sendPaymentConfirmationEmail, sendSubscriptionStatusEmail } from '../services/email.js';
import { subscriptionLimiter } from '../middleware/rateLimiter.js';
import axios from 'axios';

const router = express.Router();

/**
 * Helper function to check if Pagar.me is configured
 * Handles cases where isConfigured might not be exported yet
 */
function isPagarMeConfigured() {
  if (pagarmeSDKService.isConfigured && typeof pagarmeSDKService.isConfigured === 'function') {
    return pagarmeSDKService.isConfigured();
  }
  // Fallback: check environment variable directly
  return !!process.env.PAGARME_API_KEY;
}

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Calculate next billing date based on billing cycle
 * @param {string} billingCycle - 'monthly', 'semiannual', or 'annual'
 * @param {Date} startDate - Start date (defaults to now)
 * @returns {Date} Next billing date
 */
function calculateNextBillingDate(billingCycle, startDate = new Date()) {
  const date = new Date(startDate);
  
  switch (billingCycle) {
    case 'annual':
      date.setFullYear(date.getFullYear() + 1);
      break;
    case 'semiannual':
      date.setMonth(date.getMonth() + 6);
      break;
    case 'monthly':
    default:
      date.setMonth(date.getMonth() + 1);
      break;
  }
  
  return date;
}

/**
 * Create notification with idempotency check
 * Prevents duplicate notifications within a time window
 * @param {object} params - Notification parameters
 * @param {string} params.userId - User ID
 * @param {string} params.titulo - Notification title
 * @param {string} params.mensagem - Notification message
 * @param {string} params.tipo - Notification type ('sucesso', 'erro', 'info', 'alerta')
 * @param {number} params.windowMinutes - Time window in minutes to check for duplicates (default: 5)
 * @returns {Promise<object|null>} Created notification or null if duplicate
 */
async function createNotificationWithIdempotency({ userId, titulo, mensagem, tipo, windowMinutes = 5 }) {
  const windowAgo = new Date(Date.now() - windowMinutes * 60 * 1000);
  
  const existingNotification = await prisma.notification.findFirst({
    where: {
      userId,
      titulo,
      createdAt: { gte: windowAgo }
    }
  });

  if (existingNotification) {
    return null;
  }

  return await prisma.notification.create({
    data: {
      userId,
      titulo,
      mensagem,
      tipo
    }
  });
}

// ========================================
// WEBHOOK ENDPOINT (PUBLIC - NO AUTH)
// ========================================
// This MUST be before router.use(authenticate)
// Webhooks are the SOURCE OF TRUTH for subscription status

router.post('/webhook', express.json(), asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  // Get query token (if webhook URL is configured with ?token=SECRET)
  const queryToken = req.query.token;
  const eventId = req.headers['x-event-id'] || req.headers['x-request-id'] || 'unknown';

  // Handle both raw Buffer and pre-parsed JSON body
  let event;
  try {
    if (Buffer.isBuffer(req.body)) {
      // Body is raw Buffer - parse it
      event = JSON.parse(req.body.toString());
    } else if (typeof req.body === 'string') {
      // Body is string - parse it
      event = JSON.parse(req.body);
    } else if (typeof req.body === 'object' && req.body !== null) {
      // Body is already parsed object - use directly
      event = req.body;
    } else {
      throw new Error('Empty or invalid request body');
    }
  } catch (error) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid JSON payload'
    });
  }

  // Log webhook data from Pagar.me
  console.log('Webhook data from Pagar.me:', JSON.stringify(event, null, 2));

  // Validate webhook using custom secret (header or query token)
  // Pagar.me does NOT use HMAC signing - we use our own secret validation
  if (!pagarmeSDKService.validateWebhookSecret(req.headers, queryToken)) {
    return res.status(401).json({
      status: 'error',
      message: 'Invalid webhook secret. Configure X-Pagarme-Webhook-Secret header or ?token= query param.'
    });
  }

  const eventType = event.type || event.event || 'unknown';
  const eventData = event.data || event;
  const eventObjectId = event.id || eventData.id || eventId;

  try {
    let result = null;

    // Handle different event types
    // ✅ Pagar.me v5 Subscriptions API uses invoice.* events for payments
    // ✅ PRIMARY: invoice.paid, invoice.payment_failed (for recurring billing)
    // ✅ SECONDARY: order.* events (for one-time payments only)
    switch (eventType) {
      // ═══════════════════════════════════════════════════════════════════════
      // ✅ V5 SUBSCRIPTIONS API EVENTS (PRIMARY - for recurring billing)
      // ═══════════════════════════════════════════════════════════════════════
      
      // ✅ Invoice paid - MOST IMPORTANT for subscriptions
      // This is the SOURCE OF TRUTH for subscription payment confirmation
      case 'invoice.paid':
        result = await handleInvoicePaid(event);
        break;
      
      // ✅ Invoice payment failed - handle failed recurring payment
      case 'invoice.payment_failed':
      case 'invoice.canceled':
        result = await handleInvoicePaymentFailed(event);
        break;
      
      // ✅ Invoice created - acknowledge only (wait for invoice.paid)
      case 'invoice.created':
        result = { status: 'acknowledged', message: 'Waiting for invoice.paid event' };
        break;
      
      // ═══════════════════════════════════════════════════════════════════════
      // ✅ V5 SUBSCRIPTION LIFECYCLE EVENTS
      // ═══════════════════════════════════════════════════════════════════════
      
      case 'subscription.created':
        result = await handleSubscriptionCreated(event);
        break;

      case 'subscription.canceled':
        result = await handleSubscriptionCanceled(event);
        break;

      case 'subscription.updated':
        result = await handleSubscriptionUpdated(event);
        break;

      // Additional subscription events
      case 'subscription.renewed':
      case 'subscription.activated':
        result = await handleSubscriptionRenewed(event);
        break;

      case 'subscription.pending':
      case 'subscription.pending_payment':
        result = await handleSubscriptionPending(event);
        break;
      
      // ═══════════════════════════════════════════════════════════════════════
      // ✅ V5 ORDERS API EVENTS (for one-time payments, legacy support)
      // ═══════════════════════════════════════════════════════════════════════
      
      case 'order.paid':
      case 'order.closed':
        result = await handleOrderPaid(event);
        break;

      case 'order.payment_failed':
      case 'order.canceled':
        result = await handleOrderPaymentFailed(event);
        break;

      case 'order.created':
        result = await handleOrderCreated(event);
        break;

      // ═══════════════════════════════════════════════════════════════════════
      // ✅ V5 CHARGE EVENTS (acknowledge - let invoice/order handle activation)
      // ═══════════════════════════════════════════════════════════════════════
      
      case 'charge.paid':
        result = { status: 'acknowledged', message: 'Handled by invoice.paid or order.paid event' };
        break;

      case 'charge.payment_failed':
      case 'charge.refused':
      case 'charge.refunded':
        result = await handleChargePaymentFailed(event);
        break;

      case 'charge.created':
        result = await handleChargeCreated(event);
        break;

      // ═══════════════════════════════════════════════════════════════════════
      // ✅ LEGACY EVENTS (backward compatibility)
      // ═══════════════════════════════════════════════════════════════════════
      
      case 'subscription.paid':
      case 'transaction.paid':
        result = await handlePaymentApproved(event);
        break;

      case 'subscription.payment_failed':
      case 'transaction.refused':
        result = await handlePaymentFailed(event);
        break;

      default:
        result = { handled: false, message: 'Event type not handled' };
    }

    const processingTime = Date.now() - startTime;

    // Always return 200 to acknowledge receipt
    res.status(200).json({
      status: 'success',
      message: 'Webhook processed',
      eventId: eventObjectId,
      eventType: eventType,
      processingTime: `${processingTime}ms`
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;

    // Return 200 to acknowledge receipt and prevent infinite retries
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
 * GET /api/subscriptions/webhook/config
 * Check webhook configuration (development only)
 * Helps verify webhook secret is properly configured
 */
router.get('/webhook/config', asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      status: 'error',
      message: 'Webhook config endpoint is disabled in production'
    });
  }

  const webhookSecret = pagarmeSDKService.getWebhookSecret ? pagarmeSDKService.getWebhookSecret() : process.env.PAGARME_WEBHOOK_SECRET;
  const baseUrl = process.env.BACKEND_URL || process.env.BASE_URL || 'http://localhost:3001';
  
  sendSuccess(res, 'Webhook configuration', {
    secret_configured: !!webhookSecret,
    secret_length: webhookSecret ? webhookSecret.length : 0,
    webhook_url: `${baseUrl}/api/subscriptions/webhook`,
    webhook_url_with_token: webhookSecret ? `${baseUrl}/api/subscriptions/webhook?token=${webhookSecret}` : null,
    instructions: {
      step1: 'Go to Pagar.me Dashboard → Configurações → Webhooks',
      step2: 'Click "Criar webhook"',
      step3_option_a: `Set URL to: ${baseUrl}/api/subscriptions/webhook`,
      step3_option_a_header: 'Add custom header: X-Pagarme-Webhook-Secret: YOUR_SECRET',
      step3_option_b: `Or set URL with token: ${baseUrl}/api/subscriptions/webhook?token=YOUR_SECRET`,
      step4: 'Select events (v5 Subscriptions): invoice.paid, invoice.payment_failed, subscription.created, subscription.canceled, subscription.updated',
      step4_legacy: 'Legacy events (one-time payments): order.paid, order.payment_failed, charge.paid, charge.payment_failed',
      step5: 'Save webhook',
      important: '⚠️ For v5 subscriptions, invoice.paid is the PRIMARY payment confirmation event'
    },
    validation_methods: [
      'Header: X-Pagarme-Webhook-Secret',
      'Header: X-Webhook-Secret',
      'Header: Authorization: Bearer YOUR_SECRET',
      'Query: ?token=YOUR_SECRET'
    ]
  });
}));

/**
 * GET /api/subscriptions/webhook/test
 * Test webhook endpoint (development only)
 * Allows simulating webhook events for testing
 */
router.get('/webhook/test', asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      status: 'error',
      message: 'Webhook test endpoint is disabled in production'
    });
  }

  sendSuccess(res, 'Webhook test endpoint is available', {
    available_events: [
      'order.paid',
      'order.payment_failed',
      'order.canceled',
      'charge.paid',
      'charge.payment_failed',
      'subscription.created',
      'subscription.paid',
      'subscription.payment_failed',
      'subscription.canceled',
      'subscription.updated'
    ],
    usage: 'POST /api/subscriptions/webhook with event payload',
    example: {
      type: 'order.paid',
      data: {
        id: 'or_xxx',
        customer_id: 'cus_xxx',
        status: 'paid',
        amount: 9700,
        metadata: {
          user_id: 'user-uuid',
          plan_id: 'pro',
          billing_cycle: 'monthly',
          type: 'subscription'
        },
        charges: [{
          id: 'ch_xxx',
          amount: 9700,
          status: 'paid'
        }]
      }
    }
  });
}));

/**
 * POST /api/subscriptions/webhook/simulate
 * Simulate webhook event (development only)
 */
router.post('/webhook/simulate', express.json(), asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      status: 'error',
      message: 'Webhook simulation is disabled in production'
    });
  }

  const { event_type, data } = req.body;

  if (!event_type || !data) {
    return res.status(400).json({
      status: 'error',
      message: 'event_type and data are required'
    });
  }


  // Process the simulated event
  let result = null;

  try {
    switch (event_type) {
      case 'order.paid':
      case 'order.closed':
        result = await handleOrderPaid({ type: event_type, data });
        break;
      case 'order.payment_failed':
      case 'order.canceled':
        result = await handleOrderPaymentFailed({ type: event_type, data });
        break;
      case 'charge.paid':
        result = await handleChargePaid({ type: event_type, data });
        break;
      case 'charge.payment_failed':
        result = await handleChargePaymentFailed({ type: event_type, data });
        break;
      default:
        return res.status(400).json({
          status: 'error',
          message: `Unknown event type: ${event_type}`
        });
    }

    sendSuccess(res, 'Webhook simulation processed', { event_type, result });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}));

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
 * POST /api/subscriptions/tokenize-card
 * Backend tokenization endpoint
 * This uses Pagar.me public key to tokenize cards server-side
 * 
 * ✅ V5-COMPLIANT FLOW:
 * 1. Tokenize card with public key → get token_xxxxx
 * 2. Return token_xxxxx to frontend
 * 3. Card is created later when token is attached to customer
 * 
 * ⚠️ PUBLIC ENDPOINT (no authentication required)
 * - Uses only Pagar.me public key (not secret key)
 * - No money is charged
 * - No subscription is created
 * - Returns token (token_xxxxx), NOT card_id
 * - Card is created implicitly when token is attached to customer
 * - PCI responsibility stays with Pagar.me
 */
router.post('/tokenize-card', [
  body('number').trim().notEmpty().withMessage('Card number is required'),
  body('holder_name').trim().notEmpty().withMessage('Card holder name is required'),
  body('exp_month').trim().notEmpty().withMessage('Expiration month is required'),
  body('exp_year').trim().notEmpty().withMessage('Expiration year is required'),
  body('cvv').trim().notEmpty().withMessage('CVV is required'),
], validateRequest, asyncHandler(async (req, res) => {
  
  const { number, holder_name, exp_month, exp_year, cvv } = req.body;

  try {
    // ✅ V5-COMPLIANT FLOW:
    // 1. Tokenize card with public key → get token_xxxxx
    // 2. Return token_xxxxx to frontend
    // 3. Card will be created when token is attached to customer
    const tokenResult = await pagarmeSDKService.tokenizeCard({
      number,
      holder_name,
      exp_month,
      exp_year,
      cvv
    });

    // ✅ Returns token (token_xxxxx) - card is created later during attachment
    if (!tokenResult.token || !tokenResult.token.startsWith('token_')) {
      throw new Error('Invalid token returned from Pagar.me');
    }

    sendSuccess(res, 'Cartão tokenizado com sucesso', {
      token: tokenResult.token, // ✅ Returns token_xxxxx
      card: tokenResult.card // Card preview data (last 4 digits, brand, etc.)
    });
  } catch (error) {
    
    throw new AppError(
      `Erro ao tokenizar cartão: ${error.message}`,
      error.status || 500,
      'CARD_TOKENIZATION_ERROR',
      { originalError: error.message }
    );
  }
}));

// ========================================
// ALL OTHER ROUTES REQUIRE AUTHENTICATION
// ========================================
router.use(authenticate);

/**
 * POST /api/subscriptions/start
 * Start subscription process - creates subscription as PENDING
 * Returns checkout_url for Pagar.me
 * 
 * 🚨 IMPORTANT: Subscription is NOT active until webhook confirms payment
 */
router.post('/start', 
  subscriptionLimiter, // Use subscription-specific rate limiter
  [
    body('plan_id').notEmpty().withMessage('Plan ID is required'),
    body('billing_cycle').optional().isIn(['monthly', 'semiannual', 'annual']).withMessage('Billing cycle must be monthly, semiannual, or annual'),
    body('return_url').optional(),
    body('cancel_url').optional()
  ], 
  validateRequest, 
  asyncHandler(async (req, res) => {
  const { plan_id, billing_cycle = 'monthly', return_url, cancel_url } = req.body;
  const userId = req.user.id;

  // Get user data
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new AppError('Usuário não encontrado', 404, 'NOT_FOUND');
  }

  // Import plan configuration
  const { getPlanConfig, getPlanPrice, getBillingCycleConfig, normalizePlanId } = await import('../config/plans.js');
  
  // Normalize plan ID (map frontend IDs like 'pro', 'business' to backend IDs)
  const normalizedPlanId = normalizePlanId(plan_id);
  
  // Get plan configuration
  const planConfig = getPlanConfig(normalizedPlanId);
  if (!planConfig) {
    throw new AppError('Plano não encontrado', 400, 'INVALID_PLAN');
  }

  // Get price based on billing cycle
  const planAmount = getPlanPrice(normalizedPlanId, billing_cycle);
  if (planAmount === null && normalizedPlanId !== 'pay_per_use' && normalizedPlanId !== 'accountant' && normalizedPlanId !== 'trial') {
    throw new AppError('Plano não suporta este ciclo de cobrança', 400, 'INVALID_BILLING_CYCLE');
  }

  // Get billing cycle configuration
  const billingConfig = getBillingCycleConfig(billing_cycle);

  // Plan configuration - Use normalized plan ID
  const plan = {
    name: planConfig.name,
    amount: planAmount || planConfig.monthlyPrice || 0,
    days: normalizedPlanId === 'trial' ? 7 : billingConfig.days,
    planId: normalizedPlanId,
    interval: billingConfig.interval,
    intervalCount: billingConfig.intervalCount
  };

  // Check if user already has a subscription
  const existingSubscription = await prisma.subscription.findUnique({
    where: { userId }
  });

  let subscription;
  let checkoutUrl;

  // Handle trial differently - activate immediately (no payment needed)
  if (normalizedPlanId === 'trial') {
    // 🚫 CHECK: User can only use trial ONCE
    if (user.hasUsedTrial) {
      throw new AppError(
        'Você já utilizou seu período de teste gratuito. Por favor, escolha um plano pago para continuar.',
        403,
        'TRIAL_ALREADY_USED',
        { 
          hasUsedTrial: true,
          trialStartedAt: user.trialStartedAt,
          trialEndedAt: user.trialEndedAt
        }
      );
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + plan.days);

    if (existingSubscription) {
      // Update existing subscription to trial
      subscription = await prisma.subscription.update({
        where: { id: existingSubscription.id },
        data: {
          status: 'trial',
          pagarMePlanId: plan.planId,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          trialEndsAt: periodEnd,
          canceledAt: null
        }
      });
    } else {
      // Create new trial subscription
      subscription = await prisma.subscription.create({
        data: {
          userId,
          status: 'trial',
          pagarMePlanId: plan.planId,
          pagarMeSubscriptionId: `trial_${Date.now()}_${userId.slice(0, 8)}`,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          trialEndsAt: periodEnd
        }
      });
    }

    // ✅ Mark user as having used trial - they can NEVER use it again
    await prisma.user.update({
      where: { id: userId },
      data: {
        hasUsedTrial: true,
        trialStartedAt: now
      }
    });

    // Create welcome notification (only if one doesn't exist already)
    const existingWelcome = await prisma.notification.findFirst({
      where: {
        userId,
        titulo: 'Bem-vindo à MAY!'
      }
    });

    if (!existingWelcome) {
      await prisma.notification.create({
        data: {
          userId,
          titulo: 'Bem-vindo à MAY!',
          mensagem: 'Seu trial de 7 dias começou. Aproveite todas as funcionalidades!',
          tipo: 'sucesso'
        }
      });
    }

    // For trial, redirect directly to success page
    checkoutUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-success?plan=trial&session_id=${subscription.pagarMeSubscriptionId}`;
  } else {
    // For paid plans, create subscription with Pagar.me checkout
    // User will be redirected to Pagar.me to enter card details
    
    let pagarMeSubscriptionId = null;
    let pagarMeOrderId = null;
    
    // ✅ V5 approach: Return checkout URL for frontend payment form
    // Frontend will tokenize card and call /process-payment
    if (isPagarMeConfigured()) {
      // No need to create plans in Pagar.me (v5 uses items, not plans)
      // Just return the checkout URL for our payment form
      checkoutUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/checkout/subscription?plan=${plan_id}`;
      
      // Store temporary subscription ID (will be updated after payment)
      pagarMeSubscriptionId = `pending_${Date.now()}_${userId.slice(0, 8)}`;  
    } else {
      // Pagar.me not configured - create simulated subscription for testing/development
      pagarMeSubscriptionId = `pending_${Date.now()}_${userId.slice(0, 8)}`;
      checkoutUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-success?plan=${plan_id}&session_id=${pagarMeSubscriptionId}`;
    }

    // ✅ DON'T create subscription until payment is confirmed
    // Only create/update subscription AFTER payment is processed
    // This prevents showing "pending" status before user actually pays
    subscription = existingSubscription || null;
    
    // If subscription exists but is canceled, we'll reactivate it after payment
    // Otherwise, subscription will be created in /process-payment endpoint
  }

  sendSuccess(res, 'Subscription started', {
    checkout_url: checkoutUrl,
    subscription_id: subscription?.id || null,
    plan_id: plan.planId,
    status: subscription?.status || null,
    // Note: Subscription will be created/activated in /process-payment endpoint after payment
  });
}));

/**
 * Process subscription payment (Step 2 of subscription flow)
 * This endpoint receives card details from frontend and creates the order with Pagar.me
 * POST /api/subscriptions/process-payment
 */
router.post('/process-payment', 
  authenticate, 
  subscriptionLimiter, // Use subscription-specific rate limiter
  [
  body('plan_id').trim().notEmpty().withMessage('Plan ID is required'),
  body('billing_cycle').optional().isIn(['monthly', 'semiannual', 'annual']).withMessage('Billing cycle must be monthly, semiannual, or annual'),
  // ✅ Frontend tokenization approach: card_token from frontend (PCI compliant)
  // ✅ v5 REQUIRES token (token_xxxxx) - card is created when token is attached to customer
  body('card_token').trim().notEmpty().withMessage('Card token is required'),
  body('card_token').custom((value) => {
    if (!value.startsWith('token_')) {
      throw new Error('Invalid card_token format. Must start with "token_". In v5, tokens are attached to customers and cards are created automatically.');
    }
    return true;
  }),
  // ✅ CPF/CNPJ is required for Pagar.me customer creation
  body('cpf_cnpj').optional().trim().custom((value) => {
    if (value) {
      const cleaned = value.replace(/\D/g, '');
      if (cleaned.length !== 11 && cleaned.length !== 14) {
        throw new Error('CPF deve ter 11 dígitos e CNPJ deve ter 14 dígitos');
      }
    }
    return true;
  }),
  // ✅ CRITICAL: Phone is REQUIRED for Pagar.me customer (subscription payments fail without it)
  body('phone').trim().notEmpty().withMessage('Telefone é obrigatório para processar o pagamento'),
  body('phone').custom((value) => {
    if (value) {
      const cleaned = value.replace(/\D/g, '');
      // Accept 10-13 digits:
      // - 10 digits: DDD (2) + landline (8)
      // - 11 digits: DDD (2) + mobile (9) OR 55 (country) + DDD (2) + 7-digit (incomplete)
      // - 12 digits: 55 (country) + DDD (2) + landline (8)
      // - 13 digits: 55 (country) + DDD (2) + mobile (9)
      // Backend will strip the 55 country code prefix if present
      if (cleaned.length < 10 || cleaned.length > 13) {
        throw new Error('Telefone inválido. Informe DDD + número (ex: 47999998888)');
      }
    }
    return true;
  }),
  // ✅ CRITICAL: Billing address is REQUIRED for credit card payments
  body('billing_address').isObject().withMessage('Endereço de cobrança é obrigatório'),
  body('billing_address.line_1').trim().notEmpty().withMessage('Endereço é obrigatório'),
  body('billing_address.city').trim().notEmpty().withMessage('Cidade é obrigatória'),
  body('billing_address.state').trim().isLength({ min: 2, max: 2 }).withMessage('Estado deve ter 2 caracteres (ex: SP, RJ)'),
  body('billing_address.zip_code').trim().notEmpty().withMessage('CEP é obrigatório'),
  body('billing_address.zip_code').custom((value) => {
    if (value) {
      const cleaned = value.replace(/\D/g, '');
      if (cleaned.length !== 8) {
        throw new Error('CEP deve ter 8 dígitos');
      }
    }
    return true;
  }),
  // Explicitly reject legacy fields
  body('card_id').optional().custom((value) => {
    if (value) {
      throw new Error('card_id is not allowed. Use card_token instead. Card is created when token is attached to customer.');
    }
    return true;
  }),
], validateRequest, asyncHandler(async (req, res) => {
  const { plan_id, billing_cycle = 'monthly', card_token, cpf_cnpj, phone, billing_address } = req.body;
  const userId = req.user.id;

  // Get user data (include phone and address for full customer object in order - PSP requirement)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      cpfCnpj: true,
      phone: true,
      pagarMeCustomerId: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      zipCode: true
    }
  });

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Import plan configuration
  const { getPlanConfig, getPlanPrice, getBillingCycleConfig, normalizePlanId } = await import('../config/plans.js');
  
  // Normalize plan ID (map frontend IDs like 'pro', 'business' to backend IDs)
  const normalizedPlanId = normalizePlanId(plan_id);
  
  // Get plan configuration
  const planConfig = getPlanConfig(normalizedPlanId);
  if (!planConfig) {
    throw new AppError('Invalid plan', 400, 'INVALID_PLAN');
  }

  // Get price based on billing cycle
  const planAmount = getPlanPrice(normalizedPlanId, billing_cycle);
  if (planAmount === null && normalizedPlanId !== 'pay_per_use' && normalizedPlanId !== 'accountant' && normalizedPlanId !== 'trial') {
    throw new AppError('Plano não suporta este ciclo de cobrança', 400, 'INVALID_BILLING_CYCLE');
  }

  // Get billing cycle configuration
  const billingConfig = getBillingCycleConfig(billing_cycle);

  // Plan configuration - Use normalized plan ID
  // ✅ CRITICAL: Amount must be in cents and >= 1
  const amount = planAmount || planConfig.monthlyPrice;
  
  const plan = {
    name: planConfig.name,
    amount: amount,
    days: normalizedPlanId === 'trial' ? 7 : billingConfig.days,
    planId: normalizedPlanId,
    interval: billingConfig.interval,
    intervalCount: billingConfig.intervalCount
  };

  // ✅ Validate amount is a positive integer (in cents)
  if (!plan.amount || plan.amount < 1 || !Number.isInteger(plan.amount)) {
    throw new AppError(
      `Invalid plan amount. Must be a positive integer >= 1 (in cents). Got: ${plan.amount}`,
      400,
      'INVALID_PLAN_AMOUNT'
    );
  }

  // Pay-per-use doesn't use this endpoint
  if (normalizedPlanId === 'pay_per_use') {
    throw new AppError('Pay-per-use plan does not require subscription payment', 400, 'INVALID_PLAN');
  }

  // ✅ Validate card_token (already validated by express-validator, but double-check)
  if (!card_token) {
    throw new AppError('Card token is required', 400, 'MISSING_CARD_TOKEN');
  }

  try {
    // Determine CPF/CNPJ to use (prefer provided, fall back to stored)
    const cleanCpfCnpj = cpf_cnpj ? cpf_cnpj.replace(/\D/g, '') : null;
    const userCpfCnpj = user.cpfCnpj ? user.cpfCnpj.replace(/\D/g, '') : null;
    const finalCpfCnpj = cleanCpfCnpj || userCpfCnpj;
    
    // Validate CPF/CNPJ is available
    if (!finalCpfCnpj || (finalCpfCnpj.length !== 11 && finalCpfCnpj.length !== 14)) {
      throw new AppError(
        'CPF ou CNPJ é obrigatório para processar o pagamento. Por favor, informe seu CPF (11 dígitos) ou CNPJ (14 dígitos).',
        400,
        'CPF_CNPJ_REQUIRED'
      );
    }
    
    // Update user's CPF/CNPJ if provided and different
    if (cleanCpfCnpj && cleanCpfCnpj !== userCpfCnpj) {
      await prisma.user.update({
        where: { id: userId },
        data: { cpfCnpj: cleanCpfCnpj }
      });
    }
    
    // ✅ Get phone (prefer request, fallback to database)
    // Frontend adds country code 55 before sending
    // Pagar.me requires at least one customer phone for subscriptions
    let cleanPhone = phone?.replace(/\D/g, '') || '';
    
    // If no phone in request, try to get from database
    if (!cleanPhone && user.phone) {
      cleanPhone = user.phone.replace(/\D/g, '');
    }
    
    // ✅ NO stripping - frontend sends phone WITH country code 55
    // Just validate phone exists (no format validation - frontend handles it)
    if (!cleanPhone) {
      throw new AppError(
        'Telefone é obrigatório para processar o pagamento.',
        400,
        'PHONE_REQUIRED'
      );
    }
    
    console.log('[Backend] Phone received:', cleanPhone, 'length:', cleanPhone.length);
    
    // Step 1: Get or create customer in Pagar.me
    // ✅ CRITICAL: Phone is REQUIRED - Pagar.me rejects subscriptions without it
    const customerResult = await pagarmeSDKService.getOrCreateCustomer({
      name: user.name,
      email: user.email,
      cpfCnpj: finalCpfCnpj,
      phone: cleanPhone, // ✅ REQUIRED for subscription payments
      externalId: userId,
      pagarMeCustomerId: user.pagarMeCustomerId
    });

    const pagarMeCustomerId = customerResult.customerId;

    // Update user with Pagar.me customer ID and phone if changed
    const updateData = {};
    if (!user.pagarMeCustomerId) {
      updateData.pagarMeCustomerId = pagarMeCustomerId;
    }
    // Save phone to database if provided and different from stored
    if (phone && cleanPhone !== (user.phone?.replace(/\D/g, '') || '')) {
      updateData.phone = cleanPhone;
    }
    // Save billing address to database if provided
    if (billing_address) {
      updateData.addressLine1 = billing_address.line_1;
      updateData.addressLine2 = billing_address.line_2 || null;
      updateData.city = billing_address.city;
      updateData.state = billing_address.state.toUpperCase();
      updateData.zipCode = billing_address.zip_code.replace(/\D/g, '');
    }
    
    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: updateData
      });
    }

    // ✅ Step 2: Validate card_token format
    // Frontend tokenizes card via /tokenize-card endpoint and receives token_xxxxx
    // In v5, tokens are attached to customers and cards are created automatically

    // ✅ CRITICAL: Only accept token (token_xxxxx) - card is created during attachment
    if (!card_token || !card_token.startsWith('token_')) {
      throw new AppError(
        `Invalid card_token format. Expected token_xxxxx, got: ${card_token?.substring(0, 20) || 'undefined'}... In v5, tokens are attached to customers and cards are created automatically.`,
        400,
        'INVALID_CARD_TOKEN_FORMAT'
      );
    }

    // ✅ Step 3: Create subscription using v5 Subscriptions API
    // Use card_token directly with billing info (skipping separate attachment)
    // This allows Pagar.me to create the card and charge in one request with proper billing
    const subscriptionResult = await pagarmeSDKService.createSubscription({
      customerId: pagarMeCustomerId,
      cardToken: card_token, // ✅ Use token directly (will be converted to card)
      plan: {
        name: plan.name,
        amount: plan.amount,
        interval: plan.interval, // 'month', 'year', 'semiannual'
        intervalCount: plan.intervalCount
      },
      // ✅ CRITICAL: Billing info for card - gateway needs this for charge processing
      billing: {
        name: user.name,
        email: user.email,
        document: finalCpfCnpj,
        document_type: finalCpfCnpj.length === 11 ? 'cpf' : 'cnpj',
        address: {
          line_1: billing_address.line_1,
          line_2: billing_address.line_2 || '',
          city: billing_address.city,
          state: billing_address.state.toUpperCase(),
          zip_code: billing_address.zip_code.replace(/\D/g, ''),
          country: 'BR'
        }
      },
      billingAddress: {
        line_1: billing_address.line_1,
        line_2: billing_address.line_2 || '',
        city: billing_address.city,
        state: billing_address.state.toUpperCase(),
        zip_code: billing_address.zip_code.replace(/\D/g, ''),
        country: 'BR'
      },
      metadata: {
        type: 'subscription',
        user_id: userId,
        plan_id: plan_id,
        billing_cycle: billing_cycle
      }
    });

    // Step 5: Create or update subscription in database
    // ✅ v5: Check subscriptionResult.isPaid for immediate confirmation
    // If isPaid=true (subscription.status='active' && current_cycle.status='paid'), payment is confirmed
    // If isPaid=false, wait for invoice.paid webhook
    const existingSubscription = await prisma.subscription.findFirst({
      where: { userId }
    });

    let subscription;
    const pagarMeId = subscriptionResult.subscriptionId; // v5 returns sub_xxx
    
    // ✅ Use next billing date from Pagar.me response (current_cycle.endAt)
    const nextBillingDate = subscriptionResult.nextBillingAt || calculateNextBillingDate(billing_cycle);
    
    // ✅ Determine status based on payment confirmation
    // v5: isPaid=true means subscription.status='active' AND current_cycle.status='paid'
    const dbStatus = subscriptionResult.isPaid ? 'ativo' : 'pending';
    
    if (existingSubscription) {
      subscription = await prisma.subscription.update({
        where: { id: existingSubscription.id },
        data: {
          status: dbStatus,
          pagarMeSubscriptionId: pagarMeId,
          pagarMePlanId: plan.planId,
          billingCycle: billing_cycle,
          annualDiscountApplied: billing_cycle === 'annual' || billing_cycle === 'semiannual',
          nextBillingAt: nextBillingDate,
          canceledAt: null
        }
      });
    } else {
      subscription = await prisma.subscription.create({
        data: {
          userId,
          status: dbStatus,
          pagarMeSubscriptionId: pagarMeId,
          pagarMePlanId: plan.planId,
          billingCycle: billing_cycle,
          annualDiscountApplied: billing_cycle === 'annual' || billing_cycle === 'semiannual',
          nextBillingAt: nextBillingDate
        }
      });
    }

    // ✅ Create notification based on payment status
    if (subscriptionResult.isPaid) {
      // Payment confirmed immediately
      await createNotificationWithIdempotency({
        userId,
        titulo: 'Assinatura Ativada!',
        mensagem: `Seu plano ${plan.name} foi ativado com sucesso. Aproveite todos os recursos!`,
        tipo: 'success',
        windowMinutes: 5
      });
      
      sendSuccess(res, 'Assinatura ativada com sucesso', {
        subscription_id: subscription.id,
        pagar_me_subscription_id: subscriptionResult.subscriptionId,
        status: 'active',
        is_paid: true,
        plan_id: plan.planId,
        current_cycle: subscriptionResult.currentCycle,
        next_billing_at: nextBillingDate,
        message: 'Pagamento confirmado! Sua assinatura está ativa.'
      });
    } else {
      // Payment pending - wait for webhook
      await createNotificationWithIdempotency({
        userId,
        titulo: 'Pagamento em Processamento',
        mensagem: `Seu pagamento do plano ${plan.name} está sendo processado. Você receberá uma confirmação em breve.`,
        tipo: 'info',
        windowMinutes: 5
      });

      sendSuccess(res, 'Pagamento enviado para processamento', {
        subscription_id: subscription.id,
        pagar_me_subscription_id: subscriptionResult.subscriptionId,
        status: subscriptionResult.status,
        is_paid: false,
        plan_id: plan.planId,
        current_cycle: subscriptionResult.currentCycle,
        message: 'Aguardando confirmação do pagamento. Você será notificado quando o pagamento for aprovado.'
      });
    }

  } catch (error) {

    throw new AppError(
      `Erro ao processar pagamento: ${error.message}`,
      500,
      'PAYMENT_PROCESSING_ERROR',
      { originalError: error.message }
    );
  }
}));

/**
 * GET /api/subscriptions/trial-eligibility
 * Check if user is eligible for free trial
 * Users can only use trial ONCE
 */
router.get('/trial-eligibility', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      hasUsedTrial: true,
      trialStartedAt: true,
      trialEndedAt: true
    }
  });

  if (!user) {
    throw new AppError('Usuário não encontrado', 404, 'NOT_FOUND');
  }

  sendSuccess(res, 'Trial eligibility checked', {
    eligible: !user.hasUsedTrial,
    hasUsedTrial: user.hasUsedTrial || false,
    trialStartedAt: user.trialStartedAt,
    trialEndedAt: user.trialEndedAt,
    message: user.hasUsedTrial 
      ? 'Você já utilizou seu período de teste gratuito. Por favor, escolha um plano pago.'
      : 'Você pode iniciar seu período de teste gratuito de 7 dias.'
  });
}));

/**
 * GET /api/subscriptions/status
 * Get current user's subscription status
 */
router.get('/status', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  let subscription = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });

  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  let status = 'trial';
  let planId = null;
  let currentPeriodEnd = null;
  let daysRemaining = 0;

  const trialDays = 7;
  const accountAgeDays = Math.floor((Date.now() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24));
  const isInTrialPeriod = accountAgeDays <= trialDays;

  if (subscription) {
    if (subscription.status === 'pending' && 
        subscription.pagarMeSubscriptionId?.startsWith('pending_') &&
        !subscription.pagarMeSubscriptionId.includes('or_')) {
      const paymentCount = await prisma.payment.count({
        where: { subscriptionId: subscription.id }
      });
      
      if (paymentCount === 0) {
        subscription = null;
      }
    }

    if (subscription) {
      status = subscription.status;
      planId = subscription.pagarMePlanId;
      currentPeriodEnd = subscription.currentPeriodEnd;
    
      if (currentPeriodEnd) {
        const now = new Date();
        daysRemaining = Math.max(0, Math.ceil((new Date(currentPeriodEnd) - now) / (1000 * 60 * 60 * 24)));
      }
      
      if (status === 'pending' && isInTrialPeriod) {
        status = 'pending';
      }
    }
  }
  
  if (!subscription && user) {
    if (isInTrialPeriod) {
      status = 'trial';
      daysRemaining = trialDays - accountAgeDays;
      currentPeriodEnd = new Date(new Date(user.createdAt).getTime() + trialDays * 24 * 60 * 60 * 1000);
    } else if (user.hasUsedTrial) {
      status = 'inadimplente';
      daysRemaining = 0;
    } else {
      status = 'trial';
      daysRemaining = trialDays - accountAgeDays;
      currentPeriodEnd = new Date(new Date(user.createdAt).getTime() + trialDays * 24 * 60 * 60 * 1000);
    }
  }

  sendSuccess(res, 'Subscription status retrieved', {
    status,
    plan_id: planId,
    current_period_end: currentPeriodEnd,
    days_remaining: daysRemaining,
    has_used_trial: user?.hasUsedTrial || false,
    trial_eligible: !(user?.hasUsedTrial)
  });
}));

/**
 * GET /api/subscriptions/verify
 * Verify subscription payment status directly with Pagar.me (v5)
 * ✅ Use this to confirm payment was actually processed
 * 
 * Returns:
 * - isValid: true if subscription.status='active' AND current_cycle.status='paid'
 * - Updates local database if Pagar.me status differs
 */
router.get('/verify', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Get local subscription
  const subscription = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });

  if (!subscription) {
    return sendSuccess(res, 'Nenhuma assinatura encontrada', {
      isValid: false,
      status: 'no_subscription',
      message: 'Usuário não possui assinatura ativa'
    });
  }

  const pagarMeId = subscription.pagarMeSubscriptionId;

  // Check if it's a valid Pagar.me subscription ID (sub_xxx)
  if (!pagarMeId || !pagarMeId.startsWith('sub_')) {
    // It might be an old order-based subscription (or_xxx) or pending
    return sendSuccess(res, 'Assinatura local encontrada', {
      isValid: subscription.status === 'ativo',
      status: subscription.status,
      subscriptionId: subscription.id,
      pagarMeId: pagarMeId,
      message: pagarMeId?.startsWith('or_') 
        ? 'Assinatura baseada em pedido (legacy). Use /status para verificar.'
        : 'Assinatura pendente ou sem ID do Pagar.me',
      localData: {
        status: subscription.status,
        planId: subscription.pagarMePlanId,
        billingCycle: subscription.billingCycle,
        nextBillingAt: subscription.nextBillingAt
      }
    });
  }

  try {
    // ✅ Verify directly with Pagar.me
    const verification = await pagarmeSDKService.verifySubscriptionPayment(pagarMeId);

    // ✅ Sync local database if status differs
    if (verification.isValid && subscription.status !== 'ativo') {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ativo',
          currentPeriodStart: verification.currentCycle?.startAt 
            ? new Date(verification.currentCycle.startAt) 
            : subscription.currentPeriodStart,
          currentPeriodEnd: verification.currentCycle?.endAt 
            ? new Date(verification.currentCycle.endAt) 
            : subscription.currentPeriodEnd,
          nextBillingAt: verification.nextBillingAt 
            ? new Date(verification.nextBillingAt) 
            : subscription.nextBillingAt
        }
      });

      console.log('[Subscription] ✅ Synced local status with Pagar.me:', {
        subscriptionId: subscription.id,
        oldStatus: subscription.status,
        newStatus: 'ativo'
      });
    } else if (!verification.isValid && subscription.status === 'ativo') {
      // Payment not confirmed but local shows active - mark as pending
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'pending' }
      });

      console.log('[Subscription] ⚠️ Pagar.me shows not paid, updating local:', {
        subscriptionId: subscription.id,
        oldStatus: subscription.status,
        newStatus: 'pending'
      });
    }

    sendSuccess(res, 'Verificação de assinatura concluída', {
      isValid: verification.isValid,
      status: verification.status,
      isPaid: verification.isPaid,
      subscriptionId: subscription.id,
      pagarMeSubscriptionId: verification.subscriptionId,
      currentCycle: verification.currentCycle,
      latestInvoice: verification.latestInvoice,
      nextBillingAt: verification.nextBillingAt,
      verifiedAt: verification.verifiedAt,
      localData: {
        status: subscription.status,
        planId: subscription.pagarMePlanId,
        billingCycle: subscription.billingCycle
      }
    });

  } catch (error) {
    console.error('[Subscription] Error verifying with Pagar.me:', {
      subscriptionId: subscription.id,
      pagarMeId,
      error: error.message
    });

    // Return local data if Pagar.me verification fails
    sendSuccess(res, 'Verificação com Pagar.me falhou, usando dados locais', {
      isValid: subscription.status === 'ativo',
      status: subscription.status,
      subscriptionId: subscription.id,
      pagarMeSubscriptionId: pagarMeId,
      error: error.message,
      localData: {
        status: subscription.status,
        planId: subscription.pagarMePlanId,
        billingCycle: subscription.billingCycle,
        nextBillingAt: subscription.nextBillingAt
      }
    });
  }
}));

/**
 * GET /api/subscriptions/current
 * Get current user's subscription with payment history
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
 * POST /api/subscriptions/confirm-checkout
 * Confirm checkout (for simulated/test checkout only)
 * In production, webhooks handle this
 */
router.post('/confirm-checkout', 
  subscriptionLimiter, // Use subscription-specific rate limiter (more lenient)
  [
    body('plan_id').notEmpty().withMessage('Plan ID is required'),
    body('session_id').optional()
  ], 
  validateRequest, 
  asyncHandler(async (req, res) => {
    const { plan_id, session_id } = req.body;
    const userId = req.user.id;

    // ✅ IDEMPOTENCY CHECK: If session_id is provided and subscription already exists with same session_id,
    // return success without processing again (prevents duplicate requests)
    if (session_id) {
      const existingWithSession = await prisma.subscription.findFirst({
        where: {
          userId,
          pagarMeSubscriptionId: session_id
        }
      });

      if (existingWithSession) {
        // Subscription already confirmed with this session_id - return success
        return sendSuccess(res, 'Assinatura já confirmada', {
          subscription_id: existingWithSession.id,
          plan_id: existingWithSession.pagarMePlanId || plan_id,
          status: existingWithSession.status,
          current_period_end: existingWithSession.currentPeriodEnd
        });
      }
    }

  const plans = {
    'trial': { name: 'MAY Trial', amount: 0, days: 7, planId: 'trial' },
    'pro': { name: 'MAY Pro', amount: 9700, days: 30, planId: 'pro' },
    'business': { name: 'MAY Business', amount: 19700, days: 30, planId: 'business' }
  };

  const plan = plans[plan_id];
  if (!plan) {
    throw new AppError('Plano não encontrado', 400, 'INVALID_PLAN');
  }

  // Determine if this is a trial plan
  const isTrial = plan_id === 'trial';

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setDate(periodEnd.getDate() + plan.days);

  const existingSubscription = await prisma.subscription.findUnique({
    where: { userId }
  });

  let subscriptionId = session_id || `sim_${Date.now()}_${userId.slice(0, 8)}`;

  if (existingSubscription) {
    if (!session_id && existingSubscription.pagarMeSubscriptionId) {
      subscriptionId = existingSubscription.pagarMeSubscriptionId;
    }

    const updatedSubscription = await prisma.subscription.update({
      where: { id: existingSubscription.id },
      data: {
        pagarMePlanId: plan.planId,
        pagarMeSubscriptionId: subscriptionId,
        status: isTrial ? 'trial' : 'ativo',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        canceledAt: null,
        trialEndsAt: isTrial ? periodEnd : null
      }
    });

    // Determine notification title and message
    const notificationTitle = existingSubscription.status === 'cancelado' 
      ? 'Assinatura Reativada!' 
      : isTrial 
        ? 'Bem-vindo à MAY!' 
        : 'Assinatura Ativada!';
    
    // Only create notification if one with same title doesn't exist recently (within 1 minute)
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const recentNotification = await prisma.notification.findFirst({
      where: {
        userId,
        titulo: notificationTitle,
        createdAt: { gte: oneMinuteAgo }
      }
    });

    if (!recentNotification) {
      await prisma.notification.create({
        data: {
          userId,
          titulo: notificationTitle,
          mensagem: existingSubscription.status === 'cancelado'
            ? `Sua assinatura ${plan.name} foi reativada. Aproveite todas as funcionalidades!`
            : isTrial 
              ? 'Seu trial de 7 dias começou. Aproveite todas as funcionalidades!'
              : `Sua assinatura ${plan.name} está ativa. Aproveite todas as funcionalidades!`,
          tipo: 'sucesso'
        }
      });
    }

    sendSuccess(res, existingSubscription.status === 'cancelado' 
      ? 'Assinatura reativada com sucesso' 
      : 'Assinatura atualizada com sucesso', {
      subscription_id: updatedSubscription.id,
      plan_id: plan.planId,
      status: updatedSubscription.status,
      current_period_end: periodEnd
    });
  } else {
    const subscription = await prisma.subscription.create({
      data: {
        userId,
        status: isTrial ? 'trial' : 'ativo',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        pagarMeSubscriptionId: subscriptionId,
        pagarMePlanId: plan.planId,
        trialEndsAt: isTrial ? periodEnd : null
      }
    });

    // Only create notification if one doesn't exist recently
    const notificationTitleNew = isTrial ? 'Bem-vindo à MAY!' : 'Assinatura Ativada!';
    const oneMinuteAgoNew = new Date(Date.now() - 60000);
    const recentNotificationNew = await prisma.notification.findFirst({
      where: {
        userId,
        titulo: notificationTitleNew,
        createdAt: { gte: oneMinuteAgoNew }
      }
    });

    if (!recentNotificationNew) {
      await prisma.notification.create({
        data: {
          userId,
          titulo: notificationTitleNew,
          mensagem: isTrial 
            ? 'Seu trial de 7 dias começou. Aproveite todas as funcionalidades!'
            : `Sua assinatura ${plan.name} está ativa. Aproveite todas as funcionalidades!`,
          tipo: 'sucesso'
        }
      });
    }

    sendSuccess(res, 'Assinatura criada com sucesso', {
      subscription_id: subscription.id,
      plan_id: plan.planId,
      status: subscription.status,
      current_period_end: periodEnd
    }, 201);
  }
}));

/**
 * POST /api/subscriptions/cancel
 * Cancel current user's subscription
 */
router.post('/cancel', 
  subscriptionLimiter, // Use subscription-specific rate limiter
  asyncHandler(async (req, res) => {
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
    // Try to cancel in Pagar.me if subscription ID exists and Pagar.me is configured
    if (subscription.pagarMeSubscriptionId && isPagarMeConfigured()) {
      try {
        await pagarmeSDKService.cancelSubscription(subscription.pagarMeSubscriptionId);
      } catch (pagarMeError) {
      }
    }

    // Update in database (always do this, even if Pagar.me cancellation failed)
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

// ========================================
// WEBHOOK EVENT HANDLERS
// ========================================

/**
 * Handle subscription.created event
 */
async function handleSubscriptionCreated(event) {
  const subscriptionData = event.data || event;
  const externalId = subscriptionData.customer?.external_id;

  if (!externalId) {
    return;
  }

  const user = await prisma.user.findFirst({
    where: { id: externalId }
  });

  if (!user) {
    return;
  }

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
 * 🚨 THIS IS WHERE SUBSCRIPTIONS BECOME ACTIVE
 * Handles both subscription payments and order payments (checkout flow)
 */
async function handlePaymentApproved(event) {
  const eventData = event.data || event;
  const transactionData = eventData;
  const orderData = eventData;
  
  // Check if this is an order payment (from checkout)
  // Order payments come from order.paid events
  const eventType = event.type || event.event || '';
  const isOrderPayment = eventType.includes('order') || (orderData.id && !orderData.subscription_id);
  const orderId = isOrderPayment ? (orderData.id || orderData.order_id) : null;
  
  // For order payments, find subscription by order ID
  let subscription = null;
  let transactionId = null;
  let subscriptionId = null;
  
  if (isOrderPayment) {
    // This is an order payment from checkout
    transactionId = orderData.id || orderData.transaction_id;
    const orderIdStr = `order_${orderId}`;
    
    // Find subscription by order ID (stored as order_xxx in pagarMeSubscriptionId)
    subscription = await prisma.subscription.findFirst({
      where: { 
        pagarMeSubscriptionId: { startsWith: orderIdStr }
      },
      include: { user: true }
    });
    
    if (!subscription) {
      // Try to find by metadata in order
      const userId = orderData.metadata?.user_id;
      if (userId) {
        subscription = await prisma.subscription.findFirst({
          where: { userId },
          include: { user: true },
          orderBy: { createdAt: 'desc' }
        });
      }
    }
    
    if (!subscription) {
      throw new Error(`Subscription not found for order ID: ${orderId}`);
    }
    
    // Update user with customer data from Pagar.me (including CPF/CNPJ entered on checkout)
    let updatedCustomerId = subscription.user.pagarMeCustomerId;
    if (orderData.customer) {
      const customer = orderData.customer;
      const customerId = customer.id || orderData.customer_id;
      const customerDoc = customer.documents?.[0] || customer.document;
      
      if (customerId && !subscription.user.pagarMeCustomerId) {
        await prisma.user.update({
          where: { id: subscription.userId },
          data: { pagarMeCustomerId: customerId }
        });
        updatedCustomerId = customerId;
      }
      
      // Update CPF/CNPJ if provided by Pagar.me and user doesn't have it
      if (customerDoc && !subscription.user.cpfCnpj) {
        const cpfCnpj = customerDoc.number || customerDoc;
        await prisma.user.update({
          where: { id: subscription.userId },
          data: { cpfCnpj: cpfCnpj.replace(/\D/g, '') }
        });
      }
    }
    
    // Note: Legacy order payment flow removed
    // Modern v5 flow uses direct subscription creation via /process-payment endpoint
    // This webhook handler is for order payments (legacy), subscriptions are created directly
  } else {
    // This is a subscription payment (recurring)
    subscriptionId = transactionData.subscription_id || 
                     transactionData.subscription?.id;
    transactionId = transactionData.id;

    if (!subscriptionId) {
      throw new Error('Subscription ID not found in payment approved event');
    }

    if (!transactionId) {
      throw new Error('Transaction ID not found in payment approved event');
    }

    // Find subscription
    subscription = await prisma.subscription.findFirst({
      where: { pagarMeSubscriptionId: subscriptionId },
      include: { user: true }
    });

    if (!subscription) {
      throw new Error(`Subscription not found for Pagar.me ID: ${subscriptionId}`);
    }
  }

  // Check if payment already processed (idempotency)
  const existingPayment = await prisma.payment.findUnique({
    where: { pagarMeTransactionId: transactionId }
  });

  if (existingPayment && existingPayment.status === 'paid') {
    return {
      paymentId: existingPayment.id,
      status: 'already_processed'
    };
  }

  // Extract amount (Pagar.me sends amount in cents)
  // For orders, amount might be in orderData.amount
  // For transactions, amount is in transactionData.amount
  let amount = 0;
  if (isOrderPayment) {
    amount = orderData.amount 
      ? parseFloat(orderData.amount) / 100 
      : parseFloat(orderData.total || orderData.value || 0) / 100;
  } else {
    amount = transactionData.amount 
      ? parseFloat(transactionData.amount) / 100 
      : parseFloat(transactionData.value || 0) / 100;
  }

  if (amount <= 0) {
    throw new Error(`Invalid payment amount: ${amount}`);
  }

  // Extract payment method
  const paymentMethod = isOrderPayment
    ? (orderData.payments?.[0]?.paymentMethod || orderData.payment_method || 'credit_card')
    : (transactionData.payment_method || transactionData.payment_method_type || 'credit_card');

  // Extract paid date
  const paidAt = isOrderPayment
    ? (orderData.createdAt ? new Date(orderData.createdAt * 1000) : new Date())
    : (transactionData.date_created 
        ? new Date(transactionData.date_created * 1000)
        : transactionData.paid_at
        ? new Date(transactionData.paid_at * 1000)
        : new Date());

  // Calculate period dates
  const periodStart = isOrderPayment
    ? new Date()
    : (transactionData.date_created ? new Date(transactionData.date_created * 1000) : new Date());
  const periodEnd = new Date(periodStart);
  const billingCycle = subscription.billingCycle || 'monthly';
  
  // Calculate period end based on billing cycle
  switch (billingCycle) {
    case 'annual':
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      break;
    case 'semiannual':
      periodEnd.setMonth(periodEnd.getMonth() + 6);
      break;
    case 'monthly':
    default:
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      break;
  }
  
  const nextBillingDate = calculateNextBillingDate(billingCycle, periodStart);

  // ✅ Check if status is actually changing (only create notification on status change)
  const wasPending = subscription.status === 'pending';
  
  // 🚨 ACTIVATE SUBSCRIPTION
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: 'ativo',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      nextBillingAt: nextBillingDate
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

  // ✅ Create success notification ONLY if status changed from 'pending' to 'ativo'
  // This ensures notification is created exactly once when payment is confirmed
  if (wasPending) {
    await createNotificationWithIdempotency({
      userId: subscription.userId,
      titulo: 'Pagamento Aprovado',
      mensagem: `Seu pagamento de R$ ${(payment.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} foi aprovado. Sua assinatura está ativa!`,
      tipo: 'sucesso',
      windowMinutes: 5
    });
  }

  // Send payment confirmation email (async)
  if (subscription.user?.email) {
    sendPaymentConfirmationEmail(subscription.user, {
      amount: payment.amount * 100,
      planName: subscription.planId || 'MAY Pro',
      date: paidAt,
      transactionId: transactionId
    }).catch(() => {});
  }

  return {
    paymentId: payment.id,
    subscriptionId: subscription.id,
    status: 'processed'
  };
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

  const subscription = await prisma.subscription.findFirst({
    where: { pagarMeSubscriptionId: subscriptionId },
    include: { user: true }
  });

  if (!subscription) {
    throw new Error(`Subscription not found for Pagar.me ID: ${subscriptionId}`);
  }

  const amount = transactionData.amount 
    ? parseFloat(transactionData.amount) / 100 
    : parseFloat(transactionData.value || 0) / 100;

  const paymentMethod = transactionData.payment_method || 
                       transactionData.payment_method_type || 
                       'credit_card';

  const failureReason = transactionData.refuse_reason || 
                       transactionData.status_reason || 
                       'Payment failed';

  // 🚨 MARK AS DELINQUENT
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: 'inadimplente'
    }
  });

  await prisma.payment.upsert({
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

  await prisma.notification.create({
    data: {
      userId: subscription.userId,
      titulo: 'Pagamento Recusado',
      mensagem: `Seu pagamento foi recusado. Motivo: ${failureReason}. Por favor, atualize seu método de pagamento.`,
      tipo: 'erro'
    }
  });

  if (subscription.user?.email) {
    sendSubscriptionStatusEmail(subscription.user, 'inadimplente').catch(() => {});
  }

  return {
    subscriptionId: subscription.id,
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

  const subscription = await prisma.subscription.findFirst({
    where: { pagarMeSubscriptionId: subscriptionId },
    include: { user: true }
  });

  if (!subscription) {
    throw new Error(`Subscription not found for Pagar.me ID: ${subscriptionId}`);
  }

  const canceledAt = subscriptionData.canceled_at 
    ? new Date(subscriptionData.canceled_at * 1000)
    : new Date();

  // 🚨 MARK AS CANCELED
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: 'cancelado',
      canceledAt: canceledAt
    }
  });

  await prisma.notification.create({
    data: {
      userId: subscription.userId,
      titulo: 'Assinatura Cancelada',
      mensagem: 'Sua assinatura foi cancelada. Você ainda terá acesso até o final do período pago.',
      tipo: 'info'
    }
  });

  if (subscription.user?.email) {
    sendSubscriptionStatusEmail(subscription.user, 'cancelado').catch(() => {});
  }

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

  const subscription = await prisma.subscription.findFirst({
    where: { pagarMeSubscriptionId: subscriptionId }
  });

  if (!subscription) {
    throw new Error(`Subscription not found for Pagar.me ID: ${subscriptionId}`);
  }

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

  return {
    subscriptionId: subscription.id,
    updates: updateData
  };
}

/**
 * Handle subscription.renewed and subscription.activated events
 */
async function handleSubscriptionRenewed(event) {
  const subscriptionData = event.data || event;
  const subscriptionId = subscriptionData.id;

  if (!subscriptionId) {
    throw new Error('Subscription ID not found in renewed/activated event');
  }

  const subscription = await prisma.subscription.findFirst({
    where: { pagarMeSubscriptionId: subscriptionId },
    include: { user: true }
  });

  if (!subscription) {
    return { status: 'subscription_not_found', subscriptionId };
  }

  // Calculate new period dates
  const periodStart = new Date();
  const periodEnd = new Date();
  const billingCycle = subscription.billingCycle || 'monthly';
  
  // Calculate period end based on billing cycle
  switch (billingCycle) {
    case 'annual':
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      break;
    case 'semiannual':
      periodEnd.setMonth(periodEnd.getMonth() + 6);
      break;
    case 'monthly':
    default:
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      break;
  }
  
  const nextBillingDate = calculateNextBillingDate(billingCycle, periodStart);

  // ✅ Activate/renew subscription
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: 'ativo',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      nextBillingAt: nextBillingDate
    }
  });

  // Create notification
  await prisma.notification.create({
    data: {
      userId: subscription.userId,
      titulo: 'Assinatura Renovada',
      mensagem: 'Sua assinatura foi renovada com sucesso!',
      tipo: 'sucesso'
    }
  });

  return {
    subscriptionId: subscription.id,
    status: 'renewed',
    periodEnd
  };
}

/**
 * Handle subscription.pending events
 */
async function handleSubscriptionPending(event) {
  const subscriptionData = event.data || event;
  const subscriptionId = subscriptionData.id;

  if (!subscriptionId) {
    throw new Error('Subscription ID not found in pending event');
  }

  const subscription = await prisma.subscription.findFirst({
    where: { pagarMeSubscriptionId: subscriptionId },
    include: { user: true }
  });

  if (!subscription) {
    return { status: 'subscription_not_found', subscriptionId };
  }

  // Update to pending status
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: 'pending' }
  });

  return {
    subscriptionId: subscription.id,
    status: 'pending'
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
    'pending': 'pending',
    'trialing': 'trial'
  };
  return statusMap[pagarmeStatus] || 'pending';
}

// ========================================
// V5 ORDERS API WEBHOOK HANDLERS
// ========================================

/**
 * Handle invoice.paid event (v5 Subscriptions API)
 * ✅ PRIMARY event for subscription payments in v5
 * This is the SOURCE OF TRUTH for subscription payment confirmation
 * 
 * Invoice structure:
 * - id: invoice ID (in_xxx)
 * - subscription_id: subscription ID (sub_xxx)
 * - status: 'paid', 'pending', 'canceled'
 * - charge: charge details
 */
async function handleInvoicePaid(event) {
  const invoiceData = event.data || event;
  const invoiceId = invoiceData.id;
  const subscriptionId = invoiceData.subscription_id || invoiceData.subscription?.id;
  const customerId = invoiceData.customer_id || invoiceData.customer?.id;
  const userId = invoiceData.metadata?.user_id;
  const charge = invoiceData.charge;

  console.log('[Webhook] invoice.paid received:', {
    invoiceId,
    subscriptionId,
    customerId,
    userId,
    status: invoiceData.status,
    chargeStatus: charge?.status
  });

  if (!invoiceId) {
    throw new Error('Invoice ID not found in invoice.paid event');
  }

  // Find subscription by subscriptionId, userId, or customerId
  let subscription = null;
  
  if (subscriptionId) {
    subscription = await prisma.subscription.findFirst({
      where: { pagarMeSubscriptionId: subscriptionId },
      include: { user: true }
    });
  }

  if (!subscription && userId) {
    subscription = await prisma.subscription.findFirst({
      where: { userId },
      include: { user: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  if (!subscription && customerId) {
    const user = await prisma.user.findFirst({ where: { pagarMeCustomerId: customerId } });
    if (user) {
      subscription = await prisma.subscription.findFirst({
        where: { userId: user.id },
        include: { user: true },
        orderBy: { createdAt: 'desc' }
      });
    }
  }

  if (!subscription) {
    console.warn('[Webhook] Subscription not found for invoice:', {
      invoiceId,
      subscriptionId,
      customerId,
      userId
    });
    return { status: 'subscription_not_found', invoiceId };
  }

  // Check idempotency - avoid duplicate processing
  const transactionId = charge?.id || invoiceId;
  const existingPayment = await prisma.payment.findUnique({
    where: { pagarMeTransactionId: transactionId }
  });

  if (existingPayment && existingPayment.status === 'paid') {
    console.log('[Webhook] Invoice already processed:', { invoiceId, paymentId: existingPayment.id });
    return { status: 'already_processed', paymentId: existingPayment.id };
  }

  // Calculate period dates from invoice data
  const periodStart = invoiceData.period?.start_at ? new Date(invoiceData.period.start_at) : new Date();
  const periodEnd = invoiceData.period?.end_at ? new Date(invoiceData.period.end_at) : null;
  
  // If no period end from invoice, calculate based on billing cycle
  let calculatedPeriodEnd = periodEnd;
  if (!calculatedPeriodEnd) {
    calculatedPeriodEnd = new Date(periodStart);
    const billingCycle = subscription.billingCycle || 'monthly';
    switch (billingCycle) {
      case 'annual':
        calculatedPeriodEnd.setFullYear(calculatedPeriodEnd.getFullYear() + 1);
        break;
      case 'semiannual':
        calculatedPeriodEnd.setMonth(calculatedPeriodEnd.getMonth() + 6);
        break;
      case 'monthly':
      default:
        calculatedPeriodEnd.setMonth(calculatedPeriodEnd.getMonth() + 1);
        break;
    }
  }

  // Extract amount from invoice/charge
  const amount = invoiceData.amount ? invoiceData.amount / 100 : (charge?.amount ? charge.amount / 100 : 0);

  // Update subscription status to active
  const updatedSubscription = await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: 'ativo',
      currentPeriodStart: periodStart,
      currentPeriodEnd: calculatedPeriodEnd,
      nextBillingAt: calculatedPeriodEnd,
      pagarMeSubscriptionId: subscriptionId || subscription.pagarMeSubscriptionId
    },
    include: { user: true }
  });

  // Create or update payment record
  const payment = existingPayment
    ? await prisma.payment.update({
        where: { id: existingPayment.id },
        data: {
          status: 'paid',
          paidAt: new Date()
        }
      })
    : await prisma.payment.create({
        data: {
          subscriptionId: subscription.id,
          pagarMeTransactionId: transactionId,
          amount,
          status: 'paid',
          paymentMethod: 'credit_card',
          paidAt: new Date()
        }
      });

  // Create notification
  await createNotificationWithIdempotency({
    userId: subscription.userId,
    titulo: 'Pagamento Confirmado!',
    mensagem: `Seu pagamento de R$ ${amount.toFixed(2)} foi confirmado. Sua assinatura está ativa até ${calculatedPeriodEnd.toLocaleDateString('pt-BR')}.`,
    tipo: 'success',
    windowMinutes: 60
  });

  // Send confirmation email
  if (updatedSubscription.user?.email) {
    try {
      await sendEmail({
        to: updatedSubscription.user.email,
        subject: '✅ Pagamento Confirmado - MAY',
        html: `
          <h2>Olá ${updatedSubscription.user.name || 'Cliente'},</h2>
          <p>Seu pagamento de <strong>R$ ${amount.toFixed(2)}</strong> foi confirmado com sucesso!</p>
          <p>Sua assinatura está ativa até <strong>${calculatedPeriodEnd.toLocaleDateString('pt-BR')}</strong>.</p>
          <p>Obrigado por usar o MAY!</p>
        `
      });
    } catch (emailError) {
      console.error('[Webhook] Error sending confirmation email:', emailError.message);
    }
  }

  console.log('[Webhook] ✅ invoice.paid processed successfully:', {
    invoiceId,
    subscriptionId: updatedSubscription.id,
    pagarMeSubscriptionId: subscriptionId,
    status: 'ativo',
    paymentId: payment.id,
    amount,
    nextBillingAt: calculatedPeriodEnd
  });

  return {
    status: 'activated',
    subscriptionId: updatedSubscription.id,
    paymentId: payment.id,
    nextBillingAt: calculatedPeriodEnd
  };
}

/**
 * Handle invoice.payment_failed event (v5 Subscriptions API)
 * ✅ Handle failed recurring payment
 * 
 * User action: Notify user to update payment method
 * System action: Mark subscription as past_due
 */
async function handleInvoicePaymentFailed(event) {
  const invoiceData = event.data || event;
  const invoiceId = invoiceData.id;
  const subscriptionId = invoiceData.subscription_id || invoiceData.subscription?.id;
  const customerId = invoiceData.customer_id || invoiceData.customer?.id;
  const userId = invoiceData.metadata?.user_id;
  const charge = invoiceData.charge;

  console.log('[Webhook] invoice.payment_failed received:', {
    invoiceId,
    subscriptionId,
    customerId,
    userId,
    status: invoiceData.status,
    chargeStatus: charge?.status
  });

  if (!invoiceId) {
    throw new Error('Invoice ID not found in invoice.payment_failed event');
  }

  // Find subscription
  let subscription = null;
  
  if (subscriptionId) {
    subscription = await prisma.subscription.findFirst({
      where: { pagarMeSubscriptionId: subscriptionId },
      include: { user: true }
    });
  }

  if (!subscription && userId) {
    subscription = await prisma.subscription.findFirst({
      where: { userId },
      include: { user: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  if (!subscription && customerId) {
    const user = await prisma.user.findFirst({ where: { pagarMeCustomerId: customerId } });
    if (user) {
      subscription = await prisma.subscription.findFirst({
        where: { userId: user.id },
        include: { user: true },
        orderBy: { createdAt: 'desc' }
      });
    }
  }

  if (!subscription) {
    console.warn('[Webhook] Subscription not found for failed invoice:', {
      invoiceId,
      subscriptionId,
      customerId
    });
    return { status: 'subscription_not_found', invoiceId };
  }

  // Extract error info
  const gatewayResponse = charge?.last_transaction?.gateway_response || {};
  const errorMessage = gatewayResponse.errors?.[0]?.message || 'Pagamento recusado';

  // Update subscription status to past_due (NOT canceled - give user chance to update card)
  const updatedSubscription = await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: 'past_due'
    },
    include: { user: true }
  });

  // Create failed payment record
  const transactionId = charge?.id || invoiceId;
  const amount = invoiceData.amount ? invoiceData.amount / 100 : 0;
  
  await prisma.payment.upsert({
    where: { pagarMeTransactionId: transactionId },
    create: {
      subscriptionId: subscription.id,
      pagarMeTransactionId: transactionId,
      amount,
      status: 'failed',
      paymentMethod: 'credit_card',
      failureReason: errorMessage
    },
    update: {
      status: 'failed',
      failureReason: errorMessage
    }
  });

  // Create notification
  await createNotificationWithIdempotency({
    userId: subscription.userId,
    titulo: '⚠️ Problema com sua Assinatura',
    mensagem: `Seu pagamento falhou: ${errorMessage}. Por favor, atualize seu método de pagamento para continuar usando o MAY.`,
    tipo: 'warning',
    windowMinutes: 60
  });

  // Send failure email
  if (updatedSubscription.user?.email) {
    try {
      await sendEmail({
        to: updatedSubscription.user.email,
        subject: '⚠️ Problema com sua Assinatura - MAY',
        html: `
          <h2>Olá ${updatedSubscription.user.name || 'Cliente'},</h2>
          <p>Infelizmente, houve um problema com seu último pagamento:</p>
          <p><strong>${errorMessage}</strong></p>
          <p>Por favor, acesse sua conta e atualize seu método de pagamento para continuar usando o MAY.</p>
          <p>Se precisar de ajuda, entre em contato conosco.</p>
        `
      });
    } catch (emailError) {
      console.error('[Webhook] Error sending failure email:', emailError.message);
    }
  }

  console.log('[Webhook] ⚠️ invoice.payment_failed processed:', {
    invoiceId,
    subscriptionId: updatedSubscription.id,
    status: 'past_due',
    errorMessage
  });

  return {
    status: 'marked_past_due',
    subscriptionId: updatedSubscription.id,
    errorMessage
  };
}

/**
 * Handle order.paid event (v5 Orders API)
 * ⚠️ This is for ONE-TIME payments only, not subscriptions
 * For subscriptions, use invoice.paid event
 */
async function handleOrderPaid(event) {
  const orderData = event.data || event;
  const orderId = orderData.id;
  const customerId = orderData.customer_id || orderData.customer?.id;
  const userId = orderData.metadata?.user_id;
  const planId = orderData.metadata?.plan_id;
  const billingCycle = orderData.metadata?.billing_cycle || 'monthly';

  if (!orderId) {
    throw new Error('Order ID not found in order.paid event');
  }

  // Find subscription by orderId or userId
  let subscription = await prisma.subscription.findFirst({
    where: { pagarMeSubscriptionId: orderId },
    include: { user: true }
  });

  if (!subscription && userId) {
    subscription = await prisma.subscription.findFirst({
      where: { userId },
      include: { user: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  if (!subscription && customerId) {
    const user = await prisma.user.findFirst({ where: { pagarMeCustomerId: customerId } });
    if (user) {
      subscription = await prisma.subscription.findFirst({
        where: { userId: user.id },
        include: { user: true },
        orderBy: { createdAt: 'desc' }
      });
    }
  }

  if (!subscription) {
    
    // Try to find user by customerId or metadata
    let user = null;
    if (userId) {
      user = await prisma.user.findUnique({ where: { id: userId } });
    }
    if (!user && customerId) {
      user = await prisma.user.findFirst({ where: { pagarMeCustomerId: customerId } });
    }

    if (!user) {
      throw new Error(`User not found for order: ${orderId}`);
    }

    // Create subscription from order (fallback - should rarely happen)
    // Use proper billing cycle calculation
    const periodStart = new Date();
    const periodEnd = new Date();
    const finalBillingCycle = billingCycle || 'monthly';
    
    switch (finalBillingCycle) {
      case 'annual':
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        break;
      case 'semiannual':
        periodEnd.setMonth(periodEnd.getMonth() + 6);
        break;
      case 'monthly':
      default:
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        break;
    }
    
    const nextBillingDate = calculateNextBillingDate(finalBillingCycle, periodStart);
    
    subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        pagarMeSubscriptionId: orderId,
        pagarMePlanId: planId,
        billingCycle: finalBillingCycle,
        status: 'ativo',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        nextBillingAt: nextBillingDate
      },
      include: { user: true }
    });
  }

  // Extract charge/payment info
  const charge = orderData.charges?.[0];
  const transactionId = charge?.id || orderId;
  const amount = orderData.amount ? orderData.amount / 100 : (charge?.amount ? charge.amount / 100 : 0);

  // Check idempotency
  const existingPayment = await prisma.payment.findUnique({
    where: { pagarMeTransactionId: transactionId }
  });

  if (existingPayment && existingPayment.status === 'paid') {
    return { status: 'already_processed', paymentId: existingPayment.id };
  }

  // Calculate period dates
  // ✅ CRITICAL: Use subscription's billingCycle first (it's the source of truth)
  // Metadata might be missing or incorrect, but subscription was created with correct billingCycle
  const periodStart = new Date();
  const periodEnd = new Date();
  const subBillingCycle = subscription.billingCycle || billingCycle || 'monthly';
  
  // Calculate period end based on billing cycle
  switch (subBillingCycle) {
    case 'annual':
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      break;
    case 'semiannual':
      periodEnd.setMonth(periodEnd.getMonth() + 6);
      break;
    case 'monthly':
    default:
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      break;
  }
  
  const nextBillingDate = calculateNextBillingDate(subBillingCycle, periodStart);

  // ✅ Check if status is actually changing (only create notification on status change)
  const wasPending = subscription.status === 'pending';
  
  // ✅ ACTIVATE SUBSCRIPTION
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: 'ativo',
      pagarMeSubscriptionId: orderId,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      nextBillingAt: nextBillingDate
    }
  });

  // Create payment record
  const payment = await prisma.payment.upsert({
    where: { pagarMeTransactionId: transactionId },
    update: {
      status: 'paid',
      amount: amount,
      paidAt: new Date()
    },
    create: {
      subscriptionId: subscription.id,
      pagarMeTransactionId: transactionId,
      amount: amount,
      status: 'paid',
      paymentMethod: 'credit_card',
      paidAt: new Date()
    }
  });

  // ✅ Create success notification ONLY if status changed from 'pending' to 'ativo'
  // This ensures notification is created exactly once when payment is confirmed
  if (wasPending) {
    await createNotificationWithIdempotency({
      userId: subscription.userId,
      titulo: 'Pagamento Aprovado',
      mensagem: `Seu pagamento de R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} foi aprovado. Sua assinatura está ativa!`,
      tipo: 'sucesso',
      windowMinutes: 5
    });
  }

  // Send confirmation email (async)
  if (subscription.user?.email) {
    sendPaymentConfirmationEmail(subscription.user, {
      amount: amount * 100,
      planName: planId || 'MAY Pro',
      date: new Date(),
      transactionId: transactionId
    }).catch(() => {});
  }

  return {
    orderId,
    subscriptionId: subscription.id,
    paymentId: payment.id,
    status: 'processed'
  };
}

/**
 * Handle order.payment_failed event (v5 Orders API)
 */
async function handleOrderPaymentFailed(event) {
  const orderData = event.data || event;
  const orderId = orderData.id;
  const userId = orderData.metadata?.user_id;
  
  // ✅ Extract detailed failure reason from order and charges
  const charge = orderData.charges?.[0];
  const lastTransaction = charge?.last_transaction;
  const gatewayResponse = lastTransaction?.gateway_response || {};
  const gatewayCode = gatewayResponse.code;
  const gatewayErrors = gatewayResponse.errors || [];
  
  // ✅ CRITICAL: Detect HTTP 412 (Precondition Failed) - missing required fields like 'code'
  const isIntegrationError = gatewayCode === '412' || gatewayCode === 412 || 
                            gatewayErrors.some(e => e.message?.includes('Code') || e.message?.includes('code'));
  
  let failureReason = orderData.status_reason || orderData.failure_reason || 'Payment failed';
  let userMessage = `Seu pagamento foi recusado. Motivo: ${failureReason}. Por favor, atualize seu método de pagamento.`;
  
  if (isIntegrationError) {
    const errorMsg = gatewayErrors.find(e => e.message?.includes('Code') || e.message?.includes('code'))?.message || 
                     'Erro de integração no processamento do pagamento';
    failureReason = `Integration error: ${errorMsg}`;
    userMessage = 'Não foi possível processar seu pagamento no momento. Por favor, tente novamente mais tarde.';
  } else if (lastTransaction?.gateway_response?.message) {
    failureReason = lastTransaction.gateway_response.message;
  } else if (lastTransaction?.acquirer_message) {
    failureReason = lastTransaction.acquirer_message;
  } else if (lastTransaction?.status_reason) {
    failureReason = lastTransaction.status_reason;
  } else if (charge?.status_reason) {
    failureReason = charge.status_reason;
  }

  // Find subscription
  let subscription = await prisma.subscription.findFirst({
    where: { pagarMeSubscriptionId: orderId },
    include: { user: true }
  });

  if (!subscription && userId) {
    subscription = await prisma.subscription.findFirst({
      where: { userId },
      include: { user: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  if (!subscription) {
    return { status: 'subscription_not_found', orderId };
  }

  // Update subscription status
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: 'inadimplente' }
  });

  // Create failure notification with appropriate message
  await prisma.notification.create({
    data: {
      userId: subscription.userId,
      titulo: isIntegrationError ? 'Erro no Processamento' : 'Pagamento Recusado',
      mensagem: userMessage,
      tipo: 'erro'
    }
  });

  // Send status email
  if (subscription.user?.email) {
    sendSubscriptionStatusEmail(subscription.user, 'inadimplente').catch(() => {});
  }

  return {
    orderId,
    subscriptionId: subscription.id,
    status: 'processed',
    reason: failureReason
  };
}

/**
 * Handle charge.paid event (v5 Orders API)
 * Charges are individual payments within an order
 */
async function handleChargePaid(event) {
  const chargeData = event.data || event;
  const chargeId = chargeData.id;
  const orderId = chargeData.order_id || chargeData.order?.id;
  const customerId = chargeData.customer_id || chargeData.customer?.id;

  // Find subscription by orderId
  let subscription = null;
  
  if (orderId) {
    subscription = await prisma.subscription.findFirst({
      where: { pagarMeSubscriptionId: orderId },
      include: { user: true }
    });
  }

  if (!subscription && customerId) {
    const user = await prisma.user.findFirst({
      where: { pagarMeCustomerId: customerId }
    });
    if (user) {
      subscription = await prisma.subscription.findFirst({
        where: { userId: user.id },
        include: { user: true },
        orderBy: { createdAt: 'desc' }
      });
    }
  }

  if (!subscription) {
    return { status: 'subscription_not_found', chargeId, orderId };
  }

  // Check idempotency
  const existingPayment = await prisma.payment.findUnique({
    where: { pagarMeTransactionId: chargeId }
  });

  if (existingPayment && existingPayment.status === 'paid') {
    return { status: 'already_processed', chargeId };
  }

  const amount = chargeData.amount ? chargeData.amount / 100 : 0;

  // ✅ Check if status is actually changing (only create notification on status change)
  const wasPending = subscription.status === 'pending';

  // ✅ Calculate period dates using subscription's billingCycle (source of truth)
  const periodStart = new Date();
  const periodEnd = new Date();
  const billingCycle = subscription.billingCycle || 'monthly';
  
  // Calculate period end based on billing cycle
  switch (billingCycle) {
    case 'annual':
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      break;
    case 'semiannual':
      periodEnd.setMonth(periodEnd.getMonth() + 6);
      break;
    case 'monthly':
    default:
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      break;
  }
  
  const nextBillingDate = calculateNextBillingDate(billingCycle, periodStart);

  // Activate subscription and record payment
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: 'ativo',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      nextBillingAt: nextBillingDate
    }
  });

  await prisma.payment.upsert({
    where: { pagarMeTransactionId: chargeId },
    update: { status: 'paid', amount, paidAt: new Date() },
    create: {
      subscriptionId: subscription.id,
      pagarMeTransactionId: chargeId,
      amount,
      status: 'paid',
      paymentMethod: 'credit_card',
      paidAt: new Date()
    }
  });

  // ✅ Create success notification ONLY if status changed from 'pending' to 'ativo'
  // charge.paid is a secondary event - only create notification if status actually changed
  if (wasPending) {
    await createNotificationWithIdempotency({
      userId: subscription.userId,
      titulo: 'Pagamento Aprovado',
      mensagem: `Seu pagamento de R$ ${amount.toFixed(2)} foi aprovado. Sua assinatura está ativa!`,
      tipo: 'sucesso',
      windowMinutes: 5
    });
  }

  return {
    chargeId,
    subscriptionId: subscription.id,
    status: 'processed'
  };
}

/**
 * Handle charge.payment_failed event (v5 Orders API)
 */
async function handleChargePaymentFailed(event) {
  const chargeData = event.data || event;
  const chargeId = chargeData.id;
  const orderId = chargeData.order_id || chargeData.order?.id;
  
  // ✅ Extract detailed failure reason from charge and transaction
  const lastTransaction = chargeData.last_transaction;
  const gatewayResponse = lastTransaction?.gateway_response || {};
  const gatewayCode = gatewayResponse.code;
  const gatewayErrors = gatewayResponse.errors || [];
  
  // ✅ CRITICAL: Detect HTTP 412 (Precondition Failed) - missing required fields like 'code'
  const isIntegrationError = gatewayCode === '412' || gatewayCode === 412 || 
                            gatewayErrors.some(e => e.message?.includes('Code') || e.message?.includes('code'));
  
  let failureReason = chargeData.status_reason || 'Charge failed';
  let userMessage = `Seu pagamento foi recusado. Motivo: ${failureReason}. Por favor, atualize seu método de pagamento.`;
  
  if (isIntegrationError) {
    const errorMsg = gatewayErrors.find(e => e.message?.includes('Code') || e.message?.includes('code'))?.message || 
                     'Erro de integração no processamento do pagamento';
    failureReason = `Integration error: ${errorMsg}`;
    userMessage = 'Não foi possível processar seu pagamento no momento. Por favor, tente novamente mais tarde.';
  } else if (lastTransaction?.gateway_response?.message) {
    failureReason = lastTransaction.gateway_response.message;
  } else if (lastTransaction?.acquirer_message) {
    failureReason = lastTransaction.acquirer_message;
  } else if (lastTransaction?.status_reason) {
    failureReason = lastTransaction.status_reason;
  }

  // Find subscription
  let subscription = null;
  if (orderId) {
    subscription = await prisma.subscription.findFirst({
      where: { pagarMeSubscriptionId: orderId },
      include: { user: true }
    });
  }

  if (!subscription) {
    return { status: 'subscription_not_found', chargeId };
  }

  // Update subscription status
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: 'inadimplente' }
  });

  // Create notification with appropriate message
  await prisma.notification.create({
    data: {
      userId: subscription.userId,
      titulo: isIntegrationError ? 'Erro no Processamento' : 'Pagamento Recusado',
      mensagem: userMessage,
      tipo: 'erro'
    }
  });

  // Send status email
  if (subscription.user?.email) {
    sendSubscriptionStatusEmail(subscription.user, 'inadimplente').catch(() => {});
  }

  return {
    chargeId,
    subscriptionId: subscription.id,
    status: 'processed',
    reason: failureReason
  };
}

/**
 * Handle order.created event (v5 Orders API)
 * Just acknowledge - let order.paid handle the activation
 * This prevents duplicate processing since Pagar.me sends both order.created and order.paid
 */
async function handleOrderCreated(event) {
  const orderData = event.data || event;
  const orderId = orderData.id;
  const orderStatus = orderData.status;

  // Don't process here - let order.paid event handle activation
  // This prevents duplicate notifications and subscription updates
  return { status: 'acknowledged', orderId, orderStatus };
}

/**
 * Handle charge.created event (v5 Orders API)
 * Just acknowledge - let charge.paid handle the activation
 * This prevents duplicate processing since Pagar.me sends both charge.created and charge.paid
 */
async function handleChargeCreated(event) {
  const chargeData = event.data || event;
  const chargeId = chargeData.id;
  const chargeStatus = chargeData.status;

  // Don't process here - let charge.paid event handle activation
  // This prevents duplicate notifications and subscription updates
  return { status: 'acknowledged', chargeId, chargeStatus };
}

/**
 * POST /api/subscriptions/check-payment
 * Manually check payment status with Pagar.me API and activate subscription if paid
 * Useful when webhook hasn't been received yet
 */
router.post('/check-payment', 
  authenticate, 
  subscriptionLimiter, // Use subscription-specific rate limiter
  asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { order_id } = req.body;

  // Find pending subscription
  let subscription = await prisma.subscription.findFirst({
    where: { 
      userId,
      ...(order_id ? { pagarMeSubscriptionId: order_id } : { status: 'pending' })
    },
    include: { user: true },
    orderBy: { createdAt: 'desc' }
  });

  if (!subscription || !subscription.pagarMeSubscriptionId) {
    return sendSuccess(res, 'No pending subscription found', {
      hasPendingSubscription: false
    });
  }

  const orderId = subscription.pagarMeSubscriptionId;

  // Skip if order ID doesn't look like a Pagar.me order ID
  if (!orderId.startsWith('or_')) {
    return sendSuccess(res, 'Order ID is not a Pagar.me order ID', {
      orderId,
      canCheck: false
    });
  }

  try {
    // ✅ Check order status with Pagar.me API
    const orderStatus = await pagarmeSDKService.getOrderStatus(orderId);

    // If order is paid, activate subscription
    if (orderStatus.status === 'paid' || orderStatus.status === 'closed') {

      // ✅ Check if status is actually changing (only create notification on status change)
      const wasPending = subscription.status === 'pending';

      // Calculate period dates
      const periodStart = new Date();
      const periodEnd = new Date();
      const billingCycle = subscription.billingCycle || 'monthly';
      
      // Calculate period end based on billing cycle
      switch (billingCycle) {
        case 'annual':
          periodEnd.setFullYear(periodEnd.getFullYear() + 1);
          break;
        case 'semiannual':
          periodEnd.setMonth(periodEnd.getMonth() + 6);
          break;
        case 'monthly':
        default:
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          break;
      }
      
      const nextBillingDate = calculateNextBillingDate(billingCycle, periodStart);

      // Update subscription status
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ativo',
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          nextBillingAt: nextBillingDate
        }
      });

      // Extract charge/payment info
      const charge = orderStatus.charges?.[0];
      const transactionId = charge?.id || orderId;
      const amount = orderStatus.amount ? orderStatus.amount / 100 : (charge?.amount ? charge.amount / 100 : 0);

      // Create payment record if it doesn't exist
      await prisma.payment.upsert({
        where: { pagarMeTransactionId: transactionId },
        update: {
          status: 'paid',
          amount: amount,
          paidAt: new Date()
        },
        create: {
          subscriptionId: subscription.id,
          pagarMeTransactionId: transactionId,
          amount: amount,
          status: 'paid',
          paymentMethod: 'credit_card',
          paidAt: new Date()
        }
      });

      // ✅ Create success notification ONLY if status changed from 'pending' to 'ativo'
      if (wasPending) {
        await createNotificationWithIdempotency({
          userId: subscription.userId,
          titulo: 'Pagamento Aprovado',
          mensagem: `Seu pagamento de R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} foi aprovado. Sua assinatura está ativa!`,
          tipo: 'sucesso',
          windowMinutes: 5
        });
      }

      return sendSuccess(res, 'Payment confirmed and subscription activated', {
        subscriptionId: subscription.id,
        status: 'ativo',
        orderId,
        orderStatus: orderStatus.status,
        amount: amount
      });
    } else if (orderStatus.status === 'pending' || orderStatus.status === 'processing') {
      // Order is still pending

      return sendSuccess(res, 'Payment is still pending', {
        subscriptionId: subscription.id,
        status: 'pending',
        orderId,
        orderStatus: orderStatus.status,
        message: 'Payment is still being processed. Please wait for confirmation.'
      });
    } else if (orderStatus.status === 'failed' || orderStatus.status === 'canceled' || orderStatus.status === 'refused') {
      // Payment failed

      // Update subscription status
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'inadimplente' }
      });

      // Create failure notification
      await prisma.notification.create({
        data: {
          userId: subscription.userId,
          titulo: 'Pagamento Recusado',
          mensagem: `Seu pagamento foi recusado. Status: ${orderStatus.status}. Por favor, atualize seu método de pagamento.`,
          tipo: 'erro'
        }
      });

      return sendSuccess(res, 'Payment failed', {
        subscriptionId: subscription.id,
        status: 'inadimplente',
        orderId,
        orderStatus: orderStatus.status
      });
    } else {
      // Unknown status

      return sendSuccess(res, 'Payment status checked', {
        subscriptionId: subscription.id,
        status: subscription.status,
        orderId,
        orderStatus: orderStatus.status,
        message: `Order status: ${orderStatus.status}. Subscription remains ${subscription.status}.`
      });
    }
  } catch (error) {
    // If order not found or API error, return error
    throw new AppError(
      `Erro ao verificar status do pagamento: ${error.message}`,
      500,
      'PAYMENT_CHECK_ERROR',
      { orderId, originalError: error.message }
    );
  }
}));

/**
 * GET /api/subscriptions/limits
 * Get current user's plan limits (companies, invoices, etc.)
 */
router.get('/limits', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  const { getPlanLimitsSummary } = await import('../services/planService.js');
  const limits = await getPlanLimitsSummary(userId);
  
  sendSuccess(res, 'Plan limits retrieved', limits);
}));

export default router;
