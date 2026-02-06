/**
 * Subscription Access Control Middleware
 * 
 * Restricts access based on user subscription status.
 * Accepts both Prisma enum values (ACTIVE, etc.) and legacy Portuguese (ativo).
 * 
 * Usage:
 *   router.use(requireActiveSubscription);  // Apply to all routes
 *   router.get('/route', requireActiveSubscription, handler);  // Apply to specific route
 */

import { prisma } from '../index.js';
import { AppError } from './errorHandler.js';

/** Statuses that grant access (DB enum + legacy) */
const ACTIVE_STATUSES = ['ACTIVE', 'ativo'];
const PENDING_STATUSES = ['PENDING', 'pending'];
const DELINQUENT_STATUSES = ['PAST_DUE', 'inadimplente'];
const CANCELED_STATUSES = ['CANCELED', 'cancelado'];
const EXPIRED_STATUSES = ['EXPIRED', 'expired'];

function isActive(s) { return s && ACTIVE_STATUSES.includes(s); }
function isPending(s) { return s && PENDING_STATUSES.includes(s); }
function isDelinquent(s) { return s && DELINQUENT_STATUSES.includes(s); }
function isCanceled(s) { return s && CANCELED_STATUSES.includes(s); }

/**
 * Middleware to check if user has active subscription
 * Allows: 'ativo' or 'ACTIVE'
 * Blocks: 'inadimplente', 'cancelado', null
 */
export async function requireActiveSubscription(req, res, next) {
  try {
    const userId = req.user.id;
    const now = new Date();
    
    const subscription = await prisma.subscription.findUnique({
      where: { userId }
    });

    // If no subscription record
    if (!subscription) {
      throw new AppError(
        'Assinatura necessária para acessar este recurso. Por favor, assine um plano.',
        403,
        'SUBSCRIPTION_REQUIRED'
      );
    }

    // ✅ PRIORITY 1: Active subscription (DB: ACTIVE or legacy: ativo)
    if (isActive(subscription.status)) {
      return next();
    }

    // ✅ PRIORITY 2: Pending payment - block
    if (isPending(subscription.status)) {
      throw new AppError(
        'Pagamento pendente. Aguarde a confirmação ou tente novamente.',
        403,
        'PAYMENT_PENDING'
      );
    }

    // Handle past_due / inadimplente
    if (isDelinquent(subscription.status)) {
      throw new AppError(
        'Sua assinatura está inadimplente. Por favor, atualize seu método de pagamento.',
        403,
        'SUBSCRIPTION_DELINQUENT'
      );
    }

    // Handle canceled (DB: CANCELED or legacy: cancelado)
    if (isCanceled(subscription.status)) {
      if (subscription.currentPeriodEnd) {
        const periodEnd = new Date(subscription.currentPeriodEnd);
        if (now <= periodEnd) {
          return next(); // Still in paid period
        }
      }
      
      throw new AppError(
        'Sua assinatura foi cancelada. Por favor, reative sua assinatura.',
        403,
        'SUBSCRIPTION_CANCELED'
      );
    }

    // EXPIRED: treat like canceled (no access after period end)
    if (subscription.status && EXPIRED_STATUSES.includes(subscription.status)) {
      throw new AppError(
        'Sua assinatura expirou. Por favor, assine novamente.',
        403,
        'SUBSCRIPTION_EXPIRED'
      );
    }

    throw new AppError(
      'Assinatura inválida. Por favor, entre em contato com o suporte.',
      403,
      'SUBSCRIPTION_INVALID'
    );
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('[SubscriptionAccess] Error:', error);
    throw new AppError(
      'Erro ao verificar assinatura',
      500,
      'SUBSCRIPTION_CHECK_ERROR'
    );
  }
}

/**
 * Middleware to check if user has paid subscription
 * Only allows: ACTIVE or legacy 'ativo'
 */
export async function requirePaidSubscription(req, res, next) {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.user.id }
    });

    if (!subscription || !isActive(subscription.status)) {
      throw new AppError(
        'Assinatura ativa necessária para acessar este recurso.',
        403,
        'PAID_SUBSCRIPTION_REQUIRED'
      );
    }

    return next();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      'Erro ao verificar assinatura',
      500,
      'SUBSCRIPTION_CHECK_ERROR'
    );
  }
}
