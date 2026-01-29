/**
 * AI Notification Service
 * Generates contextual, AI-powered notification messages
 * 
 * Uses templates enhanced with context for personalized notifications
 * Falls back to static messages when AI is not available
 */

import { prisma } from '../lib/prisma.js';
import { translateError } from './errorTranslationService.js';
import { fetchWithTimeout, getTimeout } from '../utils/timeout.js';

/**
 * Notification templates for different events
 */
const NOTIFICATION_TEMPLATES = {
  // Invoice events
  invoice_authorized: {
    title: 'Nota Fiscal Autorizada',
    templates: [
      'Sua nota fiscal ${numero} para ${cliente} foi autorizada! Valor: R$ ${valor}.',
      'Ótima notícia! A prefeitura autorizou a nota fiscal ${numero} de R$ ${valor} para ${cliente}.',
      'Nota ${numero} autorizada com sucesso! Cliente: ${cliente}, Valor: R$ ${valor}.'
    ],
    emoji: '✅',
    type: 'sucesso'
  },
  invoice_rejected: {
    title: 'Nota Fiscal Rejeitada',
    templates: [
      'A nota fiscal para ${cliente} foi rejeitada pela prefeitura. ${reason}',
      'Atenção: A prefeitura rejeitou sua nota de R$ ${valor} para ${cliente}. Motivo: ${reason}',
      'Sua nota fiscal não foi aceita. Cliente: ${cliente}. ${reason}'
    ],
    emoji: '❌',
    type: 'erro'
  },
  invoice_processing: {
    title: 'Nota Fiscal em Processamento',
    templates: [
      'Sua nota fiscal para ${cliente} está sendo processada pela prefeitura.',
      'Aguarde! A nota de R$ ${valor} para ${cliente} está em análise.',
      'Nota enviada! A prefeitura está processando sua nota para ${cliente}.'
    ],
    emoji: '⏳',
    type: 'info'
  },
  invoice_cancelled: {
    title: 'Nota Fiscal Cancelada',
    templates: [
      'A nota fiscal ${numero} foi cancelada com sucesso.',
      'Cancelamento confirmado: Nota ${numero} para ${cliente}.',
      'Sua nota fiscal ${numero} foi cancelada conforme solicitado.'
    ],
    emoji: '🚫',
    type: 'info'
  },
  invoice_cancellation_failed: {
    title: 'Falha no Cancelamento',
    templates: [
      'Não foi possível cancelar a nota fiscal ${numero} para ${cliente}. ${reason}',
      'O cancelamento da nota ${numero} falhou. ${reason}',
      'Erro ao cancelar nota fiscal ${numero}. ${reason}'
    ],
    emoji: '⚠️',
    type: 'erro'
  },

  // Payment events
  payment_approved: {
    title: 'Pagamento Aprovado',
    templates: [
      'Seu pagamento de R$ ${valor} foi aprovado! Sua assinatura está ativa.',
      'Pagamento confirmado! R$ ${valor} processado com sucesso.',
      'Ótimo! Recebemos seu pagamento de R$ ${valor}. Aproveite a MAY!'
    ],
    emoji: '💳',
    type: 'sucesso'
  },
  payment_failed: {
    title: 'Pagamento Recusado',
    templates: [
      'Seu pagamento de R$ ${valor} foi recusado. ${reason}',
      'Não conseguimos processar seu pagamento. ${reason}',
      'Atenção: O pagamento não foi aprovado. ${reason}'
    ],
    emoji: '⚠️',
    type: 'erro'
  },

  // Subscription events
  subscription_activated: {
    title: 'Assinatura Ativada',
    templates: [
      'Sua assinatura do plano ${plan} foi ativada! Aproveite todos os recursos.',
      'Bem-vindo ao ${plan}! Sua assinatura está ativa.',
      'Plano ${plan} ativado com sucesso! Boas vendas!'
    ],
    emoji: '🎉',
    type: 'sucesso'
  },
  subscription_expiring: {
    title: 'Assinatura Expirando',
    templates: [
      'Sua assinatura expira em ${days} dias. Renove para não perder acesso.',
      'Atenção: Restam ${days} dias na sua assinatura.',
      'Sua assinatura do plano ${plan} vence em ${days} dias.'
    ],
    emoji: '⏰',
    type: 'alerta'
  },

  // Certificate events
  certificate_expiring: {
    title: 'Certificado Digital Expirando',
    templates: [
      'Seu certificado digital expira em ${days} dias. Renove para continuar emitindo notas.',
      'Atenção: Certificado digital vence em ${days} dias.',
      'Lembrete: Renove seu certificado A1 em até ${days} dias.'
    ],
    emoji: '🔐',
    type: 'alerta'
  },
  certificate_expired: {
    title: 'Certificado Digital Expirado',
    templates: [
      'Seu certificado digital expirou. Renove imediatamente para emitir notas.',
      'Certificado vencido! Faça o upload de um novo certificado.',
      'Atenção urgente: Certificado digital expirado. Não é possível emitir notas.'
    ],
    emoji: '🚨',
    type: 'erro'
  },

  // Municipality events
  municipality_offline: {
    title: 'Sistema da Prefeitura Indisponível',
    templates: [
      'O sistema da prefeitura de ${city} está temporariamente indisponível.',
      'A prefeitura de ${city} está em manutenção. Tentaremos novamente automaticamente.',
      'Sistema da prefeitura offline. Suas notas serão enviadas assim que voltar.'
    ],
    emoji: '🔧',
    type: 'alerta'
  },
  municipality_back_online: {
    title: 'Sistema da Prefeitura Restaurado',
    templates: [
      'O sistema da prefeitura de ${city} voltou ao normal!',
      'Boa notícia! A prefeitura de ${city} está online novamente.',
      'Prefeitura de ${city} disponível. Notas pendentes sendo processadas.'
    ],
    emoji: '✅',
    type: 'sucesso'
  },

  // Credential events
  credential_issue: {
    title: 'Problema com Credenciais Fiscais',
    templates: [
      'Houve um problema com suas credenciais fiscais: ${error}. Verifique e atualize as credenciais.',
      'Falha na conexão fiscal: ${error}. Acesse "Minha Empresa" para verificar.',
      'Erro nas credenciais da empresa ${company}: ${error}. Corrija para continuar emitindo notas.'
    ],
    emoji: '🔐',
    type: 'erro'
  },
  
  // MEI limit events
  mei_limit_warning: {
    title: 'Limite MEI Próximo',
    templates: [
      'Atenção: Você já faturou R$ ${current} de R$ ${limit}. Restam R$ ${remaining}.',
      'Aviso de limite: Faturamento em ${percent}% do limite MEI anual.',
      'Cuidado! Seu faturamento está em R$ ${current}. Limite: R$ ${limit}.'
    ],
    emoji: '📊',
    type: 'alerta'
  },
  mei_limit_exceeded: {
    title: 'Limite MEI Ultrapassado',
    templates: [
      'Você ultrapassou o limite anual do MEI! Faturamento: R$ ${current}.',
      'Atenção urgente: Limite MEI excedido. Consulte um contador.',
      'Limite MEI atingido! Você precisa mudar de regime tributário.'
    ],
    emoji: '🚨',
    type: 'erro'
  }
};

