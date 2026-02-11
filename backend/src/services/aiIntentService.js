/**
 * AI Intent Classification Service
 * 
 * Provides human-like understanding of user prompts using:
 * 1. NLP preprocessing for input normalization
 * 2. Semantic similarity matching
 * 3. Context-aware intent classification
 * 4. Confidence scoring for ambiguous inputs
 * 
 * This service processes user messages to understand their intent
 * like a human would - considering context, typos, abbreviations,
 * and natural language variations.
 */

// Intent types supported by the fiscal assistant
export const INTENT_TYPES = {
  // Invoice operations
  EMIT_INVOICE: 'emitir_nfse',
  CANCEL_INVOICE: 'cancelar_nfse',
  LIST_INVOICES: 'listar_notas',
  LAST_INVOICE: 'ultima_nota',
  INVOICE_STATUS: 'consultar_status',
  REJECTED_INVOICES: 'notas_rejeitadas',
  PENDING_INVOICES: 'notas_pendentes',
  
  // Client operations
  CREATE_CLIENT: 'criar_cliente',
  LIST_CLIENTS: 'listar_clientes',
  SEARCH_CLIENT: 'buscar_cliente',
  
  // Financial queries
  REVENUE: 'consultar_faturamento',
  
  // Tax operations
  VIEW_TAXES: 'ver_impostos',
  PAY_DAS: 'pagar_das',
  GENERATE_DAS: 'gerar_das',
  
  // System operations
  CHECK_CONNECTION: 'verificar_conexao',
  HELP: 'ajuda',
  GREETING: 'saudacao',
  
  // Unknown/General
  UNKNOWN: 'desconhecido',
  GENERAL_QUESTION: 'pergunta_geral',
};

