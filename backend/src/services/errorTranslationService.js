/**
 * Error Translation Service
 * Translates technical API errors into user-friendly Portuguese messages
 * 
 * Requirements:
 * - What happened
 * - Why it happened (if possible)
 * - What to do next
 */

/**
 * Error knowledge base - maps common errors to user-friendly messages
 */
const ERROR_KNOWLEDGE_BASE = {
  // ==========================================
  // USER AUTHENTICATION ERRORS (Login/Registration)
  // ==========================================
  'INVALID_CREDENTIALS': {
    category: 'user_auth',
    message: 'Email ou senha incorretos',
    explanation: 'As credenciais informadas não correspondem a nenhuma conta cadastrada.',
    action: 'Verifique se digitou o email e senha corretamente. Se esqueceu sua senha, use "Esqueceu a senha?" para recuperar.'
  },
  'invalid email or password': {
    category: 'user_auth',
    message: 'Email ou senha incorretos',
    explanation: 'As credenciais informadas não correspondem a nenhuma conta cadastrada.',
    action: 'Verifique se digitou o email e senha corretamente. Se esqueceu sua senha, use a opção de recuperação.'
  },
  'USE_GOOGLE_LOGIN': {
    category: 'user_auth',
    message: 'Esta conta usa login do Google',
    explanation: 'Esta conta foi criada usando o Google e não possui senha definida.',
    action: 'Use o botão "Continuar com Google" para fazer login.'
  },
  'EMAIL_NOT_VERIFIED': {
    category: 'user_auth',
    message: 'Email ainda não verificado',
    explanation: 'Você precisa verificar seu email antes de fazer login.',
    action: 'Verifique sua caixa de entrada e clique no link de verificação. Se não recebeu, clique em "Reenviar email".'
  },
  'AUTH_RATE_LIMIT_EXCEEDED': {
    category: 'user_auth',
    message: 'Muitas tentativas de login',
    explanation: 'Você excedeu o limite de tentativas de login.',
    action: 'Aguarde alguns minutos antes de tentar novamente.'
  },
  'NO_TOKEN': {
    category: 'user_auth',
    message: 'Sessão expirada',
    explanation: 'Sua sessão expirou ou você não está logado.',
    action: 'Faça login novamente para continuar.'
  },
  'TOKEN_EXPIRED': {
    category: 'user_auth',
    message: 'Sessão expirada',
    explanation: 'Sua sessão expirou por inatividade.',
    action: 'Faça login novamente para continuar usando o sistema.'
  },
  'INVALID_TOKEN': {
    category: 'user_auth',
    message: 'Token inválido',
    explanation: 'O link utilizado é inválido ou já foi usado.',
    action: 'Solicite um novo link de verificação ou recuperação de senha.'
  },
  'USER_NOT_FOUND': {
    category: 'user_auth',
    message: 'Usuário não encontrado',
    explanation: 'Não existe uma conta com este email cadastrado.',
    action: 'Verifique o email digitado ou crie uma nova conta.'
  },
  'EMAIL_ALREADY_EXISTS': {
    category: 'user_auth',
    message: 'Email já cadastrado',
    explanation: 'Já existe uma conta com este email.',
    action: 'Use outro email ou faça login com a conta existente. Se esqueceu a senha, use a recuperação.'
  },
  'ALREADY_VERIFIED': {
    category: 'user_auth',
    message: 'Email já verificado',
    explanation: 'Este email já foi verificado anteriormente.',
    action: 'Você já pode fazer login normalmente.'
  },
  
  // ==========================================
  // FISCAL/PREFEITURA AUTHENTICATION ERRORS
  // ==========================================
  'MUNICIPALITY_AUTH_401': {
    category: 'fiscal_auth',
    message: 'Erro de autenticação com a prefeitura',
    explanation: 'As credenciais de acesso não foram aceitas pelo sistema da prefeitura.',
    action: 'Verifique suas credenciais (certificado digital ou usuário/senha municipal) e tente novamente.'
  },
  '403': {
    category: 'authorization',
    message: 'Sem permissão para realizar esta operação',
    explanation: 'Sua conta não tem permissão para emitir notas fiscais neste município.',
    action: 'Entre em contato com a prefeitura para verificar suas permissões de emissão de NFS-e.'
  },
  'MUNICIPALITY_PERMISSION_DENIED': {
    category: 'authorization',
    message: 'Empresa não autorizada para emitir NFS-e',
    explanation: 'A empresa não está autorizada pela prefeitura para emitir notas fiscais de serviço (NFS-e). Isso pode ocorrer se a empresa não completou o cadastro municipal ou se as credenciais não foram validadas.',
    action: 'Entre em contato com a prefeitura para verificar se a empresa está habilitada para emitir NFS-e e se todas as credenciais estão corretas.'
  },
  'MUNICIPALITY_AUTH_ERROR': {
    category: 'authentication',
    message: 'Erro de autenticação com a prefeitura',
    explanation: 'As credenciais de acesso (certificado digital ou usuário/senha municipal) não foram aceitas pela prefeitura.',
    action: 'Verifique suas credenciais fiscais na configuração da empresa e tente novamente. Se o problema persistir, entre em contato com a prefeitura.'
  },
  
  // Not found errors
  '404': {
    category: 'not_found',
    message: 'Recurso não encontrado',
    explanation: 'A empresa ou nota fiscal não foi encontrada no sistema.',
    action: 'Verifique se a empresa está corretamente registrada.'
  },
  '405': {
    category: 'api_error',
    message: 'Serviço temporariamente indisponível',
    explanation: 'O sistema de emissão de notas fiscais está em manutenção ou o ambiente de homologação não suporta esta operação.',
    action: 'Tente novamente em alguns instantes ou entre em contato com o suporte.'
  },
  '400': {
    category: 'validation',
    message: 'Dados inválidos para emissão',
    explanation: 'Alguns dados informados não estão no formato esperado pela prefeitura.',
    action: 'Verifique os dados da nota fiscal (CNPJ, valores, código de serviço) e tente novamente.'
  },
  
  // Validation errors
  'invalid_municipal_registration': {
    category: 'validation',
    message: 'Inscrição municipal inválida',
    explanation: 'O número da inscrição municipal informado não é válido ou não está cadastrado na prefeitura.',
    action: 'Verifique o número da inscrição municipal da empresa e certifique-se de que está correto.'
  },
  'invalidjson': {
    category: 'validation',
    message: 'Formato de dados inválido',
    explanation: 'Os dados enviados para a prefeitura não estão no formato correto.',
    action: 'Entre em contato com o suporte técnico para verificar a configuração.'
  },
  'validationfailed': {
    category: 'validation',
    message: 'Validação de dados falhou',
    explanation: 'Alguns dados não passaram na validação da API.',
    action: 'Verifique se todos os campos obrigatórios estão preenchidos corretamente.'
  },
  'service_code_not_allowed': {
    category: 'validation',
    message: 'Código de serviço não permitido',
    explanation: 'O código de serviço informado não é permitido para este município ou regime tributário.',
    action: 'Verifique o código de serviço e escolha um código válido para seu município.'
  },
  'municipality_not_supported': {
    category: 'validation',
    message: 'Município não suportado',
    explanation: 'Este município ainda não está disponível para emissão de NFS-e.',
    action: 'Verifique se o município está correto ou entre em contato com o suporte.'
  },
  
  // Nuvem Fiscal specific errors
  'cpf_cnpj_diferente': {
    category: 'certificate',
    message: 'Certificado pertence a outra empresa',
    explanation: 'O certificado digital foi emitido para um CNPJ diferente da empresa cadastrada.',
    action: 'Faça o upload de um certificado digital que corresponda ao CNPJ da empresa.'
  },
  'empresa_nao_encontrada': {
    category: 'validation',
    message: 'Empresa não registrada',
    explanation: 'A empresa não foi encontrada no sistema da Nuvem Fiscal.',
    action: 'Clique em "Verificar conexão com prefeitura" para registrar a empresa primeiro.'
  },
  
  // Plan limit errors
  'INVOICE_LIMIT_REACHED': {
    category: 'plan_limit',
    message: 'Limite de notas fiscais atingido',
    explanation: 'Você atingiu o limite mensal de notas fiscais do seu plano atual.',
    action: 'Faça upgrade do seu plano ou use a opção Pay per Use (R$9 por nota) para continuar emitindo.'
  },
  'COMPANY_LIMIT_REACHED': {
    category: 'plan_limit',
    message: 'Limite de empresas atingido',
    explanation: 'Você atingiu o limite de empresas permitidas no seu plano atual.',
    action: 'Faça upgrade do seu plano para adicionar mais empresas.'
  },
  'PAY_PER_USE_PENDING_PAYMENTS': {
    category: 'payment',
    message: 'Pagamentos pendentes',
    explanation: 'Você tem pagamentos pendentes de notas fiscais anteriores.',
    action: 'Complete os pagamentos pendentes antes de emitir novas notas fiscais.'
  },
  
  // System errors
  'municipality_offline': {
    category: 'system',
    message: 'Sistema da prefeitura temporariamente indisponível',
    explanation: 'O sistema da prefeitura está temporariamente fora do ar ou em manutenção.',
    action: 'A prefeitura está temporariamente indisponível. Vamos tentar novamente automaticamente e avisar você assim que for possível.'
  },
  'timeout': {
    category: 'system',
    message: 'Tempo de resposta excedido',
    explanation: 'A requisição demorou muito para ser processada.',
    action: 'Tente novamente em alguns instantes.'
  },
  'network_error': {
    category: 'system',
    message: 'Erro de conexão',
    explanation: 'Não foi possível conectar com o servidor.',
    action: 'Verifique sua conexão com a internet e tente novamente.'
  },
  'service_not_configured': {
    category: 'configuration',
    message: 'Integração fiscal não configurada',
    explanation: 'O sistema de emissão de notas fiscais não está configurado no servidor.',
    action: 'Entre em contato com o administrador do sistema para configurar a integração fiscal.'
  },
  
  // Certificate errors
  'certificate_expired': {
    category: 'certificate',
    message: 'Certificado digital expirado',
    explanation: 'Seu certificado digital A1 expirou e não pode mais ser usado.',
    action: 'Renove seu certificado digital e faça o upload novamente.'
  },
  'certificate_invalid': {
    category: 'certificate',
    message: 'Certificado digital inválido',
    explanation: 'O certificado digital fornecido não é válido ou está corrompido.',
    action: 'Verifique se o arquivo do certificado está correto e tente fazer o upload novamente.'
  },
  'certificate_password_incorrect': {
    category: 'certificate',
    message: 'Senha do certificado incorreta',
    explanation: 'A senha informada para o certificado digital está incorreta.',
    action: 'Verifique a senha do certificado e tente novamente.'
  },
  
  // Municipal credential errors
  'municipal_credentials_invalid': {
    category: 'credentials',
    message: 'Credenciais municipais inválidas',
    explanation: 'O usuário ou senha informados não são válidos no sistema da prefeitura.',
    action: 'Verifique suas credenciais municipais e tente novamente.'
  },
  'municipal_credentials_not_configured': {
    category: 'credentials',
    message: 'Credenciais fiscais não configuradas',
    explanation: 'É necessário configurar certificado digital ou credenciais municipais para emitir notas fiscais.',
    action: 'Acesse a configuração da empresa e faça o upload do certificado digital.'
  },
  'fiscal_not_connected': {
    category: 'credentials',
    message: 'Conexão fiscal não estabelecida',
    explanation: 'A empresa não está conectada ao sistema de emissão de notas fiscais.',
    action: 'Acesse "Minha Empresa", configure o certificado digital e clique em "Verificar conexão com prefeitura".'
  },
  'company_not_registered': {
    category: 'configuration',
    message: 'Empresa não registrada na Nuvem Fiscal',
    explanation: 'A empresa precisa ser registrada na Nuvem Fiscal antes de emitir notas.',
    action: 'Acesse "Minha Empresa" e clique em "Verificar conexão com prefeitura" para registrar.'
  }
};

