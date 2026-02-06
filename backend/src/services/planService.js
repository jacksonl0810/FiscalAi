/**
 * Plan Service
 * Handles plan-related business logic, limit checking, and validations
 * 
 * FINAL PLAN STRUCTURE:
 * - Pay per Use: R$9/invoice, 1 company, unlimited invoices (requires payment per invoice)
 * - Essential: R$79/month, 2 companies, 30 invoices/month
 * - Professional: R$149/month, 5 companies, 100 invoices/month
 * - Accountant: Custom, unlimited companies, unlimited invoices
 */

import { prisma } from '../lib/prisma.js';
import { getPlanConfig, getUpgradeOptions, isPayPerUsePlan, getPayPerUseInvoicePrice } from '../config/plans.js';
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
    // No subscription - return null (user needs to subscribe)
    return null;
  }

  // For subscription plans, must be active
  if (subscription.status !== 'ACTIVE') {
    throw new AppError('Subscription required', 403, 'SUBSCRIPTION_REQUIRED');
  }

  return subscription;
}

/**
 * Get user's current plan
 * @param {string} userId - User ID
 * @returns {Promise<string>} Plan ID
 */
export async function getUserPlanId(userId) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: { 
      planId: true, 
      status: true
    }
  });

  // If no subscription, default to pay_per_use (new default for no subscription)
  if (!subscription) {
    return 'pay_per_use';
  }

  // Handle status based on SubscriptionStatus enum
  switch (subscription.status) {
    case 'ACTIVE':
      return subscription.planId || 'essential';

    case 'PENDING':
      return subscription.planId || 'pay_per_use';

    case 'PAST_DUE':
    case 'CANCELED':
    case 'EXPIRED':
    default:
      // For inactive statuses, return pay_per_use (can still use with per-invoice payment)
      return 'pay_per_use';
  }
}

/**
 * Check if user has Pay per Use plan
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if pay per use
 */
