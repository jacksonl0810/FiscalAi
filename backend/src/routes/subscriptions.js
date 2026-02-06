import express from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../index.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { sendSuccess } from '../utils/response.js';
import { subscriptionLimiter } from '../middleware/rateLimiter.js';
import * as stripeSDK from '../services/stripeSDK.js';
import {
  onInvoicePaid,
  onInvoicePaymentFailed,
  onSubscriptionUpdated,
  onSubscriptionDeleted,
  onSubscriptionTrialWillEnd
} from '../services/stripeWebhookHandlers.js';

const router = express.Router();

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

// ========================================
// STRIPE WEBHOOK ENDPOINT (PUBLIC - NO AUTH)
// ========================================
// This MUST be before router.use(authenticate)
// Webhooks are the SOURCE OF TRUTH for subscription status

router.post('/stripe-webhook', 
  express.raw({ type: 'application/json' }),
  asyncHandler(async (req, res) => {
  const startTime = Date.now();
    const sig = req.headers['stripe-signature'];
    
    if (!sig) {
      console.error('[Stripe Webhook] Missing stripe-signature header');
      return res.status(400).json({ error: 'Missing signature' });
    }

  let event;
  try {
      event = stripeSDK.constructWebhookEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('[Stripe Webhook] Signature verification failed:', err.message);
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    console.log('[Stripe Webhook] Received event:', event.type, 'ID:', event.id);

  try {
    let result = null;

      console.log('[Stripe Webhook] Switching on event type:', event.type);

      switch (event.type) {
        // ═══════════════════════════════════════════════════════════════════════
        // ✅ INVOICE EVENTS (Source of Truth for Subscription Payments)
        // ═══════════════════════════════════════════════════════════════════════
        
        case 'invoice.paid':
          result = await onInvoicePaid(event.data.object);
        break;

        case 'invoice.payment_failed':
          result = await onInvoicePaymentFailed(event.data.object);
        break;

        // ═══════════════════════════════════════════════════════════════════════
        // ✅ SUBSCRIPTION LIFECYCLE EVENTS
        // ═══════════════════════════════════════════════════════════════════════
        
        case 'customer.subscription.updated':
          result = await onSubscriptionUpdated(event.data.object);
        break;

        case 'customer.subscription.deleted':
          result = await onSubscriptionDeleted(event.data.object);
        break;

        case 'customer.subscription.trial_will_end':
          result = await onSubscriptionTrialWillEnd(event.data.object);
        break;

        case 'customer.subscription.created':
          // Acknowledge only - wait for invoice.paid for activation
          console.log('[Stripe Webhook] Subscription created:', event.data.object.id);
          result = { status: 'acknowledged', message: 'Subscription created, waiting for invoice.paid' };
        break;

      default:
          // Ignore all other events
          result = { status: 'ignored', message: `Event type ${event.type} not handled` };
    }

    const processingTime = Date.now() - startTime;
      console.log('[Stripe Webhook] Processed in', processingTime, 'ms');

    // Always return 200 to acknowledge receipt
    res.status(200).json({
        received: true,
        eventType: event.type,
      processingTime: `${processingTime}ms`
    });
  } catch (error) {
      console.error('[Stripe Webhook] Processing error:', error);

    // Return 200 to acknowledge receipt and prevent infinite retries
    res.status(200).json({
        received: true,
        error: error.message
      });
    }
  })
);

/**
 * GET /api/subscriptions/webhook/config
 * Check webhook configuration (development only)
 */
router.get('/webhook/config', asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      status: 'error',
      message: 'Webhook config endpoint is disabled in production'
    });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const baseUrl = process.env.BACKEND_URL || process.env.BASE_URL || 'http://localhost:3001';
  
  sendSuccess(res, 'Webhook configuration', {
    secret_configured: !!webhookSecret,
    webhook_url: `${baseUrl}/api/subscriptions/stripe-webhook`,
    instructions: {
      step1: 'Go to Stripe Dashboard → Developers → Webhooks',
      step2: 'Click "Add endpoint"',
      step3: `Set URL to: ${baseUrl}/api/subscriptions/stripe-webhook`,
      step4: 'Select events: invoice.paid, invoice.payment_failed, customer.subscription.updated, customer.subscription.deleted, customer.subscription.trial_will_end',
      step5: 'Copy the signing secret (whsec_xxx) to STRIPE_WEBHOOK_SECRET in .env'
    },
    events_handled: [
      'invoice.paid',
      'invoice.payment_failed',
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'customer.subscription.trial_will_end'
    ]
  });
}));

