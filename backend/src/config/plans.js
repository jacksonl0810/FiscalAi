/**
 * Plan Configuration
 * Defines all available subscription plans and their limits
 */

export const PLANS = {
  // ✅ Frontend plan IDs with correct prices
  pro: {
    planId: 'pro',
    name: 'Pro',
    description: 'Para profissionais autônomos e MEIs',
    monthlyPrice: 9700, // R$97.00 in cents
    annualPrice: 97000, // R$970.00/year (10 months)
    perInvoicePrice: null,
    maxCompanies: 1,
    maxInvoicesPerMonth: null, // Unlimited
    features: [
      '1 empresa',
      'Notas fiscais ilimitadas',
      'Assistente IA completo',
      'Comando por voz'
    ],
    billingCycle: 'monthly'
  },
  business: {
    planId: 'business',
    name: 'Business',
    description: 'Para empresas e escritórios contábeis',
    monthlyPrice: 19700, // R$197.00 in cents
    annualPrice: 197000, // R$1,970.00/year (10 months)
    perInvoicePrice: null,
    maxCompanies: 5,
    maxInvoicesPerMonth: null, // Unlimited
    features: [
      'Até 5 empresas',
      'Notas fiscais ilimitadas',
      'Multiusuários',
      'API de integração'
    ],
    billingCycle: 'monthly'
  },
  pay_per_use: {
    planId: 'pay_per_use',
    name: 'Pay per Use',
    description: 'Pague apenas pelo que usar',
    monthlyPrice: 0, // No monthly fee
    annualPrice: null, // Not applicable
    perInvoicePrice: 900, // R$9.00 in cents
    maxCompanies: 1,
    maxInvoicesPerMonth: null, // Unlimited
    features: [
      '1 empresa (CNPJ)',
      'Notas fiscais ilimitadas',
      'R$9 por nota fiscal emitida',
      'Assistente IA completo',
      'Comando por voz',
      'Sem assinatura mensal'
    ],
    billingCycle: 'per_invoice'
  },
  essential: {
    planId: 'essential',
    name: 'Essential',
    description: 'Para pequenos negócios',
    monthlyPrice: 7900, // R$79.00 in cents
    annualPrice: 3900, // R$39.00/month when annual (R$468/year = 3900 * 12)
    perInvoicePrice: null,
    maxCompanies: 2,
    maxInvoicesPerMonth: 30,
    features: [
      'Até 2 empresas',
      'Até 30 notas fiscais/mês',
      'Assistente IA completo',
      'Comando por voz',
      'Gestão fiscal básica'
    ],
    billingCycle: 'monthly' // or 'annual'
  },
  professional: {
    planId: 'professional',
    name: 'Professional',
    description: 'Para empresas em crescimento',
    monthlyPrice: 14900, // R$149.00 in cents
    annualPrice: 12900, // R$129.00/month when annual (R$1,548/year = 12900 * 12)
    perInvoicePrice: null,
    maxCompanies: 5,
    maxInvoicesPerMonth: 100,
    features: [
      'Até 5 empresas',
      'Até 100 notas fiscais/mês',
      'Assistente IA completo',
      'Comando por voz',
      'Revisão contábil opcional',
      'Relatórios avançados'
    ],
    billingCycle: 'monthly' // or 'annual'
  },
  accountant: {
    planId: 'accountant',
    name: 'Accountant',
    description: 'Para contadores e escritórios',
    monthlyPrice: null, // Custom pricing
    annualPrice: null,
    perInvoicePrice: null,
    maxCompanies: null, // Unlimited
    maxInvoicesPerMonth: null, // Unlimited
    features: [
      'Empresas ilimitadas',
      'Notas fiscais ilimitadas',
      'Integrações avançadas',
      'API de integração',
      'Suporte dedicado',
      'Treinamento incluso'
    ],
    billingCycle: 'custom'
  }
};

/**
 * Plan ID mapping - maps frontend plan IDs to backend plan IDs
 * ✅ Frontend 'pro' and 'business' now have their own plan definitions with correct prices
 */
const PLAN_ID_MAPPING = {
  'trial': 'trial', // Trial plan
  'pro': 'pro', // Frontend 'pro' (R$97) - uses pro plan directly
  'business': 'business', // Frontend 'business' (R$197) - uses business plan directly
  // Backend plan IDs (no mapping needed)
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
  
  // Handle 'trial' plan (special case, not in PLANS object)
  if (normalizedId === 'trial') {
    return {
      planId: 'trial',
      name: 'Trial',
      description: 'Plano de teste gratuito',
      monthlyPrice: 0,
      annualPrice: null,
      perInvoicePrice: null,
      maxCompanies: 1,
      maxInvoicesPerMonth: 5,
      features: [
        'Até 5 notas fiscais',
        'Assistente IA completo',
        'Comando por voz',
        '1 empresa',
        'Suporte por email'
      ],
      billingCycle: 'trial'
    };
  }
  
  return PLANS[normalizedId] || null;
}

/**
 * Get upgrade options for a given plan
 * @param {string} currentPlanId - Current plan ID
 * @returns {array} Array of upgrade options
 */
export function getUpgradeOptions(currentPlanId) {
  const planOrder = ['pay_per_use', 'essential', 'professional', 'accountant'];
  const currentIndex = planOrder.indexOf(currentPlanId);
  
  if (currentIndex === -1 || currentIndex === planOrder.length - 1) {
    return []; // No upgrades available
  }

  const upgradePlans = planOrder.slice(currentIndex + 1);
  return upgradePlans
    .map(planId => PLANS[planId])
    .filter(plan => plan && plan.isActive !== false);
}

/**
 * Check if a plan allows unlimited invoices
 * @param {string} planId - Plan identifier
 * @returns {boolean} True if unlimited, false otherwise
 */
export function hasUnlimitedInvoices(planId) {
  const plan = getPlanConfig(planId);
  return plan ? plan.maxInvoicesPerMonth === null : false;
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

  if (billingCycle === 'annual' && plan.annualPrice !== null) {
    return plan.annualPrice;
  }

  return plan.monthlyPrice;
}

export default PLANS;
