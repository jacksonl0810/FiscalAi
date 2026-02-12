import express from 'express';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import axios from 'axios';
import FormDataLib from 'form-data';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireActiveSubscription } from '../middleware/subscriptionAccess.js';
import { emitNfse, checkNfseStatus, isNuvemFiscalConfigured } from '../services/nuvemFiscal.js';
import { sendSuccess } from '../utils/response.js';
import { checkMEILimit } from '../services/meiLimitTracking.js';
import { validateInvoiceForRegime, getRegimeRules, getRecommendedIssRate, getRegimeInvoiceDefaults } from '../services/regimeRules.js';
import { assistantLimiter, assistantReadLimiter, invoiceEmissionLimiter } from '../middleware/rateLimiter.js';
import { fetchWithTimeout, getTimeout } from '../utils/timeout.js';
// Import new AI services for human-like understanding
import { 
  classifyIntent, 
  extractMonetaryValue, 
  extractDocument, 
  extractClientName, 
  extractPeriod,
  normalizeInput,
  needsClarification,
  generateClarification,
  INTENT_TYPES 
} from '../services/aiIntentService.js';
import { 
  FUNCTION_DEFINITIONS, 
  generateSystemPrompt, 
  mapFunctionToAction, 
  requiresConfirmation,
  buildMessages,
  getOpenAIConfig 
} from '../services/aiPromptService.js';
import { buildRAGContext } from '../services/ragService.js';

// Multer configuration for audio uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB max (Whisper API limit)
  },
  fileFilter: (req, file, cb) => {
    // More lenient MIME type checking - check if it starts with 'audio/'
    // This handles cases like 'audio/webm;codecs=opus'
    const mimeType = file.mimetype || '';
    if (mimeType.startsWith('audio/')) {
      cb(null, true);
    } else {
      console.error('[Multer] Unsupported file type:', mimeType);
      cb(new Error(`Unsupported audio format: ${mimeType}. Please use audio files only.`), false);
    }
  }
});

const router = express.Router();

/**
 * POST /api/assistant/translate-error
 * Translate technical errors to user-friendly Portuguese messages
 * Used by AI to explain errors in a conversational way
 * 
 * PUBLIC ENDPOINT - No authentication required (needed for error translation during login/registration)
 */
router.post('/translate-error', [
  body('error').notEmpty().withMessage('Error message or object is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ status: 'error', message: 'Validation failed', errors: errors.array() });
  }

  const { error, context = {} } = req.body;
  
  const { translateError, translateErrorForAI } = await import('../services/errorTranslationService.js');
  
  const translation = translateError(error, context);
  const aiExplanation = translateErrorForAI(error, context);
  
  sendSuccess(res, 'Erro traduzido com sucesso', {
    message: translation.message,
    explanation: translation.explanation,
    action: translation.action,
    category: translation.category,
    ai_explanation: aiExplanation
  });
}));

// All routes require authentication and active subscription
router.use(authenticate);
router.use(asyncHandler(requireActiveSubscription));

/**
 * POST /api/assistant/process
 * Process an AI command/message
 */
router.post('/process', assistantLimiter, [
  body('message').notEmpty().withMessage('Message is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ status: 'error', message: 'Validation failed', errors: errors.array() });
  }

  const { message, companyId, conversationHistory = [] } = req.body;

  // Get company data for regime-specific context
  let company = null;
  if (companyId) {
    company = await prisma.company.findFirst({
      where: {
        id: companyId,
        userId: req.user.id
      },
      select: {
        id: true,
        regimeTributario: true,
        razaoSocial: true,
        nomeFantasia: true
      }
    });
  }

  // Save user message to conversation history
  await prisma.conversationMessage.create({
    data: {
      userId: req.user.id,
      role: 'user',
      content: message,
      metadata: companyId ? JSON.parse(JSON.stringify({ companyId })) : null
    }
  });

  // Load conversation history from database (last 20 messages)
  const dbHistory = await prisma.conversationMessage.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'asc' },
    take: 20,
    select: {
      role: true,
      content: true
    }
  });

  // Merge with provided history (prefer provided if exists, otherwise use DB)
  const finalHistory = conversationHistory.length > 0 
    ? conversationHistory 
    : dbHistory.map(msg => ({ role: msg.role, content: msg.content }));

  // Check if OpenAI API key is configured
  const openaiApiKey = process.env.OPENAI_API_KEY;

  // =====================================================
  // STEP 1: Use AI Intent Service for human-like understanding
  // =====================================================
  const normalizedMessage = normalizeInput(message);
  const intentClassification = classifyIntent(message, { company });
  
  console.log('[Assistant] Intent classification:', {
    message: message.substring(0, 50),
    intent: intentClassification.intent,
    confidence: intentClassification.confidence,
    data: intentClassification.data
  });

  // =====================================================
  // STEP 2: Handle high-confidence pattern matches directly
  // =====================================================
  // For high-confidence intents, use pattern matching for real data
  // This ensures deterministic responses for actions that need database queries
  if (intentClassification.confidence >= 0.6 || messageMatchesPriorityIntent(message)) {
    const patternResult = await processWithPatternMatching(message, req.user.id, companyId, res, intentClassification);
    if (patternResult && patternResult.explanation) {
      try {
        await prisma.conversationMessage.create({
          data: {
            userId: req.user.id,
            role: 'assistant',
            content: patternResult.explanation,
            metadata: patternResult.action ? JSON.parse(JSON.stringify({ action: patternResult.action })) : null
          }
        });
      } catch (dbError) {
        console.error('Failed to save conversation history:', dbError.message);
      }
    }
    return patternResult;
  }

  // =====================================================
  // STEP 3: Fallback to pattern matching if no OpenAI key
  // =====================================================
  if (!openaiApiKey) {
    return processWithPatternMatching(message, req.user.id, companyId, res, intentClassification);
  }

  // =====================================================
  // STEP 4: Use OpenAI with function calling for complex queries
  // =====================================================
  try {
    const timeoutMs = getTimeout('openai');

    // Build RAG context - retrieve relevant user data from database
    const ragContext = await buildRAGContext(message, req.user.id, companyId);
    
    // Build messages with improved system prompt + RAG context
    const messages = buildMessages(message, finalHistory, { company, user: req.user, ragContext });
    
    // Get OpenAI config with function definitions
    const openaiConfig = getOpenAIConfig(messages, true);

    // Call OpenAI API with function calling
    const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify(openaiConfig)
    }, timeoutMs);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Assistant] OpenAI API error:', response.status, errorText);
      throw new Error('OpenAI API request failed');
    }

    const data = await response.json();
    const assistantResponse = data.choices[0]?.message;

    if (!assistantResponse) {
      throw new Error('No response from OpenAI');
    }

    let responseData;

    // Check if the model wants to call a function
    if (assistantResponse.tool_calls && assistantResponse.tool_calls.length > 0) {
      const toolCall = assistantResponse.tool_calls[0];
      const functionName = toolCall.function.name;
      const functionArgs = JSON.parse(toolCall.function.arguments || '{}');
      
      console.log('[Assistant] Function call:', functionName, functionArgs);
      
      // Map function to internal action type
      const actionType = mapFunctionToAction(functionName);
      const needsConfirm = requiresConfirmation(actionType);
      
      // Check if action requires a company but user has none
      const actionsRequiringCompany = [
        'emitir_nfse', 'cancelar_nfse', 'listar_notas', 'ultima_nota', 
        'notas_rejeitadas', 'consultar_status', 'consultar_faturamento', 
        'ver_impostos', 'verificar_conexao'
      ];
      
      if (actionsRequiringCompany.includes(actionType)) {
        const userCompanies = await prisma.company.findMany({
          where: { userId: req.user.id },
          select: { id: true }
        });
        
        if (userCompanies.length === 0) {
          responseData = {
            success: true,
            action: { type: 'empresa_necessaria', data: null },
            explanation: `🏢 **Você ainda não tem uma empresa cadastrada!**\n\n` +
              `Para emitir notas fiscais e acessar as funcionalidades de gestão fiscal, você precisa primeiro cadastrar sua empresa.\n\n` +
              `**Como cadastrar:**\n` +
              `1. Clique em **"+ Adicionar empresa"** no menu lateral, ou\n` +
              `2. Acesse **"Minhas Empresas"** e clique em **"Nova Empresa"**\n\n` +
              `Você precisará informar:\n` +
              `• CNPJ da empresa\n` +
              `• Razão Social\n` +
              `• Cidade e Estado\n` +
              `• Regime Tributário (MEI ou Simples Nacional)\n` +
              `• Inscrição Municipal\n` +
              `• Certificado Digital (para integração com a prefeitura)\n\n` +
              `💡 **Dica:** Se você é MEI, seu CNPJ está no Certificado MEI (CCMEI) que você recebeu ao se formalizar.`,
            requiresConfirmation: false
          };
          
          // Save response to conversation history
          await prisma.conversationMessage.create({
            data: {
              userId: req.user.id,
              role: 'assistant',
              content: responseData.explanation,
              metadata: { action: responseData.action }
            }
          });
          
          return res.json(responseData);
        }
      }
      
      // For criar_cliente with complete data, auto-execute instead of requiring confirmation
      if (actionType === 'criar_cliente' && functionArgs.name && functionArgs.document) {
        const cleanDocument = functionArgs.document.replace(/\D/g, '');
        if (cleanDocument.length === 11 || cleanDocument.length === 14) {
          console.log('[Assistant] Auto-executing criar_cliente with complete data:', functionArgs);
          
          const tipoPessoa = cleanDocument.length === 11 ? 'pf' : 'pj';
          const docLabel = tipoPessoa === 'pf' ? 'CPF' : 'CNPJ';
          
          // Check if client already exists
          const existingClient = await prisma.client.findFirst({
            where: {
              userId: req.user.id,
              documento: cleanDocument
            }
          });
          
          if (existingClient) {
            const docFormatado = formatDocumentForDisplay(existingClient.documento, existingClient.tipoPessoa);
            responseData = {
              success: true,
              action: { type: 'cliente_existente', data: { id: existingClient.id, nome: existingClient.nome, documento: existingClient.documento } },
              explanation: `Já existe um cliente cadastrado com este ${docLabel}: **${existingClient.nome}** (${docFormatado}).\n\n` +
                `Você pode emitir notas para ele. Diga:\n` +
                `"Emitir nota de R$ [valor] para ${existingClient.nome}"`,
              requiresConfirmation: false
            };
          } else {
            // Create new client
            try {
              const newClient = await prisma.client.create({
                data: {
                  userId: req.user.id,
                  nome: functionArgs.name.trim(),
                  documento: cleanDocument,
                  tipoPessoa,
                  email: functionArgs.email || null,
                  telefone: functionArgs.phone || null,
                  ativo: true
                }
              });
              
              const docFormatado = formatDocumentForDisplay(cleanDocument, tipoPessoa);
              responseData = {
                success: true,
                action: { type: 'cliente_criado', data: { id: newClient.id, nome: newClient.nome, documento: newClient.documento } },
                explanation: `✅ Cliente **${newClient.nome}** cadastrado com sucesso!\n\n` +
                  `${docLabel}: ${docFormatado}\n\n` +
                  `Agora você pode emitir notas para este cliente. Diga:\n` +
                  `"Emitir nota de R$ [valor] para ${newClient.nome}"`,
                requiresConfirmation: false
              };
            } catch (createError) {
              console.error('[Assistant] Error auto-creating client:', createError.message);
              responseData = {
                success: false,
                action: null,
                explanation: `❌ Não foi possível cadastrar o cliente.\n\nErro: ${createError.message}`,
                requiresConfirmation: false
              };
            }
          }
          
          // Save response and return
          await prisma.conversationMessage.create({
            data: {
              userId: req.user.id,
              role: 'assistant',
              content: responseData.explanation,
              metadata: responseData.action ? JSON.parse(JSON.stringify({ action: responseData.action })) : null
            }
          });
          
          return res.json(responseData);
        }
      }
      
      // Map OpenAI function args to frontend-expected format
      let mappedArgs = functionArgs;
      
      if (actionType === 'emitir_nfse') {
        // OpenAI uses: client_name, value, service_description, client_document, iss_rate, service_code
        // Frontend expects: cliente_nome, valor, descricao_servico, cliente_documento, aliquota_iss, codigo_servico
        mappedArgs = {
          cliente_nome: functionArgs.client_name || functionArgs.cliente_nome || '',
          cliente_documento: functionArgs.client_document || functionArgs.cliente_documento || '',
          descricao_servico: functionArgs.service_description || functionArgs.descricao_servico || 'Serviço prestado',
          valor: parseFloat(functionArgs.value || functionArgs.valor) || 0,
          aliquota_iss: parseFloat(functionArgs.iss_rate || functionArgs.aliquota_iss) || 5,
          codigo_servico: functionArgs.service_code || functionArgs.codigo_servico || '',
          municipio: functionArgs.municipio || '',
        };
      }
      
      // Build response data with extracted action
      responseData = {
        success: true,
        action: {
          type: actionType,
          data: mappedArgs
        },
        explanation: assistantResponse.content || generateExplanationForAction(actionType, functionArgs),
        requiresConfirmation: needsConfirm
      };
    } else {
      // No function call - just a text response
      const assistantMessage = assistantResponse.content;
      
      // Try to parse as JSON (legacy format)
    try {
      const parsed = JSON.parse(assistantMessage);
      responseData = {
        success: true,
        action: parsed.action,
        explanation: parsed.explanation,
        requiresConfirmation: parsed.requiresConfirmation || false
      };
    } catch {
      // If not valid JSON, return as explanation only
      responseData = {
        success: true,
        action: null,
        explanation: assistantMessage,
        requiresConfirmation: false
      };
      }
    }

    // Save assistant response to conversation history
    await prisma.conversationMessage.create({
      data: {
        userId: req.user.id,
        role: 'assistant',
        content: responseData.explanation,
        metadata: responseData.action ? JSON.parse(JSON.stringify({ action: responseData.action })) : null
      }
      });

    return res.json(responseData);
  } catch (error) {
    console.error('OpenAI API error:', error.message || error);
    
    // Fallback to pattern matching with intent classification
    try {
      const patternResult = await processWithPatternMatching(message, req.user.id, companyId, res, intentClassification);
      
      // Save pattern matching response to history if it returned data
      if (patternResult && patternResult.explanation) {
        try {
          await prisma.conversationMessage.create({
            data: {
              userId: req.user.id,
              role: 'assistant',
              content: patternResult.explanation,
              metadata: patternResult.action ? { action: patternResult.action } : null
            }
          });
        } catch (dbError) {
          console.error('Failed to save conversation history:', dbError.message);
        }
      }
      
      return patternResult;
    } catch (fallbackError) {
      console.error('Pattern matching fallback also failed:', fallbackError.message);
      
      // Return a generic response if all else fails
      return res.json({
        success: true,
        action: null,
        explanation: "Desculpe, estou com dificuldades técnicas no momento. Por favor, tente novamente em alguns instantes. Como posso ajudar com:\n\n• Emitir notas fiscais\n• Consultar faturamento\n• Ver impostos pendentes",
        requiresConfirmation: false
      });
    }
  }
}));

/**
 * Generate human-friendly explanation for a function call action
 * 
 * @param {string} actionType - The action type
 * @param {object} args - The function arguments
 * @returns {string} Human-friendly explanation
 */