// Keywords and phrases for each intent (Portuguese + variations)
const INTENT_PATTERNS = {
  [INTENT_TYPES.EMIT_INVOICE]: {
    keywords: ['emitir', 'emissão', 'gerar', 'criar', 'nova', 'fazer', 'lançar', 'registrar'],
    phrases: [
      // Basic patterns
      'emitir nota', 'nova nota', 'gerar nota', 'criar nota', 'fazer nota', 'emitir nf', 'emissão nf',
      'emitir uma nota', 'fazer uma nota', 'gerar uma nota', 'criar uma nota', 'lançar nota',
      // Conversational patterns
      'preciso emitir', 'quero emitir', 'gostaria de emitir', 'pode emitir', 'poderia emitir',
      'me ajuda a emitir', 'me ajude a emitir', 'vou emitir', 'vamos emitir',
      // Value-based patterns
      'nota de r$', 'nota de', 'nota fiscal de',
      // With client
      'nota para', 'emitir para',
    ],
    context: ['nota', 'nf', 'nfse', 'fiscal', 'reais', 'r$', 'valor'],
    weight: 1.0,
  },
  [INTENT_TYPES.CANCEL_INVOICE]: {
    keywords: ['cancelar', 'anular', 'estornar'],
    phrases: ['cancelar nota', 'anular nota', 'estornar nota'],
    context: ['nota', 'nf', 'nfse'],
    weight: 1.0,
  },
  [INTENT_TYPES.LIST_INVOICES]: {
    keywords: ['listar', 'mostrar', 'ver', 'exibir', 'minhas', 'todas'],
    phrases: ['listar notas', 'minhas notas', 'ver notas', 'mostrar notas', 'todas as notas', 'histórico de notas'],
    context: ['nota', 'notas', 'nf', 'nfse'],
    weight: 0.9,
  },
  [INTENT_TYPES.LAST_INVOICE]: {
    keywords: ['última', 'ultima', 'recente', 'anterior', 'last'],
    phrases: ['última nota', 'ultima nota', 'nota mais recente', 'última nf', 'minha última', 'last invoice'],
    context: ['nota', 'nf'],
    weight: 1.0,
  },
  [INTENT_TYPES.INVOICE_STATUS]: {
    keywords: ['status', 'situação', 'estado', 'como está', 'andamento'],
    phrases: ['status da nota', 'situação da nota', 'como está a nota', 'andamento da nota'],
    context: ['nota', 'nf'],
    weight: 0.9,
  },
  [INTENT_TYPES.REJECTED_INVOICES]: {
    keywords: ['rejeitada', 'rejeitadas', 'recusada', 'erro', 'falha', 'negada'],
    phrases: ['notas rejeitadas', 'notas com erro', 'notas recusadas', 'notas que falharam'],
    context: ['nota', 'notas'],
    weight: 1.0,
  },
  [INTENT_TYPES.PENDING_INVOICES]: {
    keywords: ['pendente', 'pendentes', 'processando', 'aguardando', 'em análise'],
    phrases: ['notas pendentes', 'notas processando', 'notas em análise', 'aguardando processamento'],
    context: ['nota', 'notas'],
    weight: 0.9,
  },
  [INTENT_TYPES.CREATE_CLIENT]: {
    keywords: ['cadastrar', 'criar', 'adicionar', 'novo', 'nova', 'registrar', 'incluir', 'salvar', 'inserir'],
    phrases: [
      'criar cliente', 'cadastrar cliente', 'novo cliente', 'adicionar cliente', 'registrar cliente',
      'incluir cliente', 'salvar cliente', 'inserir cliente',
      'cadastrar um cliente', 'criar um cliente', 'adicionar um cliente',
      'cadastrar novo cliente', 'criar novo cliente', 'adicionar novo cliente',
      'preciso cadastrar', 'quero cadastrar', 'quero criar',
      'preciso criar um cliente', 'quero adicionar um cliente',
      'me ajuda a cadastrar', 'me ajude a cadastrar',
      'cadastre um cliente', 'cadastre o cliente',
      'cliente novo', 'cliente nova',
    ],
    context: ['cliente', 'cpf', 'cnpj', 'documento', 'nome'],
    weight: 1.0,
  },
  [INTENT_TYPES.LIST_CLIENTS]: {
    keywords: ['listar', 'mostrar', 'ver', 'meus', 'todos'],
    phrases: ['listar clientes', 'meus clientes', 'ver clientes', 'clientes cadastrados', 'todos os clientes'],
    context: ['cliente', 'clientes'],
    weight: 0.9,
  },
  [INTENT_TYPES.SEARCH_CLIENT]: {
    keywords: ['buscar', 'procurar', 'encontrar', 'pesquisar', 'qual'],
    phrases: ['buscar cliente', 'procurar cliente', 'encontrar cliente', 'qual o cpf', 'qual o cnpj'],
    context: ['cliente'],
    weight: 0.8,
  },
  [INTENT_TYPES.REVENUE]: {
    keywords: ['faturamento', 'receita', 'ganho', 'ganhou', 'vendas', 'quanto', 'faturei'],
    phrases: ['meu faturamento', 'quanto faturei', 'receita do mês', 'total de vendas', 'quanto ganhei', 'faturamento mensal'],
    context: [],
    weight: 1.0,
  },
  [INTENT_TYPES.VIEW_TAXES]: {
    keywords: ['imposto', 'impostos', 'tributo', 'tributos', 'das', 'guia', 'guias'],
    phrases: ['ver impostos', 'meus impostos', 'guias pendentes', 'das pendente', 'impostos do mês', 'tributos a pagar'],
    context: [],
    weight: 0.9,
    // Avoid matching when CPF/CNPJ is present (common Portuguese word "das")
    negativeContext: ['cpf', 'cnpj'],
  },
  [INTENT_TYPES.PAY_DAS]: {
    keywords: ['pagar', 'pagamento', 'quitar'],
    phrases: ['pagar das', 'pagar imposto', 'pagar guia', 'quitar das'],
    context: ['das', 'imposto', 'guia'],
    weight: 1.0,
  },
  [INTENT_TYPES.GENERATE_DAS]: {
    keywords: ['gerar', 'emitir', 'criar'],
    phrases: ['gerar das', 'emitir das', 'gerar guia', 'criar guia das'],
    context: ['das', 'guia'],
    weight: 0.9,
  },
  [INTENT_TYPES.CHECK_CONNECTION]: {
    keywords: ['conexão', 'conectado', 'online', 'status', 'funcionando'],
    phrases: ['verificar conexão', 'status da conexão', 'está conectado', 'prefeitura online'],
    context: ['prefeitura', 'fiscal', 'nuvem'],
    weight: 0.8,
  },
  [INTENT_TYPES.HELP]: {
    keywords: ['ajuda', 'help', 'socorro', 'como', 'o que', 'dúvida'],
    phrases: ['preciso de ajuda', 'como funciona', 'o que você faz', 'me ajuda', 'pode me ajudar'],
    context: [],
    weight: 0.7,
  },
  [INTENT_TYPES.GREETING]: {
    keywords: ['oi', 'olá', 'ola', 'hey', 'hello', 'bom dia', 'boa tarde', 'boa noite', 'e aí', 'eai'],
    phrases: ['oi', 'olá', 'bom dia', 'boa tarde', 'boa noite', 'tudo bem', 'como vai'],
    context: [],
    weight: 0.6,
    exactMatch: true,
  },
};

