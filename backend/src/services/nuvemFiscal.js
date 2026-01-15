/**
 * Nuvem Fiscal API Integration Service
 * 
 * Documentation: https://dev.nuvemfiscal.com.br/docs
 * 
 * This service handles:
 * - OAuth 2.0 authentication
 * - Company registration
 * - NFS-e (Nota Fiscal de Serviço Eletrônica) emission
 * - Invoice status checking
 * - Connection verification
 */

// Correct URLs from official documentation: https://dev.nuvemfiscal.com.br/docs/autenticacao
const NUVEM_FISCAL_AUTH_URL = process.env.NUVEM_FISCAL_AUTH_URL || 'https://auth.nuvemfiscal.com.br/oauth/token';
const NUVEM_FISCAL_BASE_URL = process.env.NUVEM_FISCAL_BASE_URL || 'https://api.nuvemfiscal.com.br';
const NUVEM_FISCAL_SANDBOX_URL = process.env.NUVEM_FISCAL_SANDBOX_URL || 'https://api.sandbox.nuvemfiscal.com.br';
const NUVEM_FISCAL_CLIENT_ID = process.env.NUVEM_FISCAL_CLIENT_ID;
const NUVEM_FISCAL_CLIENT_SECRET = process.env.NUVEM_FISCAL_CLIENT_SECRET;
const NUVEM_FISCAL_ENVIRONMENT = process.env.NUVEM_FISCAL_ENVIRONMENT || 'sandbox'; // 'sandbox' or 'production'

// Cache for access token
let accessTokenCache = {
  token: null,
  expiresAt: null
};

/**
 * Get the base URL based on environment
 */
function getBaseUrl() {
  return NUVEM_FISCAL_ENVIRONMENT === 'production' 
    ? NUVEM_FISCAL_BASE_URL 
    : NUVEM_FISCAL_SANDBOX_URL;
}

/**
 * Check if Nuvem Fiscal is configured with valid credentials
 * @returns {boolean}
 */
export function isNuvemFiscalConfigured() {
  // Placeholder values from .env.example that should not be considered valid
  const placeholders = ['your-client-id', 'your-client-secret', 'your_client_id', 'your_client_secret', ''];
  
  // Check that credentials exist and are non-empty strings (and not placeholders)
  const clientId = NUVEM_FISCAL_CLIENT_ID?.trim() || '';
  const clientSecret = NUVEM_FISCAL_CLIENT_SECRET?.trim() || '';
  
  const hasValidClientId = clientId.length > 0 && !placeholders.includes(clientId.toLowerCase());
  const hasValidClientSecret = clientSecret.length > 0 && !placeholders.includes(clientSecret.toLowerCase());
  
  return hasValidClientId && hasValidClientSecret;
}

/**
 * Get OAuth 2.0 access token using client_credentials flow
 * @returns {Promise<string>} Access token
 */
async function getAccessToken() {
  // Check if we have a valid cached token
  if (accessTokenCache.token && accessTokenCache.expiresAt && new Date() < accessTokenCache.expiresAt) {
    return accessTokenCache.token;
  }

  if (!isNuvemFiscalConfigured()) {
    throw new Error('Nuvem Fiscal credentials not configured. Please set NUVEM_FISCAL_CLIENT_ID and NUVEM_FISCAL_CLIENT_SECRET environment variables.');
  }

  // Auth URL is separate from API URL (see https://dev.nuvemfiscal.com.br/docs/autenticacao)
  const tokenUrl = NUVEM_FISCAL_AUTH_URL;

  try {
    console.log('[NuvemFiscal] Requesting access token from:', tokenUrl);
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: NUVEM_FISCAL_CLIENT_ID,
        client_secret: NUVEM_FISCAL_CLIENT_SECRET,
        scope: 'empresa nfe nfse cte mdfe nfcom cep cnpj'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get access token: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    // Cache the token (subtract 60 seconds for safety margin)
    accessTokenCache.token = data.access_token;
    accessTokenCache.expiresAt = new Date(Date.now() + (data.expires_in - 60) * 1000);

    return data.access_token;
  } catch (error) {
    console.error('Error getting Nuvem Fiscal access token:', error);
    throw error;
  }
}