// ========================================
// ALL OTHER ROUTES REQUIRE AUTHENTICATION
// ========================================
router.use(authenticate);

/**
 * POST /api/subscriptions/create-payment-intent
 * Create a SetupIntent or PaymentIntent for collecting payment method
 * Frontend uses this to securely collect card details via Stripe.js
 */
router.post('/create-setup-intent', 
  subscriptionLimiter,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new AppError('Usuário não encontrado', 404, 'NOT_FOUND');
    }

    // Create or get Stripe customer
    const customer = await stripeSDK.createOrUpdateCustomer({
      email: user.email,
      name: user.name,
      phone: user.phone,
      existingStripeId: user.stripeCustomerId,
      metadata: { userId }
    });

    // Update user with Stripe customer ID if new
    if (!user.stripeCustomerId) {
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customer.id }
      });
    }

    // Create SetupIntent for collecting payment method
    const setupIntent = await stripeSDK.stripeSDK.setupIntents.create({
      customer: customer.id,
      payment_method_types: ['card'],
      metadata: { userId }
    });

    sendSuccess(res, 'SetupIntent created', {
      clientSecret: setupIntent.client_secret,
      customerId: customer.id
    });
  })
);

/**
 * POST /api/subscriptions/process-payment
 * Process subscription payment with Stripe
 * Frontend sends payment_method_id from Stripe.js
 */