function generateExplanationForAction(actionType, args) {
  switch (actionType) {
    case 'emitir_nfse':
      const value = args.value ? `R$ ${args.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'valor não informado';
      const client = args.client_name || 'cliente não informado';
      const service = args.service_description || 'serviço não especificado';
      return `📝 **Nota fiscal preparada:**\n\n• **Valor:** ${value}\n• **Cliente:** ${client}\n• **Serviço:** ${service}\n\n✅ Deseja confirmar a emissão?`;
    
    case 'cancelar_nfse':
      return `❌ Você quer cancelar a nota ${args.invoice_id || 'informada'}. Para prosseguir, preciso do motivo do cancelamento (mínimo 15 caracteres).`;
    
    case 'listar_notas':
      const filters = [];
      if (args.status) filters.push(`status: ${args.status}`);
      if (args.period) filters.push(`período: ${args.period}`);
      if (args.client_name) filters.push(`cliente: ${args.client_name}`);
      return filters.length > 0 
        ? `📋 Vou buscar suas notas fiscais com os filtros: ${filters.join(', ')}`
        : '📋 Vou buscar suas notas fiscais mais recentes';
    
    case 'ultima_nota':
      return '🔍 Vou buscar sua última nota fiscal emitida';
    
    case 'notas_rejeitadas':
      return `⚠️ Vou verificar as notas fiscais rejeitadas${args.period ? ` do período: ${args.period}` : ''}`;
    
    case 'consultar_faturamento':
      return `💰 Vou consultar seu faturamento${args.period ? ` do período: ${args.period}` : ' deste mês'}`;
    
    case 'criar_cliente':
      return `👤 Vou cadastrar o cliente ${args.name || 'informado'}. ${args.document ? `Documento: ${args.document}` : 'Preciso do CPF ou CNPJ para continuar.'}`;
    
    case 'criar_empresa':
      return `🏢 Vou cadastrar a empresa ${args.razao_social || 'informada'}. ${args.cnpj ? `CNPJ: ${args.cnpj}` : 'Preciso do CNPJ para continuar.'}`;
    
    case 'listar_clientes':
      return '👥 Vou listar seus clientes cadastrados';
    
    case 'buscar_cliente':
      return `🔍 Vou buscar o cliente: ${args.query || 'informado'}`;
    
    case 'ver_impostos':
      return `📊 Vou verificar seus impostos${args.status ? ` com status: ${args.status}` : ' pendentes'}`;
    
    case 'verificar_conexao':
      return '🔌 Vou verificar o status da conexão com a prefeitura';
    
    case 'ajuda':
      return '❓ Como posso ajudar? Posso:\n\n• 📝 Emitir notas fiscais\n• 👥 Cadastrar clientes\n• 🏢 Cadastrar empresas\n• 💰 Consultar faturamento\n• 📊 Ver impostos pendentes\n• 🔌 Verificar conexão fiscal\n\nO que você precisa?';
    
    case 'fora_de_escopo':
      return `Desculpe, não posso ajudar com isso. Sou a MAY, sua assistente fiscal especializada. 😊\n\nPosso ajudar você com:\n📝 Emitir notas fiscais\n👥 Cadastrar clientes e empresas\n💰 Consultar faturamento\n📊 Ver impostos e guias DAS\n🔌 Verificar conexão fiscal\n\nComo posso ajudar com sua gestão fiscal?`;
    
    default:
      return 'Processando sua solicitação...';
  }
}

/**
 * Returns true if the message matches intents that must be handled by pattern matching first
 * so the assistant returns real data (faturamento, últimas notas, etc.) instead of generic
 * LLM replies. Includes emitir nota, clientes, faturamento, consultas de notas e impostos.
 */
function messageMatchesPriorityIntent(message) {
  const lower = message.toLowerCase();
  const trimmedMessage = message.trim();
  const messageLines = message.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Multi-line message detection (value + name + document on separate lines)
  if (messageLines.length >= 2) {
    let hasValue = false;
    let hasName = false;
    let hasDocument = false;
    
    for (const line of messageLines) {
      // Check for value
      if (/^\d+(?:[.,]\d+)?(?:\s*(?:reais|k))?$/i.test(line) || /^r\$\s*\d/i.test(line)) {
        hasValue = true;
      }
      // Check for document (CPF/CNPJ)
      if (/(?:cpf|cnpj|documento)\s*:?\s*\d/i.test(line) || /^\d{11}$|^\d{14}$/.test(line.replace(/\D/g, ''))) {
        hasDocument = true;
      }
      // Check for name (text only line)
      if (/^[A-Za-zÀ-ÿ\s.]+$/i.test(line) && line.length >= 2 && !/^(?:cpf|cnpj|documento|valor|r\$)$/i.test(line)) {
        hasName = true;
      }
    }
    
    // If we have name + document (or name + value), it's a priority intent
    if ((hasName && hasDocument) || (hasName && hasValue) || (hasValue && hasDocument)) {
      return true;
    }
  }
  
  // Invoice emission - ALL variations
  // Basic patterns
  if (/emitir\s+(?:uma\s+)?nota|nova\s+nota|gerar\s+nota|criar\s+nota|fazer\s+(?:uma\s+)?nota|lançar\s+nota/i.test(message)) return true;
  // Conversational patterns
  if (/(?:preciso|quero|gostaria|pode|poderia|vou|vamos)\s+(?:de\s+)?emitir/i.test(message)) return true;
  // Help patterns
  if (/(?:me\s+)?(?:ajud[ae]|auxili[ae])\s+(?:a\s+)?emitir/i.test(message)) return true;
  // Value with "nota" context
  if (/nota.*(?:r\$|reais|\d+\s*k\b)/i.test(message) || /(?:r\$|reais|\d+\s*k\b).*nota/i.test(message)) return true;
  // "nota de R$ X para Y" pattern
  if (/nota\s+(?:de\s+)?(?:r\$|\d+)/i.test(message) && /para\s+/i.test(message)) return true;
  // "nota para [cliente]"
  if (/nota\s+(?:fiscal\s+)?para\s+/i.test(message)) return true;
  
  // Criar cliente - ALL variations
  // Explicit: "criar/cadastrar/registrar/adicionar cliente"
  if (/(?:criar|cadastrar|cadastre|registrar|registre|adicionar|adicione|incluir|novo|nova)\s+(?:um\s+|uma\s+|o\s+|a\s+)?(?:novo\s+|nova\s+)?cliente/i.test(message)) return true;
  // Reversed: "cliente novo"
  if (/cliente\s+(?:novo|nova)/i.test(message)) return true;
  // Conversational: "preciso/quero cadastrar um cliente"
  if (/(?:preciso|quero|gostaria|pode|poderia|necessito|desejo|vou)\s+(?:de\s+)?(?:criar|cadastrar|registrar|adicionar|incluir)\s+(?:um\s+|uma\s+)?(?:novo\s+|nova\s+)?cliente/i.test(message)) return true;
  // "me ajuda a criar/cadastrar cliente"
  if (/(?:me\s+)?(?:ajud[ae]|auxili[ae])\s+(?:a\s+)?(?:criar|cadastrar|registrar|adicionar)\s+(?:um\s+|uma\s+)?(?:novo\s+|nova\s+)?cliente/i.test(message)) return true;
  // "cliente" + document pattern
  if (/cliente/i.test(message) && /(?:\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2}|\d{2}\.?\d{3}\.?\d{3}[\/]?\d{4}[-.]?\d{2}|\b\d{11}\b|\b\d{14}\b)/i.test(message)) return true;
  // Standalone: "Name CPF/CNPJ/documento [number]"
  if (/^(.+?)\s+(?:cpf|cnpj|documento)\s*:?\s*(\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2}|\d{2}\.?\d{3}\.?\d{3}[\/]?\d{4}[-.]?\d{2}|\d{11}|\d{14})$/i.test(trimmedMessage)) return true;
  // "Nome: X" with document somewhere
  if (/nome\s*[:=]\s*.+/i.test(message) && /(?:cpf|cnpj|documento)\s*:?\s*\d/i.test(message)) return true;
  
  // Criar empresa / cadastrar empresa / nova empresa
  if (/(?:criar|cadastrar|registrar|nova)\s+empresa/i.test(message)) return true;
  
  // Listar clientes
  if (/listar\s+cliente|meus\s+clientes|ver\s+clientes|clientes\s+cadastrados/i.test(lower)) return true;
  // Nota(s) de/para [cliente] (client search), not emitir
  if (/nota(?:s)?\s+(?:de|do|da|para)\s+.+/i.test(message) && !lower.includes('emitir')) return true;
  // Última nota / últimas notas
  if (/última\s+nota|ultima\s+nota|last\s+invoice|minha\s+última|nota\s+mais\s+recente|últimas\s+notas|ultimas\s+notas/i.test(lower)) return true;
  // Notas rejeitadas
  if ((lower.includes('rejeitada') || lower.includes('rejeitadas')) && (lower.includes('nota') || lower.includes('invoice') || lower.includes('mês') || lower.includes('mes'))) return true;
  // Notas pendentes / processando
  if ((lower.includes('pendente') || lower.includes('pendentes') || lower.includes('processando')) && (lower.includes('nota') || lower.includes('notas'))) return true;
  // Quantas / total notas
  if ((lower.includes('quantas') || lower.includes('total')) && (lower.includes('nota') || lower.includes('notas'))) return true;
  // Status da nota
  if (/status\s+(?:da\s+)?nota/i.test(message) || (lower.includes('status') && lower.includes('nota'))) return true;
  // Faturamento (Consultar faturamento)
  if (lower.includes('faturamento') || lower.includes('quanto faturei')) return true;
  // Listar notas
  if (lower.includes('listar') && (lower.includes('nota') || lower.includes('notas'))) return true;
  
  // Impostos / DAS / Ver impostos (SPECIFIC patterns to avoid false positives)
  // "das" is a common word in Portuguese, so we need careful matching
  const containsDocumentPattern = /\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2}|\d{2}\.?\d{3}\.?\d{3}[\/\-]?\d{4}[-.]?\d{2}/.test(message);
  if (!containsDocumentPattern) {
    // Specific tax keywords
    if (lower.includes('imposto') || lower.includes('tributo')) return true;
    // DAS with specific context
    if (/(?:ver|consultar|quais?|meus?|minhas?|mostrar?|listar?)\s+(?:os?\s+)?(?:das|guias?)/i.test(message)) return true;
    if (/(?:das|guias?)\s+(?:pendentes?|pagos?|vencidos?|atrasados?|do\s+m[eê]s)/i.test(lower)) return true;
    if (/guias?\s+(?:das|de\s+pagamento)/i.test(lower)) return true;
    if (/(?:pagar|pagamento)\s+(?:do?\s+)?(?:das|imposto)/i.test(lower)) return true;
    if (/das\s+(?:mei|simples|mensal)/i.test(lower)) return true;
    if (/^(?:das|impostos?|tributos?)$/i.test(trimmedMessage)) return true; // Exact match
  }
  
  // Cancelar nota
  if (lower.includes('cancelar') && lower.includes('nota')) return true;
  // Ajuda / oi / olá
  if (lower.includes('ajuda') || lower.includes('help') || lower === 'oi' || lower === 'olá') return true;
  return false;
}

/**
 * Pattern matching fallback when OpenAI is not available
 * Enhanced with comprehensive AI query handlers
 */
async function processWithPatternMatching(message, userId, companyId, res, intentClassification = null) {
  const lowerMessage = message.toLowerCase();
  const normalizedMessage = normalizeInput(message);
  
  // Use intent classification if provided, otherwise classify
  const intent = intentClassification || classifyIntent(message);
  
  console.log('[PatternMatching] Processing with intent:', intent.intent, 'confidence:', intent.confidence);

  // Get user's companies for queries
  const companies = await prisma.company.findMany({
    where: { userId },
    select: { id: true, razaoSocial: true, cidade: true, regimeTributario: true }
  });
  const companyIds = companies.map(c => c.id);
  
  // ========================================
  // CHECK: User has no company registered
  // ========================================
  const requiresCompanyPatterns = [
    /emitir\s+(?:uma\s+)?nota/i,
    /nova\s+nota/i,
    /gerar\s+nota/i,
    /criar\s+nota/i,
    /faturamento/i,
    /quanto\s+faturei/i,
    /minhas?\s+notas?/i,
    /última\s+nota/i,
    /ultima\s+nota/i,
    /notas?\s+(?:fiscais?|rejeitadas?|pendentes?)/i,
    /(?:ver|consultar|listar)\s+notas?/i,
    /impostos?/i,
    /(?:guias?|das)\s+(?:pendentes?|pagos?|vencidos?)/i,
    /(?:ver|consultar)\s+das/i,
    /cancelar\s+nota/i,
    /status\s+(?:da\s+)?nota/i
  ];
  
  const messageRequiresCompany = requiresCompanyPatterns.some(pattern => pattern.test(message));
  
  if (messageRequiresCompany && companies.length === 0) {
    const responseData = {
      success: true,
      action: { type: 'empresa_necessaria', data: null },
      explanation: `🏢 **Você ainda não tem uma empresa cadastrada!**\n\n` +
        `Para emitir notas fiscais e acessar as funcionalidades de gestão fiscal, você precisa primeiro cadastrar sua empresa.\n\n` +
        `**Como cadastrar:**\n` +
        `1. Clique em **"+ Adicionar empresa"** no menu lateral, ou\n` +
        `2. Acesse **"Minhas Empresas"** e clique em **"Nova Empresa"**\n\n` +
        `Você precisará informar:\n` +
        `• CNPJ da empresa\n` +
        `• Razão Social\n` +
        `• Cidade e Estado\n` +
        `• Regime Tributário (MEI ou Simples Nacional)\n` +
        `• Inscrição Municipal\n` +
        `• Certificado Digital (para integração com a prefeitura)\n\n` +
        `💡 **Dica:** Se você é MEI, seu CNPJ está no Certificado MEI (CCMEI) que você recebeu ao se formalizar.`,
      requiresConfirmation: false
    };
    res.json(responseData);
    return responseData;
  }

  // ========================================
  // PATTERN: Multi-line message handler
  // Handles messages where value, name, and document are on separate lines:
  //   "10,00
  //    LUCIANO BERNARDO
  //    CPF 65325273949"
  // This should be interpreted as an invoice emission request
  // ========================================
  const messageLines = message.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  if (messageLines.length >= 2) {
    const { extractMonetaryValue, extractDocument } = await import('../services/aiIntentService.js');
    
    // Try to extract value, name, and document from the multi-line message
    let multiLineValue = null;
    let multiLineName = null;
    let multiLineDocument = null;
    
    for (const line of messageLines) {
      // Check for value (numbers with comma/dot as decimal separator)
      if (!multiLineValue) {
        // Match patterns like "10,00", "1.500,00", "R$ 100", "100 reais", "2k"
        const valueMatch = line.match(/^(\d+(?:[.,]\d+)?)\s*(?:reais)?$/i) ||
                          line.match(/^r\$\s*(\d+(?:[.,]\d+)?)/i) ||
                          line.match(/^(\d+(?:[.,]?\d+)?)\s*k$/i);
        if (valueMatch) {
          let val = valueMatch[1].replace(',', '.');
          if (line.toLowerCase().includes('k')) {
            val = parseFloat(val) * 1000;
          }
          multiLineValue = parseFloat(val);
          continue;
        }
        // Also try extractMonetaryValue on the whole line
        const extractedVal = extractMonetaryValue(line);
        if (extractedVal) {
          multiLineValue = extractedVal;
          continue;
        }
      }
      
      // Check for document (CPF/CNPJ)
      if (!multiLineDocument) {
        const docMatch = line.match(/(?:cpf|cnpj|documento)\s*:?\s*(\d[\d.\-\/]*\d)/i) ||
                        line.match(/^(\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2})$/) || // CPF format
                        line.match(/^(\d{2}\.?\d{3}\.?\d{3}[\/]?\d{4}[-.]?\d{2})$/) || // CNPJ format
                        line.match(/^(\d{11}|\d{14})$/); // Plain digits
        if (docMatch) {
          const cleanDoc = docMatch[1].replace(/\D/g, '');
          if (cleanDoc.length === 11 || cleanDoc.length === 14) {
            multiLineDocument = cleanDoc;
            continue;
          }
        }
        const extractedDoc = extractDocument(line);
        if (extractedDoc) {
          multiLineDocument = extractedDoc.value;
          continue;
        }
      }
      
      // Check for name (text line that's not value or document)
      if (!multiLineName) {
        // If line is mostly letters (with spaces) and not a keyword
        const isNameLine = /^[A-Za-zÀ-ÿ\s.]+$/.test(line) && 
                          line.length >= 2 && 
                          !/^(?:cpf|cnpj|documento|valor|cliente|nota|emitir|r\$)$/i.test(line);
        if (isNameLine) {
          // Clean the name - remove trailing punctuation
          multiLineName = line.trim().replace(/[.,;:!?]+$/g, '').trim();
          continue;
        }
      }
    }
    
    // If we have value + name (with or without document), treat as invoice emission
    if (multiLineValue && multiLineName && companies.length > 0) {
      console.log('[MultiLine] Detected invoice emission:', { value: multiLineValue, name: multiLineName, document: multiLineDocument });
      
      // Check if client exists
      const matchingClient = await prisma.client.findFirst({
        where: {
          userId,
          ativo: true,
          OR: [
            { nome: { contains: multiLineName, mode: 'insensitive' } },
            { apelido: { contains: multiLineName, mode: 'insensitive' } },
            ...(multiLineDocument ? [{ documento: multiLineDocument }] : [])
          ]
        }
      });
      
      if (matchingClient) {
        // Found client - prepare invoice
        const valorFormatado = multiLineValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const docLabel = matchingClient.tipoPessoa === 'pf' ? 'CPF' : 'CNPJ';
        const docFormatado = formatDocumentForDisplay(matchingClient.documento, matchingClient.tipoPessoa);
        
        const responseData = {
          success: true,
          action: {
            type: 'emitir_nfse',
            data: {
              cliente_nome: matchingClient.nome,
              cliente_documento: matchingClient.documento,
              descricao_servico: 'Serviço prestado',
              valor: multiLineValue,
              aliquota_iss: 5,
              client_id: matchingClient.id
            }
          },
          explanation: `📝 **Nota fiscal preparada:**\n\n` +
            `• **Valor:** R$ ${valorFormatado}\n` +
            `• **Cliente:** ${matchingClient.nome}\n` +
            `• **${docLabel}:** ${docFormatado}\n` +
            `• **Serviço:** Serviço prestado\n` +
            `• **ISS:** 5%\n\n` +
            `✅ Deseja confirmar a emissão desta nota?`,
          requiresConfirmation: true
        };
        res.json(responseData);
        return responseData;
      } else if (multiLineDocument) {
        // Client not found but we have document - offer to create
        const tipoPessoa = multiLineDocument.length === 11 ? 'pf' : 'pj';
        const docLabel = tipoPessoa === 'pf' ? 'CPF' : 'CNPJ';
        const docFormatado = formatDocumentForDisplay(multiLineDocument, tipoPessoa);
        const valorFormatado = multiLineValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        
        // Auto-create the client and prepare invoice
        try {
          const newClient = await prisma.client.create({
            data: {
              userId,
              nome: multiLineName,
              documento: multiLineDocument,
              tipoPessoa,
              ativo: true
            }
          });
          
          const responseData = {
            success: true,
            action: {
              type: 'emitir_nfse',
              data: {
                cliente_nome: newClient.nome,
                cliente_documento: newClient.documento,
                descricao_servico: 'Serviço prestado',
                valor: multiLineValue,
                aliquota_iss: 5,
                client_id: newClient.id
              }
            },
            explanation: `✅ Cliente **${newClient.nome}** cadastrado automaticamente!\n\n` +
              `📝 **Nota fiscal preparada:**\n\n` +
              `• **Valor:** R$ ${valorFormatado}\n` +
              `• **Cliente:** ${newClient.nome}\n` +
              `• **${docLabel}:** ${docFormatado}\n` +
              `• **Serviço:** Serviço prestado\n` +
              `• **ISS:** 5%\n\n` +
              `✅ Deseja confirmar a emissão desta nota?`,
            requiresConfirmation: true
          };
          res.json(responseData);
          return responseData;
        } catch (createError) {
          console.error('[MultiLine] Error creating client:', createError.message);
          // If client creation failed, ask user to provide document
          const responseData = {
            success: true,
            action: {
              type: 'criar_cliente_e_emitir',
              data: {
                cliente_nome: multiLineName,
                cliente_documento: multiLineDocument,
                valor: multiLineValue,
                aliquota_iss: 5
              }
            },
            explanation: `Não consegui cadastrar o cliente automaticamente.\n\n` +
              `Para emitir a nota de R$ ${valorFormatado} para **${multiLineName}**, diga "criar cliente ${multiLineName} ${docLabel} ${docFormatado}" e depois tente novamente.`,
            requiresConfirmation: false
          };
          res.json(responseData);
          return responseData;
        }
      } else {
        // Client not found and no document - ask for document
        const valorFormatado = multiLineValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const responseData = {
          success: true,
          action: {
            type: 'criar_cliente_e_emitir',
            data: {
              cliente_nome: multiLineName,
              valor: multiLineValue,
              aliquota_iss: 5
            }
          },
          explanation: `Não encontrei **${multiLineName}** cadastrado.\n\n` +
            `Para emitir a nota de R$ ${valorFormatado}, preciso do CPF ou CNPJ do cliente.\n\n` +
            `Por favor, informe o documento ou diga:\n` +
            `"criar cliente ${multiLineName} CPF 123.456.789-00"`,
          requiresConfirmation: false
        };
        res.json(responseData);
        return responseData;
      }
    }
    
    // If we only have name + document (no value), treat as client creation
    if (!multiLineValue && multiLineName && multiLineDocument) {
      console.log('[MultiLine] Detected client creation:', { name: multiLineName, document: multiLineDocument });
      
      const tipoPessoa = multiLineDocument.length === 11 ? 'pf' : 'pj';
      
      // Check if client already exists
      const existingClient = await prisma.client.findFirst({
        where: {
          userId,
          documento: multiLineDocument
        }
      });
      
      if (existingClient) {
        const docLabel = existingClient.tipoPessoa === 'pf' ? 'CPF' : 'CNPJ';
        const docFormatado = formatDocumentForDisplay(existingClient.documento, existingClient.tipoPessoa);
        const responseData = {
          success: true,
          action: { type: 'cliente_existente', data: { id: existingClient.id, nome: existingClient.nome, documento: existingClient.documento } },
          explanation: `Já existe um cliente cadastrado com este ${docLabel}: **${existingClient.nome}** (${docFormatado}).\n\n` +
            `Você pode emitir notas para ele. Diga:\n` +
            `"Emitir nota de R$ [valor] para ${existingClient.nome}"`,
          requiresConfirmation: false
        };
        res.json(responseData);
        return responseData;
      }
      
      // Create new client
      try {
        const newClient = await prisma.client.create({
          data: {
            userId,
            nome: multiLineName,
            documento: multiLineDocument,
            tipoPessoa,
            ativo: true
          }
        });
        
        const docLabel = tipoPessoa === 'pf' ? 'CPF' : 'CNPJ';
        const docFormatado = formatDocumentForDisplay(multiLineDocument, tipoPessoa);
        const responseData = {
          success: true,
          action: { type: 'cliente_criado', data: { id: newClient.id, nome: newClient.nome, documento: newClient.documento } },
          explanation: `✅ Cliente **${newClient.nome}** cadastrado com sucesso!\n\n` +
            `${docLabel}: ${docFormatado}\n\n` +
            `Agora você pode emitir notas para este cliente. Diga:\n` +
            `"Emitir nota de R$ [valor] para ${newClient.nome}"`,
          requiresConfirmation: false
        };
        res.json(responseData);
        return responseData;
      } catch (error) {
        console.error('[MultiLine] Error creating client:', error.message);
        const responseData = {
          success: false,
          action: null,
          explanation: `❌ Não foi possível cadastrar o cliente.\n\nErro: ${error.message}`,
          requiresConfirmation: false
        };
        res.json(responseData);
        return responseData;
      }
    }
  }

  // ========================================
  // QUERY: Last invoice / Última nota
  // ========================================
  if (lowerMessage.includes('última nota') || lowerMessage.includes('ultima nota') || 
      lowerMessage.includes('last invoice') || lowerMessage.includes('minha última') ||
      lowerMessage.includes('nota mais recente')) {
    
    const lastInvoice = await prisma.invoice.findFirst({
      where: { companyId: { in: companyIds } },
      orderBy: { dataEmissao: 'desc' },
      include: { company: { select: { razaoSocial: true } } }
    });

    if (!lastInvoice) {
      const responseData = {
        success: true,
        action: { type: 'consultar_ultima_nota', data: null },
        explanation: 'Você ainda não emitiu nenhuma nota fiscal. Diga "Emitir nota de R$ [valor] para [cliente]" para emitir sua primeira nota.',
        requiresConfirmation: false
      };
      res.json(responseData);
      return responseData;
    }

    const responseData = {
      success: true,
      action: { 
        type: 'consultar_ultima_nota', 
        data: {
          id: lastInvoice.id,
          numero: lastInvoice.numero,
          cliente: lastInvoice.clienteNome,
          valor: parseFloat(lastInvoice.valor),
          status: lastInvoice.status,
          data: lastInvoice.dataEmissao
        }
      },
      explanation: `📄 **Sua última nota fiscal:**\n\n` +
        `• **Número:** ${lastInvoice.numero || 'Processando'}\n` +
        `• **Cliente:** ${lastInvoice.clienteNome}\n` +
        `• **Valor:** R$ ${parseFloat(lastInvoice.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
        `• **Status:** ${formatStatus(lastInvoice.status)}\n` +
        `• **Data:** ${lastInvoice.dataEmissao.toLocaleDateString('pt-BR')}\n` +
        (lastInvoice.pdfUrl ? `\n📥 [Baixar PDF](${lastInvoice.pdfUrl})` : ''),
      requiresConfirmation: false
    };
    res.json(responseData);
    return responseData;
  }

  // ========================================
  // QUERY: Rejected invoices / Notas rejeitadas
  // ========================================
  if ((lowerMessage.includes('rejeitada') || lowerMessage.includes('rejeitadas') || 
       lowerMessage.includes('rejected')) && 
      (lowerMessage.includes('nota') || lowerMessage.includes('invoice') || lowerMessage.includes('mês') || lowerMessage.includes('mes'))) {
    
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const rejectedInvoices = await prisma.invoice.findMany({
      where: {
        companyId: { in: companyIds },
        status: 'rejeitada',
        dataEmissao: {
          gte: new Date(currentYear, currentMonth, 1),
          lt: new Date(currentYear, currentMonth + 1, 1)
        }
      },
      orderBy: { dataEmissao: 'desc' },
      take: 10
    });

    if (rejectedInvoices.length === 0) {
      const responseData = {
        success: true,
        action: { type: 'consultar_notas_rejeitadas', data: { count: 0, invoices: [] } },
        explanation: '✅ Ótimo! Você não tem nenhuma nota fiscal rejeitada este mês.',
        requiresConfirmation: false
      };
      res.json(responseData);
      return responseData;
    }

    let explanation = `⚠️ **Notas fiscais rejeitadas este mês:** ${rejectedInvoices.length}\n\n`;
    rejectedInvoices.forEach((inv, index) => {
      explanation += `${index + 1}. **${inv.clienteNome}** - R$ ${parseFloat(inv.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${inv.dataEmissao.toLocaleDateString('pt-BR')})\n`;
    });
    explanation += '\nAcesse a seção "Notas Fiscais" para ver os detalhes e corrigir os problemas.';

    const responseData = {
      success: true,
      action: { 
        type: 'consultar_notas_rejeitadas', 
        data: { 
          count: rejectedInvoices.length, 
          invoices: rejectedInvoices.map(inv => ({
            id: inv.id,
            cliente: inv.clienteNome,
            valor: parseFloat(inv.valor),
            data: inv.dataEmissao
          }))
        }
      },
      explanation: explanation,
      requiresConfirmation: false
    };
    res.json(responseData);
    return responseData;
  }

  // ========================================
  // QUERY: Pending invoices / Notas pendentes
  // ========================================
  if ((lowerMessage.includes('pendente') || lowerMessage.includes('pendentes') || 
       lowerMessage.includes('processando') || lowerMessage.includes('pending')) && 
      (lowerMessage.includes('nota') || lowerMessage.includes('notas'))) {
    
    const pendingInvoices = await prisma.invoice.findMany({
      where: {
        companyId: { in: companyIds },
        status: { in: ['processando', 'rascunho', 'pendente'] }
      },
      orderBy: { dataEmissao: 'desc' },
      take: 10
    });

    if (pendingInvoices.length === 0) {
      const responseData = {
        success: true,
        action: { type: 'consultar_notas_pendentes', data: { count: 0 } },
        explanation: '✅ Você não tem notas fiscais pendentes ou processando.',
        requiresConfirmation: false
      };
      res.json(responseData);
      return responseData;
    }

    let explanation = `⏳ **Notas fiscais pendentes/processando:** ${pendingInvoices.length}\n\n`;
    pendingInvoices.forEach((inv, index) => {
      explanation += `${index + 1}. **${inv.clienteNome}** - R$ ${parseFloat(inv.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} - Status: ${formatStatus(inv.status)}\n`;
    });

    const responseData = {
      success: true,
      action: { type: 'consultar_notas_pendentes', data: { count: pendingInvoices.length } },
      explanation: explanation,
      requiresConfirmation: false
    };
    res.json(responseData);
    return responseData;
  }

  // ========================================
  // QUERY: Invoice by client name
  // Skip if the message is about CREATING an invoice (not searching)
  // ========================================
  const clientSearchPattern = /nota(?:s)?\s+(?:de|do|da|para)\s+(.+)/i;
  const clientSearchMatch = message.match(clientSearchPattern);
  const isInvoiceCreation = /(?:nova|emitir|gerar|criar|fazer|lan[cç]ar|registrar)\s/i.test(message) ||
    /nota\s+(?:de\s+)?r\$\s*/i.test(message) ||
    /nota\s+(?:de\s+)?\d+(?:[.,]\d+)?/i.test(message);
  if (clientSearchMatch && !isInvoiceCreation) {
    const clientName = clientSearchMatch[1].trim();
    
    const clientInvoices = await prisma.invoice.findMany({
      where: {
        companyId: { in: companyIds },
        clienteNome: { contains: clientName, mode: 'insensitive' }
      },
      orderBy: { dataEmissao: 'desc' },
      take: 5
    });

    if (clientInvoices.length === 0) {
      const responseData = {
        success: true,
        action: { type: 'buscar_notas_cliente', data: { cliente: clientName, count: 0 } },
        explanation: `Não encontrei notas fiscais para "${clientName}". Verifique o nome do cliente ou acesse a seção "Notas Fiscais" para buscar.`,
        requiresConfirmation: false
      };
      res.json(responseData);
      return responseData;
    }

    let explanation = `📄 **Notas fiscais de "${clientName}":** ${clientInvoices.length} encontrada(s)\n\n`;
    clientInvoices.forEach((inv, index) => {
      explanation += `${index + 1}. R$ ${parseFloat(inv.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} - ${formatStatus(inv.status)} (${inv.dataEmissao.toLocaleDateString('pt-BR')})\n`;
    });

    const responseData = {
      success: true,
      action: { 
        type: 'buscar_notas_cliente', 
        data: { 
          cliente: clientName, 
          count: clientInvoices.length,
          invoices: clientInvoices.map(inv => ({
            id: inv.id,
            valor: parseFloat(inv.valor),
            status: inv.status,
            data: inv.dataEmissao
          }))
        }
      },
      explanation: explanation,
      requiresConfirmation: false
    };
    res.json(responseData);
    return responseData;
  }

  // ========================================
  // QUERY: Total invoices count / Quantas notas
  // ========================================
  if ((lowerMessage.includes('quantas') || lowerMessage.includes('total')) && 
      (lowerMessage.includes('nota') || lowerMessage.includes('notas'))) {
    
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const [monthCount, yearCount, totalCount] = await Promise.all([
      prisma.invoice.count({
        where: {
          companyId: { in: companyIds },
          status: 'autorizada',
          dataEmissao: {
            gte: new Date(currentYear, currentMonth, 1),
            lt: new Date(currentYear, currentMonth + 1, 1)
          }
        }
      }),
      prisma.invoice.count({
        where: {
          companyId: { in: companyIds },
          status: 'autorizada',
          dataEmissao: {
            gte: new Date(currentYear, 0, 1),
            lt: new Date(currentYear + 1, 0, 1)
          }
        }
      }),
      prisma.invoice.count({
        where: {
          companyId: { in: companyIds },
          status: 'autorizada'
        }
      })
    ]);

    const responseData = {
      success: true,
      action: { type: 'consultar_total_notas', data: { month: monthCount, year: yearCount, total: totalCount } },
      explanation: `📊 **Total de notas fiscais emitidas:**\n\n` +
        `• Este mês: ${monthCount} notas\n` +
        `• Este ano: ${yearCount} notas\n` +
        `• Total geral: ${totalCount} notas`,
      requiresConfirmation: false
    };
    res.json(responseData);
    return responseData;
  }

  // ========================================
  // QUERY: Check invoice status by number
  // ========================================
  const statusPattern = /status\s+(?:da\s+)?nota\s+(?:número\s+)?(\d+)/i;
  const statusMatch = message.match(statusPattern);
  if (statusMatch || (lowerMessage.includes('status') && lowerMessage.includes('nota'))) {
    const invoiceNumber = statusMatch ? statusMatch[1] : null;
    
    if (invoiceNumber) {
      const invoice = await prisma.invoice.findFirst({
        where: {
          companyId: { in: companyIds },
          numero: invoiceNumber
        }
      });

      if (invoice) {
        const responseData = {
          success: true,
          action: { 
            type: 'consultar_status_nota', 
            data: { 
              numero: invoice.numero,
              status: invoice.status,
              cliente: invoice.clienteNome
            }
          },
          explanation: `📋 **Status da nota ${invoice.numero}:**\n\n` +
            `• Cliente: ${invoice.clienteNome}\n` +
            `• Status: ${formatStatus(invoice.status)}\n` +
            `• Valor: R$ ${parseFloat(invoice.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          requiresConfirmation: false
        };
        res.json(responseData);
        return responseData;
      }
    }

    const responseData = {
      success: true,
      action: null,
      explanation: 'Para consultar o status de uma nota específica, diga o número da nota. Por exemplo: "Status da nota 12345"',
      requiresConfirmation: false
    };
    res.json(responseData);
    return responseData;
  }

  // ========================================
  // PATTERN: Create client - UNIVERSAL HANDLER
  // Handles ALL variations of client creation messages:
  //   - "Criar cliente João Silva CPF 123.456.789-00"
  //   - "Cadastrar cliente: Pedro, CPF: 555.666.777-88, email pedro@email.com"
  //   - "Preciso cadastrar um novo cliente. O nome é Maria e o CPF é 987.654.321-00"
  //   - "Quero adicionar um cliente novo. Nome: Fernanda, CPF: 444.555.666-77"
  //   - "Oi MAY, preciso adicionar um cliente novo chamado João com CPF 123.456.789-00"
  //   - "João Silva CPF 123.456.789-00" (standalone)
  //   - "Novo cliente: Empresa ABC LTDA, CNPJ 12.345.678/0001-90"
  //   - "Cadastre o cliente Roberto Alves, documento 12345678900"
  // ========================================
  const clientCreationDetected = detectClientCreationIntent(message, lowerMessage, intent);
  
  if (clientCreationDetected) {
    const extracted = extractClientDataFromMessage(message);
    
    // If we have both name and document, create the client
    if (extracted.name && extracted.document) {
      const documento = extracted.document.replace(/\D/g, '');
      
      // Validate document length
      if (documento.length !== 11 && documento.length !== 14) {
        const responseData = {
          success: false,
          action: null,
          explanation: `O documento informado é inválido. CPF deve ter 11 dígitos e CNPJ deve ter 14 dígitos.\n\nPor favor, tente novamente com o formato correto:\n• CPF: 123.456.789-00\n• CNPJ: 12.345.678/0001-00`,
          requiresConfirmation: false
        };
        res.json(responseData);
        return responseData;
      }
      
      const tipoPessoa = documento.length === 11 ? 'pf' : 'pj';
      
      // Check if client already exists
      const existingClient = await prisma.client.findFirst({
        where: { userId, documento }
      });
      
      if (existingClient) {
        const responseData = {
          success: true,
          action: { type: 'cliente_existente', data: { id: existingClient.id, nome: existingClient.nome, documento: existingClient.documento } },
          explanation: `Já existe um cliente cadastrado com este ${tipoPessoa === 'pf' ? 'CPF' : 'CNPJ'}: **${existingClient.nome}**.\n\nVocê pode usá-lo para emitir notas. Diga "Emitir nota de R$ [valor] para ${existingClient.nome}".`,
          requiresConfirmation: false
        };
        res.json(responseData);
        return responseData;
      }
      
      // Build client data with optional fields
      const clientData = {
        userId,
        nome: extracted.name,
        documento,
        tipoPessoa
      };
      if (extracted.email) clientData.email = extracted.email;
      if (extracted.phone) clientData.telefone = extracted.phone;
      
      // Create the client
      try {
        const newClient = await prisma.client.create({ data: clientData });
        
        let successMsg = `✅ Cliente **${newClient.nome}** cadastrado com sucesso!\n\n${tipoPessoa === 'pf' ? 'CPF' : 'CNPJ'}: ${formatDocumentForDisplay(documento, tipoPessoa)}`;
        if (extracted.email) successMsg += `\nEmail: ${extracted.email}`;
        if (extracted.phone) successMsg += `\nTelefone: ${extracted.phone}`;
        successMsg += `\n\nAgora você pode emitir notas para este cliente. Diga "Emitir nota de R$ [valor] para ${newClient.nome}".`;
        
        const responseData = {
          success: true,
          action: { type: 'cliente_criado', data: { id: newClient.id, nome: newClient.nome, documento: newClient.documento } },
          explanation: successMsg,
          requiresConfirmation: false
        };
        res.json(responseData);
        return responseData;
      } catch (error) {
        const responseData = {
          success: false,
          action: null,
          explanation: `Erro ao cadastrar cliente: ${error.message}`,
          requiresConfirmation: false
        };
        res.json(responseData);
        return responseData;
      }
    }
    
    // We detected client creation intent but missing data - ask for it
    if (extracted.name && !extracted.document) {
      const responseData = {
        success: true,
        action: { type: 'aguardando_documento', data: { nome: extracted.name } },
        explanation: `👤 Entendi! Vou cadastrar o cliente **${extracted.name}**.\n\nPor favor, informe o CPF ou CNPJ:\n• Exemplo: CPF 123.456.789-00\n• Exemplo: CNPJ 12.345.678/0001-90`,
        requiresConfirmation: false
      };
      res.json(responseData);
      return responseData;
    }
    
    if (!extracted.name && extracted.document) {
      const responseData = {
        success: true,
        action: { type: 'aguardando_nome', data: { documento: extracted.document } },
        explanation: `👤 Recebi o documento! Agora preciso do nome completo ou razão social do cliente para finalizar o cadastro.`,
        requiresConfirmation: false
      };
      res.json(responseData);
      return responseData;
    }
    
    // No name and no document - ask for both
    const responseData = {
      success: true,
      action: { type: 'aguardando_dados_cliente', data: null },
      explanation: `👤 Vou te ajudar a cadastrar um novo cliente!\n\nPreciso das seguintes informações:\n• **Nome** completo ou razão social\n• **CPF** (pessoa física) ou **CNPJ** (pessoa jurídica)\n\nVocê pode me dizer tudo de uma vez, por exemplo:\n• "João Silva, CPF 123.456.789-00"\n• "Empresa ABC LTDA, CNPJ 12.345.678/0001-90"\n\nOu se preferir, me diga o nome primeiro.`,
      requiresConfirmation: false
    };
    res.json(responseData);
    return responseData;
  }

  // ========================================
  // PATTERN: Create company
  // ========================================
  if (/(?:criar|cadastrar|registrar|nova)\s+empresa/i.test(message)) {
    // Try to extract company data from the message
    const cnpjExtract = message.match(/(?:cnpj)\s*:?\s*(\d{2}\.?\d{3}\.?\d{3}[\/\-]?\d{4}-?\d{2}|\d{14})/i);
    
    if (cnpjExtract) {
      const cnpj = cnpjExtract[1].replace(/\D/g, '');
      
      if (cnpj.length !== 14) {
        const responseData = {
          success: false,
          action: null,
          explanation: 'O CNPJ informado é inválido. O CNPJ deve ter 14 dígitos.\n\nPor favor, informe no formato correto:\n• 12.345.678/0001-99 ou\n• 12345678000199',
          requiresConfirmation: false
        };
        res.json(responseData);
        return responseData;
      }

      // Check if THIS USER already has a company with this CNPJ
      // Different users CAN register the same CNPJ
      const existingCompany = await prisma.company.findFirst({
        where: { cnpj, userId }
      });

      if (existingCompany) {
        const responseData = {
          success: true,
          action: { type: 'empresa_existente', data: { id: existingCompany.id, nome: existingCompany.razaoSocial } },
          explanation: `Você já possui uma empresa cadastrada com este CNPJ: **${existingCompany.razaoSocial}**.\n\nSe quiser editar os dados desta empresa, acesse "Minhas Empresas" no menu lateral.`,
          requiresConfirmation: false
        };
        res.json(responseData);
        return responseData;
      }

      // Extract other fields from message
      const razaoMatch = message.match(/(?:raz[aã]o\s+social|nome)\s*:?\s*"?([^"]+?)"?\s*(?:,|cnpj|cidade|uf|regime|email|telefone|$)/i);
      const cidadeMatch = message.match(/(?:cidade)\s*:?\s*"?([^",]+)"?/i);
      const ufMatch = message.match(/(?:uf|estado)\s*:?\s*([A-Za-z]{2})/i);

      const responseData = {
        success: true,
        action: { 
          type: 'criar_empresa', 
          data: { 
            cnpj,
            razao_social: razaoMatch ? razaoMatch[1].trim() : null,
            cidade: cidadeMatch ? cidadeMatch[1].trim() : null,
            uf: ufMatch ? ufMatch[1].toUpperCase() : null
          } 
        },
        explanation: `🏢 Para cadastrar a empresa com CNPJ **${cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}**, preciso de mais informações:\n\n• **Razão Social** (obrigatório)\n• **Cidade e UF** (obrigatório)\n• **Regime Tributário** (MEI ou Simples Nacional)\n• **Email e Telefone**\n• **Inscrição Municipal**\n\nVocê pode fornecer essas informações ou cadastrar diretamente em **"Minhas Empresas"** no menu lateral, onde há um formulário completo com todos os campos necessários.\n\n💡 **Recomendo usar o formulário completo** para garantir que todos os dados fiscais estejam corretos para emissão de notas.`,
        requiresConfirmation: false
      };
      res.json(responseData);
      return responseData;
    } else {
      // No CNPJ provided - ask for it
      const responseData = {
        success: true,
        action: { type: 'criar_empresa', data: null },
        explanation: `🏢 Para cadastrar uma nova empresa, posso ajudar! Preciso do CNPJ para começar.\n\nDiga o CNPJ da empresa, por exemplo:\n• "criar empresa CNPJ 12.345.678/0001-99"\n\nOu, para um cadastro mais completo, acesse **"Minhas Empresas"** no menu lateral e clique em **"Nova Empresa"**. Lá você pode preencher todos os campos necessários como:\n- CNPJ e Razão Social\n- Cidade e Estado\n- Regime Tributário\n- Inscrição Municipal\n- Certificado Digital`,
        requiresConfirmation: false
      };
      res.json(responseData);
      return responseData;
    }
  }

  // ========================================
  // PATTERN: List clients
  // ========================================
  if (lowerMessage.includes('listar cliente') || lowerMessage.includes('meus clientes') || 
      lowerMessage.includes('ver clientes') || lowerMessage.includes('clientes cadastrados')) {
    
    const clients = await prisma.client.findMany({
      where: { userId, ativo: true },
      orderBy: { nome: 'asc' },
      take: 10
    });
    
    if (clients.length === 0) {
      const responseData = {
        success: true,
        action: { type: 'listar_clientes', data: { count: 0 } },
        explanation: 'Você ainda não tem clientes cadastrados. Diga "criar cliente [nome] CPF [número]" ou acesse a seção "Clientes" no menu para cadastrar.',
        requiresConfirmation: false
      };
      res.json(responseData);
      return responseData;
    }
    
    let clientList = clients.map((c, i) => 
      `${i + 1}. **${c.nome}**${c.apelido ? ` (${c.apelido})` : ''} - ${c.tipoPessoa === 'pf' ? 'CPF' : 'CNPJ'}: ${formatDocumentForDisplay(c.documento, c.tipoPessoa)}`
    ).join('\n');
    
    const responseData = {
      success: true,
      action: { type: 'listar_clientes', data: { count: clients.length } },
      explanation: `📋 **Seus clientes cadastrados** (${clients.length}):\n\n${clientList}\n\nDiga "Emitir nota de R$ [valor] para [nome]" para emitir.`,
      requiresConfirmation: false
    };
    res.json(responseData);
    return responseData;
  }

  // ========================================
  // PATTERN: Issue invoice - UNIVERSAL HANDLER
  // Handles ALL variations of invoice emission messages:
  //   - "Emitir nota de R$ 1.500 para João Silva"
  //   - "Emitir uma nota de R$ 2.000 para Maria Santos"
  //   - "Nova nota de R$ 3.500 para Pedro Oliveira"
  //   - "Emitir nota de R$ 2.500 para Ana Costa por consultoria em TI"
  //   - "Emitir nota de R$ 1.800 para Roberto Alves CPF 123.456.789-00"
  //   - "Preciso emitir uma nota de R$ 1.200 para o cliente Fernando Lima"
  //   - "Emitir nota de 1500 reais para Carlos Mendes"
  //   - "Emitir nota de 2k para Rafael Souza"
  //   - "Oi MAY, quero emitir uma nota de R$ 2.500 para Fernanda Costa"
  //   - "Me ajuda a emitir uma nota de R$ 1.800 para Maria"
  //   - "Emitir nota para João Silva" (asks for value)
  //   - "Emitir nota de R$ 2.000" (asks for client)
  // ========================================
  
  // Detect if this is an invoice emission intent
  const invoiceKeywords = [
    'emitir nota', 'emitir uma nota', 'nova nota', 'gerar nota', 'criar nota', 
    'fazer nota', 'fazer uma nota', 'lançar nota', 'emitir nf', 'nota fiscal',
    'preciso emitir', 'quero emitir', 'gostaria de emitir', 'pode emitir',
    'me ajuda a emitir', 'me ajude a emitir', 'vou emitir', 'vamos emitir'
  ];
  
  const isInvoiceIntent = invoiceKeywords.some(kw => lowerMessage.includes(kw)) ||
    (lowerMessage.includes('nota') && (lowerMessage.includes('r$') || lowerMessage.includes('reais') || /\d+\s*k\b/.test(lowerMessage)));
  
  if (isInvoiceIntent) {
    // Extract value using the improved function from aiIntentService
    const { extractMonetaryValue, extractClientName: extractClientNameFromService, extractDocument: extractDocumentFromService } = await import('../services/aiIntentService.js');
    
    let valor = extractMonetaryValue(message);
    
    // Extract client name - use multiple patterns
    let clienteNome = null;
    
    // Pattern 1: "para [client]" or "para o cliente [name]"
    const paraMatch = message.match(/para\s+(?:o\s+)?(?:cliente\s+)?([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.]+?)(?:\s+(?:cpf|cnpj|pela\s+empresa|por\s+|referente|,|$))/i);
    if (paraMatch) {
      clienteNome = paraMatch[1].trim();
    }
    
    // Pattern 2: "para [client] CPF/CNPJ [document]"
    if (!clienteNome) {
      const paraDocMatch = message.match(/para\s+(?:o\s+)?(?:cliente\s+)?([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.]+?)\s+(?:cpf|cnpj)\s/i);
      if (paraDocMatch) {
        clienteNome = paraDocMatch[1].trim();
      }
    }
    
    // Pattern 3: Fallback - text after "para" until end or special markers
    if (!clienteNome) {
      const paraFallback = message.match(/para\s+(?:o\s+)?(?:cliente\s+)?([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.]+?)$/i);
      if (paraFallback) {
        clienteNome = paraFallback[1].trim();
      }
    }
    
    // Clean up client name - remove common suffixes and trailing punctuation
    if (clienteNome) {
      clienteNome = clienteNome
        .replace(/\s+(?:por|referente|,).*/i, '')
        .replace(/\s+\d+.*$/i, '') // Remove trailing numbers (like document fragments)
        .replace(/[.,;:!?]+$/g, '') // Remove trailing punctuation (., ; : ! ?)
        .trim();
      
      // Split by comma and take first part
      clienteNome = clienteNome.split(/\s*,\s*/)[0].trim();
      
      // Final cleanup - remove any remaining trailing punctuation
      clienteNome = clienteNome.replace(/[.,;:!?]+$/g, '').trim();
    }
    
    // Extract service description if present
    let descricaoServico = 'Serviço prestado';
    const servicePatterns = [
      /(?:por|referente\s+a|referente)\s+(.+?)(?:\s+(?:cpf|cnpj|pela\s+empresa)|,|$)/i,
      /(?:serviço(?:s)?|serviço de|serviços de)\s*:?\s*(.+?)(?:\s+(?:cpf|cnpj|pela\s+empresa)|,|$)/i
    ];
    
    for (const pattern of servicePatterns) {
      const serviceMatch = message.match(pattern);
      if (serviceMatch && serviceMatch[1]?.trim()) {
        descricaoServico = serviceMatch[1].trim();
        // Don't use value/client text as service description
        if (!/^\d|^r\$|^para\s/i.test(descricaoServico)) {
          break;
        }
        descricaoServico = 'Serviço prestado';
      }
    }

    // Handle cases where value or client is missing
    if (!valor && !clienteNome) {
      // Neither value nor client - provide helpful guidance
      const responseDataBoth = {
        success: true,
        action: null,
        explanation: '📝 Para emitir uma nota fiscal, preciso de algumas informações:\n\n' +
          '• **Valor:** Quanto você deseja cobrar?\n' +
          '• **Cliente:** Para quem é a nota?\n\n' +
          'Exemplo: "Emitir nota de R$ 1.500 para João Silva"\n\n' +
          'Ou me diga uma informação de cada vez.',
        requiresConfirmation: false
      };
      res.json(responseDataBoth);
      return responseDataBoth;
    }
    
    if (!valor && clienteNome) {
      // Has client but no value - ask for value
      const responseDataNoValue = {
        success: true,
        action: { type: 'aguardando_valor', data: { cliente_nome: clienteNome } },
        explanation: `💰 Qual o valor da nota fiscal para **${clienteNome}**?\n\nExemplo: "R$ 1.500" ou "1500 reais"`,
        requiresConfirmation: false
      };
      res.json(responseDataNoValue);
      return responseDataNoValue;
    }
    
    if (valor && !clienteNome) {
      // Has value but no client - ask for client
      const valorFormatado = valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
      const responseDataNoClient = {
        success: true,
        action: { type: 'aguardando_cliente', data: { valor: valor } },
        explanation: `👤 Para quem é a nota fiscal de **R$ ${valorFormatado}**?\n\nMe diga o nome do cliente.`,
        requiresConfirmation: false
      };
      res.json(responseDataNoClient);
      return responseDataNoClient;
    }
    
    // Both value and client present - proceed with invoice creation
    if (valor && clienteNome) {
      // Extract CNPJ/CPF from the full message if mentioned
      // Patterns: "pela empresa 34.172.396/0001-76", "CNPJ 34.172.396/0001-76", "CPF 123.456.789-00"
      // CNPJ format: XX.XXX.XXX/XXXX-XX (14 digits)
      // CPF format: XXX.XXX.XXX-XX (11 digits)
      const cnpjPattern = /(?:pela\s+empresa|cnpj|empresa)\s*:?\s*(\d{2}\.?\d{3}\.?\d{3}[\/\-]?\d{4}-?\d{2})/i;
      const cpfPattern = /(?:cpf)\s*:?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i;
      const cnpjMatch = message.match(cnpjPattern);
      const cpfMatch = message.match(cpfPattern);
      
      const mentionedCnpj = cnpjMatch ? cnpjMatch[1].replace(/\D/g, '') : null;
      const mentionedCpf = cpfMatch ? cpfMatch[1].replace(/\D/g, '') : null;
      
      // Validate extracted documents have correct length
      const validCnpj = mentionedCnpj && mentionedCnpj.length === 14 ? mentionedCnpj : null;
      const validCpf = mentionedCpf && mentionedCpf.length === 11 ? mentionedCpf : null;
      const mentionedDocument = validCnpj || validCpf;
      const mentionedDocumentType = validCnpj ? 'pj' : (validCpf ? 'pf' : null);

      // If a document (CNPJ/CPF) is explicitly mentioned, prioritize searching by that document
      if (mentionedDocument) {
        const clientByDocument = await prisma.client.findFirst({
          where: {
            userId,
            ativo: true,
            documento: mentionedDocument,
            tipoPessoa: mentionedDocumentType
          }
        });

        if (clientByDocument) {
          // Found client with the mentioned document - use it
          const valorFormatado = valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
          const docLabel = clientByDocument.tipoPessoa === 'pf' ? 'CPF' : 'CNPJ';
          const docFormatado = formatDocumentForDisplay(clientByDocument.documento, clientByDocument.tipoPessoa);
          const responseData = {
            success: true,
            action: {
              type: 'emitir_nfse',
              data: {
                cliente_nome: clientByDocument.nome,
                cliente_documento: clientByDocument.documento,
                descricao_servico: descricaoServico,
                valor: valor,
                aliquota_iss: 5,
                client_id: clientByDocument.id
              }
            },
            explanation: `📝 **Nota fiscal preparada:**\n\n` +
              `• **Valor:** R$ ${valorFormatado}\n` +
              `• **Cliente:** ${clientByDocument.nome}\n` +
              `• **${docLabel}:** ${docFormatado}\n` +
              `• **Serviço:** ${descricaoServico}\n` +
              `• **ISS:** 5%\n\n` +
              `✅ Deseja confirmar a emissão desta nota?`,
            requiresConfirmation: true
          };
          res.json(responseData);
          return responseData;
        } else {
          // Document mentioned but not found - ask user to create client with that document
          const docLabel = mentionedDocumentType === 'pf' ? 'CPF' : 'CNPJ';
          const docFormatado = formatDocumentForDisplay(mentionedDocument, mentionedDocumentType);
          const responseData = {
            success: true,
            action: {
              type: 'criar_cliente_e_emitir',
              data: {
                cliente_nome: clienteNome,
                cliente_documento: mentionedDocument,
                descricao_servico: descricaoServico,
                valor: valor,
                aliquota_iss: 5,
                tipo_pessoa: mentionedDocumentType
              }
            },
            explanation: `Você mencionou o ${docLabel} ${docFormatado}, mas não encontrei um cliente cadastrado com esse documento.\n\n` +
              `Para emitir a nota de R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para "${clienteNome}" com ${docLabel} ${docFormatado}, preciso cadastrar este cliente primeiro.\n\n` +
              `Deseja criar o cliente "${clienteNome}" com ${docLabel} ${docFormatado}? Ou diga "criar cliente ${clienteNome} ${docLabel} ${docFormatado}" para cadastrá-lo.`,
            requiresConfirmation: false
          };
          res.json(responseData);
          return responseData;
        }
      }

      // No document mentioned - search by name only (original logic)
      const matchingClients = await prisma.client.findMany({
        where: {
          userId,
          ativo: true,
          OR: [
            { nome: { contains: clienteNome, mode: 'insensitive' } },
            { apelido: { contains: clienteNome, mode: 'insensitive' } }
          ]
        },
        orderBy: { nome: 'asc' },
        take: 5
      });

      // If exactly one match found, use it
      if (matchingClients.length === 1) {
        const client = matchingClients[0];
        const valorFormatado = valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const docLabel = client.tipoPessoa === 'pf' ? 'CPF' : 'CNPJ';
        const docFormatado = formatDocumentForDisplay(client.documento, client.tipoPessoa);
        const responseData = {
          success: true,
          action: {
            type: 'emitir_nfse',
            data: {
              cliente_nome: client.nome,
              cliente_documento: client.documento,
              descricao_servico: descricaoServico,
              valor: valor,
              aliquota_iss: 5,
              client_id: client.id
            }
          },
          explanation: `📝 **Nota fiscal preparada:**\n\n` +
            `• **Valor:** R$ ${valorFormatado}\n` +
            `• **Cliente:** ${client.nome}\n` +
            `• **${docLabel}:** ${docFormatado}\n` +
            `• **Serviço:** ${descricaoServico}\n` +
            `• **ISS:** 5%\n\n` +
            `✅ Deseja confirmar a emissão desta nota?`,
          requiresConfirmation: true
        };
        res.json(responseData);
        return responseData;
      }
      
      // If multiple matches, ask user to choose
      if (matchingClients.length > 1) {
        let clientList = matchingClients.map((c, i) => 
          `${i + 1}. **${c.nome}**${c.apelido ? ` (${c.apelido})` : ''} - ${c.tipoPessoa === 'pf' ? 'CPF' : 'CNPJ'}: ${formatDocumentForDisplay(c.documento, c.tipoPessoa)}`
        ).join('\n');
        const responseData = {
          success: true,
          action: {
            type: 'escolher_cliente',
            data: {
              valor: valor,
              clientes: matchingClients.map(c => ({ id: c.id, nome: c.nome, documento: c.documento, tipo: c.tipoPessoa }))
            }
          },
          explanation: `Encontrei ${matchingClients.length} clientes com nome similar a "${clienteNome}":\n\n${clientList}\n\nPor favor, especifique qual cliente você deseja ou diga "criar novo cliente ${clienteNome}".`,
          requiresConfirmation: false
        };
        res.json(responseData);
        return responseData;
      }
      
      // No match found - offer to create new client
      const responseDataNoMatch = {
        success: true,
        action: {
          type: 'criar_cliente_e_emitir',
          data: {
            cliente_nome: clienteNome,
            cliente_documento: '',
            descricao_servico: descricaoServico,
            valor: valor,
            aliquota_iss: 5
          }
        },
        explanation: `Não encontrei "${clienteNome}" cadastrado. Para emitir a nota de R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, preciso do CPF ou CNPJ do cliente.\n\nDigite o documento ou diga "criar cliente ${clienteNome} CPF 123.456.789-00" para cadastrá-lo primeiro.`,
        requiresConfirmation: false
      };
      res.json(responseDataNoMatch);
      return responseDataNoMatch;
    }
  }

  // ========================================
  // PATTERN: Check revenue
  // ========================================
  if (lowerMessage.includes('faturamento') || lowerMessage.includes('quanto faturei')) {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const invoices = await prisma.invoice.findMany({
      where: {
        companyId: { in: companyIds },
        status: 'autorizada',
        dataEmissao: {
          gte: new Date(currentYear, currentMonth, 1),
          lt: new Date(currentYear, currentMonth + 1, 1)
        }
      }
    });

    const total = invoices.reduce((sum, inv) => sum + parseFloat(inv.valor), 0);
    const count = invoices.length;

    const responseData = {
      success: true,
      action: { type: 'consultar_faturamento', data: { total, count } },
      explanation: `📊 Seu faturamento este mês:\n\n💰 Total: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n📄 Notas emitidas: ${count}`,
      requiresConfirmation: false
    };
    res.json(responseData);
    return responseData;
  }

  // ========================================
  // PATTERN: List invoices
  // ========================================
  if (lowerMessage.includes('listar') && (lowerMessage.includes('nota') || lowerMessage.includes('notas'))) {
    const responseData = {
      success: true,
      action: { type: 'listar_notas' },
      explanation: 'Você pode ver todas as suas notas fiscais na seção "Notas Fiscais" do menu. Lá você encontra filtros por status, busca por cliente e pode baixar PDFs e XMLs.',
      requiresConfirmation: false
    };
    res.json(responseData);
    return responseData;
  }

  // ========================================
  // PATTERN: Check taxes (DAS / Impostos)
  // IMPORTANT: This pattern must be SPECIFIC to avoid false positives
  // "das" is a common word in Portuguese, so we need careful matching
  // ========================================
  
  // Check if message contains CPF/CNPJ patterns (to avoid false positives)
  const containsDocumentPattern = /\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2}|\d{2}\.?\d{3}\.?\d{3}[\/\-]?\d{4}[-.]?\d{2}/.test(message);
  
  // Specific tax-related patterns (more restrictive)
  const taxKeywordPatterns = [
    /(?:ver|consultar|quais?|meus?|minhas?|mostrar?|listar?)\s+(?:os?\s+)?(?:impostos?|das|tributos?|guias?)/i,
    /(?:impostos?|das|tributos?|guias?)\s+(?:pendentes?|pagos?|vencidos?|atrasados?|do\s+m[eê]s)/i,
    /guias?\s+(?:das|de\s+pagamento)/i,
    /(?:pagar|pagamento)\s+(?:do?\s+)?(?:das|imposto)/i,
    /das\s+(?:mei|simples|mensal)/i,
    /^(?:das|impostos?|tributos?)$/i  // Exact match for single word
  ];
  
  const isTaxQuery = taxKeywordPatterns.some(pattern => pattern.test(lowerMessage));
  
  // Also match if "imposto" or "tributo" appears (these are more specific than "das")
  // But NOT if the message contains a document pattern (CPF/CNPJ)
  const hasSpecificTaxWord = (lowerMessage.includes('imposto') || lowerMessage.includes('tributo')) && !containsDocumentPattern;
  
  if ((isTaxQuery || hasSpecificTaxWord) && !containsDocumentPattern) {
    const responseData = {
      success: true,
      action: { type: 'consultar_impostos' },
      explanation: 'Você pode verificar seus impostos e guias DAS na seção "Impostos (DAS)" do menu. Lá você encontra as guias pendentes, pagas e pode gerar novas guias.',
      requiresConfirmation: false
    };
    res.json(responseData);
    return responseData;
  }

  // ========================================
  // PATTERN: Cancel invoice
  // ========================================
  if (lowerMessage.includes('cancelar') && lowerMessage.includes('nota')) {
    // Extract invoice number if mentioned
    const numeroMatch = message.match(/(?:nota|nfse|fiscal)\s*(?:n[úu]mero|#|n[º°])?\s*(\d+)/i);
    const numero = numeroMatch ? numeroMatch[1] : null;
    
    if (numero) {
      // If invoice number is provided, try to execute cancellation
      // But still require reason from user
      const responseData = {
        success: true,
        action: {
          type: 'cancelar_nfse',
          data: {
            numero: numero,
            reason: null // Will be requested
          }
        },
        explanation: `Para cancelar a nota fiscal #${numero}, preciso que você informe o motivo do cancelamento (mínimo 15 caracteres). Por favor, descreva o motivo.`,
        requiresConfirmation: true
      };
      res.json(responseData);
      return responseData;
    } else {
      // No invoice number - guide user to UI
    const responseData = {
      success: true,
      action: null,
        explanation: 'Para cancelar uma nota fiscal, você pode:\n\n1. Acessar a seção "Notas Fiscais", encontrar a nota desejada e clicar no botão "Cancelar"\n\n2. Ou me informar o número da nota e o motivo do cancelamento\n\n⚠️ Lembre-se: algumas prefeituras têm prazo limite para cancelamento (geralmente 24-48 horas após a emissão).',
      requiresConfirmation: false
    };
    res.json(responseData);
    return responseData;
    }
  }

  // ========================================
  // PATTERN: Help
  // ========================================
  if (lowerMessage.includes('ajuda') || lowerMessage.includes('help') || lowerMessage === 'oi' || lowerMessage === 'olá') {
    const responseData = {
      success: true,
      action: null,
      explanation: `Olá! Sou sua assistente fiscal MAY. Posso ajudá-lo com:\n\n` +
        `📄 **Emitir notas:**\n• "Emitir nota de R$ 1.500 para João Silva"\n\n` +
        `👥 **Clientes:**\n• "Listar meus clientes"\n• "Criar cliente Gabriel CPF 123.456.789-00"\n\n` +
        `🔍 **Consultar notas:**\n• "Mostre minha última nota"\n• "Notas rejeitadas este mês"\n• "Notas de [nome do cliente]"\n• "Status da nota 12345"\n\n` +
        `📊 **Faturamento:**\n• "Qual meu faturamento este mês?"\n• "Quantas notas emiti?"\n\n` +
        `💰 **Impostos:**\n• "Quais meus impostos pendentes?"\n\n` +
        `Como posso ajudar?`,
      requiresConfirmation: false
    };
    res.json(responseData);
    return responseData;
  }

  // ========================================
  // DEFAULT: Suggest options
  // ========================================
  const responseData = {
    success: true,
    action: null,
    explanation: `Não entendi completamente. Posso ajudá-lo com:\n\n` +
      `• **Emitir nota** - "Emitir nota de R$ [valor] para [cliente]"\n` +
      `• **Última nota** - "Mostre minha última nota"\n` +
      `• **Notas rejeitadas** - "Notas rejeitadas este mês"\n` +
      `• **Faturamento** - "Qual meu faturamento?"\n` +
      `• **Impostos** - "Impostos pendentes"\n\n` +
      `Diga "ajuda" para ver todas as opções.`,
    requiresConfirmation: false
  };
  res.json(responseData);
  return responseData;
}

/**
 * Format invoice status for display
 */
function formatStatus(status) {
  const statusMap = {
    'autorizada': '✅ Autorizada',
    'rejeitada': '❌ Rejeitada',
    'cancelada': '🚫 Cancelada',
    'processando': '⏳ Processando',
    'rascunho': '📝 Rascunho',
    'pendente': '⏳ Pendente'
  };
  return statusMap[status] || status;
}

/**
 * Format document (CPF/CNPJ) for display
 */
/**
 * Detect if a message is about creating a client.
 * Checks multiple signals: explicit keywords, standalone name+document patterns,
 * and intent classification results.
 * 
 * @param {string} message - Original message
 * @param {string} lowerMessage - Lowercased message
 * @param {object} intent - Intent classification result
 * @returns {boolean} True if the message is about creating a client
 */
function detectClientCreationIntent(message, lowerMessage, intent) {
  // 1. Intent classification says it's client creation
  if (intent?.intent === 'criar_cliente' && intent.confidence >= 0.4) return true;
  
  // 2. Explicit action keywords + "cliente" keyword
  const clientKeywords = /(?:criar|cadastrar|cadastre|cadastra|registrar|registre|adicionar|adicione|novo|nova|incluir|salvar|inserir)\s+(?:um\s+|uma\s+|o\s+|a\s+)?(?:novo\s+|nova\s+)?cliente/i;
  if (clientKeywords.test(message)) return true;
  
  // 3. "cliente" keyword + action keywords (reversed order)
  const reversedPattern = /cliente\s+(?:novo|nova)|novo\s+cliente|nova?\s+cliente/i;
  if (reversedPattern.test(message)) return true;
  
  // 4. "preciso/quero/gostaria + cadastrar/criar/adicionar + cliente"
  const conversationalPattern = /(?:preciso|quero|gostaria|pode|poderia|necessito|desejo|vou)\s+(?:de\s+)?(?:criar|cadastrar|registrar|adicionar|incluir)\s+(?:um\s+|uma\s+)?(?:novo\s+|nova\s+)?cliente/i;
  if (conversationalPattern.test(message)) return true;
  
  // 5. "me ajuda/ajude a cadastrar/criar cliente"
  const helpPattern = /(?:me\s+)?(?:ajud[ae]|auxili[ae])\s+(?:a\s+)?(?:criar|cadastrar|registrar|adicionar)\s+(?:um\s+|uma\s+)?(?:novo\s+|nova\s+)?cliente/i;
  if (helpPattern.test(message)) return true;
  
  // 6. Message contains "cliente" AND has a document (CPF/CNPJ)
  if (lowerMessage.includes('cliente') && hasDocumentInMessage(message)) return true;
  
  // 7. Message contains creation keywords AND has both a name-like string and a document
  const hasCreationWord = /(?:criar|cadastrar|cadastre|registrar|adicionar|novo|nova|incluir)/i.test(message);
  if (hasCreationWord && hasDocumentInMessage(message) && /(?:nome|chamad[oa])/i.test(message)) return true;
  
  // 8. Standalone pattern: "[Name] CPF/CNPJ [document]" or "[Name], CPF: [document]"
  const standalonePattern = /^(.+?)\s+(?:cpf|cnpj|documento)\s*:?\s*(\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2}|\d{2}\.?\d{3}\.?\d{3}[\/]?\d{4}[-.]?\d{2}|\d{11}|\d{14})$/i;
  if (standalonePattern.test(message.trim())) return true;
  
  // 9. "Nome: [name]" pattern with document somewhere in the message
  if (/nome\s*[:=]\s*.+/i.test(message) && hasDocumentInMessage(message)) return true;
  
  return false;
}

/**
 * Check if a message contains a CPF or CNPJ document
 * @param {string} message 
 * @returns {boolean}
 */
function hasDocumentInMessage(message) {
  // Formatted CPF: 123.456.789-00
  if (/\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2}/.test(message)) return true;
  // Formatted CNPJ: 12.345.678/0001-90
  if (/\d{2}\.?\d{3}\.?\d{3}[\/]?\d{4}[-.]?\d{2}/.test(message)) return true;
  // Plain 11 or 14 digit number
  if (/\b\d{11}\b|\b\d{14}\b/.test(message)) return true;
  // "CPF" or "CNPJ" or "documento" keyword followed by numbers
  if (/(?:cpf|cnpj|documento)\s*:?\s*\d/i.test(message)) return true;
  return false;
}

