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
  'INVALID_CPF': {
    category: 'validation',
    message: 'CPF inválido',
    explanation: 'O CPF do cliente não passa na validação dos dígitos verificadores. A prefeitura exige um CPF válido (não use números de teste como 12345678900).',
    action: 'Informe um CPF válido do cliente com 11 dígitos. Para testes, use um CPF válido (ex.: 529.982.247-25).'
  },
  'INVALID_CNPJ': {
    category: 'validation',
    message: 'CNPJ inválido',
    explanation: 'O CNPJ do cliente (tomador) não passa na validação dos dígitos verificadores. A prefeitura exige um CNPJ válido.',
    action: 'Informe um CNPJ válido do cliente com 14 dígitos. Para testes, use um CNPJ válido (ex.: 00.000.000/0001-91 ou 11.222.333/0001-81).'
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
  'INVALID_NDPS': {
    category: 'validation',
    message: 'Número da DPS (nDPS) inválido',
    explanation: 'O número da Declaração de Prestação de Serviço deve ser um número que comece com 1 a 9 (não pode ser zero).',
    action: 'O sistema gera o nDPS automaticamente. Se o erro persistir, tente novamente em alguns segundos.'
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
  'MunicipioNaoHomologado': {
    category: 'validation',
    message: 'Município não homologado para NFSe Nacional',
    explanation: 'Este município ainda não aderiu ao Padrão Nacional de NFSe (Nota Fiscal de Serviço eletrônica). O sistema nacional ainda está em fase de implantação em todo o Brasil.',
    action: 'Você pode: (1) Aguardar a adesão do município ao padrão nacional, ou (2) Emitir a nota fiscal diretamente no portal da prefeitura do seu município.'
  },
  'Município não homologado': {
    category: 'validation',
    message: 'Município não homologado para NFSe Nacional',
    explanation: 'Este município ainda não aderiu ao Padrão Nacional de NFSe. A integração nacional está em fase de implantação gradual pelos municípios brasileiros.',
    action: 'Verifique no site nfse.gov.br se seu município já aderiu ao padrão nacional, ou emita a nota fiscal diretamente no portal da prefeitura.'
  },
  
  // ACBr DPS/NFS-e validation errors
  'E0008': {
    category: 'validation',
    message: 'Data de emissão inválida',
    explanation: 'A data de emissão da nota fiscal não pode ser posterior à data de processamento. Isso geralmente ocorre por diferença de fuso horário entre o servidor e a prefeitura.',
    action: 'Tente emitir a nota fiscal novamente. Se o problema persistir, verifique se a data e hora do sistema estão corretas.'
  },
  'E0310': {
    category: 'validation',
    message: 'Código de serviço inválido',
    explanation: 'O código de tributação nacional informado não existe na lista de serviços do Sistema Nacional NFS-e.',
    action: 'Verifique o código de serviço utilizado e selecione um código válido da lista de serviços nacional.'
  },
  'E0015': {
    category: 'validation',
    message: 'Data de competência inválida',
    explanation: 'A data de competência (data do serviço) não pode ser posterior à data de emissão da nota fiscal.',
    action: 'Verifique a data do serviço prestado e tente novamente. A data deve ser igual ou anterior à data atual.'
  },
  'E0116': {
    category: 'configuration',
    message: 'Inscrição Municipal não configurada',
    explanation: 'A Inscrição Municipal (IM) do prestador de serviço é obrigatória para este município, mas não está cadastrada na empresa.',
    action: 'Acesse a configuração da empresa e informe a Inscrição Municipal correta. Você pode obter esse número no cadastro da prefeitura.'
  },
  'E0625': {
    category: 'validation',
    message: 'Alíquota ISS não permitida para Simples Nacional',
    explanation: 'Para empresas do Simples Nacional (ME/EPP), quando não há retenção de ISS pelo tomador, não é permitido informar a alíquota de ISS na nota fiscal. O ISS é calculado e pago através do DAS mensal.',
    action: 'O sistema foi atualizado para não enviar a alíquota de ISS quando a empresa é Simples Nacional. Tente emitir a nota novamente.'
  },
  'E0424': {
    category: 'validation',
    message: 'Valor recebido não deve ser informado',
    explanation: 'O campo "valor recebido" (vReceb) não deve ser informado na DPS quando o prestador de serviço é o emitente da nota fiscal.',
    action: 'O sistema foi atualizado para não enviar este campo. Tente emitir a nota novamente.'
  },
  'E0010': {
    category: 'validation',
    message: 'Série da DPS inválida',
    explanation: 'A série informada na DPS não pertence à faixa definida para o tipo de emissor. Para emissão via API/webservice use série entre 00001 e 49999 (ex.: 900).',
    action: 'O sistema foi configurado para usar série 900 (emissão via API). Tente emitir a nota novamente.'
  },
  'INVALID_SERVICE_CODE': {
    category: 'validation',
    message: 'Código de serviço inválido',
    explanation: 'O código de serviço (cTribNac) não corresponde ao formato esperado pela Lista de Serviços LC 116/2003 ou não é suportado pelo município.',
    action: 'Verifique o código de serviço no cadastro da empresa e confirme que segue o formato de 6 dígitos (XXYYZZ) conforme LC 116. Ex.: 140101 para serviços de TI.'
  },
  // Simples Nacional: opção na DPS não confere com o cadastro (Receita Federal / prefeitura)
  'SIMPLES_NACIONAL_CADASTRO': {
    category: 'configuration',
    message: 'Regime tributário não confere com o cadastro',
    explanation: 'A opção de situação perante o Simples Nacional informada na nota não está de acordo com o cadastro oficial (Receita Federal / Simples Nacional). A prefeitura compara esse dado com o que consta no governo.',
    action: 'Acesse "Minha Empresa", abra a empresa que emite a nota e altere o campo "Regime Tributário" para bater exatamente com a situação real da empresa: se for MEI, escolha "MEI"; se for optante do Simples Nacional, escolha "Simples Nacional"; se não for optante (Lucro Presumido ou Lucro Real), escolha "Lucro Presumido" ou "Lucro Real". Depois salve e tente emitir a nota novamente.'
  },
  
  'InvalidJsonProperty': {
    category: 'validation',
    message: 'Propriedade inválida no payload',
    explanation: 'Uma propriedade enviada não é reconhecida pela API. Isso geralmente indica um campo incorreto no payload.',
    action: 'Verifique os campos enviados e tente novamente.'
  },

  // ACBr API / Fiscal specific errors
  'cpf_cnpj_diferente': {
    category: 'certificate',
    message: 'Certificado pertence a outra empresa',
    explanation: 'O certificado digital foi emitido para um CNPJ diferente da empresa cadastrada.',
    action: 'Faça o upload de um certificado digital que corresponda ao CNPJ da empresa.'
  },
  'empresa_nao_encontrada': {
    category: 'validation',
    message: 'Empresa não registrada',
    explanation: 'A empresa não foi encontrada no sistema da ACBr API.',
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
    message: 'Empresa não registrada na ACBr API',
    explanation: 'A empresa precisa ser registrada na ACBr API antes de emitir notas.',
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
    // Check exact code match first
    if (ERROR_KNOWLEDGE_BASE[errorCode]) {
      translation = ERROR_KNOWLEDGE_BASE[errorCode];
    }
    // Check exact code match (case insensitive - uppercase)
    if (!translation) {
      const upperCode = errorCode.toUpperCase();
      if (ERROR_KNOWLEDGE_BASE[upperCode]) {
        translation = ERROR_KNOWLEDGE_BASE[upperCode];
      }
    }
    // Check normalized code (lowercase with underscores)
    if (!translation) {
      const codeKey = errorCode.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      if (ERROR_KNOWLEDGE_BASE[codeKey]) {
        translation = ERROR_KNOWLEDGE_BASE[codeKey];
      }
    }
    // Check all keys case-insensitively
    if (!translation) {
      const lowerCode = errorCode.toLowerCase();
      for (const [key, value] of Object.entries(ERROR_KNOWLEDGE_BASE)) {
        if (key.toLowerCase() === lowerCode) {
          translation = value;
          break;
        }
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
                          context.acbrApi || 
                          context.acbrApi ||
                          context.municipality ||
                          normalizedMessage.includes('prefeitura') ||
                          normalizedMessage.includes('nuvem fiscal') ||
                          normalizedMessage.includes('acbr') ||
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
    } else if (statusCode === 400 && errorMessage) {
      const generic400 = ERROR_KNOWLEDGE_BASE['400'];
      const looksSpecific = /campo|inválido|obrigatório|obrigatorio|formato|esperado|descricao|correcao|cnpj|cpf|valor|código|codigo|serviço|servico|homologado|município|municipio|tributação|tributacao|existe/i.test(errorMessage);
      
      // Clean the error message - remove JSON and keep only the human-readable part
      let cleanMessage = errorMessage;
      const jsonStart = errorMessage.indexOf('; {');
      if (jsonStart > 0) {
        cleanMessage = errorMessage.substring(0, jsonStart).trim();
      }
      // Also try to clean "codigo: description" format to just description
      const colonMatch = cleanMessage.match(/^[A-Z]\d+:\s*(.+)$/i);
      if (colonMatch) {
        cleanMessage = colonMatch[1];
      }
      
      if (looksSpecific && cleanMessage.length > 10) {
        translation = { ...generic400, message: cleanMessage };
      } else if (generic400) {
        translation = generic400;
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
    if (normalizedMessage.includes('município não homologado') || normalizedMessage.includes('municipio nao homologado') || normalizedMessage.includes('municipionaohomologado')) {
      translation = ERROR_KNOWLEDGE_BASE['MunicipioNaoHomologado'];
    } else if (normalizedMessage.includes('data de emissão') && normalizedMessage.includes('posterior')) {
      translation = ERROR_KNOWLEDGE_BASE['E0008'];
    } else if (normalizedMessage.includes('inscrição municipal') || normalizedMessage.includes('inscricao municipal') || normalizedMessage.includes('municipal_registration')) {
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
    } else if (normalizedMessage.includes("'nfse}ndps'") || (normalizedMessage.includes('ndps') && normalizedMessage.includes('pattern'))) {
      translation = ERROR_KNOWLEDGE_BASE['INVALID_NDPS'];
    } else if (normalizedMessage.includes('validationfailed') || normalizedMessage.includes('validation failed')) {
      translation = ERROR_KNOWLEDGE_BASE['validationfailed'];
    } else if (normalizedMessage.includes('service_not_configured') || normalizedMessage.includes('integração fiscal não configurada')) {
      translation = ERROR_KNOWLEDGE_BASE['service_not_configured'];
    } else if (normalizedMessage.includes('simples nacional') && (normalizedMessage.includes('não está de acordo') || normalizedMessage.includes('nao esta de acordo') || normalizedMessage.includes('opção de situação'))) {
      translation = ERROR_KNOWLEDGE_BASE['SIMPLES_NACIONAL_CADASTRO'];
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