// Common typos and abbreviations mapping
const TYPO_CORRECTIONS = {
  // Portuguese typos
  'emtir': 'emitir',
  'emiti': 'emitir',
  'emissao': 'emissão',
  'faturamneto': 'faturamento',
  'fatuamento': 'faturamento',
  'ulitma': 'última',
  'utlima': 'última',
  'ultma': 'última',
  'clinte': 'cliente',
  'cleinte': 'cliente',
  'nta': 'nota',
  'noat': 'nota',
  'notaf': 'nota',
  'cancelra': 'cancelar',
  'cancela': 'cancelar',
  'lisatr': 'listar',
  'lsitar': 'listar',
  'impsto': 'imposto',
  'imposto': 'imposto',
  'quantas': 'quantas',
  'qauntas': 'quantas',
  
  // Client-related typos
  'cadastrr': 'cadastrar',
  'cadstrar': 'cadastrar',
  'cadasrar': 'cadastrar',
  'registar': 'registrar',
  'adcionar': 'adicionar',
  'adiionar': 'adicionar',
  'documeto': 'documento',
  'docmento': 'documento',
  
  // Abbreviations
  'nf': 'nota fiscal',
  'nfs': 'nota fiscal',
  'nfse': 'nota fiscal de serviço',
  'nfs-e': 'nota fiscal de serviço',
  'cli': 'cliente',
  'fat': 'faturamento',
  'canc': 'cancelar',
  'ult': 'última',
  'pend': 'pendente',
  'rej': 'rejeitada',
};

// Brazilian Portuguese number words
const NUMBER_WORDS = {
  'zero': 0,
  'um': 1, 'uma': 1,
  'dois': 2, 'duas': 2,
  'três': 3, 'tres': 3,
  'quatro': 4,
  'cinco': 5,
  'seis': 6,
  'sete': 7,
  'oito': 8,
  'nove': 9,
  'dez': 10,
  'onze': 11,
  'doze': 12,
  'treze': 13,
  'quatorze': 14, 'catorze': 14,
  'quinze': 15,
  'dezesseis': 16,
  'dezessete': 17,
  'dezoito': 18,
  'dezenove': 19,
  'vinte': 20,
  'trinta': 30,
  'quarenta': 40,
  'cinquenta': 50,
  'sessenta': 60,
  'setenta': 70,
  'oitenta': 80,
  'noventa': 90,
  'cem': 100, 'cento': 100,
  'duzentos': 200, 'duzentas': 200,
  'trezentos': 300, 'trezentas': 300,
  'quatrocentos': 400, 'quatrocentas': 400,
  'quinhentos': 500, 'quinhentas': 500,
  'seiscentos': 600, 'seiscentas': 600,
  'setecentos': 700, 'setecentas': 700,
  'oitocentos': 800, 'oitocentas': 800,
  'novecentos': 900, 'novecentas': 900,
  'mil': 1000,
  'milhão': 1000000, 'milhao': 1000000,
};

// Period keywords
const PERIOD_KEYWORDS = {
  'hoje': 'hoje',
  'ontem': 'ontem',
  'semana': 'semana',
  'esta semana': 'semana',
  'essa semana': 'semana',
  'mês': 'mes',
  'mes': 'mes',
  'este mês': 'mes',
  'esse mês': 'mes',
  'mês atual': 'mes_atual',
  'mes atual': 'mes_atual',
  'mês passado': 'mes_passado',
  'último mês': 'mes_passado',
  'ano': 'ano',
  'este ano': 'ano',
  'esse ano': 'ano',
  'ano atual': 'ano_atual',
  'janeiro': '01', 'fevereiro': '02', 'março': '03', 'marco': '03',
  'abril': '04', 'maio': '05', 'junho': '06',
  'julho': '07', 'agosto': '08', 'setembro': '09',
  'outubro': '10', 'novembro': '11', 'dezembro': '12',
};

/**
 * Normalize and preprocess user input
 * Makes the input easier to analyze by:
 * - Converting to lowercase
 * - Fixing common typos
 * - Expanding abbreviations
 * - Normalizing accents
 * 
 * @param {string} text - Raw user input
 * @returns {string} Normalized text
 */
export function normalizeInput(text) {
  if (!text) return '';
  
  let normalized = text.toLowerCase().trim();
  
  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, ' ');
  
  // Normalize common accents that might be missing
  const accentMap = {
    'a': '[aáàâã]',
    'e': '[eéèê]',
    'i': '[iíìî]',
    'o': '[oóòôõ]',
    'u': '[uúùû]',
    'c': '[cç]',
  };
  
  // Fix common typos and expand abbreviations
  for (const [typo, correction] of Object.entries(TYPO_CORRECTIONS)) {
    const regex = new RegExp(`\\b${typo}\\b`, 'gi');
    normalized = normalized.replace(regex, correction);
  }
  
  return normalized;
}

