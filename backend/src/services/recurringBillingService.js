/**
 * Recurring Billing Service
 * Handles subscription status monitoring and syncing with Stripe
 * 
 * NOTE: Stripe automatically handles recurring billing through its subscription system.
 * This service is used to:
 * - Sync local database with Stripe status
 * - Send reminder notifications
 */

import { prisma } from '../index.js';
import { getPlanConfig } from '../config/plans.js';
import { sendSubscriptionStatusEmail } from './email.js';
import * as stripeSDK from './stripeSDK.js';

/**
 * Get subscriptions that need status sync
 * @returns {Promise<Array>} Array of subscriptions to sync
 */
export async function getSubscriptionsToSync() {
  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: {
        in: ['ACTIVE', 'PAST_DUE', 'PENDING']
      },
      stripeSubscriptionId: {
        not: null,
        notIn: ['']
      }
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          stripeCustomerId: true
        }
      }
    }
  });

  return subscriptions;
}

/**
 * Sync subscription status with Stripe
 * @param {object} subscription - Subscription object with user
 * @returns {Promise<object>} Result of sync attempt
 */
export async function syncSubscriptionWithStripe(subscription) {
  const { stripeSubscriptionId, user } = subscription;

  if (!stripeSubscriptionId) {
    return {
      success: true,
      subscriptionId: subscription.id,
      message: 'Skipped - no Stripe subscription'
    };
  }

  try {
    const stripeSubscription = await stripeSDK.getSubscription(stripeSubscriptionId);
    
    // Map Stripe status to our enum
    const statusMap = {
      'incomplete': 'PENDING',
      'incomplete_expired': 'EXPIRED',
      'active': 'ACTIVE',
      'past_due': 'PAST_DUE',
      'canceled': 'CANCELED',
      'unpaid': 'PAST_DUE'
    };
    
    const newStatus = statusMap[stripeSubscription.status] || subscription.status;
    const statusChanged = newStatus !== subscription.status;

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: newStatus,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        canceledAt: stripeSubscription.canceled_at 
          ? new Date(stripeSubscription.canceled_at * 1000) 
          : null
      }
    });

    // Send notification if status changed to past_due
    if (statusChanged && newStatus === 'PAST_DUE') {
      await prisma.notification.create({
        data: {
          userId: user.id,
          titulo: 'Pagamento Pendente',
          mensagem: 'Houve um problema com o pagamento da sua assinatura. Por favor, atualize seu método de pagamento.',
          tipo: 'erro'
        }
      });

      if (user.email) {
        sendSubscriptionStatusEmail(user, 'inadimplente').catch(err => {
          console.error('[RecurringBilling] Failed to send email:', err);
        });
      }
    }

    return {
      success: true,
      subscriptionId: subscription.id,
      stripeStatus: stripeSubscription.status,
      localStatus: newStatus,
      statusChanged
    };
  } catch (error) {
    console.error(`[RecurringBilling] Error syncing subscription ${subscription.id}:`, error);
    
    return {
      success: false,
      subscriptionId: subscription.id,
      error: error.message
    };
  }
}

/**
 * Process subscription status sync with Stripe
 * @returns {Promise<object>} Results of sync process
 */
export async function processSubscriptionSync() {
  console.log('[RecurringBilling] Starting subscription sync with Stripe...');

  const subscriptions = await getSubscriptionsToSync();
  
  if (subscriptions.length === 0) {
    console.log('[RecurringBilling] No subscriptions to sync');
    return {
      total: 0,
      successful: 0,
      failed: 0,
      results: []
    };
  }

  console.log(`[RecurringBilling] Found ${subscriptions.length} subscription(s) to sync`);

  const results = {
    total: subscriptions.length,
    successful: 0,
    failed: 0,
    results: []
  };

  for (const subscription of subscriptions) {
    const result = await syncSubscriptionWithStripe(subscription);
    results.results.push(result);
    
    if (result.success) {
      results.successful++;
    } else {
      results.failed++;
    }
  }

  console.log(`[RecurringBilling] Sync completed: ${results.successful} successful, ${results.failed} failed`);

  return results;
}

/**
 * Main recurring billing process
 * Combines all recurring billing tasks
 * @returns {Promise<object>} Combined results
 */
export async function processRecurringBilling() {
  console.log('[RecurringBilling] Starting recurring billing process...');

  const syncResults = await processSubscriptionSync();

  return {
    sync: syncResults
  };
}

/**
 * Start recurring billing monitoring (call from scheduler)
 * Runs daily at 2 AM to check subscriptions
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

  // Run immediately
  await runBilling();

  // Schedule next run
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
