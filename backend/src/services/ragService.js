/**
 * RAG (Retrieval-Augmented Generation) Service
 * 
 * Retrieves relevant context from the database based on user queries
 * and builds enriched prompts for the AI assistant.
 * 
 * Flow:
 * 1. Analyze query intent to determine what data is needed
 * 2. Retrieve relevant records from database
 * 3. Build a concise context string
 * 4. Inject into the system prompt for OpenAI
 */

import { prisma } from '../lib/prisma.js';

/**
 * Query categories that determine what data to retrieve
 */
const QUERY_CATEGORIES = {
  INVOICE: ['nota', 'nf', 'nfse', 'emitir', 'emissao', 'fatura', 'fiscal', 'cancelar', 'cancelamento'],
  CLIENT: ['cliente', 'tomador', 'cadastrar', 'cadastro', 'cpf', 'cnpj', 'documento'],
  REVENUE: ['faturamento', 'receita', 'ganho', 'vendas', 'quanto', 'total', 'faturei', 'ganhei'],
  TAX: ['imposto', 'tributo', 'das', 'guia', 'iss', 'icms', 'inss', 'taxa'],
  COMPANY: ['empresa', 'cnpj', 'regime', 'mei', 'simples', 'certificado', 'conexao', 'prefeitura'],
  STATUS: ['status', 'situacao', 'pendente', 'processando', 'autorizada', 'rejeitada'],
  HISTORY: ['ultima', 'recente', 'anterior', 'historico', 'listar', 'ver', 'mostrar', 'buscar'],
};

/**
 * Analyze a query to determine what data categories are relevant
 * @param {string} message - User message (already normalized/lowercase)
 * @returns {Set<string>} Set of relevant categories
 */
function analyzeQueryIntent(message) {
  const lower = message.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Remove accents
  
  const categories = new Set();
  
  for (const [category, keywords] of Object.entries(QUERY_CATEGORIES)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        categories.add(category);
        break;
      }
    }
  }
  
  // If no specific category detected, include general context
  if (categories.size === 0) {
    categories.add('GENERAL');
  }
  
  return categories;
}

/**
 * Retrieve recent invoices for context
 * @param {string} userId - User ID
 * @param {string} companyId - Company ID
 * @param {number} limit - Max records
 * @returns {Promise<Array>} Recent invoices
 */
async function getRecentInvoices(userId, companyId, limit = 10) {
  const where = {
    company: { userId }
  };
  if (companyId) {
    where.companyId = companyId;
  }
  
  return prisma.invoice.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      numero: true,
      clienteNome: true,
      clienteDocumento: true,
      valor: true,
      status: true,
      descricaoServico: true,
      dataEmissao: true,
      createdAt: true,
    }
  });
}

/**
 * Retrieve registered clients for context
 * @param {string} userId - User ID
 * @param {number} limit - Max records
 * @returns {Promise<Array>} Clients list
 */
async function getClients(userId, limit = 20) {
  return prisma.client.findMany({
    where: { userId, ativo: true },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      nome: true,
      documento: true,
      tipoPessoa: true,
      email: true,
      telefone: true,
      apelido: true,
    }
  });
}

/**
 * Retrieve company details for context
 * @param {string} userId - User ID
 * @param {string} companyId - Active company ID
 * @returns {Promise<Object|null>} Company data
 */
async function getCompanyDetails(userId, companyId) {
  const where = { userId };
  if (companyId) {
    where.id = companyId;
  }
  
  return prisma.company.findFirst({
    where,
    select: {
      id: true,
      cnpj: true,
      razaoSocial: true,
      nomeFantasia: true,
      cidade: true,
      uf: true,
      regimeTributario: true,
      inscricaoMunicipal: true,
      fiscalConnectionStatus: true,
      certificadoDigital: true,
      certificateUploadedToNuvemFiscal: true,
      nuvemFiscalId: true,
    }
  });
}