/**
 * Extract monetary value from text
 * Handles various Brazilian formats:
 * - R$ 1.500,00
 * - R$ 1500
 * - R$ 1.250,50
 * - 1500 reais
 * - 1.500 reais
 * - mil e quinhentos
 * - 2k
 * - 2.5k
 * 
 * @param {string} text - Text containing monetary value
 * @returns {number|null} Extracted value or null
 */
export function extractMonetaryValue(text) {
  if (!text) return null;
  
  const normalized = text.toLowerCase();
  
  // Pattern 1: Currency format with R$ (R$ 1.500,00, R$ 1500, R$ 1.250,50)
  // Match R$ followed by numbers with optional thousand separators and decimal
  const currencyPatterns = [
    /r\$\s*([\d]+(?:\.[\d]{3})*(?:,[\d]{1,2})?)/,  // R$ 1.500,00 or R$ 1.500
    /r\$\s*([\d]+(?:,[\d]{1,2})?)/,                 // R$ 1500,50 or R$ 1500
    /r\$\s*([\d.,]+)/                               // Fallback
  ];
  
  for (const pattern of currencyPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      let value = match[1];
      // Handle Brazilian format: dots are thousand separators, comma is decimal
      if (value.includes(',')) {
        // Check if it's Brazilian format (1.500,00) or simple comma decimal (1500,50)
        const parts = value.split(',');
        const beforeComma = parts[0].replace(/\./g, ''); // Remove thousand separators
        const afterComma = parts[1] || '00';
        value = `${beforeComma}.${afterComma}`;
      } else {
        // No comma - dots could be thousand separators (1.500) or just not present (1500)
        value = value.replace(/\./g, ''); // Remove thousand separators
      }
      const parsed = parseFloat(value);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  }
  
  // Pattern 2: Number with "reais" (1500 reais, 1.500 reais, 1.500,00 reais)
  const reaisMatch = normalized.match(/([\d]+(?:\.[\d]{3})*(?:,[\d]{1,2})?)\s*reais/);
  if (reaisMatch) {
    let value = reaisMatch[1];
    if (value.includes(',')) {
      const parts = value.split(',');
      const beforeComma = parts[0].replace(/\./g, '');
      const afterComma = parts[1] || '00';
      value = `${beforeComma}.${afterComma}`;
    } else {
      value = value.replace(/\./g, '');
    }
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  
  // Pattern 3: K notation (2k, 2.5k, 2,5k)
  const kMatch = normalized.match(/([\d]+(?:[.,][\d]+)?)\s*k\b/);
  if (kMatch) {
    let value = kMatch[1].replace(',', '.');
    const parsed = parseFloat(value) * 1000;
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  
  // Pattern 4: Word numbers (mil, mil e quinhentos, dois mil)
  let totalValue = 0;
  let hasWordNumber = false;
  
  // Check for "mil"
  if (normalized.includes('mil')) {
    hasWordNumber = true;
    totalValue = 1000;
    
    // Check for multipliers before "mil" (dois mil, três mil)
    for (const [word, value] of Object.entries(NUMBER_WORDS)) {
      const milPattern = new RegExp(`\\b${word}\\s+mil\\b`, 'i');
      if (milPattern.test(normalized)) {
        totalValue = value * 1000;
        break;
      }
    }
  }
  
  // Check for hundreds after "mil" (mil e quinhentos, mil e duzentos)
  const afterMilMatch = normalized.match(/mil\s+e?\s*(\w+)/);
  if (afterMilMatch && NUMBER_WORDS[afterMilMatch[1]]) {
    totalValue += NUMBER_WORDS[afterMilMatch[1]];
  }
  
  if (hasWordNumber && totalValue > 0) return totalValue;
  
  // Pattern 5: Plain number after "de" or "valor" (nota de 1500, valor 1500)
  const contextualMatch = normalized.match(/(?:de|valor)\s+([\d]+(?:\.[\d]{3})*(?:,[\d]{1,2})?)/);
  if (contextualMatch) {
    let value = contextualMatch[1];
    if (value.includes(',')) {
      const parts = value.split(',');
      const beforeComma = parts[0].replace(/\./g, '');
      const afterComma = parts[1] || '00';
      value = `${beforeComma}.${afterComma}`;
    } else {
      value = value.replace(/\./g, '');
    }
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  
  // Pattern 6: Plain number (1500, 1.500) - last resort
  // Be careful to not match document numbers (11 or 14 digits)
  const plainMatches = normalized.matchAll(/\b([\d]+(?:\.[\d]{3})*)\b/g);
  for (const match of plainMatches) {
    let value = match[1].replace(/\./g, '');
    // Skip if it looks like a document number (11 or 14 digits)
    if (value.length === 11 || value.length === 14) continue;
    const parsed = parseFloat(value);
    // Reasonable invoice values are typically between 1 and 10,000,000
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 10000000) return parsed;
  }
  
  return null;
}

/**
 * Extract CPF or CNPJ from text
 * 
 * @param {string} text - Text containing document
 * @returns {object|null} { type: 'cpf'|'cnpj', value: string } or null
 */
export function extractDocument(text) {
  if (!text) return null;
  
  // CNPJ pattern (14 digits, with or without formatting)
  const cnpjMatch = text.match(/(\d{2}\.?\d{3}\.?\d{3}[\/]?\d{4}[-]?\d{2})/);
  if (cnpjMatch) {
    const clean = cnpjMatch[1].replace(/\D/g, '');
    if (clean.length === 14) {
      return { type: 'cnpj', value: clean };
    }
  }
  
  // CPF pattern (11 digits, with or without formatting)
  const cpfMatch = text.match(/(\d{3}\.?\d{3}\.?\d{3}[-]?\d{2})/);
  if (cpfMatch) {
    const clean = cpfMatch[1].replace(/\D/g, '');
    if (clean.length === 11) {
      return { type: 'cpf', value: clean };
    }
  }
  
  // Plain 11 or 14 digit number
  const plainMatch = text.match(/\b(\d{11}|\d{14})\b/);
  if (plainMatch) {
    const clean = plainMatch[1];
    return {
      type: clean.length === 11 ? 'cpf' : 'cnpj',
      value: clean,
    };
  }
  
  // "documento" keyword followed by numbers
  const docMatch = text.match(/documento\s*:?\s*(\d[\d.\-\/]*\d)/i);
  if (docMatch) {
    const clean = docMatch[1].replace(/\D/g, '');
    if (clean.length === 11 || clean.length === 14) {
      return {
        type: clean.length === 11 ? 'cpf' : 'cnpj',
        value: clean,
      };
    }
  }
  
  return null;
}

/**
 * Extract client name from text
 * Handles patterns like:
 * - "para João Silva"
 * - "cliente Maria"
 * - "do cliente Empresa ABC"
 * 
 * @param {string} text - Text containing client name
 * @returns {string|null} Client name or null
 */
export function extractClientName(text) {
  if (!text) return null;
  
  // Remove document patterns first to avoid including them in name
  let cleanText = text
    .replace(/\d{2}\.?\d{3}\.?\d{3}[\/]?\d{4}[-]?\d{2}/g, '') // CNPJ
    .replace(/\d{3}\.?\d{3}\.?\d{3}[-]?\d{2}/g, '') // CPF
    .replace(/\b\d{11,14}\b/g, '') // Plain numbers
    .replace(/r\$\s*[\d.,]+/gi, '') // Currency
    .replace(/\b\d+\s*(?:reais|mil|k)\b/gi, '') // Number words
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '') // Email
    .replace(/\(?\d{2}\)?\s*\d{4,5}[-.]?\d{4}/g, '') // Phone
    .trim();
  
  // Pattern 1: "Nome: [name]" or "nome é [name]" or "nome = [name]"
  const nomeMatch = cleanText.match(/nome\s*(?:[:=é]|é)\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.]+?)(?:\s*[,;]|\s+(?:cpf|cnpj|documento|email|telefone|tel|fone|e\s+o|com\s)|$)/i);
  if (nomeMatch && nomeMatch[1]?.trim().length > 1) {
    return nomeMatch[1].trim();
  }
  
  // Pattern 2: "o nome é/dele é/dela é [name]"
  const nameIsMatch = cleanText.match(/(?:o\s+nome|nome\s+(?:dele|dela)?)\s+(?:é|e)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.]+?)(?:\s*[,;.]|\s+(?:cpf|cnpj|documento|email|telefone|e\s+o|com\s)|$)/i);
  if (nameIsMatch && nameIsMatch[1]?.trim().length > 1) {
    return nameIsMatch[1].trim();
  }
  
  // Pattern 3: "chamado/chamada [name]" or "de nome [name]"
  const chamadoMatch = cleanText.match(/(?:chamad[oa]|de\s+nome)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.]+?)(?:\s*[,;.]|\s+(?:cpf|cnpj|documento|email|telefone|com\s)|$)/i);
  if (chamadoMatch && chamadoMatch[1]?.trim().length > 1) {
    return chamadoMatch[1].trim();
  }
  
  // Pattern 4: "criar/cadastrar cliente [name]"
  const afterClienteMatch = cleanText.match(/(?:criar|cadastrar|cadastre|registrar|adicionar|incluir|novo|nova)\s+(?:um\s+|uma\s+|o\s+|a\s+)?(?:novo\s+|nova\s+)?cliente\s*:?\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.]+?)(?:\s*[,;]|\s+(?:cpf|cnpj|documento|email|telefone|tel|fone|com\s|de\s|no\s)|$)/i);
  if (afterClienteMatch && afterClienteMatch[1]?.trim().length > 1) {
    return afterClienteMatch[1].trim();
  }
  
  // Pattern 5: "cliente [name]" (simple)
  const clienteMatch = cleanText.match(/cliente\s*:?\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.]+?)(?:\s*[,;]|\s+(?:cpf|cnpj|documento|de|no|por|email|telefone)|$)/i);
  if (clienteMatch && clienteMatch[1]?.trim().length > 1) {
    const candidate = clienteMatch[1].trim();
    // Exclude words that aren't names
    if (!/^(?:novo|nova|um|uma|o|a|com|de|para|meu|minha)$/i.test(candidate)) {
      return candidate;
    }
  }
  
  // Pattern 6: "para [name]"
  const paraMatch = cleanText.match(/para\s+(?:o\s+cliente\s+|a\s+empresa\s+)?([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.]+?)(?:\s+(?:cpf|cnpj|documento|de|no\s+valor|por|referente)|$)/i);
  if (paraMatch && paraMatch[1]?.trim().length > 1) {
    return paraMatch[1].trim();
  }
  
  // Pattern 7: "do/da [name]"
  const doMatch = cleanText.match(/(?:do|da)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.]+?)(?:\s+(?:cpf|cnpj|documento|de|no|por)|$)/i);
  if (doMatch && doMatch[1]?.trim().length > 1 && !doMatch[1].toLowerCase().includes('cliente')) {
    return doMatch[1].trim();
  }
  
  // Pattern 8: "razão social [name]"
  const razaoMatch = cleanText.match(/(?:razão\s*social|razao\s*social)\s*:?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.]+?)(?:\s*[,;]|\s+(?:cpf|cnpj|documento|email|telefone)|$)/i);
  if (razaoMatch && razaoMatch[1]?.trim().length > 1) {
    return razaoMatch[1].trim();
  }
  
  return null;
}

