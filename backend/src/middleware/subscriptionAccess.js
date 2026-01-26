/**
 * Subscription Access Control Middleware
 * 
 * Restricts access based on user subscription status
 * Only allows access for users with 'ativo' or 'trial' status
 * 
 * IMPORTANT: Trial users can access even if they have a pending payment
 * 
 * Usage:
 *   router.use(requireActiveSubscription);  // Apply to all routes
 *   router.get('/route', requireActiveSubscription, handler);  // Apply to specific route
 */

import { prisma } from '../index.js';
import { AppError } from './errorHandler.js';

/**
 * Helper: Check if user is in active trial period
 */
async function isUserInTrialPeriod(userId) {
  const now = new Date();
  
  // Check subscription trial
  const subscription = await prisma.subscription.findUnique({
    where: { userId }
  });
  
  if (subscription?.status === 'trial' && subscription?.trialEndsAt) {
    if (now <= new Date(subscription.trialEndsAt)) {
      return { valid: true, daysRemaining: Math.ceil((new Date(subscription.trialEndsAt) - now) / (1000 * 60 * 60 * 24)) };
    }
  }
  
  // Check user's trialStartedAt
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { trialStartedAt: true, createdAt: true, hasUsedTrial: true }
  });
  
  if (user?.trialStartedAt) {
    const trialEnd = new Date(user.trialStartedAt);
    trialEnd.setDate(trialEnd.getDate() + 7);
    if (now <= trialEnd) {
      return { valid: true, daysRemaining: Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)) };
    }
  }
  
  return { valid: false, daysRemaining: 0 };
}

/**
 * Middleware to check if user has active subscription
 * Allows: 'ativo', 'trial', or valid trial period
 * Blocks: 'inadimplente', 'cancelado', null (unless in trial)
 */
export async function requireActiveSubscription(req, res, next) {
  try {
    const userId = req.user.id;
    const now = new Date();
    
    const subscription = await prisma.subscription.findUnique({
      where: { userId }
    });

    // ✅ PRIORITY 1: Check if user is in active trial period
    // This takes precedence over pending payments
    const trialCheck = await isUserInTrialPeriod(userId);
    if (trialCheck.valid) {
      console.log(`[SubscriptionAccess] User ${userId} in trial period (${trialCheck.daysRemaining} days remaining)`);
      return next();
    }

    // If no subscription record
    if (!subscription) {
      // Check implicit trial period for new users
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { createdAt: true, hasUsedTrial: true }
      });
      
      const userCreatedAt = new Date(user?.createdAt || new Date());
      const implicitTrialEnd = new Date(userCreatedAt);
      implicitTrialEnd.setDate(implicitTrialEnd.getDate() + 7);

      if (now <= implicitTrialEnd && !user?.hasUsedTrial) {
        // Allow implicit trial access for brand new users
        return next();
      }

      throw new AppError(
        'Assinatura necessária para acessar este recurso. Por favor, assine um plano.',
        403,
        'SUBSCRIPTION_REQUIRED'
      );
    }

    // ✅ PRIORITY 2: Active subscription
    if (subscription.status === 'ativo') {
      return next();
    }

    // ✅ PRIORITY 3: Active trial subscription
    if (subscription.status === 'trial') {
      if (subscription.trialEndsAt && now > new Date(subscription.trialEndsAt)) {
        throw new AppError(
          'Período de teste expirado. Por favor, assine um plano.',
          403,
          'TRIAL_EXPIRED'
        );
      }
      return next();
    }

    // ✅ PRIORITY 4: Pending payment - already checked trial above, so block
    if (subscription.status === 'pending') {
      throw new AppError(
        'Pagamento pendente. Aguarde a confirmação ou tente novamente.',
        403,
        'PAYMENT_PENDING'
      );
    }

    // Handle inadimplente
    if (subscription.status === 'inadimplente') {
      throw new AppError(
        'Sua assinatura está inadimplente. Por favor, atualize seu método de pagamento.',
        403,
        'SUBSCRIPTION_DELINQUENT'
      );
    }

    // Handle canceled
    if (subscription.status === 'cancelado') {
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
 * Middleware to check if user has paid subscription (not trial)
 * Only allows: 'ativo'
 */
export async function requirePaidSubscription(req, res, next) {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.user.id }
    });

    if (!subscription || subscription.status !== 'ativo') {
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
