/**
 * Recurring Billing Service
 * Handles automatic rebilling for subscriptions based on billing cycle
 * 
 * This service implements the recurring billing logic as described in the guide:
 * - Pagar.me does NOT automatically rebill
 * - We must create orders ourselves on a schedule
 * - Uses cron job to check subscriptions that need billing
 */

import { prisma } from '../index.js';
import * as pagarmeSDKService from './pagarMeSDK.js';
import { getPlanConfig, getPlanPrice, getBillingCycleConfig } from '../config/plans.js';
import { sendSubscriptionStatusEmail } from './email.js';

/**
 * Get subscriptions that need to be billed today
 * @returns {Promise<Array>} Array of subscriptions to bill
 */
export async function getSubscriptionsToBillToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      nextBillingAt: {
        gte: today,
        lt: tomorrow
      },
      billingCycle: {
        in: ['monthly', 'semiannual', 'annual']
      },
      canceledAt: null
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          pagarMeCustomerId: true
        }
      }
    }
  });

  return subscriptions;
}

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
 * Create subscription charge for recurring billing
 * @param {object} subscription - Subscription object with user
 * @returns {Promise<object>} Result of billing attempt
 */
export async function createSubscriptionCharge(subscription) {
  const { user, billingCycle, pagarMePlanId } = subscription;

  if (!user.pagarMeCustomerId) {
    throw new Error(`User ${user.id} does not have Pagar.me customer ID`);
  }

  if (!pagarMePlanId) {
    throw new Error(`Subscription ${subscription.id} does not have plan ID`);
  }

  const planConfig = getPlanConfig(pagarMePlanId);
  if (!planConfig) {
    throw new Error(`Plan ${pagarMePlanId} not found`);
  }

  const planAmount = getPlanPrice(pagarMePlanId, billingCycle);
  if (planAmount === null) {
    throw new Error(`Plan ${pagarMePlanId} does not support billing cycle ${billingCycle}`);
  }

  const billingConfig = getBillingCycleConfig(billingCycle);

  const plan = {
    name: planConfig.name,
    amount: planAmount,
    planId: pagarMePlanId,
    interval: billingConfig.interval,
    intervalCount: billingConfig.intervalCount
  };

  try {
    const customer = await prisma.user.findUnique({
      where: { id: user.id },
      select: { pagarMeCustomerId: true }
    });

    if (!customer?.pagarMeCustomerId) {
      throw new Error('Customer not found in Pagar.me');
    }

    let customerCards;
    try {
      customerCards = await pagarmeSDKService.getCustomerCards(customer.pagarMeCustomerId);
    } catch (error) {
      console.error('[RecurringBilling] Error fetching customer cards:', error);
      throw new Error('Não foi possível acessar os cartões do cliente');
    }
    
    if (!customerCards || customerCards.length === 0) {
      throw new Error('Nenhum método de pagamento encontrado para o cliente');
    }

    const defaultCard = customerCards.find(card => card.status === 'active') || customerCards[0];
    
    if (!defaultCard || !defaultCard.id) {
      throw new Error('Cartão padrão inválido');
    }

    const subscriptionResult = await pagarmeSDKService.createSubscription({
      customerId: customer.pagarMeCustomerId,
      cardId: defaultCard.id,
      plan: {
        name: plan.name,
        amount: plan.amount,
        interval: plan.interval,
        intervalCount: plan.intervalCount,
        code: plan.planId
      },
      metadata: {
        type: 'subscription',
        user_id: user.id,
        plan_id: pagarMePlanId,
        billing_cycle: billingCycle,
        recurring: 'true',
        subscription_id: subscription.id
      }
    });

    const nextBillingDate = calculateNextBillingDate(billingCycle);

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        nextBillingAt: nextBillingDate,
        pagarMeSubscriptionId: subscriptionResult.orderId || subscriptionResult.subscriptionId
      }
    });

    return {
      success: true,
      subscriptionId: subscription.id,
      orderId: subscriptionResult.orderId,
      amount: plan.amount,
      nextBillingAt: nextBillingDate
    };
  } catch (error) {
    console.error(`[RecurringBilling] Error billing subscription ${subscription.id}:`, error);

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'PAST_DUE'
      }
    });

    await prisma.notification.create({
      data: {
        userId: user.id,
        titulo: 'Falha no Pagamento Recorrente',
        mensagem: `Não foi possível processar o pagamento da sua assinatura. Por favor, atualize seu método de pagamento.`,
        tipo: 'erro'
      }
    });

    if (user.email) {
      sendSubscriptionStatusEmail(user, 'inadimplente').catch(err => {
        console.error('[RecurringBilling] Failed to send email:', err);
      });
    }

    return {
      success: false,
      subscriptionId: subscription.id,
      error: error.message
    };
  }
}

/**
 * Process all subscriptions that need billing today
 * @returns {Promise<object>} Results of billing process
 */
export async function processRecurringBilling() {
  console.log('[RecurringBilling] Starting recurring billing process...');

  const subscriptions = await getSubscriptionsToBillToday();
  
  if (subscriptions.length === 0) {
    console.log('[RecurringBilling] No subscriptions to bill today');
    return {
      total: 0,
      successful: 0,
      failed: 0,
      results: []
    };
  }

  console.log(`[RecurringBilling] Found ${subscriptions.length} subscription(s) to bill`);

  const results = {
    total: subscriptions.length,
    successful: 0,
    failed: 0,
    results: []
  };

  for (const subscription of subscriptions) {
    try {
      const result = await createSubscriptionCharge(subscription);
      results.results.push(result);
      
      if (result.success) {
        results.successful++;
        console.log(`[RecurringBilling] ✅ Successfully billed subscription ${subscription.id}`);
      } else {
        results.failed++;
        console.error(`[RecurringBilling] ❌ Failed to bill subscription ${subscription.id}: ${result.error}`);
      }
    } catch (error) {
      results.failed++;
      results.results.push({
        success: false,
        subscriptionId: subscription.id,
        error: error.message
      });
      console.error(`[RecurringBilling] ❌ Error processing subscription ${subscription.id}:`, error);
    }
  }

  console.log(`[RecurringBilling] Billing process completed: ${results.successful} successful, ${results.failed} failed`);

  return results;
}

/**
 * Start recurring billing monitoring (call from scheduler)
 * Runs daily at 2 AM to check for subscriptions that need billing
 */
export async function startRecurringBillingMonitoring() {
  console.log('[RecurringBilling] Starting recurring billing monitoring...');

  const runBilling = async () => {
    try {
      await processRecurringBilling();
    } catch (error) {
      console.error('[RecurringBilling] Error in billing cycle:', error);
    }
  };

  await runBilling();

  const scheduleNextRun = () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(2, 0, 0, 0);

    const msUntilTomorrow = tomorrow.getTime() - now.getTime();

    setTimeout(async () => {
      await runBilling();
      setInterval(runBilling, 24 * 60 * 60 * 1000);
    }, msUntilTomorrow);
  };

  scheduleNextRun();
}