/**
 * Extract client data (name, document, email, phone) from ANY message format.
 * Tries multiple extraction strategies to handle diverse message styles.
 * 
 * @param {string} message - The user message
 * @returns {{ name: string|null, document: string|null, email: string|null, phone: string|null }}
 */
function extractClientDataFromMessage(message) {
  let name = null;
  let document = null;
  let email = null;
  let phone = null;
  
  // ---- Extract DOCUMENT (CPF or CNPJ) ----
  // Try CNPJ first (14 digits, formatted or not)
  const cnpjMatch = message.match(/(\d{2}\.?\d{3}\.?\d{3}[\/]?\d{4}[-.]?\d{2})/);
  if (cnpjMatch) {
    const clean = cnpjMatch[1].replace(/\D/g, '');
    if (clean.length === 14) document = clean;
  }
  
  // Try CPF (11 digits, formatted or not)
  if (!document) {
    const cpfMatch = message.match(/(\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2})/);
    if (cpfMatch) {
      const clean = cpfMatch[1].replace(/\D/g, '');
      if (clean.length === 11) document = clean;
    }
  }
  
  // Try plain 11 or 14 digit number (not part of a longer number)
  if (!document) {
    const plainMatch = message.match(/(?:^|\s|:)(\d{11}|\d{14})(?:\s|$|,|;|\.|!|\?)/);
    if (plainMatch) document = plainMatch[1];
  }
  
  // ---- Extract EMAIL ----
  const emailMatch = message.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (emailMatch) email = emailMatch[0];
  
  // ---- Extract PHONE ----
  // Brazilian phone: (XX) XXXXX-XXXX or (XX) XXXX-XXXX or just digits
  const phoneMatch = message.match(/(?:telefone|tel|fone|celular|whatsapp)\s*:?\s*(\(?\d{2}\)?\s*\d{4,5}[-.]?\d{4})/i);
  if (phoneMatch) phone = phoneMatch[1];
  if (!phone) {
    const phoneMatch2 = message.match(/(\(\d{2}\)\s*\d{4,5}[-.]?\d{4})/);
    if (phoneMatch2) phone = phoneMatch2[1];
  }
  
  // ---- Extract NAME ----
  // Remove document, email, phone from the message to help isolate the name
  let cleanMsg = message
    .replace(/\d{2}\.?\d{3}\.?\d{3}[\/]?\d{4}[-.]?\d{2}/g, '')   // CNPJ
    .replace(/\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2}/g, '')               // CPF
    .replace(/\b\d{11}\b|\b\d{14}\b/g, '')                          // Plain doc numbers
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '')                       // Email
    .replace(/\(?\d{2}\)?\s*\d{4,5}[-.]?\d{4}/g, '')               // Phone
    .trim();
  
  // Strategy 1: "criar/cadastrar cliente [NAME]" - name after action+cliente
  const afterClienteMatch = cleanMsg.match(/(?:criar|cadastrar|cadastre|registrar|adicionar|incluir|novo|nova)\s+(?:um\s+|uma\s+|o\s+|a\s+)?(?:novo\s+|nova\s+)?cliente\s*:?\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.]+?)(?:\s*[,;]|\s+(?:cpf|cnpj|documento|email|telefone|tel|fone|com\s|de\s|no\s)|$)/i);
  if (afterClienteMatch && afterClienteMatch[1]?.trim().length > 1) {
    name = afterClienteMatch[1].trim();
  }
  
  // Strategy 2: "Nome: [NAME]" or "nome = [NAME]" or "nome é [NAME]"
  if (!name) {
    const nomeMatch = cleanMsg.match(/nome\s*(?:[:=é]|é)\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.]+?)(?:\s*[,;]|\s+(?:cpf|cnpj|documento|email|telefone|tel|fone|e\s+o|com\s)|$)/i);
    if (nomeMatch && nomeMatch[1]?.trim().length > 1) {
      name = nomeMatch[1].trim();
    }
  }
  
  // Strategy 3: "nome/razão social [NAME]" (without colon)
  if (!name) {
    const razaoMatch = cleanMsg.match(/(?:razão\s*social|razao\s*social)\s*:?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.]+?)(?:\s*[,;]|\s+(?:cpf|cnpj|documento|email|telefone)|$)/i);
    if (razaoMatch && razaoMatch[1]?.trim().length > 1) {
      name = razaoMatch[1].trim();
    }
  }
  
  // Strategy 4: "o nome é/dele é/dela é [NAME]"
  if (!name) {
    const nameIsMatch = cleanMsg.match(/(?:o\s+nome|nome\s+(?:dele|dela)?)\s+(?:é|e)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.]+?)(?:\s*[,;.]|\s+(?:cpf|cnpj|documento|email|telefone|e\s+o|com\s)|$)/i);
    if (nameIsMatch && nameIsMatch[1]?.trim().length > 1) {
      name = nameIsMatch[1].trim();
    }
  }
  
  // Strategy 5: "chamado/chamada [NAME]" or "de nome [NAME]"
  if (!name) {
    const chamadoMatch = cleanMsg.match(/(?:chamad[oa]|de\s+nome)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.]+?)(?:\s*[,;.]|\s+(?:cpf|cnpj|documento|email|telefone|com\s)|$)/i);
    if (chamadoMatch && chamadoMatch[1]?.trim().length > 1) {
      name = chamadoMatch[1].trim();
    }
  }
  
  // Strategy 6: "para [NAME]" in client creation context
  if (!name) {
    const paraMatch = cleanMsg.match(/(?:para|do|da)\s+(?:o\s+|a\s+)?(?:cliente\s+)?([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.]+?)(?:\s*[,;.]|\s+(?:cpf|cnpj|documento|email|telefone|com\s)|$)/i);
    if (paraMatch && paraMatch[1]?.trim().length > 1) {
      // Exclude common verbs/articles that aren't names
      const candidate = paraMatch[1].trim();
      if (!/^(?:mim|meu|minha|isso|ele|ela|nós|eles|elas|você|voce)$/i.test(candidate)) {
        name = candidate;
      }
    }
  }
  
  // Strategy 7: Standalone "[NAME] CPF/CNPJ [doc]" - name is everything before CPF/CNPJ keyword
  if (!name) {
    const standaloneMatch = cleanMsg.match(/^(.+?)(?:\s*[,;]\s*|\s+)(?:cpf|cnpj|documento)\s*:?\s*/i);
    if (standaloneMatch && standaloneMatch[1]?.trim().length > 1) {
      let candidate = standaloneMatch[1].trim();
      // Remove leading action words
      candidate = candidate.replace(/^(?:criar|cadastrar|cadastre|registrar|adicionar|incluir|novo|nova)\s+(?:um\s+|uma\s+|o\s+|a\s+)?(?:novo\s+|nova\s+)?(?:cliente\s*:?\s*)?/i, '').trim();
      // Remove conversational prefixes
      candidate = candidate.replace(/^(?:oi\s+may\s*[,;]?\s*|oi\s*[,;]?\s*|olá\s*[,;]?\s*|hey\s*[,;]?\s*|bom\s+dia\s*[,;]?\s*|boa\s+tarde\s*[,;]?\s*|boa\s+noite\s*[,;]?\s*)/i, '').trim();
      candidate = candidate.replace(/^(?:preciso|quero|gostaria\s+de|pode|poderia|vou|desejo)\s+(?:de\s+)?(?:criar|cadastrar|registrar|adicionar)\s+(?:um\s+|uma\s+)?(?:novo\s+|nova\s+)?(?:cliente\s*:?\s*)?/i, '').trim();
      // Clean up trailing punctuation/words
      candidate = candidate.replace(/\s*[,;.]\s*$/, '').trim();
      if (candidate.length > 1 && /[A-Za-zÀ-ÿ]/.test(candidate)) {
        name = candidate;
      }
    }
  }
  
  // Strategy 8: If intent was "criar_cliente" and we have a document, try extracting name
  // from the cleaned message by removing all known tokens
  if (!name && document) {
    let remnant = cleanMsg
      .replace(/(?:oi\s+may|oi|olá|hey|bom\s+dia|boa\s+tarde|boa\s+noite)\s*[,;.]?\s*/gi, '')
      .replace(/(?:preciso|quero|gostaria|pode|poderia|necessito|desejo|vou)\s+(?:de\s+)?/gi, '')
      .replace(/(?:criar|cadastrar|cadastre|registrar|registre|adicionar|adicione|incluir|salvar|inserir)\s+/gi, '')
      .replace(/(?:um|uma|o|a|novo|nova|meu|minha)\s+/gi, '')
      .replace(/\bcliente\s*:?\s*/gi, '')
      .replace(/\b(?:cpf|cnpj|documento)\s*:?\s*/gi, '')
      .replace(/\b(?:nome|razão\s*social|razao\s*social)\s*:?\s*/gi, '')
      .replace(/\b(?:email|telefone|tel|fone|celular|whatsapp)\s*:?\s*/gi, '')
      .replace(/\b(?:me\s+ajud[ae]|por\s+favor|com|de|do|da|para|no|na|é|e\s+o|e\s+a)\b/gi, '')
      .replace(/\s*[,;.:!?]+\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (remnant.length > 1 && /^[A-Za-zÀ-ÿ]/.test(remnant)) {
      name = remnant;
    }
  }
  
  // Clean up the name - remove trailing common words
  if (name) {
    name = name
      .replace(/\s+(?:com|de|do|da|no|na|e|ou|por|seu|sua)\s*$/i, '')
      .replace(/\s*[,;.:]+\s*$/, '')
      .trim();
    // If name ended up too short or is a common word, discard it
    if (name.length < 2 || /^(?:o|a|um|uma|de|do|da|no|na|com|por|para|que|se|os|as|em|ao)$/i.test(name)) {
      name = null;
    }
  }
  
  return { name, document, email, phone };
}

