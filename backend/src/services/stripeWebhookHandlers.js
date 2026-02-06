/**
 * Stripe Webhook Handlers
 * Handle Stripe webhook events for subscriptions and invoices
 */

import { prisma } from '../index.js';
import { sendEmail } from './email.js';

/**
 * Handle invoice.paid event
 * Subscription payment successful - activate subscription
 */
export async function onInvoicePaid(invoice) {
  // Support both old and new Stripe API invoice structures
  // Old: invoice.subscription
  // New (2026+): invoice.parent.subscription_details.subscription
  const subscriptionId = invoice.subscription ?? invoice.parent?.subscription_details?.subscription;
  
  console.log('[Stripe Webhook] onInvoicePaid called:', {
    invoiceId: invoice.id,
    subscriptionId,
    subscriptionSource: invoice.subscription ? 'invoice.subscription' : 'invoice.parent.subscription_details',
    customerId: invoice.customer,
    amount: invoice.amount_paid,
    status: invoice.status
  });
  
  if (!subscriptionId) {
    console.error('[Stripe Webhook] ❌ Invoice paid but no subscription ID found:', invoice.id);
    console.error('[Stripe Webhook] Checked invoice.subscription and invoice.parent.subscription_details');
    return;
  }
  
  console.log('[Stripe Webhook] Processing invoice.paid:', {
    invoiceId: invoice.id,
    subscriptionId,
    amount: invoice.amount_paid / 100
  });
  
  const subscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
    include: { user: true }
  });
  
  console.log('[Stripe Webhook] Database lookup result:', {
    found: !!subscription,
    subscriptionId: subscription?.id,
    userId: subscription?.userId,
    currentStatus: subscription?.status
  });
  
  if (!subscription) {
    console.error('[Stripe Webhook] ❌ Subscription not found in database:', subscriptionId);
    console.error('[Stripe Webhook] This means the subscription was not created in database during checkout');
    return;
  }
  
  // Idempotency check - prevent duplicate payment records
  const existingPayment = await prisma.payment.findUnique({
    where: { stripeInvoiceId: invoice.id }
  });
  
  if (existingPayment) {
    console.log('[Stripe Webhook] Payment already recorded for invoice:', invoice.id);
    return;
  }
  
  const amount = invoice.amount_paid / 100; // Convert from cents to dollars
  
  try {
    // Build update data for subscription
    const subscriptionUpdateData = {
      status: 'ACTIVE'
    };
    
    // Add period dates if they exist
    if (invoice.period_start) {
      subscriptionUpdateData.currentPeriodStart = new Date(invoice.period_start * 1000);
    }
    if (invoice.period_end) {
      subscriptionUpdateData.currentPeriodEnd = new Date(invoice.period_end * 1000);
    }
    
    // Update subscription and create payment record in a transaction
    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: subscription.id },
        data: subscriptionUpdateData
      }),
      prisma.payment.create({
        data: {
          subscriptionId: subscription.id,
          stripeInvoiceId: invoice.id,
          amount,
          status: 'PAID',
          paymentMethod: 'credit_card',
          paidAt: invoice.status_transitions.paid_at 
            ? new Date(invoice.status_transitions.paid_at * 1000) 
            : new Date()
        }
      })
    ]);
    
    console.log('[Stripe Webhook] ✅ Invoice paid processed:', {
      invoiceId: invoice.id,
      subscriptionId: subscription.id,
      status: 'ACTIVE',
      amount
    });
    
    // In-app notification: payment success / plan active (idempotent)
    const planNames = { pro: 'Pro', business: 'Business' };
    const planName = planNames[subscription.planId] || subscription.planId || 'assinatura';
    const windowAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existingNotif = await prisma.notification.findFirst({
      where: {
        userId: subscription.userId,
        titulo: 'Assinatura Ativada!',
        createdAt: { gte: windowAgo }
      }
    });
    if (!existingNotif) {
      await prisma.notification.create({
        data: {
          userId: subscription.userId,
          titulo: 'Assinatura Ativada!',
          mensagem: `Seu plano MAY ${planName} foi ativado com sucesso. Aproveite todos os recursos!`,
          tipo: 'sucesso'
        }
      });
    }
    
    // Send payment confirmation email
    if (subscription.user.email) {
      await sendEmail({
        to: subscription.user.email,
        subject: '✅ Payment Confirmed - MAY',
        html: `
          <h2>Payment Confirmed</h2>
          <p>Your payment of R$ ${amount.toFixed(2)} has been processed successfully.</p>
          <p>Your subscription is now active.</p>
          <p>Thank you for using MAY!</p>
        `
      }).catch(err => console.error('[Email] Failed to send confirmation:', err));
    }
    
  } catch (error) {
    console.error('[Stripe Webhook] ❌ Error processing invoice.paid:', error);
    throw error;
  }
}

/**
 * Handle invoice.payment_failed event
 * Payment failed - mark subscription as past due
 */
