/**
 * Plan Service
 * Handles plan-related business logic, limit checking, and validations
 */

import { prisma } from '../lib/prisma.js';
import { getPlanConfig, getUpgradeOptions } from '../config/plans.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Get active subscription for user
 * @param {string} userId - User ID
 * @returns {Promise<object>} Subscription object
 */
export async function getActiveSubscription(userId) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId }
  });

  if (!subscription) {
    // For pay-per-use, user doesn't need a subscription
    // Return a virtual subscription object
    return {
      userId,
      planId: 'pay_per_use',
      status: 'ativo',
      billingCycle: 'per_invoice'
    };
  }

  // For subscription plans, must be active
  if (subscription.status !== 'ativo' && subscription.planId !== 'pay_per_use') {
    throw new AppError('Subscription required', 403, 'SUBSCRIPTION_REQUIRED');
  }

  return subscription;
}

/**
 * Get user's current plan (with fallback to pay-per-use)
 * @param {string} userId - User ID
 * @returns {Promise<string>} Plan ID
 */
export async function getUserPlanId(userId) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: { 
      planId: true, 
      status: true,
      trialEndsAt: true
    }
  });

  // If no subscription, default to pay-per-use
  if (!subscription) {
    return 'pay_per_use';
  }

  // Handle trial status - return 'trial' plan
  if (subscription.status === 'trial') {
    // Check if trial is still valid
    if (subscription.trialEndsAt && new Date() > new Date(subscription.trialEndsAt)) {
      // Trial expired, but subscription still shows as trial
      // This shouldn't happen normally, but handle it gracefully
      return subscription.planId || 'pay_per_use';
    }
    return 'trial';
  }

  // Handle active subscription
  if (subscription.status === 'ativo') {
    return subscription.planId || 'pay_per_use';
  }

  // Handle pending subscription - check if user is in trial period
  if (subscription.status === 'pending') {
    // If there's a trial end date and it hasn't passed, user is still in trial
    if (subscription.trialEndsAt && new Date() <= new Date(subscription.trialEndsAt)) {
      return 'trial';
    }
    // Otherwise, pending payment - use the plan they're trying to subscribe to
    return subscription.planId || 'pay_per_use';
  }

  // For canceled, inadimplente, or other statuses, default to pay-per-use
  return 'pay_per_use';
}

/**
 * Check company limit for user's plan
 * @param {string} userId - User ID
 * @returns {Promise<object>} Limit check result
 */
export async function checkCompanyLimit(userId) {
  const planId = await getUserPlanId(userId);
  const planConfig = getPlanConfig(planId);

  if (!planConfig) {
    throw new AppError('Invalid plan configuration', 500, 'INVALID_PLAN_CONFIG');
  }

  if (planConfig.maxCompanies === null) {
    return { 
      allowed: true, 
      unlimited: true,
      current: 0,
      max: null,
      remaining: null
    };
  }

  const companyCount = await prisma.company.count({
    where: { userId }
  });

  const result = {
    allowed: companyCount < planConfig.maxCompanies,
    unlimited: false,
    current: companyCount,
    max: planConfig.maxCompanies,
    remaining: Math.max(0, planConfig.maxCompanies - companyCount),
    upgradeOptions: getUpgradeOptions(planId)
  };

  return result;
}

/**
 * Check invoice limit for user's plan
 * @param {string} userId - User ID
 * @returns {Promise<object>} Limit check result
 */