function formatDocumentForDisplay(doc, tipo) {
  if (!doc) return '';
  const cleaned = doc.replace(/\D/g, '');
  if (tipo === 'pf' || cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  } else {
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
}

/**
 * GET /api/assistant/suggestions
 * Get suggested actions
 */
router.get('/suggestions', asyncHandler(async (req, res) => {
  res.json([
    'Emitir nova nota fiscal',
    'Qual meu faturamento este mês?',
    'Listar minhas últimas notas',
    'Verificar impostos pendentes'
  ]);
}));

/**
 * POST /api/assistant/transcribe
 * Transcribe audio to text using OpenAI Whisper API
 */
// Multer error handler middleware
const handleMulterError = (req, res, next) => {
  upload.single('audio')(req, res, (err) => {
    if (err) {
      console.error('[Multer Error]', {
        message: err.message,
        code: err.code,
        field: err.field,
        name: err.name
      });
      
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            status: 'error',
            message: 'Arquivo de áudio muito grande. O tamanho máximo é 25MB.',
            code: 'FILE_TOO_LARGE'
          });
        }
        return res.status(400).json({
          status: 'error',
          message: `Erro ao processar arquivo: ${err.message}`,
          code: 'MULTER_ERROR'
        });
      }
      
      // File filter error or other errors
      return res.status(400).json({
        status: 'error',
        message: err.message || 'Formato de áudio não suportado. Por favor, use um formato de áudio válido.',
        code: 'UNSUPPORTED_AUDIO_FORMAT'
      });
    }
    next();
  });
};

