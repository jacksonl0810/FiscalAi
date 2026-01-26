/**
 * Cancellation Service
 * Handles invoice cancellation validation based on municipality rules
 * 
 * Different municipalities have different time limits and rules for NFS-e cancellation:
 * - Some allow cancellation within 24-48 hours
 * - Some allow cancellation within the same month
 * - Some require cancellation before specific fiscal periods
 */

import { prisma } from '../index.js';
import { apiRequest, isNuvemFiscalConfigured } from './nuvemFiscal.js';

// Default cancellation rules (conservative - most restrictive)
const DEFAULT_CANCELLATION_RULES = {
  maxHoursAfterEmission: 48, // 48 hours max by default
  allowedStatuses: ['autorizada'], // Only authorized invoices can be cancelled
  requiresJustification: true,
  minJustificationLength: 15
};

// Municipality-specific cancellation rules
// These should be fetched from Nuvem Fiscal API when available
const MUNICIPALITY_RULES = {
  // São Paulo
  '3550308': {
    maxHoursAfterEmission: 48,
    allowedStatuses: ['autorizada'],
    requiresJustification: true,
    notes: 'São Paulo permite cancelamento em até 48 horas após emissão'
  },
  // Rio de Janeiro
  '3304557': {
    maxHoursAfterEmission: 72,
    allowedStatuses: ['autorizada'],
    requiresJustification: true,
    notes: 'Rio de Janeiro permite cancelamento em até 72 horas'
  },
  // Belo Horizonte
  '3106200': {
    maxHoursAfterEmission: 24,
    allowedStatuses: ['autorizada'],
    requiresJustification: true,
    notes: 'Belo Horizonte permite cancelamento em até 24 horas'
  },
  // Curitiba
  '4106902': {
    maxHoursAfterEmission: 48,
    allowedStatuses: ['autorizada'],
    requiresJustification: true,
    notes: 'Curitiba permite cancelamento em até 48 horas'
  },
  // Porto Alegre
  '4314902': {
    maxHoursAfterEmission: 120, // 5 days
    allowedStatuses: ['autorizada'],
    requiresJustification: true,
    notes: 'Porto Alegre permite cancelamento em até 5 dias'
  },
  // Florianópolis
  '4205407': {
    maxHoursAfterEmission: 48,
    allowedStatuses: ['autorizada'],
    requiresJustification: true,
    notes: 'Florianópolis permite cancelamento em até 48 horas'
  }
};

/**
 * Get cancellation rules for a municipality
 * 
 * @param {string} codigoMunicipio - IBGE municipality code
 * @returns {object} Cancellation rules
 */
export function getCancellationRules(codigoMunicipio) {
  const cleanCode = (codigoMunicipio || '').replace(/\D/g, '');
  return MUNICIPALITY_RULES[cleanCode] || DEFAULT_CANCELLATION_RULES;
}

/**
 * Validate if an invoice can be cancelled
 * 
 * @param {object} invoice - Invoice object
 * @param {object} company - Company object
 * @param {string} justification - Cancellation justification
 * @returns {object} Validation result { canCancel, reason, rules }
 */
export async function validateCancellation(invoice, company, justification = '') {
  const rules = getCancellationRules(company.codigoMunicipio);
  const errors = [];
  const warnings = [];

  // 1. Check invoice status
  if (!rules.allowedStatuses.includes(invoice.status)) {
    errors.push({
      code: 'INVALID_STATUS',
      message: `Notas com status "${invoice.status}" não podem ser canceladas. Apenas notas com status: ${rules.allowedStatuses.join(', ')}.`
    });
  }

  // 2. Check time limit
  const emissionDate = new Date(invoice.dataEmissao);
  const now = new Date();
  const hoursElapsed = (now - emissionDate) / (1000 * 60 * 60);
  const maxHours = rules.maxHoursAfterEmission;

  if (hoursElapsed > maxHours) {
    const daysElapsed = Math.floor(hoursElapsed / 24);
    const hoursRemaining = Math.floor(hoursElapsed % 24);
    
    errors.push({
      code: 'TIME_LIMIT_EXCEEDED',
      message: `O prazo para cancelamento desta nota expirou. ` +
        `Limite: ${maxHours} horas. ` +
        `Tempo decorrido: ${daysElapsed} dia(s) e ${hoursRemaining} hora(s).`,
      details: {
        maxHours,
        hoursElapsed: Math.floor(hoursElapsed),
        emissionDate: emissionDate.toISOString()
      }
    });
  } else if (hoursElapsed > maxHours * 0.8) {
    // Warn if close to limit (80%)
    const remainingHours = Math.floor(maxHours - hoursElapsed);
    warnings.push({
      code: 'APPROACHING_TIME_LIMIT',
      message: `Atenção: Restam apenas ${remainingHours} hora(s) para cancelar esta nota.`
    });
  }

  // 3. Check justification
  if (rules.requiresJustification) {
    if (!justification || justification.trim().length === 0) {
      errors.push({
        code: 'JUSTIFICATION_REQUIRED',
        message: 'É obrigatório informar o motivo do cancelamento.'
      });
    } else if (justification.trim().length < (rules.minJustificationLength || 15)) {
      errors.push({
        code: 'JUSTIFICATION_TOO_SHORT',
        message: `O motivo do cancelamento deve ter pelo menos ${rules.minJustificationLength || 15} caracteres.`
      });
    }
  }

  // 4. Check if invoice is already cancelled
  if (invoice.status === 'cancelada') {
    errors.push({
      code: 'ALREADY_CANCELLED',
      message: 'Esta nota fiscal já foi cancelada.'
    });
  }

  // 5. Check for pending payments or linked transactions (if applicable)
  // This would require additional business logic based on requirements

  // Return validation result
  const canCancel = errors.length === 0;

  return {
    canCancel,
    errors,
    warnings,
    rules: {
      maxHoursAfterEmission: rules.maxHoursAfterEmission,
      requiresJustification: rules.requiresJustification,
      municipalityNotes: rules.notes || null,
      timeRemaining: canCancel ? Math.max(0, maxHours - hoursElapsed) : 0
    },
    summary: canCancel 
      ? 'Cancelamento permitido' 
      : `Cancelamento não permitido: ${errors.map(e => e.message).join(' ')}`
  };
}

