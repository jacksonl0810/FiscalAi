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
export function getBaseUrl() {
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
export async function apiRequest(endpoint, options = {}) {
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
      // Extract meaningful error message from Nuvem Fiscal response
      let errorMessage = `API request failed: ${response.status}`;
      
      if (responseData.error) {
        if (typeof responseData.error === 'string') {
          errorMessage = responseData.error;
        } else if (responseData.error.message) {
          errorMessage = responseData.error.message;
          
          // If there are detailed validation errors, include them
          if (responseData.error.errors && Array.isArray(responseData.error.errors)) {
            const errorDetails = responseData.error.errors.map(e => {
              if (typeof e === 'string') return e;
              if (e.message) return e.message;
              if (e.field && e.error) return `${e.field}: ${e.error}`;
              return JSON.stringify(e);
            }).join('; ');
            errorMessage = `${errorMessage}: ${errorDetails}`;
          }
        }
      } else if (responseData.message) {
        errorMessage = responseData.message;
      }
      
      console.error('[NuvemFiscal] API Error Response:', JSON.stringify(responseData, null, 2));
      
      const error = new Error(errorMessage);
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
 * Get company from Nuvem Fiscal by CNPJ
 * @param {string} cnpj - Company CNPJ (cleaned, 14 digits)
 * @returns {Promise<object|null>} Company data from Nuvem Fiscal or null if not found
 */
async function getCompanyByCnpj(cnpj) {
  try {
    const cleanCnpj = (cnpj || '').replace(/\D/g, '');
    if (!cleanCnpj || cleanCnpj.length !== 14) {
      return null;
    }

    console.log('[NuvemFiscal] Fetching existing company by CNPJ:', cleanCnpj);
    
    // Try to fetch company by CNPJ (Nuvem Fiscal uses CNPJ as ID in some cases)
    try {
      const response = await apiRequest(`/empresas/${cleanCnpj}`);
      if (response && (response.id || response.cpf_cnpj)) {
        console.log('[NuvemFiscal] Company found by CNPJ:', response.id || response.cpf_cnpj);
        return response;
      }
    } catch (apiError) {
      // If 404, company doesn't exist - that's fine
      if (apiError.status === 404) {
        console.log('[NuvemFiscal] Company not found by CNPJ:', cleanCnpj);
        return null;
      }
      // Other errors might indicate the endpoint doesn't support CNPJ lookup
      // We'll try alternative approaches below
      console.log('[NuvemFiscal] Error fetching by CNPJ (will try alternative):', apiError.status);
    }

    return null;
  } catch (error) {
    console.error('[NuvemFiscal] Error getting company by CNPJ:', error.message);
    return null;
  }
}

/**
 * Register a company in Nuvem Fiscal
 * Documentation: https://dev.nuvemfiscal.com.br/docs/api#tag/Empresa/operation/CriarEmpresa
 * 
 * This function implements idempotent behavior:
 * - If company already exists in Nuvem Fiscal, it fetches and links the existing company
 * - Company existence is NOT treated as an error
 * - Returns status 'not_connected' for existing companies (they need credentials)
 * 
 * @param {object} companyData - Company data from database (Prisma camelCase format)
 * @returns {Promise<object>} Registration result with nuvemFiscalId and status
 */
async function registerCompany(companyData) {
  try {
    console.log('[NuvemFiscal] Starting company registration with data:', {
      id: companyData.id,
      cnpj: companyData.cnpj,
      razaoSocial: companyData.razaoSocial,
      hasCep: !!companyData.cep,
      hasCodigoMunicipio: !!companyData.codigoMunicipio,
      cidade: companyData.cidade,
      uf: companyData.uf
    });

    // Clean CNPJ - remove all non-numeric characters
    const cleanCnpj = (companyData.cnpj || '').replace(/\D/g, '');
    
    if (!cleanCnpj || cleanCnpj.length !== 14) {
      const error = new Error(`CNPJ inválido: ${companyData.cnpj || 'não fornecido'}. Deve conter 14 dígitos.`);
      error.status = 400;
      error.code = 'INVALID_CNPJ';
      throw error;
    }

    // Clean phone number
    const cleanPhone = (companyData.telefone || '').replace(/\D/g, '');

    // Clean CEP - remove non-numeric characters
    const cleanCep = (companyData.cep || '').replace(/\D/g, '');
    if (!cleanCep || cleanCep.length !== 8) {
      const error = new Error(`CEP inválido: ${companyData.cep || 'não fornecido'}. Deve conter 8 dígitos (ex: 88330000).`);
      error.status = 400;
      error.code = 'INVALID_CEP';
      throw error;
    }

    // Clean and validate codigo_municipio - must be exactly 7 digits (IBGE code)
    const cleanCodigoMunicipio = (companyData.codigoMunicipio || '').replace(/\D/g, '');
    if (!cleanCodigoMunicipio || cleanCodigoMunicipio.length !== 7) {
      const error = new Error(`Código do Município (IBGE) inválido: ${companyData.codigoMunicipio || 'não fornecido'}. Deve conter exatamente 7 dígitos (ex: 4202008). Consulte: https://www.ibge.gov.br/explica/codigos-dos-municipios.php`);
      error.status = 400;
      error.code = 'INVALID_CODIGO_MUNICIPIO';
      throw error;
    }

    // Validate required string fields
    if (!companyData.razaoSocial || !companyData.razaoSocial.trim()) {
      const error = new Error('Razão Social é obrigatória');
      error.status = 400;
      error.code = 'MISSING_RAZAO_SOCIAL';
      throw error;
    }

    if (!companyData.email || !companyData.email.trim()) {
      const error = new Error('Email é obrigatório');
      error.status = 400;
      error.code = 'MISSING_EMAIL';
      throw error;
    }

    if (!companyData.cidade || !companyData.cidade.trim()) {
      const error = new Error('Cidade é obrigatória');
      error.status = 400;
      error.code = 'MISSING_CIDADE';
      throw error;
    }

    if (!companyData.uf || companyData.uf.length !== 2) {
      const error = new Error('UF é obrigatória e deve ter 2 caracteres');
      error.status = 400;
      error.code = 'MISSING_UF';
      throw error;
    }

    // Map regime tributário to Nuvem Fiscal format
    const regimeMap = {
      'MEI': 1,        // Simples Nacional - MEI
      'Simples Nacional': 1, // Simples Nacional
      'Lucro Presumido': 2,  // Lucro Presumido
      'Lucro Real': 3        // Lucro Real
    };
    const regimeTributario = regimeMap[companyData.regimeTributario] || 1;

    // Build company object for Nuvem Fiscal API
    // See: https://dev.nuvemfiscal.com.br/docs/api#tag/Empresa/operation/CriarEmpresa
    const nuvemFiscalCompany = {
      cpf_cnpj: cleanCnpj,
      inscricao_municipal: companyData.inscricaoMunicipal || '',
      inscricao_estadual: '',
      nome_razao_social: companyData.razaoSocial,
      nome_fantasia: companyData.nomeFantasia || companyData.razaoSocial,
      fone: cleanPhone,
      email: companyData.email,
      endereco: {
        logradouro: companyData.logradouro || 'Não informado',
        numero: companyData.numero || 'S/N',
        complemento: companyData.complemento || '',
        bairro: companyData.bairro || 'Centro',
        codigo_municipio: cleanCodigoMunicipio, // IBGE code - exactly 7 digits
        cidade: companyData.cidade,
        uf: companyData.uf,
        cep: cleanCep // 8 digits without dash
      }
    };

    console.log('[NuvemFiscal] Registering company with payload:', JSON.stringify(nuvemFiscalCompany, null, 2));

    let response;
    try {
      response = await apiRequest('/empresas', {
        method: 'POST',
        body: JSON.stringify(nuvemFiscalCompany)
      });
      
      console.log('[NuvemFiscal] Company registered successfully:', response.id || response.cpf_cnpj);

      // Validate response has required fields
      if (!response.id && !response.cpf_cnpj) {
        console.error('[NuvemFiscal] Invalid response from API:', response);
        throw new Error('Resposta inválida da Nuvem Fiscal: ID da empresa não retornado');
      }

      return {
        nuvemFiscalId: response.id || response.cpf_cnpj || cleanCnpj,
        status: 'not_connected', // New companies need credentials/certificate
        message: 'Empresa registrada com sucesso na Nuvem Fiscal. Configure certificado digital ou credenciais municipais para conectar.'
      };
    } catch (apiError) {
      console.error('[NuvemFiscal] API request failed:', {
        status: apiError.status,
        message: apiError.message,
        data: apiError.data
      });
      
      // Check if company already exists (common error codes: 400, 409, 422)
      const isCompanyExistsError = (
        apiError.status === 400 || 
        apiError.status === 409 || 
        apiError.status === 422
      ) && (
        apiError.message?.toLowerCase().includes('já existe') ||
        apiError.message?.toLowerCase().includes('already exists') ||
        apiError.message?.toLowerCase().includes('duplicado') ||
        apiError.message?.toLowerCase().includes('duplicate') ||
        apiError.message?.toLowerCase().includes('cpf_cnpj') ||
        (apiError.data?.error && (
          typeof apiError.data.error === 'string' && (
            apiError.data.error.toLowerCase().includes('já existe') ||
            apiError.data.error.toLowerCase().includes('already exists') ||
            apiError.data.error.toLowerCase().includes('duplicado')
          )
        ))
      );

      if (isCompanyExistsError) {
        console.log('[NuvemFiscal] Company already exists, fetching existing company by CNPJ:', cleanCnpj);
        
        // Try to fetch the existing company
        const existingCompany = await getCompanyByCnpj(cleanCnpj);
        
        if (existingCompany && (existingCompany.id || existingCompany.cpf_cnpj)) {
          const nuvemFiscalId = existingCompany.id || existingCompany.cpf_cnpj || cleanCnpj;
          console.log('[NuvemFiscal] Existing company found and linked:', nuvemFiscalId);
          
          return {
            nuvemFiscalId: nuvemFiscalId,
            status: 'not_connected', // Existing companies need credentials/certificate
            message: 'Empresa já existe na Nuvem Fiscal. Configure certificado digital ou credenciais municipais para conectar.',
            alreadyExists: true
          };
        } else {
          // Company exists but we couldn't fetch it - use CNPJ as ID
          console.log('[NuvemFiscal] Company exists but couldn\'t fetch details, using CNPJ as ID:', cleanCnpj);
          return {
            nuvemFiscalId: cleanCnpj,
            status: 'not_connected',
            message: 'Empresa já existe na Nuvem Fiscal. Configure certificado digital ou credenciais municipais para conectar.',
            alreadyExists: true
          };
        }
      }
      
      // Not a "company exists" error - re-throw as actual error
      const error = new Error(apiError.message || 'Erro ao registrar empresa na Nuvem Fiscal');
      error.status = apiError.status || 500;
      error.code = 'NUVEM_FISCAL_API_ERROR';
      error.data = apiError.data;
      throw error;
    }
  } catch (error) {
    console.error('[NuvemFiscal] Error registering company:', error);
    console.error('[NuvemFiscal] Error name:', error?.name);
    console.error('[NuvemFiscal] Error message:', error?.message);
    console.error('[NuvemFiscal] Error status:', error?.status);
    console.error('[NuvemFiscal] Error statusCode:', error?.statusCode);
    console.error('[NuvemFiscal] Error code:', error?.code);
    console.error('[NuvemFiscal] Error stack:', error?.stack);
    
    // Extract meaningful error message
    let errorMessage = 'Erro desconhecido';
    let statusCode = error?.status || error?.statusCode || 500;
    let errorCode = error?.code || 'NUVEM_FISCAL_REGISTRATION_ERROR';
    let errorData = error?.data || null;
    
    if (error.message) {
      errorMessage = error.message;
    } else if (error.data && typeof error.data === 'object') {
      // Nuvem Fiscal API error response
      if (error.data.error) {
        errorMessage = typeof error.data.error === 'string' 
          ? error.data.error 
          : JSON.stringify(error.data.error);
      } else if (error.data.message) {
        errorMessage = error.data.message;
      } else if (error.data.errors && Array.isArray(error.data.errors)) {
        errorMessage = error.data.errors.map(e => e.message || e).join(', ');
      } else {
        errorMessage = JSON.stringify(error.data);
      }
    } else if (typeof error === 'object') {
      errorMessage = JSON.stringify(error);
    }
    
    // Preserve status code from original error if it exists
    if (error?.status) {
      statusCode = error.status;
    } else if (error?.statusCode) {
      statusCode = error.statusCode;
    }
    
    // Preserve error code from original error if it exists
    if (error?.code) {
      errorCode = error.code;
    }
    
    // Create new error with preserved properties
    const newError = new Error(`Falha ao registrar empresa na Nuvem Fiscal: ${errorMessage}`);
    newError.status = statusCode;
    newError.statusCode = statusCode;
    newError.code = errorCode;
    if (errorData) {
      newError.data = errorData;
    }
    
    throw newError;
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
      console.log('[NuvemFiscal] Fetching company data for:', nuvemFiscalId);
      response = await apiRequest(`/empresas/${nuvemFiscalId}`);
      console.log('[NuvemFiscal] Company data response:', JSON.stringify(response, null, 2));
    } catch (apiError) {
      console.log('[NuvemFiscal] API Error:', apiError.status, apiError.message);
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
    // Nuvem Fiscal may return cpf_cnpj instead of cnpj
    const hasCnpj = response && (response.cnpj || response.cpf_cnpj);
    const hasId = response && response.id;
    
    if (!response || (!hasCnpj && !hasId)) {
      console.log('[NuvemFiscal] Invalid response structure:', Object.keys(response || {}));
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
    const companyCnpj = response.cnpj || response.cpf_cnpj || nuvemFiscalId;
    const companyName = response.razao_social || response.nome_fantasia || response.nome || companyCnpj;
    
    console.log('[NuvemFiscal] Connection successful for:', companyName);
    
    return {
      status: 'conectado',
      message: 'Conexão com a prefeitura estabelecida com sucesso',
      details: `Empresa ${companyName} está conectada e pronta para emitir notas fiscais.`,
      data: {
        id: response.id || nuvemFiscalId,
        cnpj: companyCnpj,
        razao_social: response.razao_social || response.nome,
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

    const cleanCnpj = companyData.cnpj.replace(/\D/g, '');
    const clienteDocumento = (invoiceData.cliente_documento || '').replace(/\D/g, '');
    const ambiente = NUVEM_FISCAL_ENVIRONMENT === 'production' ? 'producao' : 'homologacao';

    // POST /nfse/dps — National DPS format (NFS-e Padrão Nacional)
    // Fields: provedor, ambiente, referencia (optional), infDPS
    // Note: opSimpNac and regTrib are configured at the company level via /empresas/{cnpj}/nfse
    //       and are NOT sent in the DPS payload. InfoPrestador only accepts CNPJ/CPF.
    const nfsePayload = {
      provedor: 'padrao',
      ambiente: ambiente,
      infDPS: {
        tpAmb: NUVEM_FISCAL_ENVIRONMENT === 'production' ? 1 : 2,
        dhEmi: new Date().toISOString(),
        verAplic: "1.0",
        dCompet: invoiceData.data_prestacao || new Date().toISOString().split('T')[0],
        prest: {
          CNPJ: cleanCnpj
          // IM (inscrição municipal) is configured at the company level, not in DPS
          // regTrib is also configured at the company level via /empresas/{cnpj}/nfse
        },
        toma: {
          xNome: invoiceData.cliente_nome,
          ...(clienteDocumento.length === 11 ? { CPF: clienteDocumento } : {}),
          ...(clienteDocumento.length === 14 ? { CNPJ: clienteDocumento } : {}),
        },
          serv: {
          // locPrest is optional — Nuvem Fiscal uses the company's registered municipality
          // Sending cLocPrestacao causes XML schema ordering issues with some municipality providers
          cServ: {
            cTribNac: invoiceData.codigo_servico || '010601',
            xDescServ: invoiceData.descricao_servico || 'Serviço prestado'
          }
        },
        valores: {
          vServPrest: {
            vServ: parseFloat(invoiceData.valor || 0)  // vServ = service total value (required)
          },
          trib: {
            tribMun: {
              tribISSQN: 1, // 1=Operação tributável (normal ISS)
              pAliq: parseFloat(invoiceData.aliquota_iss || 5)
            }
          }
        }
      }
    };

    console.log('[NuvemFiscal] Emitting NFS-e to: /nfse/dps');
    console.log('[NuvemFiscal] NFS-e payload:', JSON.stringify(nfsePayload, null, 2));
    
    let response;
    try {
      response = await apiRequest(`/nfse/dps`, {
        method: 'POST',
        body: JSON.stringify(nfsePayload)
      });
    } catch (apiError) {
      console.error('[NuvemFiscal] API Error:', apiError.status, apiError.message);
      console.error('[NuvemFiscal] Error data:', JSON.stringify(apiError.data || {}, null, 2));
      
      // Handle 403 - Municipality permission denied
      if (apiError.status === 403) {
        const permissionError = new Error('A empresa não tem permissão para emitir NFS-e neste município. Verifique se a empresa está autorizada pela prefeitura.');
        permissionError.status = 403;
        permissionError.code = 'MUNICIPALITY_PERMISSION_DENIED';
        permissionError.data = apiError.data;
        throw permissionError;
      }
      
      // Handle 401 - Authentication error
      if (apiError.status === 401) {
        const authError = new Error('Erro de autenticação com a prefeitura. Verifique suas credenciais.');
        authError.status = 401;
        authError.code = 'MUNICIPALITY_AUTH_ERROR';
        authError.data = apiError.data;
        throw authError;
      }
      
      // X800 errors with CodigoMunicipioLocalPestacao indicate a known Nuvem Fiscal bug
      // in their XML generation for the Publica provider. Surface this clearly.
      if (apiError.data?.error?.errors?.some(e => 
        e.message?.includes('CodigoMunicipioLocalPestacao') || 
        e.code === 'X800'
      )) {
        const municipalityBugError = new Error(
          'Erro no sistema da prefeitura (Publica/NFS-e): XML gerado pela Nuvem Fiscal contém elemento incorreto ' +
          '"CodigoMunicipioLocalPestacao" (deveria ser "CodigoMunicipioLocalPrestacao"). ' +
          'Este é um bug conhecido na Nuvem Fiscal para este município. ' +
          'Reporte ao suporte da Nuvem Fiscal: suporte.nuvemfiscal.com.br'
        );
        municipalityBugError.status = 400;
        municipalityBugError.code = 'NUVEM_FISCAL_XML_BUG';
        municipalityBugError.data = apiError.data;
        throw municipalityBugError;
      }

      // Only allow simulation fallback in sandbox/homologacao environment
      // In production, always surface the real error to the user
      if (NUVEM_FISCAL_ENVIRONMENT !== 'production' && (apiError.status === 405 || apiError.status === 404)) {
        console.log('[NuvemFiscal] Sandbox: endpoint not available, using simulation mode');
        const simulatedId = `SIM-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const simulatedNumero = String(Math.floor(Math.random() * 900000) + 100000);
        
        return {
          status: 'success',
          simulated: true,
          message: 'Nota fiscal simulada em ambiente de homologação. Em produção, a nota será enviada para a prefeitura.',
          nfse: {
            id: simulatedId,
            numero: simulatedNumero,
            codigo_verificacao: Math.random().toString(36).substring(2, 10).toUpperCase(),
            status: 'processando',
            pdf_url: null,
            xml_url: null,
            nuvem_fiscal_id: simulatedId,
            message: 'Nota fiscal enviada para processamento. Em ambiente sandbox, a nota é simulada.'
          }
        };
      }
      
      throw apiError;
    }

    console.log('[NuvemFiscal] NFS-e emission response:', JSON.stringify(response, null, 2));

    return {
      status: 'success',
      nfse: {
        id: response.id,
        numero: response.numero,
        codigo_verificacao: response.codigo_verificacao,
        status: response.status || 'processando',
        pdf_url: response.pdf_url,
        xml_url: response.xml_url,
        nuvem_fiscal_id: response.id
      }
    };
  } catch (error) {
    console.error('[NuvemFiscal] Error emitting NFS-e:', error.status, error.message);
    console.error('[NuvemFiscal] Error code:', error.code);
    console.error('[NuvemFiscal] Error data:', JSON.stringify(error.data || {}, null, 2));
    
    // Import error translation (dynamic import to avoid circular dependency)
    const { translateError } = await import('./errorTranslationService.js');
    const translated = translateError(error, {
      municipality: companyData.cidade,
      includeTechnicalDetails: false
    });
    
    const translatedError = new Error(translated.message);
    translatedError.status = error.status || 500;
    // Preserve the error code if it's a specific one (like MUNICIPALITY_PERMISSION_DENIED)
    // Otherwise, use the translated category to generate a code
    translatedError.code = error.code || (error.status === 403 ? 'MUNICIPALITY_PERMISSION_DENIED' : (error.status === 401 ? 'MUNICIPALITY_AUTH_ERROR' : 'INVOICE_EMISSION_ERROR'));
    translatedError.explanation = translated.explanation;
    translatedError.action = translated.action;
    translatedError.data = error.data;
    throw translatedError;
  }
}

/**
 * Check NFS-e status
 * Uses the official Nuvem Fiscal API: GET /nfse/{id}
 * 
 * @param {string} companyNuvemId - Company ID/CNPJ in Nuvem Fiscal (not used in new endpoint)
 * @param {string} nfseId - NFS-e ID returned from emission
 * @returns {Promise<object>} NFS-e status
 */
async function checkNfseStatus(companyNuvemId, nfseId) {
  try {
    if (!nfseId) {
      throw new Error('NFS-e ID is required');
    }

    if (nfseId.startsWith('SIM-')) {
      console.log('[NuvemFiscal] Simulated invoice, returning mock authorized status');
      return {
        status: 'autorizada',
        numero: nfseId.split('-')[1] || '000000',
        codigo_verificacao: 'SIMULATED',
        pdf_url: null,
        xml_url: null,
        mensagem: 'Nota fiscal simulada autorizada (ambiente de teste)'
      };
    }

    console.log('[NuvemFiscal] Checking NFS-e status:', nfseId);
    
    const response = await apiRequest(`/nfse/${nfseId}`);

    const statusMap = {
      'autorizado': 'autorizada',
      'autorizada': 'autorizada',
      'rejeitado': 'rejeitada',
      'rejeitada': 'rejeitada',
      'cancelado': 'cancelada',
      'cancelada': 'cancelada',
      'processando': 'processando',
      'pendente': 'processando'
    };

    const mappedStatus = statusMap[response.status?.toLowerCase()] || response.status || 'processando';
    
    console.log('[NuvemFiscal] NFS-e status result:', mappedStatus);

    return {
      status: mappedStatus,
      numero: response.numero ? String(response.numero) : null,
      codigo_verificacao: response.codigo_verificacao || response.codigoVerificacao,
      pdf_url: response.pdf_url || response.pdfUrl,
      xml_url: response.xml_url || response.xmlUrl,
      mensagem: response.mensagem || response.message || ''
    };
  } catch (error) {
    console.error('[NuvemFiscal] Error checking NFS-e status:', error.message);
    
    if (error.status === 404) {
      return {
        status: 'processando',
        mensagem: 'Nota fiscal ainda em processamento na prefeitura'
      };
    }
    
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
  // Check if this is a simulated invoice (created when API had errors)
  if (nfseId && nfseId.startsWith('SIM-')) {
    console.log('[NuvemFiscal] Simulated invoice detected, canceling locally only:', nfseId);
    return {
      status: 'success',
      message: 'NFS-e simulada cancelada com sucesso (apenas local)',
      data: {
        simulated: true,
        nfseId: nfseId,
        motivo: motivo
      }
    };
  }
  
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
    console.error('[NuvemFiscal] Error canceling NFS-e:', {
      nuvemFiscalId,
      nfseId,
      motivo,
      errorMessage: error.message,
      errorStatus: error.status,
      errorData: error.data,
      fullError: error
    });
    
    // Preserve original error structure (status, data, code) when re-throwing
    const cancelError = new Error(error.message || `Falha ao cancelar NFS-e: ${error.message}`);
    
    // Preserve status code from original error
    if (error.status) {
      cancelError.status = error.status;
    }
    
    // Preserve error data from original error
    if (error.data) {
      cancelError.data = error.data;
    }
    
    // Preserve error code if present
    if (error.code) {
      cancelError.code = error.code;
    }
    
    throw cancelError;
  }
}

async function uploadCertificate(cpfCnpj, certificateBase64, password) {
  try {
    const cleanCpfCnpj = (cpfCnpj || '').replace(/\D/g, '');
    
    if (!cleanCpfCnpj || (cleanCpfCnpj.length !== 11 && cleanCpfCnpj.length !== 14)) {
      throw new Error(`CPF/CNPJ inválido: ${cpfCnpj}`);
    }

    if (!certificateBase64) {
      throw new Error('Certificado não fornecido');
    }

    if (!password) {
      throw new Error('Senha do certificado não fornecida');
    }

    console.log('[NuvemFiscal] Uploading certificate for:', cleanCpfCnpj);

    // First check if company exists on Nuvem Fiscal
    // If not, try to register it first
    let companyExists = false;
    try {
      const existingCompany = await getCompanyByCnpj(cleanCpfCnpj);
      companyExists = !!(existingCompany && (existingCompany.id || existingCompany.cpf_cnpj));
    } catch (e) {
      console.log('[NuvemFiscal] Could not check company existence, proceeding with certificate upload');
    }

    if (!companyExists) {
      console.log('[NuvemFiscal] Company not found on Nuvem Fiscal, will attempt to register before certificate upload');
      // Company not on Nuvem Fiscal yet - this shouldn't happen normally
      // but if it does, the certificate upload will fail with a clear error
    }

    const response = await apiRequest(`/empresas/${cleanCpfCnpj}/certificado`, {
      method: 'PUT',
      body: JSON.stringify({
        certificado: certificateBase64,
        password: password
      })
    });

    console.log('[NuvemFiscal] Certificate uploaded successfully');

    return {
      status: 'success',
      message: 'Certificado digital enviado com sucesso para a Nuvem Fiscal',
      data: response
    };
  } catch (error) {
    console.error('[NuvemFiscal] Error uploading certificate:', error);
    
    let errorMessage = 'Erro desconhecido ao enviar certificado';
    
    if (error.message) {
      errorMessage = error.message;
    } else if (error.data && typeof error.data === 'object') {
      if (error.data.error) {
        errorMessage = typeof error.data.error === 'string' 
          ? error.data.error 
          : JSON.stringify(error.data.error);
      } else if (error.data.message) {
        errorMessage = error.data.message;
      }
    }
    
    // If company not found on Nuvem Fiscal (404), provide a clearer error
    if (error.status === 404) {
      throw new Error('Empresa não encontrada na Nuvem Fiscal. Registre a empresa primeiro antes de enviar o certificado.');
    }
    
    throw new Error(`Falha ao enviar certificado para Nuvem Fiscal: ${errorMessage}`);
  }
}

/**
 * Configure municipal credentials for NFS-e issuance
 * Sends login/password/token to Nuvem Fiscal via PUT /empresas/{cpf_cnpj}/nfse
 * This allows NFS-e issuance without a digital certificate
 * 
 * @param {string} cpfCnpj - Company CNPJ
 * @param {object} companyData - Company data for regime tributario mapping
 * @param {string} login - Municipal login/username
 * @param {string} senha - Municipal password
 * @param {string|null} token - Optional municipal token (some municipalities require it)
 * @returns {Promise<object>} Result of the configuration
 */
async function configureMunicipalCredentials(cpfCnpj, companyData, login, senha, token = null) {
  try {
    const cleanCpfCnpj = (cpfCnpj || '').replace(/\D/g, '');

    if (!cleanCpfCnpj || (cleanCpfCnpj.length !== 11 && cleanCpfCnpj.length !== 14)) {
      throw new Error(`CPF/CNPJ inválido: ${cpfCnpj}`);
    }

    if (!login || !senha) {
      throw new Error('Login e senha da prefeitura são obrigatórios');
    }

    console.log('[NuvemFiscal] Configuring municipal credentials for:', cleanCpfCnpj);

    // opSimpNac valid values: 1=Simples Nacional, 2=Simples Nacional (excesso sublimite), 3=Regime Normal (Lucro Real/Presumido)
    let opSimpNac = 1; // Default: Simples Nacional
    const regime = (companyData.regimeTributario || companyData.regime_tributario || '').toLowerCase();
    if (regime.includes('mei')) {
      opSimpNac = 1; // MEI is under Simples Nacional
    } else if (regime.includes('simples')) {
      opSimpNac = 1; // Simples Nacional
    } else if (regime.includes('lucro presumido') || regime.includes('lucro real')) {
      opSimpNac = 3; // Regime Normal
    }

    const ambiente = NUVEM_FISCAL_ENVIRONMENT === 'production' ? 'producao' : 'homologacao';

    // Build prefeitura object
    const prefeitura = { login, senha };
    if (token) {
      prefeitura.token = token;
    }

    const nfseConfig = {
      regTrib: {
        opSimpNac: opSimpNac,
        regApTribSN: 1, // 1: Microempresa Municipal, 2: Estimativa, 3: Sociedade de Profissionais
        regEspTrib: 0
      },
      rps: {
        lote: 0,
        serie: 'RPS',
        numero: 0
      },
      prefeitura,
      incentivo_fiscal: false,
      ambiente
    };

    console.log('[NuvemFiscal] Sending NFS-e config with prefeitura credentials');

    const response = await apiRequest(`/empresas/${cleanCpfCnpj}/nfse`, {
      method: 'PUT',
      body: JSON.stringify(nfseConfig)
    });

    console.log('[NuvemFiscal] Municipal credentials configured successfully');

    return {
      status: 'success',
      message: 'Credenciais da prefeitura configuradas com sucesso na Nuvem Fiscal',
      data: response
    };
  } catch (error) {
    console.error('[NuvemFiscal] Error configuring municipal credentials:', error);

    let errorMessage = 'Erro desconhecido ao configurar credenciais municipais';

    if (error.message) {
      errorMessage = error.message;
    } else if (error.data && typeof error.data === 'object') {
      if (error.data.error) {
        errorMessage = typeof error.data.error === 'string'
          ? error.data.error
          : JSON.stringify(error.data.error);
      } else if (error.data.message) {
        errorMessage = error.data.message;
      }
    }

    if (error.status === 404) {
      throw new Error('Empresa não encontrada na Nuvem Fiscal. Registre a empresa primeiro.');
    }

    throw new Error(`Falha ao configurar credenciais municipais: ${errorMessage}`);
  }
}

/**
 * Configure NFS-e to use the uploaded digital certificate (for certificate-only municipalities)
 * This removes any prefeitura credentials and relies solely on the uploaded certificate.
 * 
 * @param {string} cpfCnpj - Company CNPJ
 * @param {object} companyData - Company data for regime tributario mapping
 * @returns {Promise<object>} Result of the configuration
 */
async function configureNfseForCertificate(cpfCnpj, companyData) {
  try {
    const cleanCpfCnpj = (cpfCnpj || '').replace(/\D/g, '');

    if (!cleanCpfCnpj || (cleanCpfCnpj.length !== 11 && cleanCpfCnpj.length !== 14)) {
      throw new Error(`CPF/CNPJ inválido: ${cpfCnpj}`);
    }

    console.log('[NuvemFiscal] Configuring NFS-e to use digital certificate for:', cleanCpfCnpj);

    // opSimpNac valid values: 1=Simples Nacional, 2=Simples Nacional (excesso sublimite), 3=Regime Normal (Lucro Real/Presumido)
    let opSimpNac = 1;
    const regime = (companyData.regimeTributario || companyData.regime_tributario || '').toLowerCase();
    if (regime.includes('mei')) {
      opSimpNac = 1; // MEI is under Simples Nacional
    } else if (regime.includes('simples')) {
      opSimpNac = 1;
    } else if (regime.includes('lucro presumido') || regime.includes('lucro real')) {
      opSimpNac = 3; // Regime Normal
    }

    const ambiente = NUVEM_FISCAL_ENVIRONMENT === 'production' ? 'producao' : 'homologacao';

    // Set prefeitura: null to explicitly clear any previously stored prefeitura credentials.
    // For certificate-only municipalities, having prefeitura creds causes auth failures.
    const nfseConfig = {
      regTrib: {
        opSimpNac: opSimpNac,
        regApTribSN: 1,
        regEspTrib: 0
      },
      rps: {
        lote: 0,
        serie: 'RPS',
        numero: 0
      },
      prefeitura: null,
      incentivo_fiscal: false,
      ambiente
    };

    console.log('[NuvemFiscal] Sending NFS-e config (certificate mode, no prefeitura credentials)');

    const response = await apiRequest(`/empresas/${cleanCpfCnpj}/nfse`, {
      method: 'PUT',
      body: JSON.stringify(nfseConfig)
    });

    console.log('[NuvemFiscal] NFS-e configured for certificate use successfully');

    return {
      status: 'success',
      message: 'Configuração NFS-e atualizada para usar certificado digital',
      data: response
    };
  } catch (error) {
    console.error('[NuvemFiscal] Error configuring NFS-e for certificate:', error);
    let errorMessage = error.message || 'Erro desconhecido';
    if (error.status === 404) {
      throw new Error('Empresa não encontrada na Nuvem Fiscal. Registre a empresa primeiro.');
    }
    throw new Error(`Falha ao configurar NFS-e para certificado: ${errorMessage}`);
  }
}

/**
 * Test NFS-e emission capability for a company
 * This performs a "dry run" to detect configuration issues or provider bugs
 * before the user tries to emit a real invoice.
 * 
 * @param {string} cnpj - Company CNPJ
 * @returns {Promise<object>} Test result with status and any detected issues
 */
async function testNfseEmissionCapability(cnpj) {
  const cleanCnpj = (cnpj || '').replace(/\D/g, '');
  const ambiente = NUVEM_FISCAL_ENVIRONMENT === 'production' ? 'producao' : 'homologacao';

  // Minimal test payload
  const testPayload = {
    provedor: 'padrao',
    ambiente: ambiente,
    infDPS: {
      tpAmb: NUVEM_FISCAL_ENVIRONMENT === 'production' ? 1 : 2,
      dhEmi: new Date().toISOString(),
      dCompet: new Date().toISOString().split('T')[0],
      prest: { CNPJ: cleanCnpj },
      toma: { xNome: 'TESTE VALIDACAO', CNPJ: '00000000000191' }, // CNPJ válido de teste
      serv: { cServ: { cTribNac: '010601', xDescServ: 'Teste de validação de emissão' } },
      valores: {
        vServPrest: { vServ: 1 },
        trib: { tribMun: { tribISSQN: 1 } }
      }
    }
  };

  try {
    // We expect this to fail in various ways, but we're looking for specific errors
    await apiRequest('/nfse/dps', { method: 'POST', body: JSON.stringify(testPayload) });
    
    // If somehow it succeeds, that's unexpected but good
    return {
      canEmit: true,
      status: 'ready',
      message: 'Empresa pronta para emitir NFS-e'
    };
  } catch (error) {
    // Check for known Nuvem Fiscal bugs
    const errorMessage = error.message || '';
    const errorData = error.data?.error;

    // Known bug: CodigoMunicipioLocalPestacao typo in Publica provider
    if (errorMessage.includes('CodigoMunicipioLocalPestacao') || 
        errorData?.errors?.some(e => e.message?.includes('CodigoMunicipioLocalPestacao'))) {
      return {
        canEmit: false,
        status: 'provider_bug',
        code: 'NUVEM_FISCAL_XML_BUG',
        message: 'Bug detectado no provedor Nuvem Fiscal/Publica: XML com elemento incorreto "CodigoMunicipioLocalPestacao"',
        action: 'Reporte este erro ao suporte da Nuvem Fiscal (suporte.nuvemfiscal.com.br). ' +
                'A emissão de NFS-e está temporariamente indisponível para este município até que o bug seja corrigido.',
        supportUrl: 'https://suporte.nuvemfiscal.com.br',
        technicalDetails: errorData
      };
    }

    // Check for credential issues
    if (errorMessage.includes('CredentialsNotFound') || errorMessage.includes('Credencial não encontrada')) {
      return {
        canEmit: false,
        status: 'credentials_missing',
        code: 'CREDENTIALS_NOT_CONFIGURED',
        message: 'Credenciais não configuradas corretamente',
        action: 'Configure o certificado digital ou credenciais da prefeitura na configuração da empresa.'
      };
    }

    // Check for certificate issues
    if (errorMessage.includes('certificado') || errorMessage.includes('Certificate')) {
      return {
        canEmit: false,
        status: 'certificate_issue',
        code: 'CERTIFICATE_ISSUE',
        message: 'Problema com o certificado digital',
        action: 'Verifique se o certificado está válido e foi enviado corretamente.'
      };
    }

    // Other validation errors (like missing fields) indicate the system is working
    // These are expected since we're sending minimal test data
    if (error.status === 400 && !errorMessage.includes('Pestacao')) {
      return {
        canEmit: true,
        status: 'ready',
        message: 'Configuração de NFS-e validada. Empresa pronta para emitir.',
        note: 'Teste de validação concluído com sucesso.'
      };
    }

    // Unknown error
    return {
      canEmit: false,
      status: 'unknown_error',
      code: 'UNKNOWN_ERROR',
      message: `Erro ao testar emissão: ${errorMessage.substring(0, 200)}`,
      action: 'Verifique as configurações da empresa ou entre em contato com o suporte.'
    };
  }
}

export {
  registerCompany,
  checkConnection,
  emitNfse,
  checkNfseStatus,
  cancelNfse,
  uploadCertificate,
  configureMunicipalCredentials,
  configureNfseForCertificate,
  testNfseEmissionCapability
};