/**
 * POST /api/assistant/transcribe
 * Transcribe audio to text using OpenAI Whisper API
 */
router.post('/transcribe', authenticate, asyncHandler(requireActiveSubscription), handleMulterError, asyncHandler(async (req, res) => {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    throw new AppError(
      'OpenAI API key not configured. Audio transcription requires OpenAI API key.',
      500,
      'OPENAI_NOT_CONFIGURED'
    );
  }

  // Check if file was uploaded
  if (!req.file) {
    console.error('[Transcription] No file received:', {
      body: req.body,
      files: req.files,
      headers: req.headers['content-type']
    });
    throw new AppError(
      'Audio file is required. Please upload an audio file.',
      400,
      'AUDIO_FILE_REQUIRED'
    );
  }

  const audioFile = req.file;

  try {
    const timeoutMs = getTimeout('openai');

    // Validate audio file
    if (!audioFile.buffer || audioFile.buffer.length === 0) {
      throw new AppError(
        'Audio file is empty or invalid',
        400,
        'INVALID_AUDIO_FILE'
      );
    }

    // Check minimum file size (at least 5KB to avoid empty/silent recordings)
    // This helps prevent Whisper hallucinations on very short or silent audio
    if (audioFile.buffer.length < 5120) {
      throw new AppError(
        'Gravação muito curta. Por favor, grave pelo menos 2 segundos de áudio falando claramente.',
        400,
        'AUDIO_TOO_SHORT'
      );
    }

    // Known Whisper hallucinations that occur with silent/unclear audio
    const KNOWN_HALLUCINATIONS = [
      'legendas pela comunidade amara.org',
      'legendas pela comunidade amara',
      'subtitles by amara.org',
      'subtítulos por amara.org',
      'tradução por',
      'obrigado por assistir',
      'thanks for watching',
      'please subscribe',
      'inscreva-se',
      'legendas em português',
      'transcrição automática',
      'música',
      '[música]',
      '[music]',
      '...',
      '♪',
      '♫'
    ];

    // Map MIME type to file extension (OpenAI Whisper supported formats)
    // Supported: flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm
    const mimeToExtension = {
      'audio/webm': 'webm',
      'audio/webm;codecs=opus': 'webm',
      'audio/ogg': 'ogg',
      'audio/ogg;codecs=opus': 'ogg',
      'audio/oga': 'oga',
      'audio/wav': 'wav',
      'audio/wave': 'wav',
      'audio/x-wav': 'wav',
      'audio/mp3': 'mp3',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'mp4',
      'audio/m4a': 'm4a',
      'audio/x-m4a': 'm4a',
      'audio/flac': 'flac',
      'audio/x-flac': 'flac'
    };

    // Get clean MIME type (remove codec info)
    const cleanMimeType = (audioFile.mimetype || 'audio/webm').split(';')[0].trim();
    const extension = mimeToExtension[audioFile.mimetype] || mimeToExtension[cleanMimeType] || 'webm';
    const filename = `audio.${extension}`;

    console.log('[Transcription] Starting transcription:', {
      originalFilename: audioFile.originalname,
      mimetype: audioFile.mimetype,
      cleanMimeType,
      extension,
      filename,
      size: audioFile.buffer.length,
      hasOpenAIKey: !!openaiApiKey
    });

    // Create FormData for OpenAI Whisper API
    const formData = new FormDataLib();
    formData.append('file', audioFile.buffer, {
      filename: filename,
      contentType: cleanMimeType
    });
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt'); // Portuguese

    // Get form-data headers
    const formHeaders = formData.getHeaders();

    // Retry logic for transient network errors
    const maxRetries = 3;
    let lastError = null;
    let response = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Transcription] Calling OpenAI Whisper API (attempt ${attempt}/${maxRetries})...`);

        // Recreate FormData for each attempt (streams can only be read once)
        const retryFormData = new FormDataLib();
        retryFormData.append('file', audioFile.buffer, {
          filename: filename,
          contentType: cleanMimeType
        });
        retryFormData.append('model', 'whisper-1');
        retryFormData.append('language', 'pt');
        // Add a prompt to guide Whisper towards business/fiscal content
        // This helps reduce hallucinations and improves transcription accuracy
        retryFormData.append('prompt', 'Transcrição de comandos de voz para sistema fiscal. Comandos comuns: emitir nota fiscal, consultar nota, verificar status, valor, cliente, serviço.');

        response = await axios.post('https://api.openai.com/v1/audio/transcriptions', retryFormData, {
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            ...retryFormData.getHeaders()
          },
          timeout: timeoutMs,
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        });

        // Success - break out of retry loop
        break;
      } catch (err) {
        lastError = err;
        console.error(`[Transcription] Attempt ${attempt} failed:`, err.message);

        // Don't retry for client errors (4xx) or if it's the last attempt
        if (err.response?.status >= 400 && err.response?.status < 500) {
          break;
        }
        
        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff: 1s, 2s, 4s)
          const waitTime = Math.pow(2, attempt - 1) * 1000;
          console.log(`[Transcription] Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    // If no successful response after all retries, throw the last error
    if (!response) {
      if (lastError?.response) {
        const errorMessage = lastError.response.data?.error?.message || lastError.response.data?.message || 'Failed to transcribe audio';
        throw new AppError(
          errorMessage,
          lastError.response.status || 500,
          'WHISPER_API_ERROR'
        );
      }
      
      if (lastError?.code === 'ECONNABORTED' || lastError?.message?.includes('timeout')) {
        throw new AppError(
          'Tempo limite excedido ao transcrever áudio. Verifique sua conexão com a internet.',
          408,
          'TRANSCRIPTION_TIMEOUT'
        );
      }
      
      // Network errors (TLS, connection reset, etc.)
      if (lastError?.code === 'ECONNRESET' || 
          lastError?.code === 'ENOTFOUND' || 
          lastError?.message?.includes('TLS') ||
          lastError?.message?.includes('socket') ||
          lastError?.message?.includes('network')) {
        throw new AppError(
          'Erro de conexão com o servidor de transcrição. Verifique sua conexão com a internet e tente novamente.',
          503,
          'NETWORK_ERROR'
        );
      }
      
      throw new AppError(
        `Erro ao transcrever áudio: ${lastError?.message || 'Erro desconhecido'}`,
        500,
        'TRANSCRIPTION_ERROR'
      );
    }

    console.log('[Transcription] OpenAI response received:', {
      status: response.status,
      hasText: !!response.data?.text,
      textLength: response.data?.text?.length || 0,
      text: response.data?.text?.substring(0, 100) // Log first 100 chars for debugging
    });

    let transcribedText = response.data?.text || '';

    // Check for empty transcription
    if (!transcribedText.trim()) {
      // Return a helpful message instead of throwing an error
      // This happens when there's no speech or the audio is too quiet
      sendSuccess(res, 'Nenhuma fala detectada no áudio', {
        text: '',
        warning: 'NO_SPEECH_DETECTED'
      });
      return;
    }

    // Check for known Whisper hallucinations
    const normalizedText = transcribedText.toLowerCase().trim();
    const isHallucination = KNOWN_HALLUCINATIONS.some(hallucination => 
      normalizedText.includes(hallucination.toLowerCase()) || 
      normalizedText === hallucination.toLowerCase()
    );

    if (isHallucination) {
      console.warn('[Transcription] Detected Whisper hallucination:', transcribedText);
      sendSuccess(res, 'Não foi possível entender o áudio. Por favor, fale mais alto e claramente, ou tente novamente em um ambiente mais silencioso.', {
        text: '',
        warning: 'HALLUCINATION_DETECTED',
        details: 'O modelo de transcrição não conseguiu identificar fala clara no áudio.'
      });
      return;
    }

    // Clean up common transcription artifacts
    transcribedText = transcribedText
      .replace(/^\s*\.+\s*/g, '') // Remove leading dots
      .replace(/\s*\.+\s*$/g, '') // Remove trailing dots
      .trim();

    if (!transcribedText) {
      sendSuccess(res, 'Nenhuma fala detectada no áudio', {
        text: '',
        warning: 'NO_SPEECH_DETECTED'
      });
      return;
    }

    sendSuccess(res, 'Audio transcrito com sucesso', {
      text: transcribedText
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError(
      `Erro ao transcrever áudio: ${error.message || 'Erro desconhecido'}`,
      500,
      'TRANSCRIPTION_ERROR'
    );
  }
}));