export async function onInvoicePaymentFailed(invoice) {
  // Support both old and new Stripe API invoice structures
  // Old: invoice.subscription
  // New (2026+): invoice.parent.subscription_details.subscription
  const subscriptionId = invoice.subscription ?? invoice.parent?.subscription_details?.subscription;
  
  if (!subscriptionId) {
    console.error('[Stripe Webhook] ❌ Invoice payment failed but no subscription ID found:', invoice.id);
    console.error('[Stripe Webhook] Checked invoice.subscription and invoice.parent.subscription_details');
    return;
  }
  
  console.log('[Stripe Webhook] Processing invoice.payment_failed:', {
    invoiceId: invoice.id,
    subscriptionId,
    attemptCount: invoice.attempt_count
  });
  
  const subscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
    include: { user: true }
  });
  
  if (!subscription) {
    console.warn('[Stripe Webhook] ⚠️ Subscription not found in database:', subscriptionId);
    return;
  }
  
  try {
    // Mark subscription as past due
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'PAST_DUE' }
    });
    
    console.log('[Stripe Webhook] ⚠️ Invoice payment failed processed:', {
      invoiceId: invoice.id,
      subscriptionId: subscription.id,
      status: 'PAST_DUE',
      attemptCount: invoice.attempt_count
    });
    
    // Send payment failure email
    if (subscription.user.email) {
      const errorMessage = invoice.last_finalization_error?.message || 'Payment was declined';
      
      await sendEmail({
        to: subscription.user.email,
        subject: '⚠️ Payment Failed - MAY',
        html: `
          <h2>Payment Failed</h2>
          <p>We were unable to process your payment.</p>
          <p><strong>Reason:</strong> ${errorMessage}</p>
          <p>Please update your payment method to continue using MAY.</p>
          <p><a href="${process.env.FRONTEND_URL}/settings/billing">Update Payment Method</a></p>
        `
      }).catch(err => console.error('[Email] Failed to send failure notification:', err));
    }
    
  } catch (error) {
    console.error('[Stripe Webhook] ❌ Error processing invoice.payment_failed:', error);
    throw error;
  }
}

/**
 * Handle customer.subscription.updated event
 * Subscription status or details changed
 */
export async function onSubscriptionUpdated(stripeSubscription) {
  console.log('[Stripe Webhook] Processing customer.subscription.updated:', {
    subscriptionId: stripeSubscription.id,
    status: stripeSubscription.status
  });
  
  const subscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: stripeSubscription.id }
  });
  
  if (!subscription) {
    console.warn('[Stripe Webhook] ⚠️ Subscription not found in database:', stripeSubscription.id);
    return;
  }
  
  try {
    // Map Stripe status to our enum
    const statusMap = {
      'incomplete': 'PENDING',
      'incomplete_expired': 'EXPIRED',
      'active': 'ACTIVE',
      'past_due': 'PAST_DUE',
      'canceled': 'CANCELED',
      'unpaid': 'PAST_DUE'
    };
    
    const mappedStatus = statusMap[stripeSubscription.status] || 'PENDING';
    
    // Build update data object, only including valid date fields
    const updateData = {
      status: mappedStatus
    };
    
    // Only update period dates if they exist and are valid
    if (stripeSubscription.current_period_start) {
      updateData.currentPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
    }
    
    if (stripeSubscription.current_period_end) {
      updateData.currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
    }
    
    // Handle canceled_at
    if (stripeSubscription.canceled_at) {
      updateData.canceledAt = new Date(stripeSubscription.canceled_at * 1000);
    } else if (mappedStatus !== 'CANCELED') {
      // Only clear canceledAt if status is not CANCELED
      updateData.canceledAt = null;
    }
    
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: updateData
    });
    
    console.log('[Stripe Webhook] ✅ Subscription updated:', {
      subscriptionId: subscription.id,
      status: mappedStatus,
      stripeStatus: stripeSubscription.status
    });
    
  } catch (error) {
    console.error('[Stripe Webhook] ❌ Error processing subscription.updated:', error);
    throw error;
  }
}

/**
 * Handle customer.subscription.deleted event
 * Subscription was canceled/deleted
 */
export async function onSubscriptionDeleted(stripeSubscription) {
  console.log('[Stripe Webhook] Processing customer.subscription.deleted:', {
    subscriptionId: stripeSubscription.id
  });
  
  const subscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: stripeSubscription.id },
    include: { user: true }
  });
  
  if (!subscription) {
    console.warn('[Stripe Webhook] ⚠️ Subscription not found in database:', stripeSubscription.id);
    return;
  }
  
  try {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'CANCELED',
        canceledAt: new Date()
      }
    });
    
    console.log('[Stripe Webhook] ✅ Subscription canceled:', {
      subscriptionId: subscription.id,
      status: 'CANCELED'
    });
    
    // Send cancellation confirmation email
    if (subscription.user.email) {
      await sendEmail({
        to: subscription.user.email,
        subject: 'Subscription Canceled - MAY',
        html: `
          <h2>Subscription Canceled</h2>
          <p>Your subscription has been canceled.</p>
          <p>You will have access until the end of your current billing period.</p>
          <p>We're sorry to see you go! If you'd like to reactivate, just let us know.</p>
        `
      }).catch(err => console.error('[Email] Failed to send cancellation email:', err));
    }
    
  } catch (error) {
    console.error('[Stripe Webhook] ❌ Error processing subscription.deleted:', error);
    throw error;
  }
}

/**
 * Handle customer.subscription.trial_will_end event
 * @deprecated Trial plan has been removed. This handler is kept for backwards compatibility.
 */
export async function onSubscriptionTrialWillEnd(stripeSubscription) {
  console.log('[Stripe Webhook] Ignoring trial_will_end event (trial plan removed):', {
    subscriptionId: stripeSubscription.id
  });
  // No-op - trial plan has been removed
}

// Export all handlers
export default {
  onInvoicePaid,
  onInvoicePaymentFailed,
  onSubscriptionUpdated,
  onSubscriptionDeleted,
  onSubscriptionTrialWillEnd,
};
