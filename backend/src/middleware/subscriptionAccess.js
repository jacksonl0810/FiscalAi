/**
 * Subscription Access Control Middleware
 * 
 * Restricts access based on user subscription status
 * Only allows access for users with 'ativo' or 'trial' status
 * 
 * Usage:
 *   router.use(requireActiveSubscription);  // Apply to all routes
 *   router.get('/route', requireActiveSubscription, handler);  // Apply to specific route
 */

import { prisma } from '../index.js';
import { AppError } from './errorHandler.js';

/**
 * Middleware to check if user has active subscription
 * Allows: 'ativo', 'trial'
 * Blocks: 'inadimplente', 'cancelado', null
 */
export async function requireActiveSubscription(req, res, next) {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.user.id }
    });

    // If no subscription, check if trial period is still valid
    if (!subscription) {
      // Allow trial access (new users get 7 days trial)
      const userCreatedAt = new Date(req.user.createdAt || new Date());
      const trialEndDate = new Date(userCreatedAt);
      trialEndDate.setDate(trialEndDate.getDate() + 7); // 7 days trial

      if (new Date() <= trialEndDate) {
        return next(); // Still in trial period
      }

      throw new AppError(
        'Assinatura necessária para acessar este recurso. Por favor, assine um plano.',
        403,
        'SUBSCRIPTION_REQUIRED'
      );
    }

    // Check subscription status
    if (subscription.status === 'ativo' || subscription.status === 'trial') {
      // Check if trial period has expired
      if (subscription.status === 'trial' && subscription.trialEndsAt) {
        if (new Date() > new Date(subscription.trialEndsAt)) {
          throw new AppError(
            'Período de teste expirado. Por favor, assine um plano.',
            403,
            'TRIAL_EXPIRED'
          );
        }
      }
      return next();
    }

    if (subscription.status === 'inadimplente') {
      throw new AppError(
        'Sua assinatura está inadimplente. Por favor, atualize seu método de pagamento.',
        403,
        'SUBSCRIPTION_DELINQUENT'
      );
    }

    if (subscription.status === 'cancelado') {
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
