/**
 * MEI Limit Tracking Service
 * 
 * Monitors revenue against MEI annual limit (R$ 81.000)
 * Creates alerts and notifications when approaching/exceeding limits
 */

import { prisma } from '../index.js';

const MEI_ANNUAL_LIMIT = 81000; // R$ 81.000 per year

/**
 * Calculate yearly revenue for a company
 * @param {string} companyId - Company ID
 * @param {number} year - Year to calculate (default: current year)
 * @returns {Promise<number>} Total revenue for the year
 */
export async function calculateYearlyRevenue(companyId, year = new Date().getFullYear()) {
  const startDate = new Date(year, 0, 1); // January 1st
  const endDate = new Date(year, 11, 31, 23, 59, 59); // December 31st

  const invoices = await prisma.invoice.findMany({
    where: {
      companyId,
      status: {
        in: ['autorizada', 'enviada'] // Only count authorized/sent invoices
      },
      dataEmissao: {
        gte: startDate,
        lte: endDate
      }
    },
    select: {
      valor: true
    }
  });

  const totalRevenue = invoices.reduce((sum, invoice) => {
    return sum + parseFloat(invoice.valor || 0);
  }, 0);

  return totalRevenue;
}

/**
 * Check MEI limit status and create alerts if needed
 * @param {string} companyId - Company ID
 * @param {string} userId - User ID
 * @returns {Promise<object>} Limit status information
 */
export async function checkMEILimit(companyId, userId) {
  // Get company to verify regime
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { regimeTributario: true }
  });

  if (!company || company.regimeTributario !== 'MEI') {
    return {
      isMEI: false,
      message: 'Company is not MEI'
    };
  }

  const currentYear = new Date().getFullYear();
  const yearlyRevenue = await calculateYearlyRevenue(companyId, currentYear);
  const percentage = (yearlyRevenue / MEI_ANNUAL_LIMIT) * 100;
  const remaining = MEI_ANNUAL_LIMIT - yearlyRevenue;

  // Determine alert level
  let alertLevel = null;
  let shouldNotify = false;
  let notificationMessage = '';

  if (yearlyRevenue >= MEI_ANNUAL_LIMIT) {
    alertLevel = 'exceeded';
    shouldNotify = true;
    notificationMessage = `⚠️ ATENÇÃO: Você ultrapassou o limite anual do MEI (R$ ${MEI_ANNUAL_LIMIT.toLocaleString('pt-BR')}). Faturamento atual: R$ ${yearlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Considere migrar para o Simples Nacional.`;
  } else if (percentage >= 90) {
    alertLevel = 'critical';
    shouldNotify = true;
    notificationMessage = `🚨 ATENÇÃO: Você está muito próximo do limite anual do MEI (${percentage.toFixed(1)}% utilizado). Restam apenas R$ ${remaining.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Considere migrar para o Simples Nacional.`;
  } else if (percentage >= 70) {
    alertLevel = 'warning';
    shouldNotify = true;
    notificationMessage = `💡 Aviso: Você já utilizou ${percentage.toFixed(1)}% do limite anual do MEI. Faturado: R$ ${yearlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de R$ ${MEI_ANNUAL_LIMIT.toLocaleString('pt-BR')}.`;
  } else if (percentage >= 50) {
    alertLevel = 'info';
    // Don't notify for info level, just track
  }

  // Create notification if needed
  if (shouldNotify) {
    // Check if we already notified for this level recently (avoid spam)
    const recentNotification = await prisma.notification.findFirst({
      where: {
        userId,
        tipo: alertLevel === 'exceeded' ? 'erro' : alertLevel === 'critical' ? 'alerta' : 'info',
        mensagem: {
          contains: 'limite anual do MEI'
        },
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Only create notification if we haven't notified recently
    if (!recentNotification) {
      await prisma.notification.create({
        data: {
          userId,
          titulo: alertLevel === 'exceeded' 
            ? 'Limite MEI Ultrapassado'
            : alertLevel === 'critical'
            ? 'Limite MEI Crítico'
            : 'Aviso de Limite MEI',
          mensagem: notificationMessage,
          tipo: alertLevel === 'exceeded' ? 'erro' : alertLevel === 'critical' ? 'alerta' : 'info'
        }
      });
    }
  }

  return {
    isMEI: true,
    yearlyRevenue,
    limit: MEI_ANNUAL_LIMIT,
    percentage: Math.min(percentage, 100), // Cap at 100%
    remaining: Math.max(remaining, 0), // Don't go negative
    alertLevel,
    status: yearlyRevenue >= MEI_ANNUAL_LIMIT ? 'exceeded' : percentage >= 90 ? 'critical' : percentage >= 70 ? 'warning' : 'ok'
  };
}

/**
 * Get MEI limit status for dashboard
 * @param {string} companyId - Company ID
 * @returns {Promise<object>} Limit status
 */
export async function getMEILimitStatus(companyId) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { regimeTributario: true, userId: true }
  });

  if (!company || company.regimeTributario !== 'MEI') {
    return null;
  }

  return await checkMEILimit(companyId, company.userId);
}