/**
 * Calculate revenue summary for context
 * @param {string} userId - User ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Revenue summary
 */
async function getRevenueSummary(userId, companyId) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  
  const where = {
    company: { userId },
    status: { in: ['autorizada', 'emitida', 'processando'] },
  };
  if (companyId) {
    where.companyId = companyId;
  }
  
  // Current month
  const monthInvoices = await prisma.invoice.findMany({
    where: {
      ...where,
      OR: [
        { dataEmissao: { gte: startOfMonth, lte: endOfMonth } },
        { dataEmissao: null, createdAt: { gte: startOfMonth, lte: endOfMonth } },
      ],
    },
    select: { valor: true, status: true }
  });
  
  const monthTotal = monthInvoices.reduce((sum, inv) => sum + Number(inv.valor), 0);
  const monthCount = monthInvoices.length;
  
  // Year total
  const yearInvoices = await prisma.invoice.findMany({
    where: {
      ...where,
      OR: [
        { dataEmissao: { gte: startOfYear } },
        { dataEmissao: null, createdAt: { gte: startOfYear } },
      ],
    },
    select: { valor: true }
  });
  
  const yearTotal = yearInvoices.reduce((sum, inv) => sum + Number(inv.valor), 0);
  const yearCount = yearInvoices.length;
  
  return {
    monthTotal,
    monthCount,
    yearTotal,
    yearCount,
    monthAverage: monthCount > 0 ? monthTotal / monthCount : 0,
  };
}

/**
 * Retrieve pending DAS payments
 * @param {string} userId - User ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Array>} Pending DAS payments
 */
async function getPendingTaxes(userId, companyId) {
  const where = {
    company: { userId },
    status: 'pendente',
  };
  if (companyId) {
    where.companyId = companyId;
  }
  
  return prisma.dAS.findMany({
    where,
    orderBy: { dataVencimento: 'asc' },
    take: 5,
    select: {
      id: true,
      referencia: true,
      dataVencimento: true,
      valorTotal: true,
      status: true,
    }
  });
}

/**
 * Search for a specific client by name or document
 * @param {string} userId - User ID
 * @param {string} query - Search term (name or document)
 * @returns {Promise<Array>} Matching clients
 */
async function searchClients(userId, query) {
  const cleanQuery = query.replace(/\D/g, '');
  const isDocument = cleanQuery.length >= 11;
  
  return prisma.client.findMany({
    where: {
      userId,
      ativo: true,
      OR: [
        { nome: { contains: query, mode: 'insensitive' } },
        ...(isDocument ? [{ documento: { contains: cleanQuery } }] : []),
        ...(query.length >= 2 ? [{ apelido: { contains: query, mode: 'insensitive' } }] : []),
      ],
    },
    take: 5,
    select: {
      id: true,
      nome: true,
      documento: true,
      tipoPessoa: true,
      email: true,
    }
  });
}

/**
 * Build RAG context string from retrieved data
 * @param {Object} data - Retrieved data
 * @param {Set<string>} categories - Relevant categories
 * @returns {string} Formatted context for the system prompt
 */
