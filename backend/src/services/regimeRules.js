/**
 * Regime-Specific Business Rules Service
 * 
 * Handles business rules for different tax regimes:
 * - MEI (Microempreendedor Individual)
 * - Simples Nacional
 * - Lucro Presumido
 * - Lucro Real
 */

import { prisma } from '../lib/prisma.js';
import { calculateYearlyRevenue } from './meiLimitTracking.js';

const MEI_ANNUAL_LIMIT = 81000; // R$ 81.000 per year

/**
 * Get regime-specific rules
 * @param {string} regime - Tax regime
 * @returns {object|null} Regime rules or null if not found
 */
export function getRegimeRules(regime) {
  const rules = {
    'MEI': {
      name: 'Microempreendedor Individual',
      annualLimit: MEI_ANNUAL_LIMIT,
      issRate: 5, // Fixed ISS rate for MEI
      dasValue: 69.00, // Fixed DAS value (approximate, varies by activity)
      canEmitInvoices: true,
      requiresInscricaoMunicipal: true,
      limitTracking: true,
      warnings: {
        limit80: 'Você está próximo do limite anual. Considere migrar para Simples Nacional.',
        limit90: 'ATENÇÃO: Você está muito próximo do limite anual do MEI!',
        limitExceeded: 'Você ultrapassou o limite anual. É necessário migrar para Simples Nacional.'
      }
    },
    'Simples Nacional': {
      name: 'Simples Nacional',
      annualLimit: null, // No hard limit, but has revenue brackets
      issRate: null, // Variable based on revenue bracket and activity
      dasValue: null, // Variable based on revenue
      canEmitInvoices: true,
      requiresInscricaoMunicipal: true,
      limitTracking: false,
      revenueBrackets: [
        { min: 0, max: 180000, name: 'Anexo I' },
        { min: 180000, max: 360000, name: 'Anexo II' },
        { min: 360000, max: 720000, name: 'Anexo III' },
        { min: 720000, max: 1800000, name: 'Anexo IV' },
        { min: 1800000, max: 3600000, name: 'Anexo V' },
        { min: 3600000, max: 4800000, name: 'Anexo VI' }
      ],
      warnings: {
        bracketChange: 'Seu faturamento pode mudar de anexo. Verifique as alíquotas.'
      }
    },
    'Lucro Presumido': {
      name: 'Lucro Presumido',
      annualLimit: null,
      issRate: null, // Variable by municipality
      dasValue: null, // No DAS, different tax structure
      canEmitInvoices: true,
      requiresInscricaoMunicipal: true,
      limitTracking: false,
      taxStructure: {
        irpj: 15, // IRPJ rate
        csll: 9, // CSLL rate
        pis: 0.65, // PIS rate
        cofins: 3 // COFINS rate
      }
    },
    'Lucro Real': {
      name: 'Lucro Real',
      annualLimit: null,
      issRate: null, // Variable by municipality
      dasValue: null, // No DAS, different tax structure
      canEmitInvoices: true,
      requiresInscricaoMunicipal: true,
      limitTracking: false,
      taxStructure: {
        irpj: 15, // IRPJ rate (on actual profit)
        csll: 9, // CSLL rate (on actual profit)
        pis: 1.65, // PIS rate
        cofins: 7.6 // COFINS rate
      },
      requiresAccounting: true
    }
  };

  return rules[regime] || null;
}

/**
 * Validate invoice against regime rules
 * @param {object} invoiceData - Invoice data
 * @param {object} company - Company data
 * @returns {object} Validation result
 */