/**
 * Check cancellation status via Nuvem Fiscal API
 * 
 * @param {string} nuvemFiscalId - Company ID in Nuvem Fiscal
 * @param {string} nfseId - NFS-e ID in Nuvem Fiscal
 * @returns {Promise<object>} Cancellation status
 */
export async function checkCancellationStatus(nuvemFiscalId, nfseId) {
  if (!isNuvemFiscalConfigured()) {
    return {
      canCancel: null,
      message: 'Nuvem Fiscal não configurada'
    };
  }

  try {
    // Some APIs provide a specific endpoint to check if cancellation is allowed
    const response = await apiRequest(`/empresas/${nuvemFiscalId}/nfse/${nfseId}/cancelamento/validar`, {
      method: 'GET'
    });

    return {
      canCancel: response.pode_cancelar || response.can_cancel,
      reason: response.motivo || response.reason,
      deadline: response.prazo_limite || response.deadline
    };
  } catch (error) {
    // If endpoint doesn't exist, return unknown
    if (error.status === 404) {
      return {
        canCancel: null,
        message: 'Endpoint de validação não disponível'
      };
    }

    console.error('[Cancellation] Error checking cancellation status:', error);
    return {
      canCancel: null,
      error: error.message
    };
  }
}

/**
 * Get cancellation deadline for an invoice
 * 
 * @param {object} invoice - Invoice object
 * @param {object} company - Company object
 * @returns {object} Deadline information
 */
export function getCancellationDeadline(invoice, company) {
  const rules = getCancellationRules(company.codigoMunicipio);
  const emissionDate = new Date(invoice.dataEmissao);
  const deadline = new Date(emissionDate.getTime() + rules.maxHoursAfterEmission * 60 * 60 * 1000);
  const now = new Date();
  
  const isExpired = now > deadline;
  const hoursRemaining = isExpired ? 0 : Math.max(0, (deadline - now) / (1000 * 60 * 60));

  return {
    deadline: deadline,
    isExpired: isExpired,
    hoursRemaining: Math.floor(hoursRemaining),
    formattedDeadline: deadline.toLocaleString('pt-BR'),
    rules: {
      maxHours: rules.maxHoursAfterEmission,
      notes: rules.notes
    }
  };
}

/**
 * Log cancellation attempt for audit
 * 
 * @param {object} invoice - Invoice object
 * @param {string} userId - User ID
 * @param {boolean} success - Whether cancellation succeeded
 * @param {string} reason - Cancellation reason or error
 */
export async function logCancellationAttempt(invoice, userId, success, reason) {
  try {
    await prisma.invoiceStatusHistory.create({
      data: {
        invoiceId: invoice.id,
        status: success ? 'cancelada' : invoice.status,
        message: success 
          ? `Nota cancelada: ${reason}` 
          : `Tentativa de cancelamento falhou: ${reason}`,
        source: 'api',
        metadata: {
          userId: userId,
          success: success,
          attempt_time: new Date().toISOString(),
          reason: reason
        }
      }
    });
  } catch (error) {
    console.error('[Cancellation] Error logging cancellation attempt:', error);
  }
}
