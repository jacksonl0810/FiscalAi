import express from 'express';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import axios from 'axios';
import FormDataLib from 'form-data';
import { prisma } from '../index.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireActiveSubscription } from '../middleware/subscriptionAccess.js';
import { emitNfse, checkNfseStatus, isNuvemFiscalConfigured } from '../services/nuvemFiscal.js';
import { sendSuccess } from '../utils/response.js';
import { checkMEILimit } from '../services/meiLimitTracking.js';
import { validateInvoiceForRegime, getRegimeRules, getRecommendedIssRate, getRegimeInvoiceDefaults } from '../services/regimeRules.js';
import { assistantLimiter, assistantReadLimiter, invoiceEmissionLimiter } from '../middleware/rateLimiter.js';
import { fetchWithTimeout, getTimeout } from '../utils/timeout.js';

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

// All routes require authentication and active subscription
router.use(authenticate);
router.use(requireActiveSubscription);

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
  
  if (!openaiApiKey) {
    // Fallback to pattern matching if no API key
    return processWithPatternMatching(message, req.user.id, companyId, res);
  }

  try {
    const timeoutMs = getTimeout('openai');

    // Call OpenAI API with timeout
    const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: getSystemPrompt(company)
          },
          ...finalHistory.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    }, timeoutMs);

    if (!response.ok) {
      throw new Error('OpenAI API request failed');
    }

    const data = await response.json();
    const assistantMessage = data.choices[0]?.message?.content;

    if (!assistantMessage) {
      throw new Error('No response from OpenAI');
    }

    // Try to parse as JSON
    let responseData;
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
    
    // Fallback to pattern matching
    try {
      const patternResult = await processWithPatternMatching(message, req.user.id, companyId, res);
      
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
 * Pattern matching fallback when OpenAI is not available
 */
async function processWithPatternMatching(message, userId, companyId, res) {
  const lowerMessage = message.toLowerCase();

  // Pattern: Issue invoice
  const invoicePattern = /emitir\s+nota\s+(?:de\s+)?r?\$?\s*(\d+(?:[.,]\d+)?)\s+(?:para|para\s+o?\s*)?(.+)/i;
  const invoiceMatch = message.match(invoicePattern);

  if (invoiceMatch || lowerMessage.includes('emitir nota') || lowerMessage.includes('nova nota')) {
    let valor = invoiceMatch ? parseFloat(invoiceMatch[1].replace(',', '.')) : null;
    let clienteNome = invoiceMatch ? invoiceMatch[2].trim() : null;

    if (valor && clienteNome) {
      return res.json({
        success: true,
        action: {
          type: 'emitir_nfse',
          data: {
            cliente_nome: clienteNome,
            cliente_documento: '',
            descricao_servico: 'Serviço prestado',
            valor: valor,
            aliquota_iss: 5
          }
        },
        explanation: `Entendi! Vou preparar uma nota fiscal de R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para ${clienteNome}. Por favor, confirme os dados.`,
        requiresConfirmation: true
      });
    } else {
      return res.json({
        success: true,
        action: null,
        explanation: 'Para emitir uma nota fiscal, me diga o valor e o nome do cliente. Por exemplo: "Emitir nota de R$ 1.500 para João Silva"',
        requiresConfirmation: false
      });
    }
  }

  // Pattern: Check revenue
  if (lowerMessage.includes('faturamento') || lowerMessage.includes('quanto faturei')) {
    const companies = await prisma.company.findMany({
      where: { userId },
      select: { id: true }
    });
    const companyIds = companies.map(c => c.id);

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

  // Pattern: List invoices
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

  // Pattern: Check taxes
  if (lowerMessage.includes('imposto') || lowerMessage.includes('das') || lowerMessage.includes('tributo')) {
    const responseData = {
      success: true,
      action: { type: 'consultar_impostos' },
      explanation: 'Você pode verificar seus impostos e guias DAS na seção "Impostos (DAS)" do menu. Lá você encontra as guias pendentes, pagas e pode gerar novas guias.',
      requiresConfirmation: false
    };
    res.json(responseData);
    return responseData;
  }

  // Default response
  const responseData = {
    success: true,
    action: null,
    explanation: `Olá! Sou seu assistente fiscal. Posso ajudá-lo com:\n\n• **Emitir notas fiscais** - Diga "Emitir nota de R$ [valor] para [cliente]"\n• **Consultar faturamento** - Pergunte "Qual meu faturamento este mês?"\n• **Ver impostos** - Pergunte "Quais meus impostos pendentes?"\n• **Listar notas** - Diga "Listar minhas notas fiscais"\n\nComo posso ajudar?`,
    requiresConfirmation: false
  };
  res.json(responseData);
  return responseData;
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
router.post('/transcribe', authenticate, requireActiveSubscription, handleMulterError, asyncHandler(async (req, res) => {
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
 * POST /api/assistant/execute-action
 * Execute an AI action (e.g., emit invoice)
 * This endpoint is called when user confirms an AI action
 */
router.post('/execute-action', [
  body('action_type').notEmpty().withMessage('Action type is required'),
  body('action_data').isObject().withMessage('Action data is required'),
  body('company_id').notEmpty().withMessage('Company ID is required')
], asyncHandler(async (req, res) => {
  // Apply invoice emission limiter only for emitir_nfse action
  if (req.body.action_type === 'emitir_nfse') {
    return invoiceEmissionLimiter(req, res, async () => {
      await executeActionHandler(req, res);
    });
  }
  
  await executeActionHandler(req, res);
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

  // Verify company ownership
  const company = await prisma.company.findFirst({
    where: {
      id: company_id,
      userId: req.user.id
    }
  });

  if (!company) {
    throw new AppError('Company not found', 404, 'NOT_FOUND');
  }

  // Handle different action types
  switch (action_type) {
    case 'emitir_nfse':
      return await executeEmitNfse(action_data, company, req.user.id, res);

    case 'consultar_status':
      return await executeCheckStatus(action_data, company, res);

    case 'verificar_conexao':
      return await executeCheckConnection(company, res);

    default:
      throw new AppError(`Action type '${action_type}' is not supported`, 400, 'UNSUPPORTED_ACTION');
  }
}

/**
 * Execute emitir_nfse action - Emit invoice via real Nuvem Fiscal API
 */
async function executeEmitNfse(actionData, company, userId, res) {
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

  // Get regime-specific defaults
  const regimeDefaults = getRegimeInvoiceDefaults(company.regimeTributario, company);
  const recommendedIssRate = getRecommendedIssRate(company.regimeTributario, company);
  
  // Prepare invoice data with regime-specific defaults
  const invoiceData = {
    cliente_nome: actionData.cliente_nome,
    cliente_documento: actionData.cliente_documento || '',
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
        clienteDocumento: invoiceData.cliente_documento,
        descricaoServico: invoiceData.descricao_servico,
        valor: invoiceData.valor,
        aliquotaIss: invoiceData.aliquota_iss,
        valorIss: valorIss,
        municipio: invoiceData.municipio,
        status: nfseResult.nfse.status || 'autorizada',
        numero: nfseResult.nfse.numero,
        codigoVerificacao: nfseResult.nfse.codigo_verificacao,
        dataEmissao: new Date(),
        dataPrestacao: new Date(invoiceData.data_prestacao),
        codigoServico: invoiceData.codigo_servico,
        pdfUrl: nfseResult.nfse.pdf_url,
        xmlUrl: nfseResult.nfse.xml_url,
        nuvemFiscalId: nfseResult.nfse.nuvem_fiscal_id
      }
    });

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

    // Create error notification
    await prisma.notification.create({
      data: {
        userId: userId,
        titulo: 'Erro ao Emitir Nota Fiscal',
        mensagem: `Falha ao emitir nota fiscal via IA: ${error.message}`,
        tipo: 'erro'
      }
    });

    throw new AppError(
      error.message || 'Falha ao emitir nota fiscal na Nuvem Fiscal',
      500,
      'INVOICE_EMISSION_ERROR'
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

    // Update fiscal integration status
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
  
  return `Você é um assistente fiscal especializado em ajudar empresas brasileiras a emitir notas fiscais de serviços (NFS-e).

Sua função é:
1. Entender comandos em português brasileiro
2. Retornar ações estruturadas em JSON
3. Explicar processos em linguagem natural

Ações disponíveis:
- emitir_nfse: Emitir uma nota fiscal de serviço (SEMPRE requer confirmação)
- consultar_status: Consultar status de uma nota fiscal
- listar_notas: Listar notas fiscais emitidas
- verificar_conexao: Verificar conexão com a prefeitura
- explicar: Apenas explicar algo sem executar ação

IMPORTANTE:
- Você NUNCA deve chamar APIs fiscais diretamente
- Você apenas retorna JSON estruturado com a ação
- O backend executará a ação real através da API Nuvem Fiscal
- Sempre retorne JSON válido
- Use português brasileiro para todas as explicações
- Para emitir_nfse, SEMPRE defina requiresConfirmation: true${regimeContext}

Formato de resposta (sempre JSON válido):
{
  "action": {
    "type": "tipo_da_acao" | null,
    "data": {
      // Dados específicos da ação
      // Para emitir_nfse (OBRIGATÓRIO):
      "cliente_nome": "string (obrigatório)",
      "cliente_documento": "string (CPF ou CNPJ, opcional mas recomendado)",
      "descricao_servico": "string (obrigatório)",
      "valor": number (obrigatório, em reais, ex: 1500.00),
      "aliquota_iss": number (percentual, padrão 5),
      "municipio": "string (opcional, será usado o da empresa se não informado)",
      "codigo_servico": "string (opcional, padrão '1401')",
      "data_prestacao": "string (opcional, formato YYYY-MM-DD)"
    }
  },
  "explanation": "Explicação em português brasileiro",
  "requiresConfirmation": true/false
}

Para emitir_nfse, SEMPRE inclua:
- requiresConfirmation: true
- Todos os campos obrigatórios no data
- Explicação clara do que será emitido

Exemplo de resposta para "Emitir nota de R$ 1500 para João Silva":
{
  "action": {
    "type": "emitir_nfse",
    "data": {
      "cliente_nome": "João Silva",
      "cliente_documento": "",
      "descricao_servico": "Serviço prestado",
      "valor": 1500.00,
      "aliquota_iss": 5,
      "municipio": "",
      "codigo_servico": "1401"
    }
  },
  "explanation": "Entendi! Vou preparar uma nota fiscal de R$ 1.500,00 para João Silva. Por favor, confirme os dados antes de emitir.",
  "requiresConfirmation": true
}

Se não entender o comando ou não houver ação clara, retorne:
{
  "action": null,
  "explanation": "Explicação do que você pode fazer",
  "requiresConfirmation": false
}`;
}

export default router;