/**
 * Translate technical error to user-friendly Portuguese message
 * 
 * @param {Error|string} error - Error object or error message
 * @param {object} context - Additional context (company, municipality, etc.)
 * @returns {object} Translated error with explanation and action
 */
export function translateError(error, context = {}) {
  let errorMessage = '';
  let errorCode = '';
  let statusCode = null;

  // Extract error information
  if (typeof error === 'string') {
    errorMessage = error;
  } else if (error instanceof Error) {
    errorMessage = error.message;
    errorCode = error.code || '';
    statusCode = error.status || error.statusCode || null;
  } else if (error && typeof error === 'object') {
    errorMessage = error.message || error.error || JSON.stringify(error);
    errorCode = error.code || '';
    statusCode = error.status || error.statusCode || null;
  }

  // Normalize error message to lowercase for matching
  const normalizedMessage = errorMessage.toLowerCase();

  // Try to match against knowledge base
  let translation = null;

  // PRIORITY 1: Check specific error codes FIRST (most specific)
  if (errorCode) {
    // Check exact code match (case insensitive)
    const upperCode = errorCode.toUpperCase();
    if (ERROR_KNOWLEDGE_BASE[upperCode]) {
      translation = ERROR_KNOWLEDGE_BASE[upperCode];
  }
    // Check normalized code
    if (!translation) {
    const codeKey = errorCode.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (ERROR_KNOWLEDGE_BASE[codeKey]) {
      translation = ERROR_KNOWLEDGE_BASE[codeKey];
      }
    }
  }

  // PRIORITY 2: Check error message exact match
  if (!translation && errorMessage) {
    // Check if message directly matches a key
    const msgKey = errorMessage.toLowerCase();
    if (ERROR_KNOWLEDGE_BASE[msgKey]) {
      translation = ERROR_KNOWLEDGE_BASE[msgKey];
    }
  }

  // PRIORITY 3: Check for user authentication patterns in message
  if (!translation) {
    if (normalizedMessage.includes('invalid email or password') || 
        normalizedMessage.includes('email ou senha') ||
        normalizedMessage.includes('credenciais inválidas')) {
      translation = ERROR_KNOWLEDGE_BASE['invalid email or password'];
    } else if (normalizedMessage.includes('email not verified') || 
               normalizedMessage.includes('verifique seu email') ||
               normalizedMessage.includes('verificar seu email')) {
      translation = ERROR_KNOWLEDGE_BASE['EMAIL_NOT_VERIFIED'];
    } else if (normalizedMessage.includes('google login') || 
               normalizedMessage.includes('sign in with google') ||
               normalizedMessage.includes('continuar com google')) {
      translation = ERROR_KNOWLEDGE_BASE['USE_GOOGLE_LOGIN'];
    } else if (normalizedMessage.includes('too many') || 
               normalizedMessage.includes('rate limit') ||
               normalizedMessage.includes('muitas tentativas')) {
      translation = ERROR_KNOWLEDGE_BASE['AUTH_RATE_LIMIT_EXCEEDED'];
    } else if (normalizedMessage.includes('token') && normalizedMessage.includes('expired')) {
      translation = ERROR_KNOWLEDGE_BASE['TOKEN_EXPIRED'];
    } else if (normalizedMessage.includes('no token') || normalizedMessage.includes('token required')) {
      translation = ERROR_KNOWLEDGE_BASE['NO_TOKEN'];
    } else if (normalizedMessage.includes('email already') || normalizedMessage.includes('já existe')) {
      translation = ERROR_KNOWLEDGE_BASE['EMAIL_ALREADY_EXISTS'];
    } else if (normalizedMessage.includes('user not found') || normalizedMessage.includes('usuário não encontrado')) {
      translation = ERROR_KNOWLEDGE_BASE['USER_NOT_FOUND'];
    }
  }

  // PRIORITY 4: Check if context indicates this is a fiscal/API error (not user auth)
  const isFiscalContext = context.isFiscalOperation || 
                          context.nuvemFiscal || 
                          context.municipality ||
                          normalizedMessage.includes('prefeitura') ||
                          normalizedMessage.includes('nuvem fiscal') ||
                          normalizedMessage.includes('nfse') ||
                          normalizedMessage.includes('nota fiscal');

  // PRIORITY 5: Status code - but only use fiscal messages if it's a fiscal context
  if (!translation && statusCode) {
    if (statusCode === 401) {
      // 401 could be user auth OR fiscal auth - use context to decide
      if (isFiscalContext) {
        translation = ERROR_KNOWLEDGE_BASE['MUNICIPALITY_AUTH_401'];
      } else {
        translation = ERROR_KNOWLEDGE_BASE['INVALID_CREDENTIALS'];
      }
    } else if (ERROR_KNOWLEDGE_BASE[statusCode.toString()]) {
      translation = ERROR_KNOWLEDGE_BASE[statusCode.toString()];
    }
  }

  // Check error message patterns
  if (!translation) {
    for (const [key, value] of Object.entries(ERROR_KNOWLEDGE_BASE)) {
      if (normalizedMessage.includes(key.toLowerCase()) || 
          normalizedMessage.includes(value.message.toLowerCase())) {
        translation = value;
        break;
      }
    }
  }

  // Check common patterns in error message
  if (!translation) {
    if (normalizedMessage.includes('inscrição municipal') || normalizedMessage.includes('inscricao municipal') || normalizedMessage.includes('municipal_registration')) {
      translation = ERROR_KNOWLEDGE_BASE['invalid_municipal_registration'];
    } else if (normalizedMessage.includes('código de serviço') || normalizedMessage.includes('codigo servico')) {
      translation = ERROR_KNOWLEDGE_BASE['service_code_not_allowed'];
    } else if (normalizedMessage.includes('município') && (normalizedMessage.includes('não suportado') || normalizedMessage.includes('nao suportado'))) {
      translation = ERROR_KNOWLEDGE_BASE['municipality_not_supported'];
    } else if (normalizedMessage.includes('timeout') || normalizedMessage.includes('tempo excedido')) {
      translation = ERROR_KNOWLEDGE_BASE['timeout'];
    } else if (normalizedMessage.includes('certificado') && normalizedMessage.includes('expirado')) {
      translation = ERROR_KNOWLEDGE_BASE['certificate_expired'];
    } else if (normalizedMessage.includes('cpf/cnpj diferente') || normalizedMessage.includes('cnpj diferente')) {
      translation = ERROR_KNOWLEDGE_BASE['cpf_cnpj_diferente'];
    } else if (normalizedMessage.includes('certificado') && (normalizedMessage.includes('inválido') || normalizedMessage.includes('invalido'))) {
      translation = ERROR_KNOWLEDGE_BASE['certificate_invalid'];
    } else if (normalizedMessage.includes('credencial') && (normalizedMessage.includes('inválida') || normalizedMessage.includes('invalida'))) {
      translation = ERROR_KNOWLEDGE_BASE['municipal_credentials_invalid'];
    } else if (normalizedMessage.includes('credenciais fiscais não configuradas') || normalizedMessage.includes('fiscal_not_connected')) {
      translation = ERROR_KNOWLEDGE_BASE['fiscal_not_connected'];
    } else if (normalizedMessage.includes('empresa não registrada') || normalizedMessage.includes('company_not_registered')) {
      translation = ERROR_KNOWLEDGE_BASE['company_not_registered'];
    } else if (normalizedMessage.includes('offline') || normalizedMessage.includes('indisponível') || normalizedMessage.includes('indisponivel')) {
      translation = ERROR_KNOWLEDGE_BASE['municipality_offline'];
    } else if (normalizedMessage.includes('network') || normalizedMessage.includes('conexão') || normalizedMessage.includes('conexao')) {
      translation = ERROR_KNOWLEDGE_BASE['network_error'];
    } else if (normalizedMessage.includes('invalidjson') || normalizedMessage.includes('invalid json')) {
      translation = ERROR_KNOWLEDGE_BASE['invalidjson'];
    } else if (normalizedMessage.includes('validationfailed') || normalizedMessage.includes('validation failed')) {
      translation = ERROR_KNOWLEDGE_BASE['validationfailed'];
    } else if (normalizedMessage.includes('service_not_configured') || normalizedMessage.includes('integração fiscal não configurada')) {
      translation = ERROR_KNOWLEDGE_BASE['service_not_configured'];
    }
  }

  // If no translation found, create generic one
  if (!translation) {
    translation = {
      category: 'unknown',
      message: 'Erro ao processar solicitação',
      explanation: 'Ocorreu um erro inesperado ao processar sua solicitação.',
      action: 'Tente novamente em alguns instantes. Se o problema persistir, entre em contato com o suporte.'
    };
  }

  // Add context-specific information
  let finalMessage = translation.message;
  let finalExplanation = translation.explanation;
  let finalAction = translation.action;

  // Add municipality info if available
  if (context.municipality) {
    finalExplanation = finalExplanation.replace('prefeitura', `prefeitura de ${context.municipality}`);
  }

  // Add company info if available
  if (context.companyName) {
    finalExplanation = finalExplanation.replace('empresa', `empresa ${context.companyName}`);
  }

  return {
    message: finalMessage,
    explanation: finalExplanation,
    action: finalAction,
    category: translation.category,
    originalError: errorMessage, // Keep original for debugging (not shown to user)
    technicalDetails: context.includeTechnicalDetails ? errorMessage : undefined
  };
}

/**
 * Translate error and format for API response
 * 
 * @param {Error|string} error - Error to translate
 * @param {object} context - Context information
 * @returns {string} User-friendly error message
 */
export function translateErrorForUser(error, context = {}) {
  const translation = translateError(error, context);
  
  // Combine message, explanation, and action into a single user-friendly message
  return `${translation.message}\n\n${translation.explanation}\n\n${translation.action}`;
}

/**
 * Translate error for AI assistant (more conversational)
 * 
 * @param {Error|string} error - Error to translate
 * @param {object} context - Context information
 * @returns {string} Conversational error explanation
 */
export function translateErrorForAI(error, context = {}) {
  const translation = translateError(error, context);
  
  return `Ocorreu um problema: ${translation.message}. ${translation.explanation} ${translation.action}`;
}