function buildContextString(data, categories) {
  const sections = [];
  
  // Company info (always include if available)
  if (data.company) {
    const c = data.company;
    const fiscalStatus = c.fiscalConnectionStatus === 'connected' && c.certificateUploadedToNuvemFiscal
      ? '✅ Conectado (pronto para emitir)'
      : c.nuvemFiscalId 
        ? '⚠️ Registrado, mas certificado pendente'
        : '❌ Não registrado na Nuvem Fiscal';
    
    sections.push(`📋 EMPRESA ATIVA:
- Razão Social: ${c.razaoSocial || 'N/A'}
- Nome Fantasia: ${c.nomeFantasia || 'N/A'}
- CNPJ: ${formatCnpj(c.cnpj)}
- Regime: ${c.regimeTributario || 'N/A'}
- Cidade/UF: ${c.cidade || ''}/${c.uf || ''}
- IM: ${c.inscricaoMunicipal || 'N/A'}
- Status Fiscal: ${fiscalStatus}`);
  }
  
  // Revenue summary
  if (data.revenue && (categories.has('REVENUE') || categories.has('GENERAL') || categories.has('INVOICE'))) {
    const r = data.revenue;
    sections.push(`💰 FATURAMENTO:
- Este mês: R$ ${formatCurrency(r.monthTotal)} (${r.monthCount} nota${r.monthCount !== 1 ? 's' : ''})
- Média por nota: R$ ${formatCurrency(r.monthAverage)}
- Este ano: R$ ${formatCurrency(r.yearTotal)} (${r.yearCount} nota${r.yearCount !== 1 ? 's' : ''})`);
  }
  
  // Recent invoices
  if (data.invoices && data.invoices.length > 0 && 
      (categories.has('INVOICE') || categories.has('STATUS') || categories.has('HISTORY') || categories.has('GENERAL'))) {
    const invoiceList = data.invoices.slice(0, 8).map(inv => {
      const date = inv.dataEmissao 
        ? new Date(inv.dataEmissao).toLocaleDateString('pt-BR')
        : new Date(inv.createdAt).toLocaleDateString('pt-BR');
      return `  • #${inv.numero || 'rascunho'} | ${inv.clienteNome} | R$ ${formatCurrency(Number(inv.valor))} | ${translateStatus(inv.status)} | ${date}`;
    }).join('\n');
    
    sections.push(`📄 NOTAS FISCAIS RECENTES (${data.invoices.length} mais recentes):
${invoiceList}`);
  }
  
  // Clients
  if (data.clients && data.clients.length > 0 && 
      (categories.has('CLIENT') || categories.has('INVOICE') || categories.has('GENERAL'))) {
    const clientList = data.clients.slice(0, 15).map(cl => {
      const doc = cl.tipoPessoa === 'pf' ? formatCpf(cl.documento) : formatCnpj(cl.documento);
      return `  • ${cl.nome} | ${doc}${cl.email ? ' | ' + cl.email : ''}${cl.apelido ? ' (apelido: ' + cl.apelido + ')' : ''}`;
    }).join('\n');
    
    sections.push(`👥 CLIENTES CADASTRADOS (${data.clients.length}):
${clientList}`);
  }
  
  // Searched clients (specific match)
  if (data.searchedClients && data.searchedClients.length > 0) {
    const matchList = data.searchedClients.map(cl => {
      const doc = cl.tipoPessoa === 'pf' ? formatCpf(cl.documento) : formatCnpj(cl.documento);
      return `  • ${cl.nome} | ${doc}${cl.email ? ' | ' + cl.email : ''}`;
    }).join('\n');
    
    sections.push(`🔍 CLIENTES ENCONTRADOS:
${matchList}`);
  }
  
  // Pending taxes
  if (data.taxes && data.taxes.length > 0 && 
      (categories.has('TAX') || categories.has('GENERAL'))) {
    const taxList = data.taxes.map(t => {
      const venc = new Date(t.dataVencimento).toLocaleDateString('pt-BR');
      const isOverdue = new Date(t.dataVencimento) < new Date();
      return `  • ${t.referencia} | R$ ${formatCurrency(Number(t.valorTotal))} | Vence: ${venc}${isOverdue ? ' ⚠️ VENCIDO' : ''}`;
    }).join('\n');
    
    sections.push(`🏛️ IMPOSTOS PENDENTES:
${taxList}`);
  }
  
  if (sections.length === 0) {
    return '';
  }
  
  return `\n\n===== DADOS DO USUÁRIO (RAG Context) =====\nUse estas informações para responder com precisão. Estes são dados reais do banco de dados.\n\n${sections.join('\n\n')}\n\n===== FIM DOS DADOS =====`;
}

// ==========================================
// Formatting helpers
// ==========================================

