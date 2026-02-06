/**
 * Plan Configuration - Final Production Plans
 * 
 * PLAN STRUCTURE (as per final business requirements):
 * 1. Pay per Use: R$9/invoice, 1 company, unlimited invoices (pay per invoice)
 * 2. Essential: R$79/month or R$39/month (annual), 2 companies, 30 invoices/month
 * 3. Professional: R$149/month or R$129/month (annual), 5 companies, 100 invoices/month
 * 4. Accountant: Custom pricing, unlimited companies, unlimited invoices
 * 
 * STRIPE INTEGRATION:
 * Each plan has Stripe price IDs for billing.
 * Pay per Use uses one-time payments per invoice.
 */

export const PLANS = {
  // ═══════════════════════════════════════════════════════════════════════
  // PAY PER USE - R$9 per invoice
  // ═══════════════════════════════════════════════════════════════════════
  pay_per_use: {
    planId: 'pay_per_use',
    name: 'Pay per Use',
    description: 'Pague apenas quando emitir',
    monthlyPrice: null, // No monthly fee
    annualPrice: null,
    perInvoicePrice: 900, // R$9.00 per invoice in cents
    maxCompanies: 1,
    maxInvoicesPerMonth: null, // Unlimited (pay per invoice)
    features: [
      '1 empresa (CNPJ)',
      'Notas ilimitadas (R$9 por nota)',
      'Assistente IA completo',
      'Comando por voz',
      'Uso sob demanda'
    ],
    billingCycle: 'per_invoice',
    isPayPerUse: true,
    // Stripe Price ID for one-time invoice payment
    stripePrices: {
      per_invoice: 'price_1SxunaKTPq3SbMOc1F39Xlqq'
    }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // ESSENTIAL - R$79/month or R$39/month (annual)
  // ═══════════════════════════════════════════════════════════════════════
  essential: {
    planId: 'essential',
    name: 'Essential',
    description: 'Para pequenos negócios',
    monthlyPrice: 7900, // R$79.00/month in cents
    annualPrice: 46800, // R$39.00/month × 12 = R$468/year in cents
    annualMonthlyEquivalent: 3900, // R$39.00/month when paid annually
    perInvoicePrice: null,
    maxCompanies: 2,
    maxInvoicesPerMonth: 30,
    features: [
      'Até 2 empresas (CNPJs)',
      'Até 30 notas fiscais/mês',
      'Assistente IA completo',
      'Comando por voz',
      'Gestão fiscal básica',
      'Integrações fiscais'
    ],
    billingCycle: 'monthly',
    isPayPerUse: false,
    stripePrices: {
      monthly: 'price_1SxubrKTPq3SbMOcbwHNdKSD',
      annual: 'price_1SxueqKTPq3SbMOcZIjEyvJM'
    }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // PROFESSIONAL - R$149/month or R$129/month (annual)
  // ═══════════════════════════════════════════════════════════════════════
  professional: {
    planId: 'professional',
    name: 'Professional',
    description: 'Para empresas em crescimento',
    monthlyPrice: 14900, // R$149.00/month in cents
    annualPrice: 154800, // R$129.00/month × 12 = R$1,548/year in cents
    annualMonthlyEquivalent: 12900, // R$129.00/month when paid annually
    perInvoicePrice: null,
    maxCompanies: 5,
    maxInvoicesPerMonth: 100,
    features: [
      'Até 5 empresas (CNPJs)',
      'Até 100 notas fiscais/mês',
      'Assistente IA completo',
      'Comando por voz',
      'Revisão contábil opcional',
      'Relatórios avançados',
      'Integrações fiscais avançadas'
    ],
    billingCycle: 'monthly',
    isPayPerUse: false,
    stripePrices: {
      monthly: 'price_1SxuimKTPq3SbMOcidrSGuDg',
      annual: 'price_1SxumNKTPq3SbMOcQoWYab7D'
    }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // ACCOUNTANT - Custom pricing (contact sales)
  // ═══════════════════════════════════════════════════════════════════════
  accountant: {
    planId: 'accountant',
    name: 'Contador',
    description: 'Para contadores e escritórios',
    monthlyPrice: null, // Custom pricing - contact sales
    annualPrice: null,
    perInvoicePrice: null,
    maxCompanies: null, // Unlimited
    maxInvoicesPerMonth: null, // Unlimited
    features: [
      'Empresas ilimitadas',
      'Notas fiscais ilimitadas',
      'Integrações avançadas',
      'API de integração',
      'Gestão de clientes',
      'Suporte dedicado',
      'Treinamento incluso'
    ],
    billingCycle: 'custom',
    isPayPerUse: false,
    isCustomPricing: true,
    stripePrices: null // Custom pricing - no Stripe product
  }
};

/**
 * Plan ID mapping - maps frontend plan IDs to backend plan IDs
 */
const PLAN_ID_MAPPING = {
  'pay_per_use': 'pay_per_use',
  'essential': 'essential',
  'professional': 'professional',
  'accountant': 'accountant'
};

/**
 * Normalize plan ID (map frontend IDs to backend IDs)
 * @param {string} planId - Plan identifier (from frontend or backend)
 * @returns {string} Normalized plan ID
 */
export function normalizePlanId(planId) {
  return PLAN_ID_MAPPING[planId] || planId;
}

/**
 * Get plan configuration by plan ID
 * @param {string} planId - Plan identifier (supports both frontend and backend IDs)
 * @returns {object|null} Plan configuration or null if not found
 */
export function getPlanConfig(planId) {
  const normalizedId = normalizePlanId(planId);
  return PLANS[normalizedId] || null;
}

/**
 * Get active plans (non-custom)
 * @returns {array} Array of active plan configurations
 */
export function getActivePlans() {
  return Object.values(PLANS).filter(plan => 
    plan.isActive !== false && !plan.isCustomPricing
  );
}

/**
 * Get upgrade options for a given plan
 * @param {string} currentPlanId - Current plan ID
 * @returns {array} Array of upgrade options
 */
export function getUpgradeOptions(currentPlanId) {
  // Plan hierarchy for upgrades
  const planOrder = ['pay_per_use', 'essential', 'professional', 'accountant'];
  const currentIndex = planOrder.indexOf(currentPlanId);
  
  if (currentIndex === -1 || currentIndex === planOrder.length - 1) {
    return []; // No upgrades available
  }

  const upgradePlans = planOrder.slice(currentIndex + 1);
  return upgradePlans
    .map(planId => getPlanConfig(planId))
    .filter(plan => plan && plan.isActive !== false && !plan.isCustomPricing);
}

/**
 * Check if a plan is Pay per Use
 * @param {string} planId - Plan identifier
 * @returns {boolean} True if pay per use, false otherwise
 */
export function isPayPerUsePlan(planId) {
  const plan = getPlanConfig(planId);
  return plan ? plan.isPayPerUse === true : false;
}

/**
 * Check if a plan allows unlimited invoices
 * @param {string} planId - Plan identifier
 * @returns {boolean} True if unlimited, false otherwise
 */
export function hasUnlimitedInvoices(planId) {
  const plan = getPlanConfig(planId);
  if (!plan) return false;
  // Pay per use has "unlimited" but requires payment per invoice
  return plan.maxInvoicesPerMonth === null;
}

/**
 * Check if a plan allows unlimited companies
 * @param {string} planId - Plan identifier
 * @returns {boolean} True if unlimited, false otherwise
 */
export function hasUnlimitedCompanies(planId) {
  const plan = getPlanConfig(planId);
  return plan ? plan.maxCompanies === null : false;
}

/**
 * Get plan price based on billing cycle
 * @param {string} planId - Plan identifier
 * @param {string} billingCycle - 'monthly' or 'annual'
 * @returns {number|null} Price in cents or null if not applicable
 */
export function getPlanPrice(planId, billingCycle = 'monthly') {
  const plan = getPlanConfig(planId);
  if (!plan) return null;

  // Pay per use - return per invoice price
  if (plan.isPayPerUse) {
    return plan.perInvoicePrice;
  }

  switch (billingCycle) {
    case 'annual':
      return plan.annualPrice !== null ? plan.annualPrice : plan.monthlyPrice;
    case 'monthly':
    default:
      return plan.monthlyPrice;
  }
}

/**
 * Get per-invoice price for Pay per Use plan
 * @returns {number} Price per invoice in cents
 */
export function getPayPerUseInvoicePrice() {
  return PLANS.pay_per_use.perInvoicePrice;
}

/**
 * Get billing cycle configuration
 * @param {string} billingCycle - 'monthly' or 'annual'
 * @returns {object} Configuration with interval and intervalCount
 */
export function getBillingCycleConfig(billingCycle) {
  switch (billingCycle) {
    case 'annual':
      return {
        interval: 'year',
        intervalCount: 1,
        days: 365
      };
    case 'monthly':
    default:
      return {
        interval: 'month',
        intervalCount: 1,
        days: 30
      };
  }
}

/**
 * Get Stripe price ID for a plan and billing cycle
 * @param {string} planId - Plan identifier
 * @param {string} billingCycle - 'monthly' or 'annual'
 * @returns {string|null} Stripe price ID or null if not found
 */
export function getStripePriceId(planId, billingCycle = 'monthly') {
  const normalizedId = normalizePlanId(planId);
  const plan = PLANS[normalizedId];
  
  if (!plan || !plan.stripePrices) {
    return null;
  }
  
  return plan.stripePrices[billingCycle] || null;
}

export default PLANS;
