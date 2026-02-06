/**
 * AI Prompt Service
 * 
 * Provides optimized prompts and function definitions for OpenAI API.
 * Uses function calling (tools) for structured, reliable outputs.
 * 
 * Based on OpenAI best practices:
 * 1. Clear, focused system prompts
 * 2. Function calling for structured outputs
 * 3. Context-aware responses
 * 4. Human-like conversation flow
 */

import { getRegimeRules } from './regimeRules.js';

/**
 * OpenAI Function Definitions (Tools)
 * These define the structured actions the assistant can take
 */
export const FUNCTION_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'emit_invoice',
      description: 'Emite uma nota fiscal de serviço (NFS-e). Use quando o usuário pedir para emitir, gerar ou criar uma nota fiscal.',
      parameters: {
        type: 'object',
        properties: {
          client_name: {
            type: 'string',
            description: 'Nome do cliente/tomador do serviço. Ex: "João Silva", "Empresa ABC Ltda"',
          },
          client_document: {
            type: 'string',
            description: 'CPF (11 dígitos) ou CNPJ (14 dígitos) do cliente, apenas números. Ex: "12345678900", "12345678000199"',
          },
          value: {
            type: 'number',
            description: 'Valor da nota em reais. Ex: 1500.00, 2500.50',
          },
          service_description: {
            type: 'string',
            description: 'Descrição detalhada do serviço prestado. Ex: "Consultoria em TI", "Desenvolvimento de sistema web"',
          },
          service_code: {
            type: 'string',
            description: 'Código do serviço conforme LC 116/2003. Ex: "0101" (software), "1701" (consultoria), "0802" (treinamento)',
          },
          iss_rate: {
            type: 'number',
            description: 'Alíquota do ISS em percentual. Para MEI sempre use 5. Ex: 2, 3, 5',
          },
        },
        required: ['value'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_invoice',
      description: 'Cancela uma nota fiscal já emitida. Requer o número ou ID da nota e um motivo.',
      parameters: {
        type: 'object',
        properties: {
          invoice_id: {
            type: 'string',
            description: 'ID ou número da nota fiscal a ser cancelada',
          },
          reason: {
            type: 'string',
            description: 'Motivo do cancelamento (mínimo 15 caracteres). Ex: "Erro no valor do serviço prestado"',
          },
        },
        required: ['invoice_id', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_invoices',
      description: 'Lista notas fiscais com filtros opcionais. Use para consultas de histórico.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['emitida', 'rejeitada', 'processando', 'cancelada', 'rascunho'],
            description: 'Filtrar por status da nota',
          },
          period: {
            type: 'string',
            enum: ['hoje', 'semana', 'mes', 'mes_atual', 'mes_passado', 'ano'],
            description: 'Período para filtrar as notas',
          },
          client_name: {
            type: 'string',
            description: 'Nome do cliente para filtrar',
          },
          limit: {
            type: 'integer',
            description: 'Quantidade máxima de notas a retornar',
            default: 10,
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_last_invoice',
      description: 'Retorna a última nota fiscal emitida. Use quando o usuário perguntar sobre a última nota.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_rejected_invoices',
      description: 'Lista notas fiscais rejeitadas. Use quando o usuário perguntar sobre notas com erro ou rejeitadas.',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['hoje', 'semana', 'mes', 'mes_atual', 'ano'],
            description: 'Período para filtrar',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_invoice_status',
      description: 'Verifica o status de uma nota fiscal específica.',
      parameters: {
        type: 'object',
        properties: {
          invoice_id: {
            type: 'string',
            description: 'ID ou número da nota fiscal',
          },
        },
        required: ['invoice_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_revenue',
      description: 'Consulta o faturamento total de um período. Use quando o usuário perguntar sobre faturamento, receita ou quanto faturou.',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['hoje', 'semana', 'mes', 'mes_atual', 'mes_passado', 'ano'],
            description: 'Período para calcular o faturamento',
            default: 'mes_atual',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_client',
      description: 'Cadastra um novo cliente no sistema. Use quando o usuário quiser criar ou cadastrar um cliente.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Nome completo ou razão social do cliente',
          },
          document: {
            type: 'string',
            description: 'CPF (11 dígitos) ou CNPJ (14 dígitos), apenas números',
          },
          email: {
            type: 'string',
            description: 'Email do cliente (opcional)',
          },
          phone: {
            type: 'string',
            description: 'Telefone do cliente (opcional)',
          },
        },
        required: ['name', 'document'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_clients',
      description: 'Lista todos os clientes cadastrados. Use quando o usuário pedir para ver seus clientes.',
      parameters: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Termo de busca para filtrar clientes por nome',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_client',
      description: 'Busca um cliente específico por nome ou documento.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Nome, CPF ou CNPJ do cliente',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_taxes',
      description: 'Consulta impostos e guias DAS pendentes. Use quando o usuário perguntar sobre impostos, DAS ou tributos.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['pendente', 'pago', 'vencido'],
            description: 'Filtrar por status do imposto',
          },
          period: {
            type: 'string',
            enum: ['mes_atual', 'mes_passado', 'ano'],
            description: 'Período para filtrar',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_fiscal_connection',
      description: 'Verifica o status da conexão com a prefeitura e Nuvem Fiscal.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'provide_help',
      description: 'Fornece ajuda e orientações sobre o que o assistente pode fazer.',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            enum: ['notas', 'clientes', 'impostos', 'faturamento', 'geral'],
            description: 'Tópico específico para ajuda',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ask_clarification',
      description: 'Pede esclarecimento quando a intenção do usuário não está clara.',
      parameters: {
        type: 'object',
        properties: {
          missing_info: {
            type: 'string',
            description: 'O que está faltando ou não está claro',
          },
          suggestions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Sugestões do que o usuário pode querer',
          },
        },
        required: ['missing_info'],
      },
    },
  },
];

/**
 * Generate an optimized system prompt
 * 
 * @param {object} company - Company data for context
 * @param {object} user - User data for personalization
 * @returns {string} System prompt
 */
export function generateSystemPrompt(company = null, user = null) {
  const today = new Date().toLocaleDateString('pt-BR');
  const currentMonth = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  
  // Build company context
  let companyContext = '';
  if (company) {
    companyContext = `
EMPRESA DO USUÁRIO:
- Nome: ${company.razaoSocial || company.nomeFantasia || 'Não informado'}
- Regime: ${company.regimeTributario || 'Não informado'}`;
    
    if (company.regimeTributario === 'MEI') {
      const rules = getRegimeRules('MEI');
      companyContext += `
- Limite anual MEI: R$ ${rules?.annualLimit?.toLocaleString('pt-BR') || '81.000,00'}
- Alíquota ISS fixa: 5%
- IMPORTANTE: Sempre use ISS de 5% para esta empresa`;
    }
  }

  // Build user context
  let userContext = '';
  if (user) {
    userContext = `
USUÁRIO:
- Nome: ${user.name || 'Usuário'}`;
  }

  return `Você é MAY, uma assistente fiscal inteligente e amigável. Você ajuda empresas brasileiras (MEI e Simples Nacional) a emitir notas fiscais de serviço (NFS-e) e gerenciar suas obrigações fiscais.

PERSONALIDADE:
- Amigável e profissional
- Usa português brasileiro natural
- Explica conceitos fiscais de forma simples
- Sempre confirma antes de executar ações importantes
- Nunca mostra erros técnicos ao usuário

DATA ATUAL: ${today}
MÊS ATUAL: ${currentMonth}
${companyContext}
${userContext}

REGRAS DE INTERPRETAÇÃO:

1. VALORES MONETÁRIOS:
   - "R$ 1.500,00" ou "1500 reais" ou "mil e quinhentos" = 1500.00
   - "2k" = 2000.00
   - Sempre interprete o valor mais provável

2. CLIENTES:
   - Se o usuário mencionar um nome, busque o cliente cadastrado
   - Se não encontrar, peça o CPF/CNPJ para cadastrar
   - Formate CPF como XXX.XXX.XXX-XX e CNPJ como XX.XXX.XXX/XXXX-XX

3. PERÍODOS:
   - "hoje" = data atual
   - "ontem" = dia anterior
   - "este mês" / "mês atual" = mês corrente
   - "mês passado" = mês anterior

4. SERVIÇOS (Códigos LC 116):
   - Consultoria/assessoria: 1701
   - Desenvolvimento de software: 0101
   - Design/marketing: 1706
   - Treinamento/cursos: 0802
   - Websites: 0108
   - Se não especificado, use 1701

FLUXO DE EMISSÃO DE NOTA:

1. Usuário pede: "Emitir nota de R$ 2.000 para João Silva por consultoria"
2. Você extrai: valor=2000, cliente="João Silva", serviço="consultoria"
3. Você confirma: "📝 Vou emitir uma nota de R$ 2.000,00 para João Silva por serviço de consultoria. Confirma?"
4. Só emite após confirmação explícita ("sim", "confirma", "ok")

SE FALTAR INFORMAÇÃO:
- Valor não informado: "Para emitir a nota, preciso saber o valor do serviço. Qual é o valor?"
- Cliente não encontrado: "Não encontrei 'João' cadastrado. Qual o CPF ou CNPJ dele?"
- Serviço não claro: Assuma consultoria (1701) e pergunte se está correto

FORMATO DE RESPOSTA:
- Seja conciso e objetivo
- Use emojis com moderação (📝 ✅ ❌ 💰 📊)
- Sempre que for executar uma ação, peça confirmação
- Para consultas, mostre os dados de forma organizada

EXEMPLOS DE RESPOSTAS:

Para emissão de nota:
"📝 **Nota fiscal preparada:**
• Valor: R$ 2.000,00
• Cliente: João Silva
• Serviço: Consultoria em TI (código 1701)
• ISS: 5%

✅ Posso emitir? Responda 'sim' para confirmar."

Para consulta de faturamento:
"💰 **Seu faturamento em ${currentMonth}:**
• Total: R$ 15.350,00
• Notas emitidas: 8
• Média por nota: R$ 1.918,75

Precisa de mais detalhes?"

Para cliente não encontrado:
"Não encontrei um cliente chamado 'Gabriel' cadastrado. 🤔

Para criar o cadastro, preciso do documento:
• CPF: 'criar cliente Gabriel Silva CPF 123.456.789-00'
• CNPJ: 'criar cliente Empresa XYZ CNPJ 12.345.678/0001-99'

Ou você pode acessar a seção **Clientes** no menu lateral."

NUNCA:
- Exponha erros técnicos ou códigos de erro
- Execute ações sem confirmação do usuário
- Invente dados que não existem
- Forneça informações fiscais incorretas`;
}

/**
 * Map function call result to action type
 * 
 * @param {string} functionName - OpenAI function name
 * @returns {string} Internal action type
 */
export function mapFunctionToAction(functionName) {
  const mapping = {
    'emit_invoice': 'emitir_nfse',
    'cancel_invoice': 'cancelar_nfse',
    'list_invoices': 'listar_notas',
    'get_last_invoice': 'ultima_nota',
    'get_rejected_invoices': 'notas_rejeitadas',
    'check_invoice_status': 'consultar_status',
    'get_revenue': 'consultar_faturamento',
    'create_client': 'criar_cliente',
    'list_clients': 'listar_clientes',
    'search_client': 'buscar_cliente',
    'get_taxes': 'ver_impostos',
    'check_fiscal_connection': 'verificar_conexao',
    'provide_help': 'ajuda',
    'ask_clarification': 'esclarecer',
  };
  
  return mapping[functionName] || functionName;
}

/**
 * Determine if an action requires user confirmation
 * 
 * @param {string} actionType - Action type
 * @returns {boolean} True if confirmation is required
 */
export function requiresConfirmation(actionType) {
  const requiresConfirm = [
    'emitir_nfse',
    'cancelar_nfse',
    'criar_cliente',
  ];
  
  return requiresConfirm.includes(actionType);
}

/**
 * Build conversation messages for OpenAI API
 * 
 * @param {string} userMessage - Current user message
 * @param {array} history - Conversation history
 * @param {object} context - Additional context
 * @returns {array} Messages array for OpenAI
 */
export function buildMessages(userMessage, history = [], context = {}) {
  const { company, user } = context;
  
  const messages = [
    {
      role: 'system',
      content: generateSystemPrompt(company, user),
    },
  ];
  
  // Add conversation history (last 10 messages)
  const recentHistory = history.slice(-10);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  }
  
  // Add current message
  messages.push({
    role: 'user',
    content: userMessage,
  });
  
  return messages;
}

/**
 * Get OpenAI API request configuration
 * 
 * @param {array} messages - Conversation messages
 * @param {boolean} useFunctions - Whether to use function calling
 * @returns {object} Request body for OpenAI API
 */
export function getOpenAIConfig(messages, useFunctions = true) {
  const config = {
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages,
    temperature: 0.5, // Lower temperature for more consistent outputs
    max_tokens: 1000,
  };
  
  if (useFunctions) {
    config.tools = FUNCTION_DEFINITIONS;
    config.tool_choice = 'auto'; // Let the model decide when to use functions
  }
  
  return config;
}

export default {
  FUNCTION_DEFINITIONS,
  generateSystemPrompt,
  mapFunctionToAction,
  requiresConfirmation,
  buildMessages,
  getOpenAIConfig,
};
