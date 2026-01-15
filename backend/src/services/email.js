/**
 * Email Service for FiscalAI
 * 
 * Handles sending notification emails for:
 * - User registration
 * - Payment confirmation
 * - Invoice issued/rejected
 * - Subscription status changes
 */

import nodemailer from 'nodemailer';

// Email configuration from environment variables
const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || '587');
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || 'FiscalAI <noreply@fiscalai.com.br>';
const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true';

// Create transporter (reusable)
let transporter = null;

/**
 * Check if email service is configured
 */
export function isEmailConfigured() {
  return EMAIL_ENABLED && EMAIL_USER && EMAIL_PASS;
}

/**
 * Get or create email transporter
 */
function getTransporter() {
  if (!transporter && isEmailConfigured()) {
    transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: EMAIL_PORT === 465,
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
      }
    });
  }
  return transporter;
}

/**
 * Send an email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML body
 * @param {string} [options.text] - Plain text body
 */
export async function sendEmail({ to, subject, html, text }) {
  if (!isEmailConfigured()) {
    console.log('[Email] Email service not configured, skipping:', subject);
    return { success: false, reason: 'Email service not configured' };
  }

  try {
    const transport = getTransporter();
    const result = await transport.sendMail({
      from: EMAIL_FROM,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, '') // Strip HTML for plain text
    });

    console.log('[Email] Sent successfully:', { to, subject, messageId: result.messageId });
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('[Email] Failed to send:', { to, subject, error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Email template wrapper
 */
function emailTemplate(content, title = 'FiscalAI') {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #0a0a0f; color: #ffffff; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 30px 0; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .logo { font-size: 28px; font-weight: bold; background: linear-gradient(135deg, #f97316, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .content { padding: 30px 0; }
    .button { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #f97316, #ea580c); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .footer { text-align: center; padding: 20px 0; border-top: 1px solid rgba(255,255,255,0.1); color: #888; font-size: 12px; }
    .highlight { background: rgba(249,115,22,0.1); border-left: 4px solid #f97316; padding: 15px; margin: 15px 0; border-radius: 4px; }
    .success { background: rgba(34,197,94,0.1); border-left-color: #22c55e; }
    .error { background: rgba(239,68,68,0.1); border-left-color: #ef4444; }
    .details { background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; margin: 15px 0; }
    .details-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .details-label { color: #888; }
    .details-value { font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🚀 FiscalAI</div>
      <p style="color: #888; margin: 5px 0;">Assistente Fiscal Inteligente</p>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>Este é um email automático do FiscalAI.</p>
      <p>© ${new Date().getFullYear()} FiscalAI - Todos os direitos reservados.</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send welcome email after registration
 */
export async function sendWelcomeEmail(user) {
  const content = `
    <h2>Bem-vindo ao FiscalAI! 🎉</h2>
    <p>Olá <strong>${user.name || 'Usuário'}</strong>,</p>
    <p>Sua conta foi criada com sucesso! Estamos muito felizes em tê-lo conosco.</p>
    
    <div class="highlight success">
      <strong>Seu período de teste gratuito de 7 dias começou!</strong>
      <p style="margin: 5px 0 0 0;">Durante o teste, você tem acesso completo a todas as funcionalidades.</p>
    </div>
    
    <p>Com o FiscalAI você pode:</p>
    <ul>
      <li>✅ Emitir notas fiscais por comando de voz ou texto</li>
      <li>✅ Consultar seu faturamento em tempo real</li>
      <li>✅ Acompanhar impostos e guias DAS</li>
      <li>✅ Gerenciar múltiplas empresas</li>
    </ul>
    
    <p>Para começar, acesse o sistema e cadastre sua primeira empresa:</p>
    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" class="button">Acessar FiscalAI</a>
    
    <p>Precisa de ajuda? Nosso assistente de IA está sempre disponível para guiá-lo.</p>
  `;

  return sendEmail({
    to: user.email,
    subject: '🎉 Bem-vindo ao FiscalAI - Sua conta foi criada!',
    html: emailTemplate(content, 'Bem-vindo ao FiscalAI')
  });
}

/**
 * Send payment confirmation email
 */
export async function sendPaymentConfirmationEmail(user, payment) {
  const content = `
    <h2>Pagamento Confirmado! 💳</h2>
    <p>Olá <strong>${user.name || 'Usuário'}</strong>,</p>
    <p>Seu pagamento foi processado com sucesso!</p>
    
    <div class="details">
      <div class="details-row">
        <span class="details-label">Valor:</span>
        <span class="details-value">R$ ${(payment.amount / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
      </div>
      <div class="details-row">
        <span class="details-label">Plano:</span>
        <span class="details-value">${payment.planName || 'FiscalAI Pro'}</span>
      </div>
      <div class="details-row">
        <span class="details-label">Data:</span>
        <span class="details-value">${new Date(payment.date || Date.now()).toLocaleDateString('pt-BR')}</span>
      </div>
      <div class="details-row" style="border-bottom: none;">
        <span class="details-label">ID da Transação:</span>
        <span class="details-value">${payment.transactionId || '---'}</span>
      </div>
    </div>
    
    <div class="highlight success">
      <strong>Sua assinatura está ativa!</strong>
      <p style="margin: 5px 0 0 0;">Você tem acesso completo a todas as funcionalidades do FiscalAI.</p>
    </div>
    
    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" class="button">Acessar FiscalAI</a>
  `;

  return sendEmail({
    to: user.email,
    subject: '✅ Pagamento Confirmado - FiscalAI',
    html: emailTemplate(content, 'Pagamento Confirmado')
  });
}

/**
 * Send invoice issued email
 */
export async function sendInvoiceIssuedEmail(user, invoice, company) {
  const content = `
    <h2>Nota Fiscal Emitida! 📄</h2>
    <p>Olá <strong>${user.name || 'Usuário'}</strong>,</p>
    <p>Uma nova nota fiscal foi emitida com sucesso!</p>
    
    <div class="details">
      <div class="details-row">
        <span class="details-label">Número:</span>
        <span class="details-value">${invoice.numero || '---'}</span>
      </div>
      <div class="details-row">
        <span class="details-label">Cliente:</span>
        <span class="details-value">${invoice.clienteNome}</span>
      </div>
      <div class="details-row">
        <span class="details-label">Valor:</span>
        <span class="details-value">R$ ${invoice.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
      </div>
      <div class="details-row">
        <span class="details-label">Empresa:</span>
        <span class="details-value">${company?.nomeFantasia || company?.razaoSocial || 'Sua Empresa'}</span>
      </div>
      <div class="details-row" style="border-bottom: none;">
        <span class="details-label">Data:</span>
        <span class="details-value">${new Date(invoice.dataEmissao || Date.now()).toLocaleDateString('pt-BR')}</span>
      </div>
    </div>
    
    <div class="highlight success">
      <strong>✅ Status: ${invoice.status === 'autorizada' ? 'Autorizada pela Prefeitura' : 'Emitida'}</strong>
      ${invoice.codigoVerificacao ? `<p style="margin: 5px 0 0 0;">Código de Verificação: ${invoice.codigoVerificacao}</p>` : ''}
    </div>
    
    <p>Você pode visualizar e baixar a nota fiscal no sistema:</p>
    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/documents" class="button">Ver Nota Fiscal</a>
  `;

  return sendEmail({
    to: user.email,
    subject: `📄 NFS-e #${invoice.numero || '---'} Emitida - ${invoice.clienteNome}`,
    html: emailTemplate(content, 'Nota Fiscal Emitida')
  });
}

/**
 * Send invoice rejected email
 */
export async function sendInvoiceRejectedEmail(user, invoice, error, company) {
  const content = `
    <h2>Problema na Emissão de Nota Fiscal ⚠️</h2>
    <p>Olá <strong>${user.name || 'Usuário'}</strong>,</p>
    <p>Houve um problema ao emitir a nota fiscal. Veja os detalhes abaixo:</p>
    
    <div class="details">
      <div class="details-row">
        <span class="details-label">Cliente:</span>
        <span class="details-value">${invoice.clienteNome}</span>
      </div>
      <div class="details-row">
        <span class="details-label">Valor:</span>
        <span class="details-value">R$ ${invoice.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
      </div>
      <div class="details-row" style="border-bottom: none;">
        <span class="details-label">Empresa:</span>
        <span class="details-value">${company?.nomeFantasia || company?.razaoSocial || 'Sua Empresa'}</span>
      </div>
    </div>
    
    <div class="highlight error">
      <strong>❌ Motivo da Rejeição:</strong>
      <p style="margin: 5px 0 0 0;">${error || 'Erro desconhecido. Por favor, verifique os dados e tente novamente.'}</p>
    </div>
    
    <p><strong>O que fazer?</strong></p>
    <ul>
      <li>Verifique se os dados do cliente estão corretos (CPF/CNPJ válido)</li>
      <li>Confirme se a inscrição municipal da empresa está ativa</li>
      <li>Tente emitir novamente usando o assistente de IA</li>
    </ul>
    
    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/assistant" class="button">Falar com Assistente</a>
  `;

  return sendEmail({
    to: user.email,
    subject: '⚠️ Problema na Emissão de Nota Fiscal - FiscalAI',
    html: emailTemplate(content, 'Erro na Emissão')
  });
}

/**
 * Send subscription status change email
 */
export async function sendSubscriptionStatusEmail(user, status, details = {}) {
  let content = '';
  let subject = '';

  switch (status) {
    case 'ativo':
      subject = '✅ Assinatura Ativada - FiscalAI';
      content = `
        <h2>Assinatura Ativada! 🎉</h2>
        <p>Olá <strong>${user.name || 'Usuário'}</strong>,</p>
        <p>Sua assinatura do FiscalAI está ativa!</p>
        <div class="highlight success">
          <strong>Você tem acesso completo a todas as funcionalidades.</strong>
        </div>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" class="button">Acessar FiscalAI</a>
      `;
      break;

    case 'inadimplente':
      subject = '⚠️ Problema com sua Assinatura - FiscalAI';
      content = `
        <h2>Atenção: Pagamento Pendente ⚠️</h2>
        <p>Olá <strong>${user.name || 'Usuário'}</strong>,</p>
        <p>Identificamos um problema com o pagamento da sua assinatura.</p>
        <div class="highlight error">
          <strong>Seu acesso pode ser suspenso em breve.</strong>
          <p style="margin: 5px 0 0 0;">Por favor, atualize seus dados de pagamento para continuar usando o FiscalAI.</p>
        </div>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings" class="button">Atualizar Pagamento</a>
      `;
      break;

    case 'cancelado':
      subject = '😢 Assinatura Cancelada - FiscalAI';
      content = `
        <h2>Assinatura Cancelada</h2>
        <p>Olá <strong>${user.name || 'Usuário'}</strong>,</p>
        <p>Sua assinatura do FiscalAI foi cancelada.</p>
        <p>Sentiremos sua falta! Se mudar de ideia, você pode reativar sua assinatura a qualquer momento.</p>
        <div class="highlight">
          <strong>Seus dados foram preservados.</strong>
          <p style="margin: 5px 0 0 0;">Ao reativar, você terá acesso a todo seu histórico de notas fiscais.</p>
        </div>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/pricing" class="button">Reativar Assinatura</a>
      `;
      break;

    default:
      return { success: false, reason: 'Unknown status' };
  }

  return sendEmail({
    to: user.email,
    subject,
    html: emailTemplate(content, 'Status da Assinatura')
  });
}

export default {
  isEmailConfigured,
  sendEmail,
  sendWelcomeEmail,
  sendPaymentConfirmationEmail,
  sendInvoiceIssuedEmail,
  sendInvoiceRejectedEmail,
  sendSubscriptionStatusEmail
};