/**
 * Generate notification message from template
 * 
 * @param {string} eventType - Type of event
 * @param {object} context - Context data for template
 * @returns {object} Generated notification { title, message, type }
 */
export function generateNotification(eventType, context = {}) {
  const template = NOTIFICATION_TEMPLATES[eventType];
  
  if (!template) {
    console.warn(`[AINotification] Unknown event type: ${eventType}`);
    return {
      title: 'Notificação',
      message: 'Você tem uma nova notificação.',
      type: 'info'
    };
  }

  // Select a random template for variety
  const messageTemplate = template.templates[Math.floor(Math.random() * template.templates.length)];
  
  // Replace placeholders with context values
  let message = messageTemplate;
  for (const [key, value] of Object.entries(context)) {
    const placeholder = new RegExp(`\\$\\{${key}\\}`, 'g');
    message = message.replace(placeholder, formatValue(key, value));
  }

  // Add emoji if configured
  if (template.emoji) {
    message = `${template.emoji} ${message}`;
  }

  return {
    title: template.title,
    message: message,
    type: template.type
  };
}

/**
 * Format value based on key type
 * 
 * @param {string} key - Context key
 * @param {any} value - Value to format
 * @returns {string} Formatted value
 */
function formatValue(key, value) {
  if (value === null || value === undefined) {
    return '';
  }

  // Format currency values
  if (key === 'valor' || key === 'current' || key === 'limit' || key === 'remaining') {
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (!isNaN(num)) {
      return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  }

  // Format percentage
  if (key === 'percent') {
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (!isNaN(num)) {
      return num.toFixed(0);
    }
  }

  // Format dates
  if (value instanceof Date) {
    return value.toLocaleDateString('pt-BR');
  }

  return String(value);
}

/**
 * Create notification in database with AI-generated content
 * 
 * @param {string} userId - User ID
 * @param {string} eventType - Type of event
 * @param {object} context - Context data
 * @param {object} options - Additional options (invoiceId, etc.)
 * @returns {Promise<object>} Created notification
 */
export async function createAINotification(userId, eventType, context = {}, options = {}) {
  const notification = generateNotification(eventType, context);

  try {
    const created = await prisma.notification.create({
      data: {
        userId: userId,
        titulo: notification.title,
        mensagem: notification.message,
        tipo: notification.type,
        invoiceId: options.invoiceId || null
      }
    });

    console.log(`[AINotification] Created notification for user ${userId}: ${eventType}`);
    return created;
  } catch (error) {
    console.error('[AINotification] Error creating notification:', error);
    throw error;
  }
}

/**
 * Generate notification using OpenAI (when available)
 * Falls back to template-based generation
 * 
 * @param {string} eventType - Type of event
 * @param {object} context - Full context for AI
 * @returns {Promise<object>} Generated notification
 */
export async function generateAINotification(eventType, context = {}) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  // If no OpenAI key, use template-based generation
  if (!openaiApiKey) {
    return generateNotification(eventType, context);
  }

  try {
    const prompt = buildNotificationPrompt(eventType, context);
    const timeoutMs = getTimeout('openai');

    const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Você é um assistente fiscal brasileiro. Gere notificações claras, profissionais e amigáveis em português. Seja conciso (máximo 2 frases).'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 150
      })
    }, timeoutMs);

    if (!response.ok) {
      throw new Error('OpenAI API request failed');
    }

    const data = await response.json();
    const aiMessage = data.choices[0]?.message?.content;

    if (aiMessage) {
      const template = NOTIFICATION_TEMPLATES[eventType];
      return {
        title: template?.title || 'Notificação',
        message: aiMessage.trim(),
        type: template?.type || 'info'
      };
    }
  } catch (error) {
    console.warn('[AINotification] OpenAI generation failed, using template:', error.message);
  }

  // Fallback to template
  return generateNotification(eventType, context);
}

/**
 * Build prompt for AI notification generation
 * 
 * @param {string} eventType - Event type
 * @param {object} context - Context data
 * @returns {string} Prompt for OpenAI
 */
function buildNotificationPrompt(eventType, context) {
  const template = NOTIFICATION_TEMPLATES[eventType];
  const eventDescription = template?.title || eventType;

  let prompt = `Gere uma notificação para o evento: ${eventDescription}\n\nContexto:\n`;
  
  for (const [key, value] of Object.entries(context)) {
    prompt += `- ${key}: ${formatValue(key, value)}\n`;
  }

  prompt += '\nA notificação deve ser em português brasileiro, profissional e amigável. Máximo 2 frases.';
  
  return prompt;
}

/**
 * Get available notification event types
 * @returns {Array} Array of event type names
 */
export function getNotificationEventTypes() {
  return Object.keys(NOTIFICATION_TEMPLATES);
}
