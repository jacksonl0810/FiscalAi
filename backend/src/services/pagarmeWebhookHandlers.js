/**
 * Pagar.me Webhook Handlers (v5 Subscriptions API)
 * 
 * Single-source-of-truth for subscription state management
 * Invoice-first philosophy: ONLY invoice.paid activates subscriptions
 * 
 * State machine:
 * PENDING → invoice.paid → ACTIVE
 * ACTIVE → invoice.payment_failed → PAST_DUE
 * PAST_DUE → invoice.paid → ACTIVE (auto-recovery)
 * ANY → subscription.canceled → CANCELED
 */

import { prisma } from '../index.js';
import { sendEmail } from './email.js';

/**
 * Handle invoice.paid event
 * ✅ ONLY activation point for subscriptions
 * This is the single source of truth for "subscription is paid and active"
 * 
 * @param {object} event - Webhook event
 */
export async function onInvoicePaid(event) {
  const invoice = event.data;
  const subscriptionId = invoice.subscription?.id;
  
  console.log('[Webhook] invoice.paid received:', {
    invoiceId: invoice.id,
    subscriptionId,
    amount: invoice.amount,
    status: invoice.status
  });

  if (!subscriptionId) {
    console.warn('[Webhook] No subscription ID in invoice.paid event');
    return { status: 'no_subscription_id' };
  }

  // Find subscription by Pagar.me subscription ID
  const subscription = await prisma.subscription.findFirst({
    where: { pagarMeSubscriptionId: subscriptionId },
    include: { user: true }
  });

  if (!subscription) {
    console.warn('[Webhook] Subscription not found:', subscriptionId);
    return { status: 'subscription_not_found', subscriptionId };
  }

  // ✅ IDEMPOTENCY: Check if this invoice was already processed
  const existingPayment = await prisma.payment.findUnique({
    where: { pagarMeInvoiceId: invoice.id }
  });

  if (existingPayment) {
    console.log('[Webhook] Invoice already processed:', invoice.id);
    return { status: 'already_processed', invoiceId: invoice.id };
  }

  // Extract period dates from invoice cycle
  const cycle = invoice.cycle || invoice.subscription?.current_cycle;
  const periodStart = cycle?.start_at ? new Date(cycle.start_at) : new Date();
  const periodEnd = cycle?.end_at ? new Date(cycle.end_at) : new Date();
  const nextBilling = invoice.subscription?.next_billing_at 
    ? new Date(invoice.subscription.next_billing_at)
    : new Date(periodEnd.getTime() + 24 * 60 * 60 * 1000); // +1 day after period end

  const amount = invoice.amount ? invoice.amount / 100 : 0;

  // ✅ ATOMIC UPDATE: Activate subscription + record payment
  await prisma.$transaction([
    // Activate subscription
    prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'ACTIVE',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        nextBillingAt: nextBilling
      }
    }),

    // Record payment
    prisma.payment.create({
      data: {
        subscriptionId: subscription.id,
        pagarMeInvoiceId: invoice.id,
        pagarMeTransactionId: invoice.charge?.id || invoice.id,
        amount,
        status: 'PAID',
        paymentMethod: invoice.payment_method || 'credit_card',
        paidAt: new Date()
      }
    }),

    // Create success notification
    prisma.notification.create({
      data: {
        userId: subscription.userId,
        titulo: '✅ Pagamento Confirmado',
        mensagem: `Seu pagamento de R$ ${amount.toFixed(2)} foi confirmado! Sua assinatura está ativa.`,
        tipo: 'sucesso'
      }
    })
  ]);

  // Send confirmation email
  if (subscription.user?.email) {
    try {
      await sendEmail({
        to: subscription.user.email,
        subject: '✅ Pagamento Confirmado - MAY',
        html: `
          <h2>Olá ${subscription.user.name || 'Cliente'},</h2>
          <p>Seu pagamento de <strong>R$ ${amount.toFixed(2)}</strong> foi confirmado com sucesso!</p>
          <p>Sua assinatura está ativa até <strong>${periodEnd.toLocaleDateString('pt-BR')}</strong>.</p>
          <p>Obrigado por usar o MAY!</p>
        `
      });
    } catch (emailError) {
      console.error('[Webhook] Error sending confirmation email:', emailError.message);
    }
  }

  console.log('[Webhook] ✅ invoice.paid processed successfully:', {
    invoiceId: invoice.id,
    subscriptionId: subscription.id,
    status: 'ACTIVE',
    amount,
    periodEnd
  });

  return {
    status: 'activated',
    subscriptionId: subscription.id,
    amount
  };
}

/**
 * Handle invoice.payment_failed event
 * ⚠️ Mark as PAST_DUE (NOT canceled - allow retries)
 * 
 * @param {object} event - Webhook event
 */