router.post('/process-payment', 
  authenticate, 
  subscriptionLimiter,
  [
    body('plan_id').trim().notEmpty().withMessage('Plan ID is required'),
    body('billing_cycle').optional().isIn(['monthly', 'semiannual', 'annual']).withMessage('Billing cycle must be monthly, semiannual, or annual'),
    body('payment_method_id').trim().notEmpty().withMessage('Payment method ID is required'),
    body('cpf_cnpj').optional().trim(),
    body('phone').optional().trim(),
    body('billing_address').optional().isObject()
  ], 
  validateRequest, 
  asyncHandler(async (req, res) => {
    const { plan_id, billing_cycle = 'monthly', payment_method_id, cpf_cnpj, phone, billing_address } = req.body;
  const userId = req.user.id;

    console.log('[Stripe] Processing payment for user:', userId, 'plan:', plan_id, 'cycle:', billing_cycle);

  // Get user data
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Import plan configuration
    const { getPlanConfig, getPlanPrice, getStripePriceId, normalizePlanId } = await import('../config/plans.js');
  
    // Normalize plan ID
  const normalizedPlanId = normalizePlanId(plan_id);
  
  // Get plan configuration
  const planConfig = getPlanConfig(normalizedPlanId);
  if (!planConfig) {
      throw new AppError('Invalid plan', 400, 'INVALID_PLAN');
    }

    // Get Stripe price ID
    const stripePriceId = getStripePriceId(normalizedPlanId, billing_cycle);
    if (!stripePriceId) {
      throw new AppError('Stripe price not configured for this plan', 400, 'STRIPE_PRICE_NOT_FOUND');
    }

    console.log('[Stripe] Using price ID:', stripePriceId);

    try {
      // Step 1: Create or update Stripe customer
      const customer = await stripeSDK.createOrUpdateCustomer({
        email: user.email,
        name: user.name,
        phone: phone || user.phone,
        existingStripeId: user.stripeCustomerId,
        metadata: { 
          userId,
          cpfCnpj: cpf_cnpj || user.cpfCnpj
        }
      });

      console.log('[Stripe] Customer:', customer.id);

      // Update user with Stripe customer ID and other info
      const updateData = {
        stripeCustomerId: customer.id
      };
      if (cpf_cnpj) updateData.cpfCnpj = cpf_cnpj.replace(/\D/g, '');
      if (phone) updateData.phone = phone.replace(/\D/g, '');
      if (billing_address) {
        updateData.addressLine1 = billing_address.line_1;
        updateData.addressLine2 = billing_address.line_2 || null;
        updateData.city = billing_address.city;
        updateData.state = billing_address.state?.toUpperCase();
        updateData.zipCode = billing_address.zip_code?.replace(/\D/g, '');
      }
      
      await prisma.user.update({
        where: { id: userId },
        data: updateData
      });

      // Step 2: Attach payment method to customer
      await stripeSDK.attachPaymentMethod({
        customerId: customer.id,
        paymentMethodId: payment_method_id
      });

      console.log('[Stripe] Payment method attached');

      // Step 3: Create subscription
      const subscriptionResult = await stripeSDK.createSubscription({
        customerId: customer.id,
        priceId: stripePriceId,
        paymentMethodId: payment_method_id,
        metadata: {
          userId,
          planId: normalizedPlanId,
          billingCycle: billing_cycle
        }
      });

      console.log('[Stripe] Subscription created:', subscriptionResult.subscriptionId, 'Status:', subscriptionResult.status);

      // Step 4: Create or update subscription in database
      const existingSubscription = await prisma.subscription.findFirst({
        where: { userId }
      });

      // Map Stripe status to our enum
      const statusMap = {
        'incomplete': 'PENDING',
        'incomplete_expired': 'EXPIRED',
        'active': 'ACTIVE',
        'past_due': 'PAST_DUE',
        'canceled': 'CANCELED',
        'unpaid': 'PAST_DUE'
      };
      const dbStatus = statusMap[subscriptionResult.status] || 'PENDING';

      let subscription;
    if (existingSubscription) {
      subscription = await prisma.subscription.update({
        where: { id: existingSubscription.id },
        data: {
            status: dbStatus,
            stripeSubscriptionId: subscriptionResult.subscriptionId,
            stripePriceId: stripePriceId,
            planId: normalizedPlanId,
            billingCycle: billing_cycle,
            annualDiscountApplied: billing_cycle === 'annual' || billing_cycle === 'semiannual',
            currentPeriodStart: subscriptionResult.currentPeriodStart,
            currentPeriodEnd: subscriptionResult.currentPeriodEnd,
            nextBillingAt: subscriptionResult.currentPeriodEnd,
            canceledAt: null,
            trialEndsAt: subscriptionResult.trialEnd
        }
      });
    } else {
      subscription = await prisma.subscription.create({
        data: {
          userId,
            status: dbStatus,
            stripeSubscriptionId: subscriptionResult.subscriptionId,
            stripePriceId: stripePriceId,
            planId: normalizedPlanId,
            billingCycle: billing_cycle,
            annualDiscountApplied: billing_cycle === 'annual' || billing_cycle === 'semiannual',
            currentPeriodStart: subscriptionResult.currentPeriodStart,
            currentPeriodEnd: subscriptionResult.currentPeriodEnd,
            nextBillingAt: subscriptionResult.currentPeriodEnd,
            trialEndsAt: subscriptionResult.trialEnd
        }
      });
    }

      // Step 5: Return response with client secret if payment confirmation needed
      const isPaid = subscriptionResult.status === 'active';
      
      if (isPaid) {
        await createNotificationWithIdempotency({
        userId,
          titulo: 'Assinatura Ativada!',
          mensagem: `Seu plano ${planConfig.name} foi ativado com sucesso. Aproveite todos os recursos!`,
          tipo: 'sucesso',
          windowMinutes: 5
        });
      } else {
        await createNotificationWithIdempotency({
          userId,
          titulo: 'Pagamento em Processamento',
          mensagem: `Seu pagamento do plano ${planConfig.name} está sendo processado.`,
          tipo: 'info',
          windowMinutes: 5
        });
      }

      sendSuccess(res, isPaid ? 'Assinatura ativada com sucesso' : 'Pagamento enviado para processamento', {
        subscription_id: subscription.id,
        stripe_subscription_id: subscriptionResult.subscriptionId,
        status: subscriptionResult.status,
        is_paid: isPaid,
        plan_id: normalizedPlanId,
        client_secret: subscriptionResult.clientSecret,
        current_period_end: subscriptionResult.currentPeriodEnd,
        message: isPaid 
          ? 'Pagamento confirmado! Sua assinatura está ativa.'
          : subscriptionResult.clientSecret 
            ? 'Confirmação de pagamento necessária. Use o client_secret para confirmar.'
            : 'Aguardando confirmação do pagamento.'
      });

    } catch (error) {
      console.error('[Stripe] Error processing payment:', error);
      throw new AppError(
        `Erro ao processar pagamento: ${error.message}`,
        500,
        'PAYMENT_PROCESSING_ERROR',
        { originalError: error.message }
      );
    }
  })
);