/**
 * Extract period/date reference from text
 * 
 * @param {string} text - Text containing period reference
 * @returns {string|null} Period identifier or null
 */
export function extractPeriod(text) {
  if (!text) return null;
  
  const normalized = text.toLowerCase();
  
  for (const [keyword, period] of Object.entries(PERIOD_KEYWORDS)) {
    if (normalized.includes(keyword)) {
      return period;
    }
  }
  
  // Try to extract specific date
  const dateMatch = normalized.match(/dia\s+(\d{1,2})/);
  if (dateMatch) {
    return `dia_${dateMatch[1]}`;
  }
  
  return null;
}

/**
 * Calculate semantic similarity between text and keywords
 * Uses a simple but effective scoring algorithm
 * 
 * @param {string} text - User input
 * @param {object} pattern - Intent pattern object
 * @returns {number} Similarity score (0-1)
 */
function calculateSimilarity(text, pattern) {
  const normalized = normalizeInput(text);
  const words = normalized.split(/\s+/);
  
  let score = 0;
  let matches = 0;
  
  // Check exact phrase matches (highest weight)
  for (const phrase of pattern.phrases || []) {
    if (normalized.includes(phrase.toLowerCase())) {
      score += 0.5;
      matches++;
    }
  }
  
  // Check keyword matches
  for (const keyword of pattern.keywords || []) {
    if (normalized.includes(keyword.toLowerCase())) {
      score += 0.3;
      matches++;
    }
  }
  
  // Check context words
  for (const context of pattern.context || []) {
    if (normalized.includes(context.toLowerCase())) {
      score += 0.1;
      matches++;
    }
  }
  
  // Check negative context (should NOT be present)
  for (const negative of pattern.negativeContext || []) {
    if (normalized.includes(negative.toLowerCase())) {
      score -= 0.5;
    }
  }
  
  // Exact match bonus for short phrases
  if (pattern.exactMatch && pattern.keywords?.some(k => normalized === k.toLowerCase())) {
    score += 0.5;
  }
  
  // Apply weight
  score *= pattern.weight || 1.0;
  
  // Normalize to 0-1
  return Math.min(1, Math.max(0, score));
}