/**
 * GET /api/assistant/history
 * Get conversation history for current user
 */
router.get('/history', assistantReadLimiter, asyncHandler(async (req, res) => {
  const { limit = 50 } = req.query;

  const messages = await prisma.conversationMessage.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'asc' },
    take: parseInt(limit),
    select: {
      id: true,
      role: true,
      content: true,
      metadata: true,
      createdAt: true
    }
  });

  // Transform to frontend format
  const history = messages.map(msg => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    metadata: msg.metadata,
    createdAt: msg.createdAt
  }));

  res.json(history);
}));

/**
 * POST /api/assistant/history
 * Save a message to conversation history
 * Used to persist success/error messages that are generated client-side
 */
router.post('/history', asyncHandler(async (req, res) => {
  const { role, content, metadata } = req.body;
  
  if (!role || !content) {
    return res.status(400).json({
      status: 'error',
      message: 'Role and content are required'
    });
  }
  
  if (!['user', 'assistant'].includes(role)) {
    return res.status(400).json({
      status: 'error',
      message: 'Role must be "user" or "assistant"'
    });
  }
  
  const message = await prisma.conversationMessage.create({
    data: {
      userId: req.user.id,
      role,
      content,
      metadata: metadata || {}
    }
  });
  
  res.json({
    status: 'success',
    message: 'Message saved',
    data: {
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt
    }
  });
}));

/**
 * DELETE /api/assistant/history
 * Clear conversation history for current user
 */
router.delete('/history', asyncHandler(async (req, res) => {
  await prisma.conversationMessage.deleteMany({
    where: { userId: req.user.id }
  });

  sendSuccess(res, 'Histórico de conversa limpo com sucesso');
}));


/**
 * POST /api/assistant/validate-issuance
 * Pre-validate all conditions before invoice issuance
 * AI should call this before confirming invoice emission
 */
router.post('/validate-issuance', [
  body('company_id').notEmpty().withMessage('Company ID is required'),
  body('invoice_data').isObject().withMessage('Invoice data is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ status: 'error', message: 'Validation failed', errors: errors.array() });
  }

  const { company_id, invoice_data } = req.body;
  const validationErrors = [];
  const warnings = [];

  const company = await prisma.company.findFirst({
    where: { id: company_id, userId: req.user.id },
    include: { fiscalCredential: true }
  });

  if (!company) {
    return res.status(404).json({
      status: 'error',
      valid: false,
      errors: [{ code: 'COMPANY_NOT_FOUND', message: 'Empresa não encontrada' }]
    });
  }

  const { checkInvoiceLimit } = await import('../services/planService.js');
  const limitCheck = await checkInvoiceLimit(req.user.id);
  if (!limitCheck.allowed) {
    validationErrors.push({
      code: 'INVOICE_LIMIT_REACHED',
      message: `Limite de ${limitCheck.max} notas atingido. ${limitCheck.used}/${limitCheck.max} usadas.`
    });
  }

  if (!isNuvemFiscalConfigured()) {
    validationErrors.push({
      code: 'NUVEM_FISCAL_NOT_CONFIGURED',
      message: 'Integração fiscal não configurada no servidor.'
    });
  }

  if (!company.nuvemFiscalId) {
    validationErrors.push({
      code: 'COMPANY_NOT_REGISTERED',
      message: 'Empresa não registrada na Nuvem Fiscal.'
    });
  }

  if (!company.fiscalCredential) {
    validationErrors.push({
      code: 'NO_CREDENTIAL',
      message: 'Certificado digital ou credenciais municipais não configurados.'
    });
  } else if (company.fiscalCredential.type === 'certificate' && company.fiscalCredential.expiresAt) {
    if (new Date(company.fiscalCredential.expiresAt) < new Date()) {
      validationErrors.push({
        code: 'CERTIFICATE_EXPIRED',
        message: 'Certificado digital expirado.'
      });
    }
  }

  const { validateMunicipalitySupport } = await import('../services/municipalityService.js');
  try {
    await validateMunicipalitySupport(company);
  } catch (e) {
    validationErrors.push({
      code: 'MUNICIPALITY_NOT_SUPPORTED',
      message: e.message || 'Município não suportado.'
    });
  }

  // Check fiscal connection status
  // 'not_connected' means company exists but needs credentials (NOT a failure)
  // 'failed' means credentials were tested and failed
  if (company.fiscalConnectionStatus === 'failed') {
    validationErrors.push({
      code: 'CONNECTION_FAILED',
      message: company.fiscalConnectionError || 'Conexão fiscal com falha. Verifique as credenciais e tente novamente.'
    });
  } else if (company.fiscalConnectionStatus === 'not_connected') {
    // Company exists but needs credentials - provide helpful guidance
    validationErrors.push({
      code: 'NOT_CONNECTED',
      message: 'Empresa cadastrada, mas falta conectar com a prefeitura. Configure certificado digital ou credenciais municipais na aba "Integração Fiscal".'
    });
  }

  if (!invoice_data.cliente_nome) {
    validationErrors.push({ code: 'MISSING_CLIENT_NAME', message: 'Nome do cliente é obrigatório.' });
  }
  if (!invoice_data.valor || parseFloat(invoice_data.valor) <= 0) {
    validationErrors.push({ code: 'INVALID_VALUE', message: 'Valor deve ser maior que zero.' });
  }

  if (company.regimeTributario === 'MEI') {
    const meiCheck = await checkMEILimit(company.id);
    if (!meiCheck.withinLimit) {
      validationErrors.push({
        code: 'MEI_LIMIT_EXCEEDED',
        message: `Limite anual MEI excedido. Faturamento: R$ ${meiCheck.currentRevenue?.toFixed(2)} / R$ ${meiCheck.limit?.toFixed(2)}`
      });
    }
  }

  const isValid = validationErrors.length === 0;
  
  sendSuccess(res, isValid ? 'Validação aprovada' : 'Validação falhou', {
    valid: isValid,
    errors: validationErrors,
    warnings,
    company: {
      id: company.id,
      razaoSocial: company.razaoSocial,
      regime: company.regimeTributario,
      nuvemFiscalId: company.nuvemFiscalId,
      hasCredential: !!company.fiscalCredential,
      connectionStatus: company.fiscalConnectionStatus
    },
    limits: limitCheck
  });
}));

/**
 * POST /api/assistant/validate-client
 * Validate client data against registered clients
 * Used when editing invoice preview
 */
router.post('/validate-client', [
  body('cliente_nome').optional().isString(),
  body('cliente_documento').optional().isString()
], asyncHandler(async (req, res) => {
  const { cliente_nome, cliente_documento } = req.body;
  
  if (!cliente_nome && !cliente_documento) {
    return res.status(400).json({
      status: 'error',
      message: 'Nome ou documento do cliente é obrigatório',
      code: 'MISSING_CLIENT_DATA'
    });
  }
  
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({
      status: 'error',
      message: 'Usuário não autenticado',
      code: 'UNAUTHORIZED'
    });
  }
  
  try {
    // Clean document if provided
    const cleanDoc = cliente_documento ? cliente_documento.replace(/\D/g, '') : '';
    
    // Try to find by document first (most reliable)
    if (cleanDoc && (cleanDoc.length === 11 || cleanDoc.length === 14)) {
      const existingByDoc = await prisma.client.findFirst({
        where: {
          userId,
          documento: cleanDoc
        }
      });
      
      if (existingByDoc) {
        return res.json({
          status: 'success',
          found: true,
          client: {
            id: existingByDoc.id,
            nome: existingByDoc.nome,
            documento: existingByDoc.documento,
            tipoPessoa: existingByDoc.tipoPessoa,
            email: existingByDoc.email,
            telefone: existingByDoc.telefone
          },
          message: `Cliente encontrado: ${existingByDoc.nome}`
        });
      }
      
      // Document provided but client not found
      return res.json({
        status: 'success',
        found: false,
        canAutoCreate: true,
        documentValid: true,
        message: `Cliente não encontrado com ${cleanDoc.length === 11 ? 'CPF' : 'CNPJ'} informado. Será cadastrado automaticamente ao confirmar a emissão.`,
        suggestedData: {
          nome: cliente_nome,
          documento: cleanDoc,
          tipoPessoa: cleanDoc.length === 11 ? 'pf' : 'pj'
        }
      });
    }
    
    // Try to find by name (exact or partial match)
    if (cliente_nome) {
      // First try exact match
      let existingByName = await prisma.client.findFirst({
        where: {
          userId,
          nome: cliente_nome
        }
      });
      
      // If not found, try case-insensitive partial match
      if (!existingByName) {
        existingByName = await prisma.client.findFirst({
          where: {
            userId,
            nome: {
              contains: cliente_nome,
              mode: 'insensitive'
            }
          }
        });
      }
      
      if (existingByName) {
        return res.json({
          status: 'success',
          found: true,
          client: {
            id: existingByName.id,
            nome: existingByName.nome,
            documento: existingByName.documento,
            tipoPessoa: existingByName.tipoPessoa,
            email: existingByName.email,
            telefone: existingByName.telefone
          },
          message: `Cliente encontrado: ${existingByName.nome}`
        });
      }
      
      // Search for similar names
      const similarClients = await prisma.client.findMany({
        where: {
          userId,
          nome: {
            contains: cliente_nome.split(' ')[0], // Match first name
            mode: 'insensitive'
          }
        },
        take: 5
      });
      
      if (similarClients.length > 0) {
        return res.json({
          status: 'success',
          found: false,
          canAutoCreate: false,
          documentValid: false,
          similarClients: similarClients.map(c => ({
            id: c.id,
            nome: c.nome,
            documento: c.documento
          })),
          message: `Cliente "${cliente_nome}" não encontrado. Encontrei clientes semelhantes - selecione um ou informe o CPF/CNPJ para cadastrar.`
        });
      }
    }
    
    // No match found and no valid document
    return res.json({
      status: 'success',
      found: false,
      canAutoCreate: false,
      documentValid: !cleanDoc || (cleanDoc.length !== 11 && cleanDoc.length !== 14),
      message: `Cliente "${cliente_nome || 'não informado'}" não encontrado. Informe o CPF ou CNPJ para cadastrar automaticamente.`
    });
    
  } catch (error) {
    console.error('[ValidateClient] Error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Erro ao validar cliente',
      code: 'VALIDATION_ERROR'
    });
  }
}));

/**
 * POST /api/assistant/execute-action
 * Execute an AI action (e.g., emit invoice)
 * This endpoint is called when user confirms an AI action
 */
router.post('/execute-action', [
  body('action_type').notEmpty().withMessage('Action type is required'),
  body('action_data').isObject().withMessage('Action data is required'),
  body('company_id').notEmpty().withMessage('Company ID is required')
], (req, res, next) => {
  if (req.body.action_type === 'emitir_nfse') {
    return invoiceEmissionLimiter(req, res, next);
  }
  next();
}, asyncHandler(async (req, res, next) => {
  try {
      await executeActionHandler(req, res);
  } catch (error) {
    const { translateErrorForUser } = await import('../services/errorTranslationService.js');
    const translatedMessage = translateErrorForUser(error, {});
    
    return res.status(error.statusCode || 500).json({
      status: 'error',
      message: translatedMessage,
      code: error.code || 'ACTION_ERROR',
      data: error.data || null
    });
  }
}));

async function executeActionHandler(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Validation failed', 
      errors: errors.array() 
    });
  }

  const { action_type, action_data, company_id } = req.body;

  const company = await prisma.company.findFirst({
    where: {
      id: company_id,
      userId: req.user.id
    },
    include: {
      fiscalCredential: true
    }
  });

  if (!company) {
    return res.status(404).json({
      status: 'error',
      message: 'Empresa não encontrada',
      code: 'NOT_FOUND'
    });
  }

  try {
  switch (action_type) {
    case 'emitir_nfse':
      return await executeEmitNfse(action_data, company, req.user.id, res);

    case 'consultar_status':
      return await executeCheckStatus(action_data, company, res);

    case 'verificar_conexao':
      return await executeCheckConnection(company, res);

      case 'cancelar_nfse':
        return await executeCancelNfse(action_data, company, req.user.id, res);

      case 'listar_notas':
        return await executeListInvoices(action_data, company, res);

      case 'consultar_faturamento':
        return await executeGetRevenue(action_data, company, res);

      case 'ultima_nota':
        return await executeGetLastInvoice(action_data, company, res);

      case 'notas_rejeitadas':
        return await executeGetRejectedInvoices(action_data, company, res);

      case 'criar_cliente':
        return await executeCreateClient(action_data, req.user.id, res);

    default:
        return res.status(400).json({
          status: 'error',
          message: `Tipo de ação '${action_type}' não suportado`,
          code: 'UNSUPPORTED_ACTION'
        });
    }
  } catch (error) {
    console.error(`[ExecuteAction] Error in ${action_type}:`, error.message);
    
    const { translateErrorForUser } = await import('../services/errorTranslationService.js');
    const translatedMessage = translateErrorForUser(error, {
      municipality: company.cidade,
      companyName: company.razaoSocial
    });
    
    return res.status(error.statusCode || 500).json({
      status: 'error',
      message: translatedMessage,
      code: error.code || 'INVOICE_EMISSION_ERROR'
    });
  }
}

/**
 * Execute emitir_nfse action - Emit invoice via real Nuvem Fiscal API
 */