/**
 * POST /api/subscriptions/start
 * Start subscription process - handles pay_per_use and paid plans
 * 
 * PLAN TYPES:
 * - pay_per_use: No subscription needed, activates immediately (R$9/invoice)
 * - essential/professional: Monthly subscription plans
 * - accountant: Custom pricing (contact sales)
 */
router.post('/start', 
  subscriptionLimiter,
  [
    body('plan_id').notEmpty().withMessage('Plan ID is required'),
    body('billing_cycle').optional().isIn(['monthly', 'annual'])
  ], 
  validateRequest, 
  asyncHandler(async (req, res) => {
    const { plan_id, billing_cycle = 'monthly' } = req.body;
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new AppError('Usuário não encontrado', 404, 'NOT_FOUND');
    }

    const { getPlanConfig, normalizePlanId, isPayPerUsePlan } = await import('../config/plans.js');
    const normalizedPlanId = normalizePlanId(plan_id);
    const planConfig = getPlanConfig(normalizedPlanId);
    
    if (!planConfig) {
      throw new AppError('Plano não encontrado', 400, 'INVALID_PLAN');
    }

    // Handle custom pricing plans (accountant)
    if (planConfig.isCustomPricing) {
      sendSuccess(res, 'Custom pricing plan - contact sales', {
        checkout_url: null,
        subscription_id: null,
        plan_id: normalizedPlanId,
        status: 'CONTACT_SALES',
        message: 'Para o plano Contador, entre em contato com nossa equipe de vendas.',
        contact_email: 'contato@mayassessorfiscal.com.br'
      });
      return;
    }

    // Handle Pay per Use - activate immediately (no subscription needed)
    if (isPayPerUsePlan(normalizedPlanId)) {
      const existingSubscription = await prisma.subscription.findUnique({
        where: { userId }
      });

      let subscription;
      if (existingSubscription) {
        // Update to pay_per_use
        subscription = await prisma.subscription.update({
          where: { id: existingSubscription.id },
          data: {
            status: 'ACTIVE',
            planId: 'pay_per_use',
            billingCycle: 'per_invoice',
            canceledAt: null,
            // Clear period dates (pay per use has no period)
            currentPeriodStart: null,
            currentPeriodEnd: null,
            nextBillingAt: null
          }
        });
      } else {
        subscription = await prisma.subscription.create({
          data: {
            userId,
            status: 'ACTIVE',
            planId: 'pay_per_use',
            billingCycle: 'per_invoice',
            stripeSubscriptionId: `ppu_${Date.now()}_${userId.slice(0, 8)}`
          }
        });
      }

      await createNotificationWithIdempotency({
        userId,
        titulo: 'Pay per Use Ativado!',
        mensagem: 'Agora você pode emitir notas fiscais por R$9 cada. Pague apenas quando usar.',
        tipo: 'sucesso',
        windowMinutes: 60
      });

      const checkoutUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-success?plan=pay_per_use&session_id=${subscription.stripeSubscriptionId}`;

      sendSuccess(res, 'Pay per Use activated', {
        checkout_url: checkoutUrl,
        subscription_id: subscription.id,
        plan_id: 'pay_per_use',
        status: 'ACTIVE',
        per_invoice_price: planConfig.perInvoicePrice,
        per_invoice_price_formatted: 'R$ 9,00'
      });
      return;
    }

    // For paid subscription plans (essential, professional), redirect to checkout page
    const checkoutUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/checkout/subscription?plan=${normalizedPlanId}&cycle=${billing_cycle}`;
    
    sendSuccess(res, 'Redirect to checkout', {
      checkout_url: checkoutUrl,
      subscription_id: null,
      plan_id: normalizedPlanId,
      billing_cycle,
      status: null
    });
  })
);