/**
 * Classify user intent with confidence scoring
 * Returns the most likely intent and a confidence score
 * 
 * @param {string} message - User message
 * @param {object} context - Additional context (company, history, etc.)
 * @returns {object} { intent, confidence, data }
 */
export function classifyIntent(message, context = {}) {
  const normalized = normalizeInput(message);
  
  // Special case: standalone document input (response to "what's their CPF?")
  const document = extractDocument(message);
  const clientName = extractClientName(message);
  
  // Check if this is a client creation pattern - multiple approaches
  
  // Pattern A: "[Name] CPF/CNPJ/documento [number]" (standalone)
  const clientCreationPattern = /^(.+?)\s+(?:cpf|cnpj|documento)\s*:?\s*(\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2}|\d{2}\.?\d{3}\.?\d{3}[\/]?\d{4}[-.]?\d{2}|\d{11}|\d{14})$/i;
  if (clientCreationPattern.test(message.trim())) {
    const match = message.trim().match(clientCreationPattern);
    return {
      intent: INTENT_TYPES.CREATE_CLIENT,
      confidence: 0.95,
      data: {
        clientName: match[1].trim(),
        document: extractDocument(message),
      },
    };
  }
  
  // Pattern B: Explicit "criar/cadastrar/registrar/adicionar cliente" with any format
  const explicitClientCreation = /(?:criar|cadastrar|cadastre|registrar|registre|adicionar|adicione|incluir|salvar|inserir)\s+(?:um\s+|uma\s+|o\s+|a\s+)?(?:novo\s+|nova\s+)?cliente/i;
  if (explicitClientCreation.test(message)) {
    return {
      intent: INTENT_TYPES.CREATE_CLIENT,
      confidence: 0.9,
      data: {
        clientName: clientName,
        document: document,
      },
    };
  }
  
  // Pattern C: "cliente novo" (reversed)
  if (/cliente\s+(?:novo|nova)/i.test(message)) {
    return {
      intent: INTENT_TYPES.CREATE_CLIENT,
      confidence: 0.85,
      data: {
        clientName: clientName,
        document: document,
      },
    };
  }
  
  // Pattern D: Conversational "preciso/quero/gostaria cadastrar cliente"
  const conversationalClient = /(?:preciso|quero|gostaria|pode|poderia|necessito|desejo|vou)\s+(?:de\s+)?(?:criar|cadastrar|registrar|adicionar|incluir)\s+(?:um\s+|uma\s+)?(?:novo\s+|nova\s+)?cliente/i;
  if (conversationalClient.test(message)) {
    return {
      intent: INTENT_TYPES.CREATE_CLIENT,
      confidence: 0.9,
      data: {
        clientName: clientName,
        document: document,
      },
    };
  }
  
  // Pattern E: "me ajuda/ajude a cadastrar cliente"
  const helpClient = /(?:me\s+)?(?:ajud[ae]|auxili[ae])\s+(?:a\s+)?(?:criar|cadastrar|registrar|adicionar)\s+(?:um\s+|uma\s+)?(?:novo\s+|nova\s+)?cliente/i;
  if (helpClient.test(message)) {
    return {
      intent: INTENT_TYPES.CREATE_CLIENT,
      confidence: 0.85,
      data: {
        clientName: clientName,
        document: document,
      },
    };
  }
  
  // Pattern F: "Nome: [name]" with document in the same message
  if (/nome\s*[:=]\s*.+/i.test(message) && document) {
    return {
      intent: INTENT_TYPES.CREATE_CLIENT,
      confidence: 0.85,
      data: {
        clientName: clientName,
        document: document,
      },
    };
  }
  
  // Calculate scores for all intents
  const scores = [];
  
  for (const [intentType, pattern] of Object.entries(INTENT_PATTERNS)) {
    const similarity = calculateSimilarity(message, pattern);
    if (similarity > 0) {
      scores.push({
        intent: intentType,
        confidence: similarity,
        pattern,
      });
    }
  }
  
  // Sort by confidence
  scores.sort((a, b) => b.confidence - a.confidence);
  
  // No matches found
  if (scores.length === 0) {
    return {
      intent: INTENT_TYPES.UNKNOWN,
      confidence: 0,
      data: null,
    };
  }
  
  // Get the best match
  const best = scores[0];
  
  // Extract additional data based on intent
  const data = {};
  
  // Extract monetary value for invoice-related intents
  if ([INTENT_TYPES.EMIT_INVOICE, INTENT_TYPES.CANCEL_INVOICE].includes(best.intent)) {
    data.value = extractMonetaryValue(message);
    data.clientName = extractClientName(message);
    data.document = document;
  }
  
  // Extract period for query intents
  if ([INTENT_TYPES.LIST_INVOICES, INTENT_TYPES.REJECTED_INVOICES, INTENT_TYPES.PENDING_INVOICES, INTENT_TYPES.REVENUE].includes(best.intent)) {
    data.period = extractPeriod(message);
  }
  
  // Extract client info for client intents
  if ([INTENT_TYPES.CREATE_CLIENT, INTENT_TYPES.SEARCH_CLIENT].includes(best.intent)) {
    data.clientName = clientName;
    data.document = document;
  }
  
  return {
    intent: best.intent,
    confidence: best.confidence,
    data: Object.keys(data).length > 0 ? data : null,
    alternatives: scores.slice(1, 3).map(s => ({ intent: s.intent, confidence: s.confidence })),
  };
}