function formatCurrency(value) {
  return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCpf(doc) {
  if (!doc) return 'N/A';
  const clean = doc.replace(/\D/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return doc;
}

function formatCnpj(doc) {
  if (!doc) return 'N/A';
  const clean = doc.replace(/\D/g, '');
  if (clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return doc;
}

function translateStatus(status) {
  const map = {
    'autorizada': '✅ Autorizada',
    'emitida': '✅ Emitida',
    'processando': '⏳ Processando',
    'rejeitada': '❌ Rejeitada',
    'cancelada': '🚫 Cancelada',
    'rascunho': '📝 Rascunho',
    'pendente': '⏳ Pendente',
  };
  return map[status?.toLowerCase()] || status || 'N/A';
}

/**
 * Extract potential client name mentions from the message
 * @param {string} message - User message
 * @returns {string|null} Extracted name or null
 */
function extractNameFromMessage(message) {
  const patterns = [
    /para\s+(?:o\s+(?:cliente\s+)?)?([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.]+?)(?:\s+(?:cpf|cnpj|por|no|valor|de|,|$))/i,
    /cliente\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.]+?)(?:\s+(?:cpf|cnpj|,|$))/i,
    /(?:buscar|procurar|encontrar)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.]+?)(?:\s|$)/i,
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]?.trim().length >= 2) {
      return match[1].trim();
    }
  }
  return null;
}

// ==========================================
// Main RAG function
// ==========================================

/**
 * Build RAG context for the AI assistant
 * Retrieves relevant data based on the user's message and injects it as context.
 * 
 * @param {string} message - User message
 * @param {string} userId - User ID
 * @param {string|null} companyId - Active company ID
 * @returns {Promise<string>} RAG context string to append to system prompt
 */
export async function buildRAGContext(message, userId, companyId = null) {
  try {
    const categories = analyzeQueryIntent(message);
    
    console.log('[RAG] Query categories:', [...categories]);
    
    // Parallel data retrieval based on detected categories
    const promises = {};
    
    // Always get company details
    promises.company = getCompanyDetails(userId, companyId);
    
    // Get data based on categories
    if (categories.has('INVOICE') || categories.has('STATUS') || categories.has('HISTORY') || categories.has('GENERAL')) {
      promises.invoices = getRecentInvoices(userId, companyId, 10);
    }
    
    if (categories.has('CLIENT') || categories.has('INVOICE') || categories.has('GENERAL')) {
      promises.clients = getClients(userId, 20);
    }
    
    if (categories.has('REVENUE') || categories.has('GENERAL') || categories.has('INVOICE')) {
      promises.revenue = getRevenueSummary(userId, companyId);
    }
    
    if (categories.has('TAX') || categories.has('GENERAL')) {
      promises.taxes = getPendingTaxes(userId, companyId);
    }
    
    // If message mentions a client name, search for them
    const mentionedName = extractNameFromMessage(message);
    if (mentionedName) {
      promises.searchedClients = searchClients(userId, mentionedName);
    }
    
    // Wait for all queries in parallel
    const keys = Object.keys(promises);
    const values = await Promise.all(Object.values(promises));
    
    const data = {};
    keys.forEach((key, i) => {
      data[key] = values[i];
    });
    
    // Build context string
    const context = buildContextString(data, categories);
    
    console.log('[RAG] Context built:', {
      categories: [...categories],
      hasCompany: !!data.company,
      invoiceCount: data.invoices?.length || 0,
      clientCount: data.clients?.length || 0,
      hasRevenue: !!data.revenue,
      taxCount: data.taxes?.length || 0,
      searchedClients: data.searchedClients?.length || 0,
      contextLength: context.length,
    });
    
    return context;
  } catch (error) {
    console.error('[RAG] Error building context:', error.message);
    // Return empty context on error - don't break the assistant
    return '';
  }
}

export default { buildRAGContext };