/**
 * GET /api/subscriptions/trial-eligibility
 * @deprecated Trial plan has been removed. This endpoint is kept for backwards compatibility.
 * Always returns not eligible.
 */
router.get('/trial-eligibility', asyncHandler(async (req, res) => {
  sendSuccess(res, 'Trial plan is no longer available', {
    eligible: false,
    hasUsedTrial: true,
    trialStartedAt: null,
    trialEndedAt: null,
    message: 'O período de teste não está mais disponível. Por favor, escolha um plano pago.'
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

  let status = 'no_subscription';
  let planId = null;
  let currentPeriodEnd = null;
  let daysRemaining = 0;

  if (subscription) {
    status = subscription.status;
    planId = subscription.planId;
    currentPeriodEnd = subscription.currentPeriodEnd;
    
    if (currentPeriodEnd) {
      const now = new Date();
      daysRemaining = Math.max(0, Math.ceil((new Date(currentPeriodEnd) - now) / (1000 * 60 * 60 * 24)));
    }
  }

  sendSuccess(res, 'Subscription status retrieved', {
    status,
    plan_id: planId,
    current_period_end: currentPeriodEnd,
    days_remaining: daysRemaining
  });
}));

/**
 * GET /api/subscriptions/verify
 * Verify subscription status with Stripe
 */
router.get('/verify', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const subscription = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });

  if (!subscription) {
    return sendSuccess(res, 'Nenhuma assinatura encontrada', {
      isValid: false,
      status: 'no_subscription'
    });
  }

  const stripeSubId = subscription.stripeSubscriptionId;

  if (!stripeSubId || stripeSubId.startsWith('ppu_')) {
    return sendSuccess(res, 'Assinatura local encontrada', {
      isValid: subscription.status === 'ACTIVE',
      status: subscription.status,
      subscriptionId: subscription.id,
      message: stripeSubId?.startsWith('ppu_') ? 'Pay per Use subscription' : 'No Stripe subscription ID'
    });
  }

  try {
    const stripeSubscription = await stripeSDK.getSubscription(stripeSubId);
    
    const statusMap = {
      'active': 'ACTIVE',
      'past_due': 'PAST_DUE',
      'canceled': 'CANCELED',
      'incomplete': 'PENDING'
    };
    const mappedStatus = statusMap[stripeSubscription.status] || 'PENDING';

    // Sync if status differs
    if (mappedStatus !== subscription.status) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: mappedStatus,
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000)
        }
      });
    }

    sendSuccess(res, 'Verificação de assinatura concluída', {
      isValid: stripeSubscription.status === 'active',
      status: mappedStatus,
      stripeStatus: stripeSubscription.status,
      subscriptionId: subscription.id,
      stripeSubscriptionId: stripeSubId,
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000)
    });

  } catch (error) {
    console.error('[Subscription] Error verifying with Stripe:', error.message);
    
    sendSuccess(res, 'Verificação com Stripe falhou, usando dados locais', {
      isValid: subscription.status === 'ACTIVE',
      status: subscription.status,
      subscriptionId: subscription.id,
      error: error.message
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
      status: 'no_subscription',
      hasSubscription: false
    });
  }

  sendSuccess(res, 'Assinatura consultada com sucesso', subscription);
}));

/**
 * POST /api/subscriptions/cancel
 * Cancel current user's subscription
 */