export async function onInvoicePaymentFailed(event) {
  const invoice = event.data;
  const subscriptionId = invoice.subscription?.id;
  const charge = invoice.charge;

  console.log('[Webhook] invoice.payment_failed received:', {
    invoiceId: invoice.id,
    subscriptionId,
    chargeStatus: charge?.status
  });

  if (!subscriptionId) {
    console.warn('[Webhook] No subscription ID in invoice.payment_failed event');
    return { status: 'no_subscription_id' };
  }

  const subscription = await prisma.subscription.findFirst({
    where: { pagarMeSubscriptionId: subscriptionId },
    include: { user: true }
  });

  if (!subscription) {
    console.warn('[Webhook] Subscription not found:', subscriptionId);
    return { status: 'subscription_not_found', subscriptionId };
  }

  // Extract error message from gateway response
  const gatewayResponse = charge?.last_transaction?.gateway_response || {};
  const errorMessage = gatewayResponse.errors?.[0]?.message || 'Pagamento recusado';

  // ✅ ATOMIC UPDATE: Mark as past due + record failed payment
  const transactionId = charge?.id || invoice.id;
  const amount = invoice.amount ? invoice.amount / 100 : 0;

  await prisma.$transaction([
    // Mark subscription as PAST_DUE (not canceled - give user chance to fix)
    prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'PAST_DUE'
      }
    }),

    // Record failed payment attempt
    prisma.payment.upsert({
      where: { pagarMeInvoiceId: invoice.id },
      create: {
        subscriptionId: subscription.id,
        pagarMeInvoiceId: invoice.id,
        pagarMeTransactionId: transactionId,
        amount,
        status: 'FAILED',
        paymentMethod: invoice.payment_method || 'credit_card',
        failedAt: new Date(),
        failureReason: errorMessage
      },
      update: {
        status: 'FAILED',
        failedAt: new Date(),
        failureReason: errorMessage
      }
    }),

    // Create warning notification
    prisma.notification.create({
      data: {
        userId: subscription.userId,
        titulo: '⚠️ Problema com sua Assinatura',
        mensagem: `Seu pagamento falhou: ${errorMessage}. Por favor, atualize seu método de pagamento.`,
        tipo: 'alerta'
      }
    })
  ]);

  // Send failure email
  if (subscription.user?.email) {
    try {
      await sendEmail({
        to: subscription.user.email,
        subject: '⚠️ Problema com sua Assinatura - MAY',
        html: `
          <h2>Olá ${subscription.user.name || 'Cliente'},</h2>
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
    invoiceId: invoice.id,
    subscriptionId: subscription.id,
    status: 'PAST_DUE',
    errorMessage
  });

  return {
    status: 'marked_past_due',
    subscriptionId: subscription.id,
    errorMessage
  };
}

/**
 * Handle subscription.canceled event
 * ❌ Final cancellation - revoke access
 * 
 * @param {object} event - Webhook event
 */
export async function onSubscriptionCanceled(event) {
  const subscriptionData = event.data;
  const subscriptionId = subscriptionData.id;

  console.log('[Webhook] subscription.canceled received:', {
    subscriptionId,
    canceledAt: subscriptionData.canceled_at
  });

  const subscription = await prisma.subscription.findFirst({
    where: { pagarMeSubscriptionId: subscriptionId },
    include: { user: true }
  });

  if (!subscription) {
    console.warn('[Webhook] Subscription not found:', subscriptionId);
    return { status: 'subscription_not_found', subscriptionId };
  }

  // Cancel subscription
  await prisma.$transaction([
    prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'CANCELED',
        canceledAt: subscriptionData.canceled_at 
          ? new Date(subscriptionData.canceled_at)
          : new Date()
      }
    }),

    prisma.notification.create({
      data: {
        userId: subscription.userId,
        titulo: 'Assinatura Cancelada',
        mensagem: 'Sua assinatura foi cancelada. Você pode reativar a qualquer momento.',
        tipo: 'info'
      }
    })
  ]);

  console.log('[Webhook] ✅ subscription.canceled processed:', {
    subscriptionId: subscription.id,
    status: 'CANCELED'
  });

  return {
    status: 'canceled',
    subscriptionId: subscription.id
  };
}

/**
 * Handle subscription.updated event
 * 🔄 Sync metadata only (no state changes)
 * 
 * @param {object} event - Webhook event
 */
export async function onSubscriptionUpdated(event) {
  const subscriptionData = event.data;
  const subscriptionId = subscriptionData.id;

  console.log('[Webhook] subscription.updated received:', {
    subscriptionId,
    status: subscriptionData.status
  });

  const subscription = await prisma.subscription.findFirst({
    where: { pagarMeSubscriptionId: subscriptionId }
  });

  if (!subscription) {
    console.warn('[Webhook] Subscription not found:', subscriptionId);
    return { status: 'subscription_not_found', subscriptionId };
  }

  // Sync metadata only (don't change status - that's invoice.paid's job)
  const cycle = subscriptionData.current_cycle;
  const updateData = {};

  if (cycle?.start_at) updateData.currentPeriodStart = new Date(cycle.start_at);
  if (cycle?.end_at) updateData.currentPeriodEnd = new Date(cycle.end_at);
  if (subscriptionData.next_billing_at) {
    updateData.nextBillingAt = new Date(subscriptionData.next_billing_at);
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: updateData
    });
  }

  console.log('[Webhook] ✅ subscription.updated processed:', {
    subscriptionId: subscription.id,
    synced: Object.keys(updateData)
  });

  return {
    status: 'synced',
    subscriptionId: subscription.id
  };
}
