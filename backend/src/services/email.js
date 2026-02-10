/**
 * Email Service for MAY
 * 
 * Handles sending notification emails for:
 * - User registration
 * - Payment confirmation
 * - Invoice issued/rejected
 * - Subscription status changes
 * - Password reset
 * 
 * Supports both Resend API (preferred) and SMTP via Nodemailer
 */

import nodemailer from 'nodemailer';
import { Resend } from 'resend';

// Email configuration from environment variables
const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || '587');
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || 'MAY <noreply@may.com.br>';
const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true';

// Resend API configuration (preferred)
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const USE_RESEND_API = !!RESEND_API_KEY;

// Initialize Resend if API key is provided
let resend = null;
if (USE_RESEND_API) {
  resend = new Resend(RESEND_API_KEY);
  console.log('[Email] Using Resend API for email delivery');
}

// Create SMTP transporter (reusable, fallback)
let transporter = null;

/**
 * Check if email service is configured
 */
export function isEmailConfigured() {
  // Resend API takes priority
  if (USE_RESEND_API) {
    return EMAIL_ENABLED && !!RESEND_API_KEY;
  }
  // Fallback to SMTP
  return EMAIL_ENABLED && EMAIL_USER && EMAIL_PASS;
}

/**
 * Get or create SMTP email transporter (fallback)
 */