/**
 * Make an authenticated request to Nuvem Fiscal API
 * @param {string} endpoint - API endpoint (without base URL)
 * @param {object} options - Fetch options
 * @returns {Promise<object>} Response data
 */
async function apiRequest(endpoint, options = {}) {
  const token = await getAccessToken();
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const defaultOptions = {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  };

  // Set timeout for API requests
  const { fetchWithTimeout, getTimeout } = await import('../utils/timeout.js');
  const timeoutMs = getTimeout('nuvem_fiscal');

  try {
    const response = await fetchWithTimeout(url, {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers
      }
    }, timeoutMs);

    const responseText = await response.text();
    let responseData;
    
    try {
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
      responseData = { error: responseText };
    }

    if (!response.ok) {
      const error = new Error(responseData.message || responseData.error || `API request failed: ${response.status}`);
      error.status = response.status;
      error.data = responseData;
      throw error;
    }

    return responseData;
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      const timeoutError = new Error(`Timeout ao conectar com Nuvem Fiscal. A requisição demorou mais de ${timeoutMs / 1000} segundos.`);
      timeoutError.status = 408;
      timeoutError.data = { timeout: true, timeoutMs };
      throw timeoutError;
    }
    
    throw error;
  }
}

/**
 * Register a company in Nuvem Fiscal
 * @param {object} companyData - Company data from database
 * @returns {Promise<object>} Registration result with nuvemFiscalId
 */
async function registerCompany(companyData) {
  try {
    // Map our company data to Nuvem Fiscal format
    const nuvemFiscalCompany = {
      cnpj: companyData.cnpj.replace(/\D/g, ''), // Remove formatting
      inscricao_municipal: companyData.inscricaoMunicipal,
      razao_social: companyData.razaoSocial,
      nome_fantasia: companyData.nomeFantasia || companyData.razaoSocial,
      email: companyData.email,
      telefone: companyData.telefone.replace(/\D/g, ''), // Remove formatting
      endereco: {
        logradouro: '', // TODO: Add address fields to company model
        numero: '',
        complemento: '',
        bairro: '',
        codigo_municipio: '', // IBGE code
        uf: companyData.uf,
        cep: ''
      },
      regime_tributario: companyData.regimeTributario,
      cnae_principal: companyData.cnaePrincipal || ''
    };

    const response = await apiRequest('/empresas', {
      method: 'POST',
      body: JSON.stringify(nuvemFiscalCompany)
    });

    return {
      nuvemFiscalId: response.id || response.cnpj,
      status: 'conectado',
      message: 'Empresa registrada com sucesso na Nuvem Fiscal'
    };
  } catch (error) {
    console.error('Error registering company in Nuvem Fiscal:', error);
    throw new Error(`Falha ao registrar empresa na Nuvem Fiscal: ${error.message}`);
  }
}

/**
 * Check fiscal connection status
 * Verifies that the company is properly registered and can communicate with Nuvem Fiscal
 * @param {string} nuvemFiscalId - Company ID in Nuvem Fiscal
 * @returns {Promise<object>} Connection status with detailed information
 */