export async function checkInvoiceLimit(userId) {
  const planId = await getUserPlanId(userId);
  const planConfig = getPlanConfig(planId);

  if (!planConfig) {
    throw new AppError('Invalid plan configuration', 500, 'INVALID_PLAN_CONFIG');
  }

  if (planConfig.maxInvoicesPerMonth === null) {
    return { 
      allowed: true, 
      unlimited: true,
      current: 0,
      max: null,
      remaining: null
    };
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Count ALL invoices emitted this month (not just authorized ones)
  // This includes: autorizada, enviada, processando, pendente, rejeitada, cancelada
  // We exclude only 'rascunho' (draft) as those are not actual emission attempts
  const invoiceCount = await prisma.invoice.count({
    where: {
      company: {
        userId: userId
      },
      status: { 
        notIn: ['rascunho'] // Only exclude drafts - all other statuses count towards limit
      },
      dataEmissao: {
        gte: startOfMonth,
        lte: endOfMonth
      }
    }
  });

  const result = {
    allowed: invoiceCount < planConfig.maxInvoicesPerMonth,
    unlimited: false,
    current: invoiceCount,
    max: planConfig.maxInvoicesPerMonth,
    remaining: Math.max(0, planConfig.maxInvoicesPerMonth - invoiceCount),
    upgradeOptions: getUpgradeOptions(planId)
  };

  return result;
}

/**
 * Validate CNPJ uniqueness
 * @param {string} cnpj - CNPJ to validate
 * @throws {AppError} If CNPJ already exists
 */
export async function validateCNPJUniqueness(cnpj) {
  const normalizedCnpj = cnpj.replace(/\D/g, '');
  
  const existing = await prisma.company.findUnique({
    where: { cnpj: normalizedCnpj }
  });

  if (existing) {
    throw new AppError(
      'Este CNPJ já está cadastrado no sistema',
      409,
      'CNPJ_ALREADY_EXISTS',
      {
        existingCompanyId: existing.id,
        existingUserId: existing.userId
      }
    );
  }

  return true;
}

/**
 * Validate target audience (MEI, Simples Nacional, no employees)
 * Returns warning but doesn't block access
 * @param {string} regimeTributario - Tax regime
 * @param {boolean} hasEmployees - Whether company has employees
 * @returns {object} Validation result with warning if applicable
 */
export function validateTargetAudience(regimeTributario, hasEmployees = false) {
  const allowedRegimes = ['MEI', 'Simples Nacional'];
  const warnings = [];

  if (!allowedRegimes.includes(regimeTributario)) {
    warnings.push({
      type: 'regime',
      message: 'Este sistema é otimizado para MEI e Simples Nacional. Outros regimes podem ter limitações.'
    });
  }

  if (hasEmployees) {
    warnings.push({
      type: 'employees',
      message: 'Este sistema é projetado para empresas sem funcionários. Empresas com funcionários podem ter limitações.'
    });
  }

  return {
    valid: true, // Never block, just warn
    warnings: warnings.length > 0 ? warnings : null
  };
}

/**
 * Get plan limits summary for user
 * @param {string} userId - User ID
 * @returns {Promise<object>} Limits summary
 */
export async function getPlanLimitsSummary(userId) {
  const planId = await getUserPlanId(userId);
  const planConfig = getPlanConfig(planId);
  const companyLimit = await checkCompanyLimit(userId);
  const invoiceLimit = await checkInvoiceLimit(userId);

  return {
    planId,
    planName: planConfig.name,
    companyLimit,
    invoiceLimit,
    upgradeOptions: getUpgradeOptions(planId)
  };
}

/**
 * Check pay-per-use balance (pending payments)
 * For pay-per-use plan, check if user has any unpaid invoice usage records
 * @param {string} userId - User ID
 * @returns {Promise<object>} Balance check result
 */
export async function checkPayPerUseBalance(userId) {
  const planId = await getUserPlanId(userId);
  
  // Only check for pay-per-use plan
  if (planId !== 'pay_per_use') {
    return {
      allowed: true,
      isPayPerUse: false,
      pendingPayments: 0,
      totalPending: 0
    };
  }

  // Count pending payments
  const pendingUsages = await prisma.invoiceUsage.count({
    where: {
      userId,
      status: 'pending_payment'
    }
  });

  // Calculate total pending amount
  const pendingUsagesWithAmount = await prisma.invoiceUsage.findMany({
    where: {
      userId,
      status: 'pending_payment'
    },
    select: {
      amount: true
    }
  });

  const totalPending = pendingUsagesWithAmount.reduce((sum, usage) => sum + usage.amount, 0);

  // For pay-per-use, we allow issuance but user must pay before invoice is created
  // However, we should warn if there are many pending payments
  return {
    allowed: true, // Always allowed, but payment required before invoice creation
    isPayPerUse: true,
    pendingPayments: pendingUsages,
    totalPending: totalPending / 100, // Convert cents to reais
    warning: pendingUsages > 3 ? `Você tem ${pendingUsages} pagamentos pendentes. Complete os pagamentos antes de emitir mais notas.` : null
  };
}

/**
 * Comprehensive plan limits validation before invoice issuance
 * Checks all limits: invoice limit, pay-per-use balance
 * NOTE: Company limit is NOT checked here - it only applies when CREATING new companies, not when using existing ones
 * @param {string} userId - User ID
 * @param {string} companyId - Company ID (optional, for verification that company exists and belongs to user)
 * @returns {Promise<object>} Validation result with detailed error messages
 */
export async function validatePlanLimitsForIssuance(userId, companyId = null) {
  const planId = await getUserPlanId(userId);
  const planConfig = getPlanConfig(planId);
  const errors = [];
  const warnings = [];
  const suggestions = [];

  // 1. Check invoice limit
  const invoiceLimit = await checkInvoiceLimit(userId);
  if (!invoiceLimit.allowed) {
    errors.push({
      code: 'INVOICE_LIMIT_REACHED',
      message: `Você atingiu o limite de ${invoiceLimit.max} notas fiscais deste mês.`,
      details: {
        current: invoiceLimit.current,
        max: invoiceLimit.max,
        remaining: invoiceLimit.remaining
      },
      suggestions: []
    });

    // Add upgrade suggestions
    if (invoiceLimit.upgradeOptions && invoiceLimit.upgradeOptions.length > 0) {
      invoiceLimit.upgradeOptions.forEach(plan => {
        errors[errors.length - 1].suggestions.push({
          type: 'upgrade',
          planId: plan.planId,
          planName: plan.name,
          message: `Faça upgrade para ${plan.name} e tenha ${plan.maxInvoicesPerMonth === null ? 'notas ilimitadas' : `até ${plan.maxInvoicesPerMonth} notas/mês`}`
        });
      });
    }

    // Add pay-per-use suggestion if not already on it
    if (planId !== 'pay_per_use') {
      errors[errors.length - 1].suggestions.push({
        type: 'pay_per_use',
        message: 'Ou use a opção Pay per Use (R$9 por nota) para emitir sem limites mensais'
      });
    }
  } else if (!invoiceLimit.unlimited && invoiceLimit.remaining <= 5) {
    // Warning when close to limit
    warnings.push({
      code: 'INVOICE_LIMIT_WARNING',
      message: `Você tem apenas ${invoiceLimit.remaining} nota${invoiceLimit.remaining > 1 ? 's' : ''} restante${invoiceLimit.remaining > 1 ? 's' : ''} este mês.`,
      current: invoiceLimit.current,
      max: invoiceLimit.max,
      remaining: invoiceLimit.remaining
    });
  }

  // 2. Verify company exists and belongs to user (if companyId provided)
  // NOTE: We do NOT check company limit here - company limit only applies when CREATING new companies
  // Users should be able to emit invoices for existing companies even if they've reached their company limit
  if (companyId) {
    const company = await prisma.company.findFirst({
      where: {
        id: companyId,
        userId: userId
      },
      select: { id: true }
    });

    if (!company) {
      errors.push({
        code: 'COMPANY_NOT_FOUND',
        message: 'Empresa não encontrada ou não pertence ao usuário.',
        suggestions: []
      });
    }
  }

  // 3. Check pay-per-use balance
  const payPerUseBalance = await checkPayPerUseBalance(userId);
  if (payPerUseBalance.isPayPerUse && payPerUseBalance.pendingPayments > 0) {
    if (payPerUseBalance.pendingPayments > 3) {
      errors.push({
        code: 'PAY_PER_USE_PENDING_PAYMENTS',
        message: `Você tem ${payPerUseBalance.pendingPayments} pagamentos pendentes (R$ ${payPerUseBalance.totalPending.toFixed(2)}). Complete os pagamentos antes de emitir mais notas.`,
        details: {
          pendingPayments: payPerUseBalance.pendingPayments,
          totalPending: payPerUseBalance.totalPending
        },
        suggestions: [{
          type: 'complete_payments',
          message: 'Acesse "Notas Fiscais" para completar os pagamentos pendentes'
        }]
      });
    } else {
      warnings.push({
        code: 'PAY_PER_USE_PENDING_WARNING',
        message: `Você tem ${payPerUseBalance.pendingPayments} pagamento${payPerUseBalance.pendingPayments > 1 ? 's' : ''} pendente${payPerUseBalance.pendingPayments > 1 ? 's' : ''}. Complete o pagamento para finalizar a emissão.`,
        pendingPayments: payPerUseBalance.pendingPayments
      });
    }
  }

  return {
    valid: errors.length === 0,
    planId,
    planName: planConfig.name,
    errors,
    warnings,
    invoiceLimit,
    companyLimit: companyId ? await checkCompanyLimit(userId) : null,
    payPerUseBalance,
    upgradeOptions: getUpgradeOptions(planId)
  };
}