/**
 * Check if message contains ambiguity that needs clarification
 * 
 * @param {object} classification - Result from classifyIntent
 * @returns {boolean} True if clarification is needed
 */
export function needsClarification(classification) {
  // Low confidence
  if (classification.confidence < 0.4) return true;
  
  // Close alternatives (could be either)
  if (classification.alternatives?.length > 0) {
    const topAlt = classification.alternatives[0];
    if (topAlt.confidence > 0.3 && (classification.confidence - topAlt.confidence) < 0.2) {
      return true;
    }
  }
  
  return false;
}

/**
 * Generate clarification question based on classification
 * 
 * @param {object} classification - Result from classifyIntent
 * @returns {string} Clarification question
 */
export function generateClarification(classification) {
  const { intent, alternatives } = classification;
  
  // Multiple possible intents
  if (alternatives?.length > 0 && alternatives[0].confidence > 0.3) {
    const options = [intent, ...alternatives.map(a => a.intent)];
    const optionTexts = options.slice(0, 3).map(i => {
      switch (i) {
        case INTENT_TYPES.EMIT_INVOICE: return 'emitir uma nota fiscal';
        case INTENT_TYPES.LIST_INVOICES: return 'ver suas notas fiscais';
        case INTENT_TYPES.LAST_INVOICE: return 'ver sua última nota';
        case INTENT_TYPES.REVENUE: return 'consultar seu faturamento';
        case INTENT_TYPES.VIEW_TAXES: return 'ver seus impostos';
        case INTENT_TYPES.CREATE_CLIENT: return 'cadastrar um cliente';
        case INTENT_TYPES.LIST_CLIENTS: return 'listar seus clientes';
        default: return null;
      }
    }).filter(Boolean);
    
    if (optionTexts.length > 1) {
      return `Não tenho certeza se você quer:\n${optionTexts.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nPode me dizer qual opção?`;
    }
  }
  
  // Generic clarification
  return 'Desculpe, não entendi completamente. Pode reformular sua pergunta? Posso ajudar com:\n\n• Emitir notas fiscais\n• Consultar faturamento\n• Ver impostos pendentes\n• Gerenciar clientes';
}