export async function isUserOnPayPerUse(userId) {
  const planId = await getUserPlanId(userId);
  return isPayPerUsePlan(planId);
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

  // Pay per Use plan - always "allowed" but requires payment per invoice
  if (planConfig.isPayPerUse) {
    return {
      allowed: true,
      unlimited: true,
      isPayPerUse: true,
      perInvoicePrice: planConfig.perInvoicePrice,
      perInvoicePriceFormatted: `R$ ${(planConfig.perInvoicePrice / 100).toFixed(2).replace('.', ',')}`,
      current: 0,
      used: 0,
      max: null,
      remaining: null,
      requiresPayment: true,
      upgradeOptions: getUpgradeOptions(planId)
    };
  }

  if (planConfig.maxInvoicesPerMonth === null) {
    return {
      allowed: true,
      unlimited: true,
      isPayPerUse: false,
      current: 0,
      used: 0,
      max: null,
      remaining: null,
      requiresPayment: false,
      upgradeOptions: getUpgradeOptions(planId)
    };
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Count ALL invoices emitted this month (not just authorized ones)
  const invoiceCount = await prisma.invoice.count({
    where: {
      company: {
        userId: userId
      },
      status: {
        notIn: ['rascunho'] // Only exclude drafts
      },
      OR: [
        {
          dataEmissao: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        },
        {
          dataEmissao: null,
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        }
      ]
    }
  });

  const result = {
    allowed: invoiceCount < planConfig.maxInvoicesPerMonth,
    unlimited: false,
    isPayPerUse: false,
    current: invoiceCount,
    used: invoiceCount,
    max: planConfig.maxInvoicesPerMonth,
    remaining: Math.max(0, planConfig.maxInvoicesPerMonth - invoiceCount),
    requiresPayment: false,
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
    isPayPerUse: planConfig.isPayPerUse || false,
    companyLimit,
    invoiceLimit,
    upgradeOptions: getUpgradeOptions(planId)
  };
}

/**
 * Check if Pay per Use payment is required and pending
 * @param {string} userId - User ID
 * @param {string} companyId - Company ID
 * @returns {Promise<object>} Payment requirement status
 */
export async function checkPayPerUsePaymentStatus(userId, companyId) {
  const planId = await getUserPlanId(userId);
  const planConfig = getPlanConfig(planId);

  if (!planConfig.isPayPerUse) {
    return {
      required: false,
      planId,
      message: 'Plano atual não requer pagamento por nota'
    };
  }

  // Check for pending invoice usage payments
  const pendingPayments = await prisma.invoiceUsage.count({
    where: {
      userId,
      companyId,
      status: 'pending_payment'
    }
  });

  if (pendingPayments > 0) {
    return {
      required: true,
      blocked: true,
      pendingPayments,
      planId,
      perInvoicePrice: planConfig.perInvoicePrice,
      message: `Você tem ${pendingPayments} pagamento(s) pendente(s). Regularize para continuar emitindo.`
    };
  }

  return {
    required: true,
    blocked: false,
    pendingPayments: 0,
    planId,
    perInvoicePrice: planConfig.perInvoicePrice,
    perInvoicePriceFormatted: `R$ ${(planConfig.perInvoicePrice / 100).toFixed(2).replace('.', ',')}`,
    message: 'Pagamento de R$9,00 será cobrado por esta nota fiscal.'
  };
}

/**
 * Create invoice usage record for Pay per Use
 * @param {string} userId - User ID
 * @param {string} companyId - Company ID
 * @param {string} invoiceId - Invoice ID (optional, set after invoice is issued)
 * @returns {Promise<object>} Invoice usage record
 */
export async function createPayPerUseUsage(userId, companyId, invoiceId = null) {
  const planConfig = getPlanConfig('pay_per_use');
  const now = new Date();

  const usage = await prisma.invoiceUsage.create({
    data: {
      userId,
      companyId,
      invoiceId,
      planId: 'pay_per_use',
      periodYear: now.getFullYear(),
      periodMonth: now.getMonth() + 1,
      amount: planConfig.perInvoicePrice,
      status: 'pending_payment'
    }
  });

  return usage;
}

/**
 * Mark Pay per Use payment as completed
 * @param {string} usageId - Invoice usage ID
 * @param {string} paymentOrderId - Payment order ID from payment provider
 * @returns {Promise<object>} Updated usage record
 */
export async function completePayPerUsePayment(usageId, paymentOrderId) {
  const usage = await prisma.invoiceUsage.update({
    where: { id: usageId },
    data: {
      status: 'paid',
      paymentOrderId
    }
  });

  return usage;
}

/**
 * Comprehensive plan limits validation before invoice issuance
 * Checks all limits: invoice limit, pay-per-use status
 * NOTE: Company limit is NOT checked here - it only applies when CREATING new companies
 * @param {string} userId - User ID
 * @param {string} companyId - Company ID (optional, for verification that company exists and belongs to user)
 * @returns {Promise<object>} Validation result with detailed error messages
 */
export async function validatePlanLimitsForIssuance(userId, companyId = null) {
  const planId = await getUserPlanId(userId);
  const planConfig = getPlanConfig(planId);
  const errors = [];
  const warnings = [];

  // 1. Check if Pay per Use plan
  if (planConfig?.isPayPerUse) {
    // For Pay per Use, check for pending payments that would block issuance
    if (companyId) {
      const paymentStatus = await checkPayPerUsePaymentStatus(userId, companyId);
      if (paymentStatus.blocked) {
        errors.push({
          code: 'PAY_PER_USE_PENDING_PAYMENTS',
          message: paymentStatus.message,
          details: {
            pendingPayments: paymentStatus.pendingPayments,
            perInvoicePrice: paymentStatus.perInvoicePrice
          },
          suggestions: [{
            type: 'payment',
            message: 'Regularize os pagamentos pendentes para continuar emitindo notas.'
          }]
        });
      } else {
        // Add warning about per-invoice charge
        warnings.push({
          code: 'PAY_PER_USE_CHARGE',
          message: paymentStatus.message,
          perInvoicePrice: paymentStatus.perInvoicePrice,
          perInvoicePriceFormatted: paymentStatus.perInvoicePriceFormatted
        });
      }
    }

    return {
      valid: errors.length === 0,
      planId,
      planName: planConfig?.name || 'Pay per Use',
      isPayPerUse: true,
      perInvoicePrice: planConfig.perInvoicePrice,
      perInvoicePriceFormatted: `R$ ${(planConfig.perInvoicePrice / 100).toFixed(2).replace('.', ',')}`,
      errors,
      warnings,
      invoiceLimit: {
        allowed: true,
        unlimited: true,
        isPayPerUse: true,
        requiresPayment: true
      },
      companyLimit: companyId ? await checkCompanyLimit(userId) : null,
      upgradeOptions: getUpgradeOptions(planId)
    };
  }

  // 2. Check invoice limit for subscription plans
  const invoiceLimit = await checkInvoiceLimit(userId);
  if (!invoiceLimit.allowed) {
    const error = {
      code: 'INVOICE_LIMIT_REACHED',
      message: `Você atingiu o limite de ${invoiceLimit.max} notas fiscais deste mês.`,
      details: {
        current: invoiceLimit.current,
        max: invoiceLimit.max,
        remaining: invoiceLimit.remaining
      },
      suggestions: []
    };

    // Add upgrade suggestions
    if (invoiceLimit.upgradeOptions && invoiceLimit.upgradeOptions.length > 0) {
      invoiceLimit.upgradeOptions.forEach(plan => {
        error.suggestions.push({
          type: 'upgrade',
          planId: plan.planId,
          planName: plan.name,
          message: `Faça upgrade para ${plan.name} e tenha ${plan.maxInvoicesPerMonth === null ? 'notas ilimitadas' : `até ${plan.maxInvoicesPerMonth} notas/mês`}`
        });
      });
    }

    // Add Pay per Use as alternative
    error.suggestions.push({
      type: 'pay_per_use',
      planId: 'pay_per_use',
      planName: 'Pay per Use',
      message: 'Ou use o Pay per Use (R$9 por nota) para emitir notas adicionais.'
    });

    errors.push(error);
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

  // 3. Verify company exists and belongs to user (if companyId provided)
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

  return {
    valid: errors.length === 0,
    planId,
    planName: planConfig?.name || 'Pay per Use',
    isPayPerUse: false,
    errors,
    warnings,
    invoiceLimit,
    companyLimit: companyId ? await checkCompanyLimit(userId) : null,
    upgradeOptions: getUpgradeOptions(planId)
  };
}

/**
 * Get recommended plan based on usage
 * @param {string} userId - User ID
 * @returns {Promise<object>} Recommended plan
 */
export async function getRecommendedPlan(userId) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Get current month invoice count
  const invoiceCount = await prisma.invoice.count({
    where: {
      company: {
        userId: userId
      },
      createdAt: {
        gte: startOfMonth,
        lte: endOfMonth
      }
    }
  });

  // Get company count
  const companyCount = await prisma.company.count({
    where: { userId }
  });

  // Recommendation logic
  if (invoiceCount <= 5) {
    return {
      planId: 'pay_per_use',
      reason: 'Com poucos invoices por mês, Pay per Use é mais econômico.'
    };
  } else if (invoiceCount <= 30 && companyCount <= 2) {
    return {
      planId: 'essential',
      reason: 'Essential oferece até 30 notas/mês e 2 empresas por R$79/mês.'
    };
  } else if (invoiceCount <= 100 && companyCount <= 5) {
    return {
      planId: 'professional',
      reason: 'Professional oferece até 100 notas/mês e 5 empresas por R$149/mês.'
    };
  } else {
    return {
      planId: 'accountant',
      reason: 'Com alto volume, o plano Contador oferece uso ilimitado.'
    };
  }
}