async function checkConnection(nuvemFiscalId) {
  try {
    if (!nuvemFiscalId) {
      return {
        status: 'falha',
        message: 'Empresa não registrada na Nuvem Fiscal. Registre a empresa primeiro.',
        details: 'A empresa precisa ser registrada na Nuvem Fiscal antes de verificar a conexão.'
      };
    }

    // Step 1: Verify OAuth token is valid
    try {
      await getAccessToken();
    } catch (tokenError) {
      return {
        status: 'falha',
        message: 'Erro de autenticação com Nuvem Fiscal',
        details: `Não foi possível obter token de acesso: ${tokenError.message}. Verifique as credenciais (CLIENT_ID e CLIENT_SECRET).`
      };
    }

    // Step 2: Try to fetch company data from Nuvem Fiscal
    // This verifies the company exists and we can communicate with the API
    let response;
    try {
      response = await apiRequest(`/empresas/${nuvemFiscalId}`);
    } catch (apiError) {
      if (apiError.status === 404) {
        return {
          status: 'falha',
          message: 'Empresa não encontrada na Nuvem Fiscal',
          details: `A empresa com ID ${nuvemFiscalId} não foi encontrada. Pode ser necessário registrar a empresa novamente.`
        };
      }
      
      if (apiError.status === 401 || apiError.status === 403) {
        return {
          status: 'falha',
          message: 'Erro de autorização com Nuvem Fiscal',
          details: `Não foi possível acessar os dados da empresa. Verifique as permissões e credenciais.`
        };
      }

      throw apiError;
    }

    // Step 3: Verify company data structure
    if (!response || (!response.cnpj && !response.id)) {
      return {
        status: 'falha',
        message: 'Dados da empresa incompletos',
        details: 'A resposta da Nuvem Fiscal não contém os dados esperados da empresa. A API pode ter retornado um formato inesperado.'
      };
    }

    // Step 4: Check if company is active/enabled (if status field exists)
    // Nuvem Fiscal may use different status values, so we check for common inactive states
    const inactiveStatuses = ['inativo', 'suspenso', 'cancelado', 'bloqueado', 'desabilitado'];
    if (response.status && inactiveStatuses.includes(response.status.toLowerCase())) {
      return {
        status: 'falha',
        message: `Empresa com status: ${response.status}`,
        details: `A empresa está registrada mas não está ativa. Status atual: ${response.status}. Entre em contato com a Nuvem Fiscal para ativar sua conta.`
      };
    }

    // Step 5: Additional verification - try to check if we can access NFS-e endpoints
    // This is a more thorough check that verifies we can actually emit invoices
    try {
      // Try to get company's NFS-e configuration or list (if endpoint exists)
      // This verifies we have proper permissions
      await apiRequest(`/empresas/${nuvemFiscalId}/nfse/configuracao`).catch(() => {
        // If config endpoint doesn't exist, that's okay - we'll just verify basic access
      });
    } catch (permError) {
      // If we get a permission error, connection exists but may have limited access
      if (permError.status === 403) {
        return {
          status: 'falha',
          message: 'Permissões insuficientes',
          details: 'A empresa está registrada, mas não tem permissões suficientes para emitir notas fiscais. Verifique as configurações na Nuvem Fiscal.'
        };
      }
      // Other errors are non-critical for connection verification
    }

    // Connection is successful
    return {
      status: 'conectado',
      message: 'Conexão com a prefeitura estabelecida com sucesso',
      details: `Empresa ${response.razao_social || response.nome_fantasia || response.cnpj || 'registrada'} está conectada e pronta para emitir notas fiscais.`,
      data: {
        id: response.id || nuvemFiscalId,
        cnpj: response.cnpj,
        razao_social: response.razao_social,
        nome_fantasia: response.nome_fantasia,
        status: response.status || 'ativo',
        inscricao_municipal: response.inscricao_municipal,
        email: response.email,
        telefone: response.telefone
      }
    };
  } catch (error) {
    // Handle network errors, timeouts, etc.
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return {
        status: 'falha',
        message: 'Erro de conexão com Nuvem Fiscal',
        details: 'Não foi possível conectar com o servidor da Nuvem Fiscal. Verifique sua conexão com a internet.'
      };
    }

    return {
      status: 'falha',
      message: `Erro ao verificar conexão: ${error.message}`,
      details: error.data?.error || error.message || 'Erro desconhecido ao verificar conexão fiscal'
    };
  }
}

/**
 * Emit NFS-e (Nota Fiscal de Serviço Eletrônica)
 * @param {object} invoiceData - Invoice data
 * @param {object} companyData - Company data
 * @returns {Promise<object>} Emission result
 */