async function executeEmitNfse(actionData, company, userId, res) {
  // Comprehensive plan limits validation
  const { validatePlanLimitsForIssuance } = await import('../services/planService.js');
  const limitsValidation = await validatePlanLimitsForIssuance(userId, company.id);
  
  // Log validation result for debugging
  console.log('[Invoice] Plan limits validation:', {
    valid: limitsValidation.valid,
    planId: limitsValidation.planId,
    planName: limitsValidation.planName,
    invoiceLimit: limitsValidation.invoiceLimit,
    errors: limitsValidation.errors,
    warnings: limitsValidation.warnings
  });
  
  if (!limitsValidation.valid) {
    // Build comprehensive error message with suggestions
    let errorMessage = '';
    const errorDetails = [];
    
    limitsValidation.errors.forEach((error, index) => {
      if (index > 0) errorMessage += '\n\n';
      
      errorMessage += `❌ ${error.message}`;
      
      if (error.details) {
        errorDetails.push({
          code: error.code,
          current: error.details.current,
          max: error.details.max,
          remaining: error.details.remaining
        });
        
        // Add detailed information about current usage
        errorMessage += `\n\n📊 Uso atual: ${error.details.current}/${error.details.max} notas emitidas este mês.`;
        if (error.details.remaining !== undefined) {
          errorMessage += `\n📈 Restantes: ${error.details.remaining} nota${error.details.remaining !== 1 ? 's' : ''}.`;
        }
      }
      
      // Add suggestions
      if (error.suggestions && error.suggestions.length > 0) {
        errorMessage += '\n\n💡 Opções disponíveis:';
        error.suggestions.forEach((suggestion, sugIndex) => {
          errorMessage += `\n${sugIndex + 1}. ${suggestion.message}`;
        });
      }
    });
    
    // Add warnings if any
    if (limitsValidation.warnings && limitsValidation.warnings.length > 0) {
      errorMessage += '\n\n⚠️ Avisos:';
      limitsValidation.warnings.forEach(warning => {
        errorMessage += `\n• ${warning.message}`;
      });
    }
    
    console.log('[Invoice] Blocking invoice issuance due to plan limits:', {
      errorCode: limitsValidation.errors[0].code,
      errorMessage: errorMessage.substring(0, 200) + '...'
    });
    
    throw new AppError(
      errorMessage,
      403,
      limitsValidation.errors[0].code,
      {
        validation: limitsValidation,
        errorDetails
      }
    );
  }
  
  // Show warnings if any (non-blocking)
  if (limitsValidation.warnings && limitsValidation.warnings.length > 0) {
    console.warn('[Invoice] Plan limit warnings:', limitsValidation.warnings);
  }

  // ========================================
  // PAY PER USE: Charge user for invoice emission
  // ========================================
  let invoiceUsageRecord = null;
  
  if (limitsValidation.isPayPerUse) {
    console.log('[Invoice] Pay Per Use plan detected, processing payment...');
    
    // Get user's Stripe customer ID
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, stripeCustomerId: true }
    });
    
    if (!user.stripeCustomerId) {
      throw new AppError(
        'Método de pagamento não configurado.\n\n' +
        'Para emitir notas no plano Pay per Use, você precisa cadastrar um cartão de crédito.\n\n' +
        '💳 Acesse **Configurações** > **Assinatura** para adicionar seu cartão.',
        402,
        'PAYMENT_METHOD_REQUIRED'
      );
    }
    
    // Import Stripe SDK
    const { chargeOneTimePayment, getCustomerPaymentMethods } = await import('../services/stripeSDK.js');
    
    // Check if customer has a payment method
    const paymentMethods = await getCustomerPaymentMethods(user.stripeCustomerId);
    if (paymentMethods.length === 0) {
      throw new AppError(
        'Nenhum cartão cadastrado.\n\n' +
        'Para emitir notas no plano Pay per Use (R$ 9,00 por nota), você precisa cadastrar um cartão de crédito.\n\n' +
        '💳 Acesse **Configurações** > **Assinatura** para adicionar seu cartão.',
        402,
        'PAYMENT_METHOD_REQUIRED'
      );
    }
    
    const invoiceValue = parseFloat(actionData.valor);
    const perInvoicePrice = limitsValidation.perInvoicePrice || 900; // R$9.00 in cents
    
    try {
      // Charge the user
      const paymentResult = await chargeOneTimePayment({
        customerId: user.stripeCustomerId,
        amount: perInvoicePrice,
        currency: 'brl',
        description: `MAY - Nota Fiscal: ${actionData.cliente_nome} - R$ ${invoiceValue.toFixed(2)}`,
        metadata: {
          userId: userId,
          companyId: company.id,
          invoiceValue: invoiceValue.toString(),
          clienteName: actionData.cliente_nome,
          type: 'pay_per_use_invoice'
        }
      });
      
      if (!paymentResult.success) {
        if (paymentResult.requiresAction) {
          throw new AppError(
            'Seu cartão requer autenticação adicional (3D Secure).\n\n' +
            'Por favor, acesse **Configurações** > **Assinatura** para completar a verificação do cartão.',
            402,
            'PAYMENT_REQUIRES_ACTION',
            { clientSecret: paymentResult.clientSecret }
          );
        }
        throw new AppError('Falha no pagamento. Verifique seu cartão.', 402, 'PAYMENT_FAILED');
      }
      
      console.log('[Invoice] ✅ Pay Per Use payment successful:', paymentResult.paymentIntentId);
      
      // Create InvoiceUsage record
      const now = new Date();
      invoiceUsageRecord = await prisma.invoiceUsage.create({
        data: {
          userId: userId,
          companyId: company.id,
          planId: 'pay_per_use',
          periodYear: now.getFullYear(),
          periodMonth: now.getMonth() + 1,
          amount: perInvoicePrice,
          status: 'paid',
          paymentOrderId: paymentResult.paymentIntentId
        }
      });
      
      console.log('[Invoice] InvoiceUsage record created:', invoiceUsageRecord.id);
      
    } catch (paymentError) {
      console.error('[Invoice] Pay Per Use payment failed:', paymentError.message);
      
      // Translate common Stripe errors
      let errorMessage = 'Não foi possível processar o pagamento.';
      
      if (paymentError.message.includes('CARD_ERROR')) {
        errorMessage = 'Cartão recusado. Por favor, verifique os dados do cartão ou tente outro cartão.';
      } else if (paymentError.message.includes('PAYMENT_METHOD_REQUIRED')) {
        errorMessage = 'Método de pagamento não encontrado. Cadastre um cartão em Configurações > Assinatura.';
      } else if (paymentError.code === 'PAYMENT_REQUIRES_ACTION') {
        throw paymentError; // Re-throw to preserve the error details
      }
      
      // Create failed InvoiceUsage record for tracking
      await prisma.invoiceUsage.create({
        data: {
          userId: userId,
          companyId: company.id,
          planId: 'pay_per_use',
          periodYear: new Date().getFullYear(),
          periodMonth: new Date().getMonth() + 1,
          amount: perInvoicePrice,
          status: 'failed',
          paymentOrderId: null
        }
      });
      
      throw new AppError(
        `💳 **Pagamento não autorizado**\n\n${errorMessage}\n\n` +
        `O plano Pay per Use cobra R$ 9,00 por nota fiscal emitida.\n\n` +
        `Acesse **Configurações** > **Assinatura** para atualizar seu cartão.`,
        402,
        'PAYMENT_FAILED'
      );
    }
  }

  // Check if Nuvem Fiscal is configured
  if (!isNuvemFiscalConfigured()) {
    throw new AppError(
      'Integração fiscal não configurada. Para emitir notas fiscais, configure as credenciais da Nuvem Fiscal (NUVEM_FISCAL_CLIENT_ID e NUVEM_FISCAL_CLIENT_SECRET).',
      503,
      'SERVICE_NOT_CONFIGURED'
    );
  }

  // Validate required fields
  if (!actionData.cliente_nome) {
    throw new AppError('Nome do cliente é obrigatório', 400, 'VALIDATION_ERROR');
  }
  if (!actionData.valor || parseFloat(actionData.valor) <= 0) {
    throw new AppError('Valor deve ser maior que zero', 400, 'VALIDATION_ERROR');
  }

  // Check if company is registered in Nuvem Fiscal
  if (!company.nuvemFiscalId) {
    throw new AppError(
      'Empresa não registrada na Nuvem Fiscal. Por favor, registre a empresa primeiro usando o botão "Verificar conexão com prefeitura".',
      400,
      'COMPANY_NOT_REGISTERED'
    );
  }

  // Validate municipality support before issuance (non-blocking)
  const { validateMunicipalitySupport } = await import('../services/municipalityService.js');
  try {
    await validateMunicipalitySupport(company);
  } catch (municipalityError) {
    if (!company.codigoMunicipio || company.codigoMunicipio.replace(/\D/g, '').length !== 7) {
    throw new AppError(
        'Código do município (IBGE) não configurado ou inválido. Acesse "Minha Empresa" e preencha o CEP para obter o código automaticamente.',
      400,
        'MUNICIPALITY_NOT_CONFIGURED',
      { codigo_municipio: company.codigoMunicipio }
    );
    }
    console.warn(`[Invoice] Municipality validation warning: ${municipalityError.message}. Proceeding anyway.`);
  }

  // Validate fiscal connection before issuance (non-blocking for testing)
  const { validateFiscalConnection } = await import('../services/fiscalConnectionService.js');
  let fiscalConnectionValid = true;
  try {
    await validateFiscalConnection(company);
  } catch (connectionError) {
    fiscalConnectionValid = false;
    console.warn(`[Invoice] Fiscal connection warning: ${connectionError.message}. Proceeding to let Nuvem Fiscal validate.`);
    
    // Handle different connection error types
    if (connectionError.code === 'FISCAL_NOT_CONNECTED') {
      if (!company.fiscalCredential) {
    throw new AppError(
        'Certificado digital não configurado.\n\nPara emitir notas fiscais, você precisa:\n1. Ir em "Minha Empresa"\n2. Na aba "Integração Fiscal", fazer upload do certificado digital (.pfx)\n3. Informar a senha do certificado\n\nSe você não possui um certificado digital, adquira um e-CNPJ A1 ou A3.',
      400,
        'CERTIFICATE_REQUIRED',
        { step: 'upload_certificate' }
    );
      } else {
        // Has credential but not connected - might need to test connection
        throw new AppError(
          'Empresa cadastrada, mas conexão não estabelecida.\n\nConfigure certificado digital ou credenciais municipais e teste a conexão na aba "Integração Fiscal".',
          400,
          'NOT_CONNECTED',
          { step: 'test_connection' }
        );
      }
    }
  }

  // Validate certificate not expired
  const { validateCertificateNotExpired } = await import('../services/certificateLifecycleService.js');
  try {
    await validateCertificateNotExpired(company.id);
  } catch (certError) {
    const { translateErrorForUser } = await import('../services/errorTranslationService.js');
    const translatedError = translateErrorForUser(certError, {
      municipality: company.cidade
    });
    
    throw new AppError(
      translatedError,
      400,
      'CERTIFICATE_EXPIRED',
      { companyId: company.id }
    );
  }

  // ============================================
  // Client Validation and Auto-Creation
  // ============================================
  let clientData = {
    nome: actionData.cliente_nome,
    documento: actionData.cliente_documento ? actionData.cliente_documento.replace(/\D/g, '') : ''
  };
  
  // Try to find existing client by document first (most reliable)
  if (clientData.documento) {
    const existingByDoc = await prisma.client.findFirst({
      where: {
        userId: userId,
        documento: clientData.documento
      }
    });
    
    if (existingByDoc) {
      console.log(`[Invoice] Found client by document: ${existingByDoc.nome} (${existingByDoc.documento})`);
      clientData.nome = existingByDoc.nome;
      clientData.documento = existingByDoc.documento;
      clientData.id = existingByDoc.id;
    } else {
      // Client with this document doesn't exist - auto-create
      console.log(`[Invoice] Client not found by document, auto-creating...`);
      const tipoPessoa = clientData.documento.length === 11 ? 'pf' : 'pj';
      
      const newClient = await prisma.client.create({
        data: {
          userId: userId,
          nome: clientData.nome,
          documento: clientData.documento,
          tipoPessoa
        }
      });
      
      console.log(`[Invoice] Auto-created client: ${newClient.nome} (${newClient.documento})`);
      clientData.id = newClient.id;
    }
  } else {
    // No document provided - try to find by name
    const existingByName = await prisma.client.findFirst({
      where: {
        userId: userId,
        nome: {
          contains: actionData.cliente_nome,
          mode: 'insensitive'
        }
      }
    });
    
    if (existingByName) {
      console.log(`[Invoice] Found client by name: ${existingByName.nome} (${existingByName.documento})`);
      clientData.nome = existingByName.nome;
      clientData.documento = existingByName.documento;
      clientData.id = existingByName.id;
    } else {
      // Client not found and no document - return error
      throw new AppError(
        `Cliente "${actionData.cliente_nome}" não encontrado no cadastro.\n\n` +
        `Para emitir a nota, você precisa:\n` +
        `1. Informar o CPF ou CNPJ do cliente, ou\n` +
        `2. Cadastrar o cliente primeiro dizendo:\n   "Cadastrar cliente ${actionData.cliente_nome} CPF 123.456.789-00"`,
        400,
        'CLIENT_NOT_FOUND',
        { 
          clienteName: actionData.cliente_nome,
          requiresDocument: true 
        }
      );
    }
  }
  
  console.log(`[Invoice] Using client data: ${clientData.nome} (${clientData.documento})`);

  // Get regime-specific defaults
  const regimeDefaults = getRegimeInvoiceDefaults(company.regimeTributario, company);
  const recommendedIssRate = getRecommendedIssRate(company.regimeTributario, company);
  
  // Prepare invoice data with regime-specific defaults and validated client data
  const invoiceData = {
    cliente_nome: clientData.nome,
    cliente_documento: clientData.documento,
    descricao_servico: actionData.descricao_servico || 'Serviço prestado',
    valor: parseFloat(actionData.valor),
    aliquota_iss: parseFloat(actionData.aliquota_iss || recommendedIssRate || regimeDefaults.aliquota_iss),
    municipio: actionData.municipio || company.cidade,
    data_prestacao: actionData.data_prestacao || new Date().toISOString().split('T')[0],
    codigo_servico: actionData.codigo_servico || regimeDefaults.codigo_servico,
    iss_retido: actionData.iss_retido || regimeDefaults.iss_retido
  };

  // Validate invoice against regime rules
  const validation = await validateInvoiceForRegime(invoiceData, company);
  if (!validation.valid) {
    throw new AppError(
      `Validação do regime tributário falhou: ${validation.errors.join(', ')}`,
      400,
      'REGIME_VALIDATION_ERROR'
    );
  }

  try {
    // Emit NFS-e via real Nuvem Fiscal API
    const nfseResult = await emitNfse(invoiceData, company);

    // Calculate ISS value
    const valorIss = (invoiceData.valor * invoiceData.aliquota_iss) / 100;

    // Save invoice to database
    const invoice = await prisma.invoice.create({
      data: {
        companyId: company.id,
        clienteNome: invoiceData.cliente_nome,
        clienteDocumento: invoiceData.cliente_documento || '',
        descricaoServico: invoiceData.descricao_servico,
        valor: invoiceData.valor,
        aliquotaIss: invoiceData.aliquota_iss,
        valorIss: valorIss,
        municipio: invoiceData.municipio,
        status: nfseResult.nfse.status || 'processando',
        numero: nfseResult.nfse.numero ? String(nfseResult.nfse.numero) : null,
        codigoVerificacao: nfseResult.nfse.codigo_verificacao,
        dataEmissao: new Date(),
        dataPrestacao: new Date(invoiceData.data_prestacao),
        codigoServico: invoiceData.codigo_servico,
        pdfUrl: nfseResult.nfse.pdf_url,
        xmlUrl: nfseResult.nfse.xml_url,
        nuvemFiscalId: nfseResult.nfse.nuvem_fiscal_id,
        // Link to InvoiceUsage record for Pay Per Use tracking
        invoiceUsageId: invoiceUsageRecord?.id || null
      }
    });
    
    // Update InvoiceUsage with invoice ID (for Pay Per Use tracking)
    if (invoiceUsageRecord) {
      await prisma.invoiceUsage.update({
        where: { id: invoiceUsageRecord.id },
        data: { invoiceId: invoice.id }
      });
      console.log('[Invoice] InvoiceUsage linked to invoice:', invoice.id);
    }

    // Create initial status history entry
    await prisma.invoiceStatusHistory.create({
      data: {
        invoiceId: invoice.id,
        status: invoice.status,
        message: 'Nota fiscal criada e enviada para processamento',
        source: 'api',
        metadata: {
          nuvem_fiscal_id: nfseResult.nfse.nuvem_fiscal_id,
          initial_status: invoice.status
        }
      }
    });

    // If status is 'processando', it will be polled automatically by background service
    if (invoice.status === 'processando' || invoice.status === 'pendente') {
      console.log(`[Invoice] Invoice ${invoice.id} is processing, will be polled automatically`);
    }

    // Create success notification
    await prisma.notification.create({
      data: {
        userId: userId,
        titulo: 'Nota Fiscal Emitida',
        mensagem: `Nota fiscal ${invoice.numero || 'NFS-e'} emitida com sucesso para ${invoiceData.cliente_nome}`,
        tipo: 'sucesso',
        invoiceId: invoice.id
      }
    });

    return sendSuccess(res, 'Nota fiscal emitida com sucesso via IA', {
      invoice: {
        id: invoice.id,
        numero: invoice.numero,
        status: invoice.status,
        codigo_verificacao: invoice.codigoVerificacao,
        pdf_url: invoice.pdfUrl,
        xml_url: invoice.xmlUrl,
        cliente_nome: invoice.clienteNome,
        valor: parseFloat(invoice.valor)
      }
    }, 201);
  } catch (error) {
    console.error('[AI Action] Error emitting invoice:', error);
    console.error('[AI Action] Error status:', error.status);
    console.error('[AI Action] Error code:', error.code);

    // Translate error to user-friendly Portuguese
    const { translateErrorForUser } = await import('../services/errorTranslationService.js');
    const translatedError = translateErrorForUser(error, {
      municipality: company.cidade,
      companyName: company.razaoSocial || company.nomeFantasia,
      includeTechnicalDetails: false
    });

    // Create error notification with translated message
    await prisma.notification.create({
      data: {
        userId: userId,
        titulo: 'Erro ao Emitir Nota Fiscal',
        mensagem: translatedError,
        tipo: 'erro'
      }
    });

    // Preserve the error code from Nuvem Fiscal API (especially for 403 permission errors)
    // This ensures we show the correct error type (municipality permission vs plan limit)
    const errorCode = error.code || (error.status === 403 ? 'MUNICIPALITY_PERMISSION_DENIED' : (error.status === 401 ? 'MUNICIPALITY_AUTH_ERROR' : 'INVOICE_EMISSION_ERROR'));
    const statusCode = error.status || 500;

    // Throw translated error with correct code
    throw new AppError(
      translatedError,
      statusCode,
      errorCode,
      { originalError: error.message } // Keep original for debugging
    );
  }
}

/**
 * Execute consultar_status action - Check invoice status
 */
async function executeCheckStatus(actionData, company, res) {
  if (!actionData.invoice_id && !actionData.numero) {
    throw new AppError('ID ou número da nota fiscal é obrigatório', 400, 'VALIDATION_ERROR');
  }

  // Find invoice
  const invoice = await prisma.invoice.findFirst({
    where: {
      companyId: company.id,
      ...(actionData.invoice_id ? { id: actionData.invoice_id } : { numero: actionData.numero })
    }
  });

  if (!invoice) {
    throw new AppError('Nota fiscal não encontrada', 404, 'NOT_FOUND');
  }

  if (!invoice.nuvemFiscalId) {
    throw new AppError('Nota fiscal não possui ID da Nuvem Fiscal', 400, 'INVALID_INVOICE');
  }

  try {
    // Check status with Nuvem Fiscal API
    const statusResult = await checkNfseStatus(company.nuvemFiscalId, invoice.nuvemFiscalId);

    // Update invoice status in database
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: statusResult.status,
        numero: statusResult.numero || invoice.numero,
        codigoVerificacao: statusResult.codigo_verificacao || invoice.codigoVerificacao,
        pdfUrl: statusResult.pdf_url || invoice.pdfUrl,
        xmlUrl: statusResult.xml_url || invoice.xmlUrl
      }
    });

    return sendSuccess(res, 'Status da nota fiscal consultado com sucesso', {
      invoice_id: invoice.id,
      numero: statusResult.numero || invoice.numero,
      status: statusResult.status,
      codigo_verificacao: statusResult.codigo_verificacao,
      pdf_url: statusResult.pdf_url,
      xml_url: statusResult.xml_url,
      mensagem: statusResult.mensagem
    });
  } catch (error) {
    console.error('[AI Action] Error checking invoice status:', error);
    throw new AppError(
      error.message || 'Falha ao consultar status da nota fiscal',
      500,
      'STATUS_CHECK_ERROR'
    );
  }
}

/**
 * Execute verificar_conexao action - Check fiscal connection
 */
async function executeCheckConnection(company, res) {
  if (!company.nuvemFiscalId) {
    throw new AppError(
      'Empresa não registrada na Nuvem Fiscal',
      400,
      'COMPANY_NOT_REGISTERED'
    );
  }

  try {
    const { checkConnection } = await import('../services/nuvemFiscal.js');
    const connectionResult = await checkConnection(company.nuvemFiscalId);

    await prisma.fiscalIntegrationStatus.upsert({
      where: { companyId: company.id },
      update: {
        status: connectionResult.status === 'conectado' ? 'conectado' : 'falha',
        mensagem: connectionResult.details || connectionResult.message,
        ultimaVerificacao: new Date()
      },
      create: {
        companyId: company.id,
        status: connectionResult.status === 'conectado' ? 'conectado' : 'falha',
        mensagem: connectionResult.details || connectionResult.message,
        ultimaVerificacao: new Date()
      }
    });

    return sendSuccess(res, connectionResult.message, {
      status: connectionResult.status,
      message: connectionResult.message,
      details: connectionResult.details,
      data: connectionResult.data || null
    });
  } catch (error) {
    console.error('[AI Action] Error checking connection:', error);
    throw new AppError(
      error.message || 'Falha ao verificar conexão fiscal',
      500,
      'CONNECTION_CHECK_ERROR'
    );
  }
}

/**
 * Execute cancelar_nfse action - Cancel invoice
 */
async function executeCancelNfse(actionData, company, userId, res) {
  const { invoice_id, numero, reason } = actionData;

  if (!invoice_id && !numero) {
    throw new AppError('ID ou número da nota fiscal é obrigatório', 400, 'VALIDATION_ERROR');
  }
  if (!reason || reason.trim().length < 15) {
    throw new AppError('Motivo do cancelamento é obrigatório (mínimo 15 caracteres)', 400, 'VALIDATION_ERROR');
  }

  const invoice = await prisma.invoice.findFirst({
    where: {
      companyId: company.id,
      ...(invoice_id ? { id: invoice_id } : { numero: numero })
    }
  });

  if (!invoice) {
    throw new AppError('Nota fiscal não encontrada', 404, 'NOT_FOUND');
  }

  const { validateCancellation, logCancellationAttempt } = await import('../services/cancellationService.js');
  const validation = await validateCancellation(invoice, company, reason);

  if (!validation.canCancel) {
    await logCancellationAttempt(invoice, userId, false, validation.errors.map(e => e.message).join('; '));
    
    const { translateErrorForAI } = await import('../services/errorTranslationService.js');
    const errorExplanation = translateErrorForAI(
      { message: validation.summary, code: validation.errors[0]?.code },
      { municipality: company.cidade }
    );
    
    throw new AppError(errorExplanation, 400, validation.errors[0]?.code || 'CANCELLATION_NOT_ALLOWED', {
      errors: validation.errors,
      rules: validation.rules
    });
  }

  try {
    const { cancelNfse } = await import('../services/nuvemFiscal.js');
    const cancelResult = await cancelNfse(company.nuvemFiscalId, invoice.nuvemFiscalId, reason);

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'cancelada',
        updatedAt: new Date()
      }
    });

    await logCancellationAttempt(invoice, userId, true, reason);

    await prisma.notification.create({
      data: {
        userId: userId,
        titulo: 'Nota Fiscal Cancelada',
        mensagem: `Nota fiscal ${invoice.numero} cancelada com sucesso. Motivo: ${reason}`,
        tipo: 'info',
        invoiceId: invoice.id
      }
    });

    return sendSuccess(res, 'Nota fiscal cancelada com sucesso', {
      invoice_id: invoice.id,
      numero: invoice.numero,
      status: 'cancelada',
      cancellation_reason: reason,
      cancelled_at: new Date().toISOString()
    });
  } catch (error) {
    await logCancellationAttempt(invoice, userId, false, error.message);
    
    const { translateErrorForUser } = await import('../services/errorTranslationService.js');
    const translatedError = translateErrorForUser(error, { municipality: company.cidade });
    
    throw new AppError(translatedError, error.status || 500, 'CANCELLATION_ERROR');
  }
}

/**
 * Execute listar_notas action - List invoices with filters
 */