/**
 * Detect the language of the message
 * 
 * @param {string} text - User message
 * @returns {string} 'pt' for Portuguese, 'en' for English, 'unknown' otherwise
 */
export function detectLanguage(text) {
  const normalized = text.toLowerCase();
  
  // Portuguese indicators
  const ptWords = ['olá', 'oi', 'bom', 'dia', 'nota', 'fiscal', 'emitir', 'cliente', 'quanto', 'faturamento', 'meu', 'minha', 'obrigado', 'obrigada', 'por favor', 'você', 'voce'];
  const enWords = ['hello', 'hi', 'invoice', 'client', 'how', 'much', 'revenue', 'my', 'please', 'thank', 'you'];
  
  let ptScore = 0;
  let enScore = 0;
  
  for (const word of ptWords) {
    if (normalized.includes(word)) ptScore++;
  }
  
  for (const word of enWords) {
    if (normalized.includes(word)) enScore++;
  }
  
  if (ptScore > enScore) return 'pt';
  if (enScore > ptScore) return 'en';
  return 'pt'; // Default to Portuguese
}

export default {
  INTENT_TYPES,
  normalizeInput,
  extractMonetaryValue,
  extractDocument,
  extractClientName,
  extractPeriod,
  classifyIntent,
  needsClarification,
  generateClarification,
  detectLanguage,
};