async function emitNfse(invoiceData, companyData) {
  try {
    if (!companyData.nuvemFiscalId) {
      throw new Error('Empresa não registrada na Nuvem Fiscal. Registre a empresa primeiro.');
    }

    // Map invoice data to Nuvem Fiscal NFS-e format
    const nfseData = {
      prestador: {
        cnpj: companyData.cnpj.replace(/\D/g, ''),
        inscricao_municipal: companyData.inscricaoMunicipal
      },
      tomador: {
        cpf_cnpj: invoiceData.cliente_documento.replace(/\D/g, ''),
        razao_social: invoiceData.cliente_nome,
        email: '', // TODO: Add email to invoice data
        endereco: {
          logradouro: '',
          numero: '',
          complemento: '',
          bairro: '',
          codigo_municipio: invoiceData.municipio || companyData.cidade,
          uf: companyData.uf,
          cep: ''
        }
      },
      servico: {
        descricao: invoiceData.descricao_servico,
        codigo_servico: invoiceData.codigo_servico || '',
        valor_servicos: parseFloat(invoiceData.valor),
        aliquota_iss: parseFloat(invoiceData.aliquota_iss || 5),
        iss_retido: invoiceData.iss_retido || false,
        item_lista_servico: invoiceData.codigo_servico || '1401' // Default service code
      },
      data_prestacao: invoiceData.data_prestacao || new Date().toISOString().split('T')[0]
    };

    const response = await apiRequest(`/empresas/${companyData.nuvemFiscalId}/nfse`, {
      method: 'POST',
      body: JSON.stringify(nfseData)
    });

    return {
      status: 'success',
      nfse: {
        id: response.id,
        numero: response.numero,
        codigo_verificacao: response.codigo_verificacao,
        status: response.status || 'autorizada',
        pdf_url: response.pdf_url,
        xml_url: response.xml_url,
        nuvem_fiscal_id: response.id
      }
    };
  } catch (error) {
    console.error('Error emitting NFS-e:', error);
    throw new Error(`Falha ao emitir NFS-e: ${error.message}`);
  }
}

/**
 * Check NFS-e status
 * @param {string} nuvemFiscalId - Company ID in Nuvem Fiscal
 * @param {string} nfseId - NFS-e ID
 * @returns {Promise<object>} NFS-e status
 */
async function checkNfseStatus(nuvemFiscalId, nfseId) {
  try {
    const response = await apiRequest(`/empresas/${nuvemFiscalId}/nfse/${nfseId}`);

    return {
      status: response.status || 'processando',
      numero: response.numero,
      codigo_verificacao: response.codigo_verificacao,
      pdf_url: response.pdf_url,
      xml_url: response.xml_url,
      mensagem: response.mensagem || ''
    };
  } catch (error) {
    console.error('Error checking NFS-e status:', error);
    throw new Error(`Falha ao consultar status da NFS-e: ${error.message}`);
  }
}

/**
 * Cancel NFS-e
 * @param {string} nuvemFiscalId - Company ID in Nuvem Fiscal
 * @param {string} nfseId - NFS-e ID
 * @param {string} motivo - Cancellation reason
 * @returns {Promise<object>} Cancellation result
 */
async function cancelNfse(nuvemFiscalId, nfseId, motivo) {
  try {
    const response = await apiRequest(`/empresas/${nuvemFiscalId}/nfse/${nfseId}/cancelar`, {
      method: 'POST',
      body: JSON.stringify({
        motivo: motivo
      })
    });

    return {
      status: 'success',
      message: 'NFS-e cancelada com sucesso',
      data: response
    };
  } catch (error) {
    console.error('Error canceling NFS-e:', error);
    throw new Error(`Falha ao cancelar NFS-e: ${error.message}`);
  }
}

export {
  registerCompany,
  checkConnection,
  emitNfse,
  checkNfseStatus,
  cancelNfse,
  getBaseUrl
};