router.post('/cancel', 
  subscriptionLimiter,
  asyncHandler(async (req, res) => {
  const subscription = await prisma.subscription.findUnique({
    where: { userId: req.user.id }
  });

  if (!subscription) {
    throw new AppError('Assinatura não encontrada', 404, 'NOT_FOUND');
  }

    if (subscription.status === 'CANCELED') {
    throw new AppError('Assinatura já está cancelada', 400, 'ALREADY_CANCELED');
  }

  try {
      // Cancel in Stripe if subscription ID exists (skip pay_per_use local subscriptions)
      if (subscription.stripeSubscriptionId && !subscription.stripeSubscriptionId.startsWith('ppu_')) {
        await stripeSDK.cancelSubscription(subscription.stripeSubscriptionId, false); // Cancel at period end
        console.log('[Stripe] Subscription canceled at period end:', subscription.stripeSubscriptionId);
      }

      // Update in database
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
          status: 'CANCELED',
        canceledAt: new Date()
      }
    });

    await prisma.notification.create({
      data: {
        userId: req.user.id,
        titulo: 'Assinatura Cancelada',
        mensagem: 'Sua assinatura foi cancelada. Você ainda terá acesso até o final do período pago.',
        tipo: 'info'
      }
    });

      sendSuccess(res, 'Assinatura cancelada com sucesso', {
        canceledAt: new Date(),
        accessUntil: subscription.currentPeriodEnd
      });
  } catch (error) {
      console.error('[Subscription] Cancel error:', error);
    throw new AppError(error.message || 'Falha ao cancelar assinatura', 500, 'SUBSCRIPTION_CANCEL_ERROR');
  }
  })
);

/**
 * POST /api/subscriptions/reactivate
 * Reactivate a canceled subscription (if still within period)
 */
router.post('/reactivate',
  subscriptionLimiter,
  asyncHandler(async (req, res) => {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.user.id }
    });
    
    if (!subscription) {
      throw new AppError('Assinatura não encontrada', 404, 'NOT_FOUND');
    }

    if (subscription.status !== 'CANCELED') {
      throw new AppError('Assinatura não está cancelada', 400, 'NOT_CANCELED');
    }

    try {
      if (subscription.stripeSubscriptionId && !subscription.stripeSubscriptionId.startsWith('ppu_')) {
        await stripeSDK.reactivateSubscription(subscription.stripeSubscriptionId);
      }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
          status: 'ACTIVE',
          canceledAt: null
    }
  });

  await prisma.notification.create({
    data: {
          userId: req.user.id,
          titulo: 'Assinatura Reativada!',
          mensagem: 'Sua assinatura foi reativada com sucesso.',
      tipo: 'sucesso'
    }
  });

      sendSuccess(res, 'Assinatura reativada com sucesso');
    } catch (error) {
      console.error('[Subscription] Reactivate error:', error);
      throw new AppError(error.message || 'Falha ao reativar assinatura', 500, 'SUBSCRIPTION_REACTIVATE_ERROR');
    }
  })
);

/**
 * POST /api/subscriptions/update-payment-method
 * Update default payment method
 */
router.post('/update-payment-method',
  subscriptionLimiter,
  [
    body('payment_method_id').trim().notEmpty().withMessage('Payment method ID is required')
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { payment_method_id } = req.body;
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || !user.stripeCustomerId) {
      throw new AppError('Customer not found', 404, 'CUSTOMER_NOT_FOUND');
    }

    try {
      await stripeSDK.attachPaymentMethod({
        customerId: user.stripeCustomerId,
        paymentMethodId: payment_method_id
      });

      sendSuccess(res, 'Método de pagamento atualizado com sucesso');
    } catch (error) {
      console.error('[Stripe] Update payment method error:', error);
      throw new AppError(error.message || 'Falha ao atualizar método de pagamento', 500, 'PAYMENT_METHOD_ERROR');
    }
  })
);

/**
 * GET /api/subscriptions/limits
 * Get current user's plan limits
 */
router.get('/limits', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  const { getPlanLimitsSummary } = await import('../services/planService.js');
  const limits = await getPlanLimitsSummary(userId);
  
  sendSuccess(res, 'Plan limits retrieved', limits);
}));

/**
 * GET /api/subscriptions/portal
 * Get Stripe Customer Portal URL for managing subscription
 */
router.get('/portal', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user || !user.stripeCustomerId) {
    throw new AppError('Customer not found', 404, 'CUSTOMER_NOT_FOUND');
  }

  try {
    const session = await stripeSDK.stripeSDK.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings/subscription`
    });

    sendSuccess(res, 'Portal session created', {
      url: session.url
    });
  } catch (error) {
    console.error('[Stripe] Portal error:', error);
    throw new AppError('Failed to create portal session', 500, 'PORTAL_ERROR');
  }
}));

export default router;