async function executeListInvoices(actionData, company, res) {
  const { status, periodo, cliente, limit = 10 } = actionData;
  
  const where = { companyId: company.id };
  
  if (status) {
    where.status = status;
  }
  
  if (cliente) {
    where.clienteNome = { contains: cliente, mode: 'insensitive' };
  }
  
  if (periodo) {
    const now = new Date();
    if (periodo === 'hoje') {
      where.dataEmissao = { gte: new Date(now.setHours(0, 0, 0, 0)) };
    } else if (periodo === 'semana') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      where.dataEmissao = { gte: weekAgo };
    } else if (periodo === 'mes' || periodo === 'mes_atual') {
      where.dataEmissao = { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
    }
  }
  
  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { dataEmissao: 'desc' },
    take: Math.min(parseInt(limit), 50),
    select: {
      id: true,
      numero: true,
      clienteNome: true,
      valor: true,
      status: true,
      dataEmissao: true,
      pdfUrl: true
    }
  });
  
  return sendSuccess(res, `Encontradas ${invoices.length} notas fiscais`, {
    invoices: invoices.map(inv => ({
      id: inv.id,
      numero: inv.numero,
      cliente: inv.clienteNome,
      valor: parseFloat(inv.valor),
      status: inv.status,
      data_emissao: inv.dataEmissao,
      pdf_url: inv.pdfUrl
    })),
    total: invoices.length
  });
}

/**
 * Execute consultar_faturamento action - Get revenue summary
 */
async function executeGetRevenue(actionData, company, res) {
  const { periodo = 'mes_atual' } = actionData;
  const now = new Date();
  let startDate;
  
  if (periodo === 'hoje') {
    startDate = new Date(now.setHours(0, 0, 0, 0));
  } else if (periodo === 'semana') {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (periodo === 'mes' || periodo === 'mes_atual') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (periodo === 'ano') {
    startDate = new Date(now.getFullYear(), 0, 1);
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  
  const invoices = await prisma.invoice.findMany({
    where: {
      companyId: company.id,
      status: 'autorizada',
      dataEmissao: { gte: startDate }
    },
    select: { valor: true }
  });
  
  const totalRevenue = invoices.reduce((sum, inv) => sum + parseFloat(inv.valor), 0);
  const invoiceCount = invoices.length;
  
  let meiInfo = null;
  if (company.regimeTributario === 'MEI') {
    const meiCheck = await checkMEILimit(company.id);
    meiInfo = {
      limite_anual: meiCheck.limit,
      faturamento_atual: meiCheck.currentRevenue,
      percentual_usado: meiCheck.percentUsed,
      dentro_limite: meiCheck.withinLimit
    };
  }
  
  return sendSuccess(res, 'Faturamento consultado com sucesso', {
    periodo,
    data_inicio: startDate.toISOString(),
    faturamento_total: totalRevenue,
    quantidade_notas: invoiceCount,
    media_por_nota: invoiceCount > 0 ? totalRevenue / invoiceCount : 0,
    mei: meiInfo
  });
}

/**
 * Execute ultima_nota action - Get the last invoice
 */
async function executeGetLastInvoice(actionData, company, res) {
  const lastInvoice = await prisma.invoice.findFirst({
    where: { companyId: company.id },
    orderBy: { dataEmissao: 'desc' },
    select: {
      id: true,
      numero: true,
      clienteNome: true,
      valor: true,
      status: true,
      dataEmissao: true,
      pdfUrl: true,
      xmlUrl: true,
      codigoVerificacao: true
    }
  });

  if (!lastInvoice) {
    return sendSuccess(res, 'Nenhuma nota fiscal encontrada', {
      invoice: null,
      message: 'Você ainda não emitiu nenhuma nota fiscal.'
    });
  }

  return sendSuccess(res, 'Última nota fiscal encontrada', {
    invoice: {
      id: lastInvoice.id,
      numero: lastInvoice.numero,
      cliente: lastInvoice.clienteNome,
      valor: parseFloat(lastInvoice.valor),
      status: lastInvoice.status,
      data_emissao: lastInvoice.dataEmissao,
      codigo_verificacao: lastInvoice.codigoVerificacao,
      pdf_url: lastInvoice.pdfUrl,
      xml_url: lastInvoice.xmlUrl
    }
  });
}

/**
 * Execute notas_rejeitadas action - Get rejected invoices
 */
async function executeGetRejectedInvoices(actionData, company, res) {
  const { periodo } = actionData;
  const now = new Date();
  let startDate = null;
  
  if (periodo === 'hoje') {
    startDate = new Date(now.setHours(0, 0, 0, 0));
  } else if (periodo === 'semana') {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (periodo === 'mes' || periodo === 'mes_atual') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (periodo === 'ano') {
    startDate = new Date(now.getFullYear(), 0, 1);
  }
  
  const where = {
    companyId: company.id,
    status: 'rejeitada'
  };
  
  if (startDate) {
    where.dataEmissao = { gte: startDate };
  }
  
  const rejectedInvoices = await prisma.invoice.findMany({
    where,
    orderBy: { dataEmissao: 'desc' },
    take: 50,
    select: {
      id: true,
      numero: true,
      clienteNome: true,
      valor: true,
      status: true,
      dataEmissao: true,
      descricaoServico: true
    }
  });

  return sendSuccess(res, `Encontradas ${rejectedInvoices.length} notas rejeitadas${periodo ? ` no período: ${periodo}` : ''}`, {
    invoices: rejectedInvoices.map(inv => ({
      id: inv.id,
      numero: inv.numero,
      cliente: inv.clienteNome,
      valor: parseFloat(inv.valor),
      status: inv.status,
      data_emissao: inv.dataEmissao,
      descricao: inv.descricaoServico
    })),
    total: rejectedInvoices.length,
    periodo: periodo || 'todos'
  });
}

/**
 * Execute criar_cliente action - Create a new client
 */
async function executeCreateClient(actionData, userId, res) {
  const { name, document, email, phone } = actionData;
  
  // Validate required fields
  if (!name) {
    return res.status(400).json({
      status: 'error',
      message: 'Nome do cliente é obrigatório',
      code: 'VALIDATION_ERROR'
    });
  }
  
  if (!document) {
    return res.status(400).json({
      status: 'error',
      message: 'CPF ou CNPJ do cliente é obrigatório',
      code: 'VALIDATION_ERROR'
    });
  }
  
  // Clean and validate document
  const cleanDocument = document.replace(/\D/g, '');
  if (cleanDocument.length !== 11 && cleanDocument.length !== 14) {
    return res.status(400).json({
      status: 'error',
      message: 'Documento inválido. CPF deve ter 11 dígitos e CNPJ deve ter 14 dígitos.',
      code: 'VALIDATION_ERROR'
    });
  }
  
  const tipoPessoa = cleanDocument.length === 11 ? 'pf' : 'pj';
  
  // Check if client already exists
  const existingClient = await prisma.client.findFirst({
    where: {
      userId,
      documento: cleanDocument
    }
  });
  
  if (existingClient) {
    const docLabel = existingClient.tipoPessoa === 'pf' ? 'CPF' : 'CNPJ';
    const docFormatado = formatDocumentForDisplay(existingClient.documento, existingClient.tipoPessoa);
    return sendSuccess(res, 'Cliente já cadastrado', {
      client: {
        id: existingClient.id,
        nome: existingClient.nome,
        documento: existingClient.documento,
        tipo_pessoa: existingClient.tipoPessoa
      },
      message: `Já existe um cliente com este ${docLabel}: **${existingClient.nome}** (${docFormatado}).`
    });
  }
  
  // Create new client
  try {
    const newClient = await prisma.client.create({
      data: {
        userId,
        nome: name.trim(),
        documento: cleanDocument,
        tipoPessoa,
        email: email || null,
        telefone: phone || null,
        ativo: true
      }
    });
    
    const docLabel = tipoPessoa === 'pf' ? 'CPF' : 'CNPJ';
    const docFormatado = formatDocumentForDisplay(cleanDocument, tipoPessoa);
    
    return sendSuccess(res, 'Cliente cadastrado com sucesso', {
      client: {
        id: newClient.id,
        nome: newClient.nome,
        documento: newClient.documento,
        tipo_pessoa: newClient.tipoPessoa
      },
      message: `✅ Cliente **${newClient.nome}** cadastrado com sucesso!\n\n${docLabel}: ${docFormatado}`
    });
  } catch (error) {
    console.error('[executeCreateClient] Error creating client:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Erro ao cadastrar cliente. Tente novamente.',
      code: 'CREATE_ERROR'
    });
  }
}

/**
 * Get the system prompt for OpenAI
 * @param {object} company - Company data (optional, for regime-specific prompts)
 */
function getSystemPrompt(company = null) {
  let regimeContext = '';
  
  if (company && company.regimeTributario) {
    const regimeRules = getRegimeRules(company.regimeTributario);
    if (regimeRules) {
      regimeContext = `\n\nCONTEXTO DO REGIME TRIBUTÁRIO:\n`;
      regimeContext += `A empresa está no regime: ${regimeRules.name}\n`;
      
      if (company.regimeTributario === 'MEI') {
        regimeContext += `- Limite anual: R$ ${regimeRules.annualLimit.toLocaleString('pt-BR')}\n`;
        regimeContext += `- Alíquota de ISS fixa: ${regimeRules.issRate}%\n`;
        regimeContext += `- IMPORTANTE: Sempre use alíquota de ISS de 5% para MEI\n`;
        regimeContext += `- Alerte o usuário se estiver próximo do limite anual\n`;
      } else if (company.regimeTributario === 'Simples Nacional') {
        regimeContext += `- Alíquota de ISS variável (verificar município)\n`;
        regimeContext += `- DAS mensal baseado no faturamento\n`;
      } else {
        regimeContext += `- Regime: ${regimeRules.name}\n`;
        regimeContext += `- Alíquota de ISS variável por município\n`;
      }
    }
  }
  
  return `Você é MAY, uma assistente fiscal IA especializada em ajudar empresas brasileiras (MEI e Simples Nacional) a emitir e gerenciar notas fiscais de serviços (NFS-e).

PAPEL:
Interpretar comandos do usuário, validar regras fiscais e de negócio, orquestrar ações no backend, e explicar resultados em português claro.
NUNCA faça chamadas diretas a APIs externas - apenas orquestre endpoints do backend.

CAPACIDADES:
1. Emitir notas fiscais (com validação prévia completa)
2. Cancelar notas fiscais (respeitando regras do município)
3. Consultar notas (última, rejeitadas, pendentes, por cliente, por status, por período)
4. Verificar faturamento e limites MEI
5. Explicar questões fiscais em linguagem simples
6. Traduzir erros técnicos para o usuário
7. Responder perguntas sobre histórico de notas fiscais
8. Gerenciar clientes (cadastrar, listar, buscar)

GESTÃO DE CLIENTES:
Os clientes são os destinatários (tomadores) das notas fiscais. Cada cliente tem:
- Nome / Razão Social
- CPF ou CNPJ
- Apelido (opcional, para busca rápida)
- Email, telefone, endereço (opcionais)

FLUXO DE EMISSÃO COM CLIENTES:
1. Usuário pede para emitir nota: "Emitir nota de R$ 1.500 para Gabriel"
2. Sistema busca cliente pelo nome/apelido:
   - SE encontrar 1 cliente: usa automaticamente
   - SE encontrar múltiplos: pergunta qual
   - SE não encontrar: pede o CPF/CNPJ para cadastrar

3. Para cadastrar cliente inline:
   - Usuário diz: "Criar cliente Gabriel Silva CPF 123.456.789-00"
   - Sistema cria o cliente e confirma
   - Depois pode emitir: "Emitir nota de R$ 1.500 para Gabriel Silva"

AÇÕES DE CLIENTES:
- criar_cliente: Criar novo cliente
- listar_clientes: Listar clientes cadastrados
- buscar_cliente: Buscar cliente por nome/documento

AÇÕES DISPONÍVEIS:
- emitir_nfse: Emitir nota fiscal (SEMPRE requer confirmação)
- cancelar_nfse: Cancelar nota fiscal (requer motivo com 15+ caracteres)
- listar_notas: Listar notas com filtros (status, período, cliente, empresa)
- consultar_status: Verificar status de uma nota específica
- consultar_faturamento: Verificar faturamento do período
- verificar_conexao: Verificar conexão com prefeitura
- ultima_nota: Buscar a última nota fiscal emitida
- notas_rejeitadas: Listar notas rejeitadas (com filtro de período opcional)

CONSULTAS DE HISTÓRICO:
Quando o usuário perguntar sobre histórico de notas, use as ações apropriadas:

1. "Mostre minha última nota" / "Show my last invoice" → Use ação: ultima_nota
2. "Quais notas foram rejeitadas este mês?" / "Which invoices were rejected this month?" → Use ação: notas_rejeitadas com período: "mes_atual"
3. "Notas do cliente X" → Use ação: listar_notas com cliente: "X"
4. "Notas de janeiro" → Use ação: listar_notas com período apropriado
5. "Notas processando" → Use ação: listar_notas com status: "processando"

PERÍODOS SUPORTADOS:
- "hoje" → Notas de hoje
- "semana" → Últimos 7 dias
- "mes" ou "mes_atual" → Mês atual
- "ano" → Ano atual
- Datas específicas: Use formato YYYY-MM-DD

VALIDAÇÕES OBRIGATÓRIAS ANTES DE EMITIR:
Antes de emitir qualquer nota, você DEVE confirmar:
1. Status do plano (ACTIVE, PAST_DUE, CANCELED)
2. Limite de notas do plano (verificar se atingiu o limite mensal)
3. Limite de empresas (se aplicável)
4. Empresa registrada na Nuvem Fiscal
5. Conexão fiscal estabelecida
6. Município suportado
7. Certificado digital ou credenciais configurados
8. Certificado não expirado

Se QUALQUER validação falhar, BLOQUEIE a emissão e explique o motivo.

QUANDO LIMITES SÃO ATINGIDOS:
Se o usuário atingir limites do plano:
1. Explique claramente qual limite foi atingido (notas, empresas, etc.)
2. Informe o plano atual e os limites
3. Sugira opções de upgrade com detalhes dos planos disponíveis
4. Seja educado e ofereça ajuda para escolher a melhor opção

NUNCA exponha erros técnicos - sempre traduza para linguagem simples.

EXTRAÇÃO DE DADOS (IMPORTANTE):
Ao processar comandos de emissão, extraia TODOS os dados possíveis:

1. VALOR: Extraia números de qualquer formato:
   - "R$ 1.500,00" → 1500.00
   - "1500 reais" → 1500.00
   - "mil e quinhentos" → 1500.00
   - "2k" → 2000.00

2. CLIENTE: Extraia nome e documento se mencionado:
   - "João Silva" → cliente_nome
   - "CNPJ 12.345.678/0001-00" → cliente_documento
   - "CPF 123.456.789-00" → cliente_documento

3. SERVIÇO: Infira o tipo de serviço e código apropriado:
   - "consultoria" → codigo_servico: "1701", descricao: "Consultoria..."
   - "desenvolvimento de sistema" → codigo_servico: "0101"
   - "design" → codigo_servico: "1706"
   - "treinamento/curso" → codigo_servico: "0802"
   - Se não especificado: codigo_servico: "1701" (consultoria genérica)

4. DATA: Extraia datas mencionadas:
   - "ontem" → data_prestacao: (data de ontem no formato YYYY-MM-DD)
   - "dia 15" → data_prestacao do dia 15 do mês atual

CÓDIGOS DE SERVIÇO COMUNS (LC 116):
- 0101: Desenvolvimento de sistemas/software
- 0108: Criação de sites/websites
- 0802: Treinamento/curso/capacitação
- 1401: Medicina/consulta médica
- 1701: Consultoria/assessoria geral
- 1706: Marketing/design

${regimeContext}

FORMATO DE RESPOSTA (JSON VÁLIDO):
{
  "action": {
    "type": "tipo_da_acao",
    "data": {
      "cliente_nome": "Nome Completo",
      "cliente_documento": "CPF ou CNPJ (limpo, só números)",
      "descricao_servico": "Descrição detalhada do serviço",
      "valor": 1500.00,
      "aliquota_iss": 5,
      "codigo_servico": "1701",
      "data_prestacao": "2025-01-21"
    }
  },
  "explanation": "Explicação clara em português",
  "requiresConfirmation": true
}

REGRAS:
- Sempre retorne JSON válido
- Para emitir_nfse: SEMPRE requiresConfirmation: true
- Use português brasileiro
- Seja conciso mas completo nas explicações
- Se faltarem dados essenciais (valor ou cliente), pergunte
- SEMPRE confirme valores, cliente e descrição do serviço antes de emitir

CONFIRMAÇÕES CLARAS (IMPORTANTE):
Ao preparar uma nota fiscal, SEMPRE inclua na explicação:
1. Valor em formato brasileiro (R$ X.XXX,XX)
2. Nome do cliente (e documento se disponível)
3. Descrição do serviço
4. Uma pergunta de confirmação explícita

Formato de confirmação recomendado:
"📝 **Nota fiscal preparada:**

• **Valor:** R$ 1.500,00
• **Cliente:** João Silva
• **Serviço:** Consultoria de TI

✅ Deseja confirmar a emissão?"

SE O CLIENTE NÃO ESTIVER CADASTRADO:
1. Informe que o cliente não foi encontrado
2. Peça o CPF/CNPJ para cadastrar
3. Sugira usar a seção "Clientes" do menu
4. Exemplo: "Não encontrei 'Gabriel' cadastrado. Para emitir a nota, preciso do CPF ou CNPJ. Diga 'criar cliente Gabriel CPF 123.456.789-00' ou acesse a seção Clientes no menu."

EXEMPLOS:

Entrada: "Emitir nota de 2 mil para Empresa ABC por consultoria de TI"
{
  "action": {
    "type": "emitir_nfse",
    "data": {
      "cliente_nome": "Empresa ABC",
      "cliente_documento": "",
      "descricao_servico": "Consultoria de TI",
      "valor": 2000.00,
      "aliquota_iss": 5,
      "codigo_servico": "0106"
    }
  },
  "explanation": "📝 **Nota fiscal preparada:**\n\n• **Valor:** R$ 2.000,00\n• **Cliente:** Empresa ABC\n• **Serviço:** Consultoria de TI\n• **ISS:** 5%\n\n✅ Deseja confirmar a emissão desta nota?",
  "requiresConfirmation": true
}

Entrada: "Qual minha última nota?"
{
  "action": {"type": "consultar_ultima_nota"},
  "explanation": "Vou buscar sua última nota fiscal emitida.",
  "requiresConfirmation": false
}

Entrada: "Notas rejeitadas este mês"
{
  "action": {"type": "listar_notas", "data": {"status": "rejeitada", "periodo": "mes_atual"}},
  "explanation": "Vou verificar as notas fiscais rejeitadas neste mês.",
  "requiresConfirmation": false
}

Entrada: "Cancelar nota 12345"
{
  "action": {"type": "cancelar_nfse", "data": {"numero": "12345"}},
  "explanation": "Para cancelar esta nota, preciso que você informe o motivo do cancelamento (mínimo 15 caracteres).",
  "requiresConfirmation": true
}

Entrada: "Qual meu faturamento?"
{
  "action": {"type": "consultar_faturamento", "data": {"periodo": "mes_atual"}},
  "explanation": "Vou verificar seu faturamento do mês atual.",
  "requiresConfirmation": false
}

TRADUÇÃO DE ERROS:
Quando ocorrer um erro, NUNCA mostre mensagens técnicas. Sempre explique:
1. O que aconteceu (de forma simples)
2. Por que aconteceu (se possível identificar)
3. O que o usuário deve fazer

Exemplo de erro técnico: "401 Unauthorized - Invalid credentials"
Resposta traduzida: "Não foi possível conectar com a prefeitura. As credenciais de acesso não foram aceitas. Verifique se o certificado digital está válido e configurado corretamente."

REGRAS DE CANCELAMENTO:
- Só notas AUTORIZADAS podem ser canceladas
- Prazo varia por município (24-120 horas)
- Motivo obrigatório com mínimo 15 caracteres
- Se fora do prazo, explique e sugira alternativas

Se não entender, retorne:
{
  "action": null,
  "explanation": "Desculpe, não entendi. Posso ajudar com:\\n• Emitir notas fiscais\\n• Consultar última nota\\n• Ver notas rejeitadas\\n• Verificar faturamento\\n\\nO que você precisa?",
  "requiresConfirmation": false
}`;
}

export default router;