function getTransporter() {
  if (!transporter && !USE_RESEND_API && EMAIL_USER && EMAIL_PASS) {
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

  const plainText = text || html.replace(/<[^>]*>/g, ''); // Strip HTML for plain text

  try {
    // Use Resend API if configured (preferred)
    if (USE_RESEND_API && resend) {
      const { data, error } = await resend.emails.send({
        from: EMAIL_FROM,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text: plainText
      });

      if (error) {
        console.error('[Email] Resend API error:', { to, subject, error: error.message });
        return { success: false, error: error.message };
      }

      console.log('[Email] Sent successfully via Resend:', { to, subject, id: data?.id });
      return { success: true, messageId: data?.id };
    }

    // Fallback to SMTP (nodemailer)
    const transport = getTransporter();
    if (!transport) {
      console.error('[Email] SMTP transporter not available');
      return { success: false, reason: 'SMTP transporter not configured' };
    }

    const result = await transport.sendMail({
      from: EMAIL_FROM,
      to,
      subject,
      html,
      text: plainText
    });

    console.log('[Email] Sent successfully via SMTP:', { to, subject, messageId: result.messageId });
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('[Email] Failed to send:', { to, subject, error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Email template wrapper
 */
function emailTemplate(content, title = 'MAY') {
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
      <div class="logo">🚀 MAY</div>
      <p style="color: #888; margin: 5px 0;">Assistente Fiscal IA</p>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>Este é um email automático da MAY.</p>
      <p>© ${new Date().getFullYear()} MAY - Todos os direitos reservados.</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send welcome email after successful email verification
 * Note: This is NOT called on registration. Only call this after email verification is complete.
 */
export async function sendWelcomeEmail(user) {
  const content = `
    <h2>Email Verificado com Sucesso! 🎉</h2>
    <p>Olá <strong>${user.name || 'Usuário'}</strong>,</p>
    <p>Sua conta foi ativada com sucesso! Estamos muito felizes em tê-lo conosco.</p>
    
    <div class="highlight success">
      <strong>Sua conta está pronta para uso!</strong>
      <p style="margin: 5px 0 0 0;">Você já pode começar a usar todas as funcionalidades da MAY.</p>
    </div>
    
    <p>Com a MAY você pode:</p>
    <ul>
      <li>✅ Emitir notas fiscais por comando de voz ou texto</li>
      <li>✅ Consultar seu faturamento em tempo real</li>
      <li>✅ Acompanhar impostos e obrigações fiscais</li>
      <li>✅ Gerenciar múltiplas empresas</li>
    </ul>
    
    <p>Para começar, acesse o sistema e cadastre sua primeira empresa:</p>
    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" class="button">Acessar MAY</a>
    
    <p>Precisa de ajuda? Nossa equipe está sempre disponível para ajudá-lo.</p>
  `;

  return sendEmail({
    to: user.email,
    subject: '🎉 Conta Ativada - MAY',
    html: emailTemplate(content, 'Conta Ativada')
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
        <span class="details-value">${payment.planName || 'MAY Pro'}</span>
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
      <p style="margin: 5px 0 0 0;">Você tem acesso completo a todas as funcionalidades da MAY.</p>
    </div>
    
    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" class="button">Acessar MAY</a>
  `;

  return sendEmail({
    to: user.email,
    subject: '✅ Pagamento Confirmado - MAY',
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
    subject: '⚠️ Problema na Emissão de Nota Fiscal - MAY',
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
      subject = '✅ Assinatura Ativada - MAY';
      content = `
        <h2>Assinatura Ativada! 🎉</h2>
        <p>Olá <strong>${user.name || 'Usuário'}</strong>,</p>
        <p>Sua assinatura da MAY está ativa!</p>
        <div class="highlight success">
          <strong>Você tem acesso completo a todas as funcionalidades.</strong>
        </div>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" class="button">Acessar MAY</a>
      `;
      break;

    case 'inadimplente':
      subject = '⚠️ Problema com sua Assinatura - MAY';
      content = `
        <h2>Atenção: Pagamento Pendente ⚠️</h2>
        <p>Olá <strong>${user.name || 'Usuário'}</strong>,</p>
        <p>Identificamos um problema com o pagamento da sua assinatura.</p>
        <div class="highlight error">
          <strong>Seu acesso pode ser suspenso em breve.</strong>
          <p style="margin: 5px 0 0 0;">Por favor, atualize seus dados de pagamento para continuar usando a MAY.</p>
        </div>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings" class="button">Atualizar Pagamento</a>
      `;
      break;

    case 'cancelado':
      subject = '😢 Assinatura Cancelada - MAY';
      content = `
        <h2>Assinatura Cancelada</h2>
        <p>Olá <strong>${user.name || 'Usuário'}</strong>,</p>
        <p>Sua assinatura da MAY foi cancelada.</p>
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

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(user, resetUrl) {
  const content = `
    <h2>Recuperação de Senha 🔐</h2>
    <p>Olá <strong>${user.name || 'Usuário'}</strong>,</p>
    <p>Recebemos uma solicitação para redefinir a senha da sua conta MAY.</p>
    
    <div class="highlight">
      <strong>Clique no botão abaixo para criar uma nova senha:</strong>
      <p style="margin: 5px 0 0 0; color: #888;">Este link expira em <strong>1 hora</strong>.</p>
    </div>
    
    <a href="${resetUrl}" class="button">Redefinir Minha Senha</a>
    
    <p style="color: #888; font-size: 14px; margin-top: 30px;">
      Se você não solicitou a recuperação de senha, ignore este email. 
      Sua conta permanece segura.
    </p>
    
    <div class="details" style="margin-top: 20px;">
      <p style="margin: 0; font-size: 12px; color: #666;">
        <strong>Por questões de segurança:</strong>
      </p>
      <ul style="margin: 10px 0; padding-left: 20px; font-size: 12px; color: #666;">
        <li>Nunca compartilhe este link com ninguém</li>
        <li>A MAY nunca solicita sua senha por email</li>
        <li>Este link é de uso único</li>
      </ul>
    </div>
    
    <p style="color: #666; font-size: 12px; margin-top: 20px;">
      Caso o botão não funcione, copie e cole o link abaixo no seu navegador:<br>
      <span style="color: #f97316; word-break: break-all;">${resetUrl}</span>
    </p>
  `;

  return sendEmail({
    to: user.email,
    subject: '🔐 Recuperação de Senha - MAY',
    html: emailTemplate(content, 'Recuperação de Senha')
  });
}

/**
 * Send email verification email (combined with welcome message)
 * This is the ONLY email sent on registration - no separate welcome email
 */
export async function sendEmailVerificationEmail(user, verificationUrl) {
  const content = `
    <h2>Bem-vindo à MAY! 🚀</h2>
    <p>Olá <strong>${user.name || 'Usuário'}</strong>,</p>
    <p>Obrigado por se cadastrar na MAY - sua plataforma de gestão fiscal inteligente!</p>
    <p>Para completar seu cadastro e começar a usar, precisamos verificar seu email:</p>
    
    <div class="highlight success">
      <strong>Verifique seu email para começar:</strong>
      <p style="margin: 5px 0 0 0; color: #888;">Clique no botão abaixo para ativar sua conta. Este link expira em <strong>24 horas</strong>.</p>
    </div>
    
    <a href="${verificationUrl}" class="button">Verificar Email e Começar</a>
    
    <p style="margin-top: 30px;">Após verificar, você poderá:</p>
    <ul>
      <li>✅ Emitir notas fiscais por comando de voz ou texto</li>
      <li>✅ Consultar seu faturamento em tempo real</li>
      <li>✅ Acompanhar impostos e obrigações</li>
      <li>✅ Gerenciar múltiplas empresas</li>
    </ul>
    
    <p style="color: #888; font-size: 14px; margin-top: 30px;">
      Se você não criou uma conta na MAY, ignore este email.
    </p>
    
    <p style="color: #666; font-size: 12px; margin-top: 20px;">
      Caso o botão não funcione, copie e cole o link abaixo no seu navegador:<br>
      <span style="color: #f97316; word-break: break-all;">${verificationUrl}</span>
    </p>
  `;

  return sendEmail({
    to: user.email,
    subject: '🚀 Bem-vindo à MAY - Verifique seu Email',
    html: emailTemplate(content, 'Bem-vindo à MAY')
  });
}

export default {
  isEmailConfigured,
  sendEmail,
  sendWelcomeEmail,
  sendPaymentConfirmationEmail,
  sendInvoiceIssuedEmail,
  sendInvoiceRejectedEmail,
  sendSubscriptionStatusEmail,
  sendPasswordResetEmail,
  sendEmailVerificationEmail
};