export async function validateInvoiceForRegime(invoiceData, company) {
  const rules = getRegimeRules(company.regimeTributario);
  
  if (!rules) {
    return { valid: true, errors: [] };
  }

  const errors = [];

  // MEI-specific validations
  if (company.regimeTributario === 'MEI') {
    // Check annual limit
    const yearlyRevenue = await calculateYearlyRevenue(company.id);
    const newTotal = yearlyRevenue + parseFloat(invoiceData.valor || 0);
    
    if (newTotal > MEI_ANNUAL_LIMIT) {
      errors.push(`Esta nota fiscal ultrapassaria o limite anual do MEI (R$ ${MEI_ANNUAL_LIMIT.toLocaleString('pt-BR')}). Faturamento atual: R$ ${yearlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, após esta nota: R$ ${newTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`);
    }

    // Validate ISS rate (MEI has fixed 5% rate)
    const issRate = parseFloat(invoiceData.aliquota_iss || 5);
    if (issRate !== 5) {
      errors.push(`MEI deve usar alíquota de ISS de 5%. Valor fornecido: ${issRate}%`);
    }
  }

  // Simples Nacional validations
  if (company.regimeTributario === 'Simples Nacional') {
    // Check if ISS rate is reasonable (should be between 2% and 5% typically)
    const issRate = parseFloat(invoiceData.aliquota_iss || 0);
    if (issRate > 5 || issRate < 0) {
      errors.push(`Alíquota de ISS inválida para Simples Nacional. Verifique a alíquota do seu município.`);
    }
  }

  // General validations
  if (!invoiceData.cliente_nome) {
    errors.push('Nome do cliente é obrigatório');
  }

  if (!invoiceData.valor || parseFloat(invoiceData.valor) <= 0) {
    errors.push('Valor da nota fiscal deve ser maior que zero');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get recommended ISS rate for regime
 * @param {string} regime - Tax regime
 * @param {object} company - Company data (optional)
 * @returns {number|null} Recommended ISS rate or null
 */
export function getRecommendedIssRate(regime, company = null) {
  const rules = getRegimeRules(regime);
  
  if (!rules) {
    return null;
  }

  if (regime === 'MEI') {
    return rules.issRate; // Fixed 5% for MEI
  }

  // For other regimes, return null (variable by municipality)
  // In production, this could query municipality-specific rates
  return null;
}

/**
 * Check if regime change is recommended
 * @param {string} companyId - Company ID
 * @param {string} currentRegime - Current tax regime
 * @returns {Promise<object>} Recommendation result
 */
export async function checkRegimeChangeRecommendation(companyId, currentRegime) {
  if (currentRegime !== 'MEI') {
    return {
      recommended: false,
      reason: null
    };
  }

  const yearlyRevenue = await calculateYearlyRevenue(companyId);
  const percentage = (yearlyRevenue / MEI_ANNUAL_LIMIT) * 100;

  if (yearlyRevenue >= MEI_ANNUAL_LIMIT) {
    return {
      recommended: true,
      reason: 'exceeded',
      message: 'Você ultrapassou o limite anual do MEI. É necessário migrar para Simples Nacional.',
      suggestedRegime: 'Simples Nacional'
    };
  }

  if (percentage >= 90) {
    return {
      recommended: true,
      reason: 'critical',
      message: 'Você está muito próximo do limite anual do MEI. Considere migrar para Simples Nacional.',
      suggestedRegime: 'Simples Nacional'
    };
  }

  if (percentage >= 70) {
    return {
      recommended: true,
      reason: 'warning',
      message: 'Você já utilizou mais de 70% do limite anual do MEI. Planeje a migração para Simples Nacional.',
      suggestedRegime: 'Simples Nacional'
    };
  }

  return {
    recommended: false,
    reason: null
  };
}

/**
 * Get regime-specific invoice defaults
 * @param {string} regime - Tax regime
 * @param {object} company - Company data
 * @returns {object} Default values for invoice
 */
export function getRegimeInvoiceDefaults(regime, company) {
  const rules = getRegimeRules(regime);
  
  const defaults = {
    aliquota_iss: 5, // Default 5%
    iss_retido: false,
    codigo_servico: '1401' // Default service code
  };

  if (rules) {
    if (regime === 'MEI') {
      defaults.aliquota_iss = rules.issRate; // Fixed 5% for MEI
    }
  }

  return defaults;
}

/**
 * Calculate regime-specific taxes
 * @param {object} invoiceData - Invoice data
 * @param {object} company - Company data
 * @returns {object} Calculated taxes
 */
export function calculateRegimeTaxes(invoiceData, company) {
  const rules = getRegimeRules(company.regimeTributario);
  const valor = parseFloat(invoiceData.valor || 0);
  
  const taxes = {
    valor_iss: 0,
    valor_irpj: 0,
    valor_csll: 0,
    valor_pis: 0,
    valor_cofins: 0,
    valor_das: 0
  };

  if (!rules) {
    // Default calculation
    const issRate = parseFloat(invoiceData.aliquota_iss || 5);
    taxes.valor_iss = (valor * issRate) / 100;
    return taxes;
  }

  // MEI calculation
  if (company.regimeTributario === 'MEI') {
    taxes.valor_iss = (valor * rules.issRate) / 100;
    // DAS is fixed monthly, not per invoice
    taxes.valor_das = rules.dasValue;
  }

  // Simples Nacional calculation
  if (company.regimeTributario === 'Simples Nacional') {
    const issRate = parseFloat(invoiceData.aliquota_iss || 5);
    taxes.valor_iss = (valor * issRate) / 100;
    // DAS calculation would depend on revenue bracket (simplified here)
  }

  // Lucro Presumido calculation
  if (company.regimeTributario === 'Lucro Presumido') {
    const issRate = parseFloat(invoiceData.aliquota_iss || 5);
    taxes.valor_iss = (valor * issRate) / 100;
    
    if (rules.taxStructure) {
      // Simplified calculation (in reality, these are calculated on presumptive profit)
      const presumptiveProfit = valor * 0.32; // 32% presumptive profit rate
      taxes.valor_irpj = (presumptiveProfit * rules.taxStructure.irpj) / 100;
      taxes.valor_csll = (presumptiveProfit * rules.taxStructure.csll) / 100;
      taxes.valor_pis = (valor * rules.taxStructure.pis) / 100;
      taxes.valor_cofins = (valor * rules.taxStructure.cofins) / 100;
    }
  }

  // Lucro Real calculation
  if (company.regimeTributario === 'Lucro Real') {
    const issRate = parseFloat(invoiceData.aliquota_iss || 5);
    taxes.valor_iss = (valor * issRate) / 100;
    
    if (rules.taxStructure) {
      // These are calculated on actual profit (would need accounting data)
      taxes.valor_pis = (valor * rules.taxStructure.pis) / 100;
      taxes.valor_cofins = (valor * rules.taxStructure.cofins) / 100;
      // IRPJ and CSLL require actual profit calculation
    }
  }

  return taxes;
}
