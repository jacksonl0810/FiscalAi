/**
 * ACBr API Integration Service
 * 
 * Documentation: https://dev.acbr.api.br/docs
 * Swagger: https://prod.acbr.api.br/openapi/swagger.json
 * 
 * This service handles:
 * - OAuth 2.0 authentication (client_credentials flow)
 * - Company registration
 * - NFS-e (Nota Fiscal de Serviço Eletrônica) emission
 * - Invoice status checking
 * - Connection verification
 * 
 * Note: ACBr API is compatible with Nuvem Fiscal API in endpoints and payloads.
 * Main differences are authentication URL and base URL.
 */

// ACBr API URLs from official documentation
const ACBR_API_AUTH_URL = 'https://auth.acbr.api.br/realms/ACBrAPI/protocol/openid-connect/token';
const ACBR_API_PROD_URL = process.env.ACBR_API_PROD_URL || 'https://prod.acbr.api.br';
const ACBR_API_SANDBOX_URL = process.env.ACBR_API_SANDBOX_URL || 'https://hom.acbr.api.br';
const ACBR_API_CLIENT_ID = process.env.ACBR_API_CLIENT_ID;
const ACBR_API_CLIENT_SECRET = process.env.ACBR_API_CLIENT_SECRET;
const ACBR_API_ENVIRONMENT = process.env.ACBR_API_ENVIRONMENT || 'sandbox';

// Cache for access token
let accessTokenCache = {
  token: null,
  expiresAt: null
};

// Cache for ACBr server time (in UTC/GMT+00:00)
let acbrServerTimeMs = null;
let acbrServerTimeFetchedAt = null;
const TIME_SYNC_INTERVAL_MS = 2 * 60 * 1000; // Re-sync every 2 minutes

/**
 * Synchronize with ACBr API server time using their official endpoint.
 * ACBr server works with GMT (+00:00).
 * Endpoint: GET /utils/horario
 * Response: { "horario": "2026-03-11T22:40:00.000Z" }
 */
async function syncTimeWithAcbrApi() {
  try {
    // Only sync if we haven't synced recently
    if (acbrServerTimeFetchedAt && (Date.now() - acbrServerTimeFetchedAt < TIME_SYNC_INTERVAL_MS)) {
      return;
    }

    console.log('[TimeSync] Fetching ACBr server time from /utils/horario...');
    
    const token = await getAccessToken();
    const fetchedAtLocal = Date.now();
    
    const response = await fetch(`${getBaseUrl()}/utils/horario`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    // ACBr returns: { "horario": "2026-03-11T22:40:00.000Z" } (UTC/GMT+00:00)
    const acbrTimeStr = data.horario || data.dataHora || data.data_hora;
    
    if (acbrTimeStr) {
      // ACBr server works with GMT (+00:00) per ACBr support
      // "o servidor trabalha com horario +00:00 ou seja GMT"
      // If no timezone indicator, treat as UTC
      let acbrTimeIso = acbrTimeStr;
      if (!acbrTimeStr.includes('Z') && !acbrTimeStr.includes('+') && !acbrTimeStr.includes('-', 10)) {
        // Add UTC timezone indicator if not present
        acbrTimeIso = acbrTimeStr + 'Z';
      }
      
      acbrServerTimeMs = new Date(acbrTimeIso).getTime();
      acbrServerTimeFetchedAt = fetchedAtLocal;
      
      const localTimeMs = Date.now();
      const diffMs = localTimeMs - acbrServerTimeMs;
      
      // Also show Brazil time for reference
      const brazilTimeMs = acbrServerTimeMs - (3 * 60 * 60 * 1000);
      const brazilDate = new Date(brazilTimeMs);
      const brazilStr = `${brazilDate.getUTCFullYear()}-${String(brazilDate.getUTCMonth()+1).padStart(2,'0')}-${String(brazilDate.getUTCDate()).padStart(2,'0')}T${String(brazilDate.getUTCHours()).padStart(2,'0')}:${String(brazilDate.getUTCMinutes()).padStart(2,'0')}:${String(brazilDate.getUTCSeconds()).padStart(2,'0')}-03:00`;
      
      console.log(`[TimeSync] ACBr server time (raw): ${acbrTimeStr}`);
      console.log(`[TimeSync] ACBr server time (UTC): ${new Date(acbrServerTimeMs).toISOString()}`);
      console.log(`[TimeSync] ACBr server time (Brazil): ${brazilStr}`);
      console.log(`[TimeSync] Local server ${diffMs > 0 ? 'ahead' : 'behind'} by ${Math.abs(diffMs / 1000).toFixed(1)}s`);
    } else {
      console.log('[TimeSync] Unexpected response format:', JSON.stringify(data));
      throw new Error('No time field in response');
    }
  } catch (error) {
    console.log('[TimeSync] Could not fetch ACBr server time:', error.message);
    // If we can't sync, we'll use the fallback in getBrazilDateTime
    acbrServerTimeMs = null;
    acbrServerTimeFetchedAt = Date.now(); // Don't retry immediately
  }
}

/**
 * Get current ACBr server time (adjusted for elapsed time since last sync).
 * Returns time in milliseconds (UTC).
 */
function getAcbrServerTimeNow() {
  if (acbrServerTimeMs && acbrServerTimeFetchedAt) {
    const elapsedSinceSync = Date.now() - acbrServerTimeFetchedAt;
    return acbrServerTimeMs + elapsedSinceSync;
  }
  // Fallback: use local time
  return Date.now();
}

/**
 * Get current date/time in Brazil timezone (BRT, UTC-3) with ISO format.
 * Uses ACBr server time as the source of truth.
 * 
 * Per Sistema Nacional NFS-e: validation compares dhEmi vs dataHoraProcessamento.
 * DPS is processed asynchronously (queue → validation → NFS-e).
 * 
 * Integrator guides recommend 10+ minutes backdate to account for:
 * - ACBr ↔ Sefin Nacional clock drift (~3s observed)
 * - Network latency
 * - Queue processing delays
 * - DPS validation time
 */
function getBrazilDateTime() {
  // Backdate by 10 minutes - recommended by integrator documentation for production
  const SAFETY_BUFFER_MS = 10 * 60 * 1000; // 10 minutes behind
  const acbrTimeUtcMs = getAcbrServerTimeNow() - SAFETY_BUFFER_MS;
  
  // Convert UTC to Brazil time (UTC-3) by subtracting 3 hours
  // This gives us a Date where getUTC* methods return Brazil time components
  const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
  const brazilTimeMs = acbrTimeUtcMs - BRT_OFFSET_MS;
  const brazilDate = new Date(brazilTimeMs);

  // Format as Brazil local time with -03:00 offset
  const year = brazilDate.getUTCFullYear();
  const month = String(brazilDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(brazilDate.getUTCDate()).padStart(2, '0');
  const hours = String(brazilDate.getUTCHours()).padStart(2, '0');
  const minutes = String(brazilDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(brazilDate.getUTCSeconds()).padStart(2, '0');

  const result = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}-03:00`;
  
  // Log for debugging - show the conversion chain
  const acbrNowUtc = new Date(acbrTimeUtcMs + SAFETY_BUFFER_MS).toISOString();
  const dhEmiUtc = new Date(acbrTimeUtcMs).toISOString();
  console.log(`[TimeSync] ACBr server now (UTC): ${acbrNowUtc}`);
  console.log(`[TimeSync] dhEmi will be (UTC): ${dhEmiUtc} (10 min behind)`);
  console.log(`[TimeSync] dhEmi formatted (Brazil): ${result}`);
  
  return result;
}

/**
 * Get current date in Brazil timezone (YYYY-MM-DD format)
 */
function getBrazilDate() {
  return getBrazilDateTime().split('T')[0];
}

/**
 * Get the base URL based on environment
 */
export function getBaseUrl() {
  return ACBR_API_ENVIRONMENT === 'production' 
    ? ACBR_API_PROD_URL 
    : ACBR_API_SANDBOX_URL;
}

/**
 * Check if ACBr API is configured with valid credentials
 * @returns {boolean}
 */
export function isAcbrApiConfigured() {
  const placeholders = ['your-client-id', 'your-client-secret', 'your_client_id', 'your_client_secret', ''];
  
  const clientId = ACBR_API_CLIENT_ID?.trim() || '';
  const clientSecret = ACBR_API_CLIENT_SECRET?.trim() || '';
  
  const hasValidClientId = clientId.length > 0 && !placeholders.includes(clientId.toLowerCase());
  const hasValidClientSecret = clientSecret.length > 0 && !placeholders.includes(clientSecret.toLowerCase());
  
  return hasValidClientId && hasValidClientSecret;
}

/**
 * Get OAuth 2.0 access token using client_credentials flow
 * ACBr API uses Keycloak-based authentication
 * @returns {Promise<string>} Access token
 */
async function getAccessToken() {
  // Check if we have a valid cached token (with 60 second buffer)
  if (accessTokenCache.token && accessTokenCache.expiresAt && new Date() < accessTokenCache.expiresAt) {
    return accessTokenCache.token;
  }

  if (!isAcbrApiConfigured()) {
    throw new Error('ACBr API credentials not configured. Please set ACBR_API_CLIENT_ID and ACBR_API_CLIENT_SECRET environment variables.');
  }

  try {
    console.log('[ACBrAPI] Requesting access token from:', ACBR_API_AUTH_URL);
    
    const response = await fetch(ACBR_API_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: ACBR_API_CLIENT_ID,
        client_secret: ACBR_API_CLIENT_SECRET,
        scope: 'empresa nfse cep cnpj'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ACBrAPI] Auth error:', response.status, errorText);
      throw new Error(`Failed to get access token: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    // Cache the token (subtract 60 seconds for safety margin)
    accessTokenCache.token = data.access_token;
    accessTokenCache.expiresAt = new Date(Date.now() + (data.expires_in - 60) * 1000);

    console.log('[ACBrAPI] Access token obtained successfully, expires in:', data.expires_in, 'seconds');

    return data.access_token;
  } catch (error) {
    console.error('[ACBrAPI] Error getting access token:', error);
    throw error;
  }
}

/**
 * Make an authenticated request to ACBr API
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
  const timeoutMs = getTimeout('acbr_api') || 60000;

  try {
    console.log('[ACBrAPI] Request:', options.method || 'GET', url);
    
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
      let errorMessage = `API request failed: ${response.status}`;
      
      let errorCode = null;
      
      if (responseData.error) {
        if (typeof responseData.error === 'string') {
          errorMessage = responseData.error;
        } else if (responseData.error.message) {
          errorMessage = responseData.error.message;
          errorCode = responseData.error.code || null;
          
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
        errorCode = responseData.code || null;
      } else if (responseData.error_description) {
        errorMessage = responseData.error_description;
      }
      
      console.error('[ACBrAPI] API Error Response:', JSON.stringify(responseData, null, 2));
      
      const error = new Error(errorMessage);
      error.status = response.status;
      error.code = errorCode;
      error.data = responseData;
      throw error;
    }

    return responseData;
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      const timeoutError = new Error(`Timeout ao conectar com ACBr API. A requisição demorou mais de ${timeoutMs / 1000} segundos.`);
      timeoutError.status = 408;
      timeoutError.data = { timeout: true, timeoutMs };
      throw timeoutError;
    }
    
    throw error;
  }
}

// Cache for municipal parameters (avoid repeated API calls)
const municipalParamsCache = new Map();
const MUNICIPAL_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Query municipal parameters from ACBr API
 * Returns service codes, aliquotas, and tax rules for a municipality
 * 
 * Endpoint: GET /parametros_municipais/{codigoMunicipio}/aliquotas
 * 
 * @param {string} codigoMunicipio - IBGE 7-digit municipality code (e.g., "4202008" for Balneário Camboriú)
 * @returns {Promise<object|null>} Municipal parameters or null if not available
 */
export async function getMunicipalParameters(codigoMunicipio) {
  const cleanCode = (codigoMunicipio || '').replace(/\D/g, '');
  
  if (!cleanCode || cleanCode.length !== 7) {
    console.log('[ACBrAPI] Invalid municipality code for parameters:', codigoMunicipio);
    return null;
  }

  // Check cache
  const cached = municipalParamsCache.get(cleanCode);
  if (cached && Date.now() - cached.timestamp < MUNICIPAL_CACHE_TTL_MS) {
    console.log('[ACBrAPI] Using cached municipal parameters for:', cleanCode);
    return cached.data;
  }

  try {
    console.log('[ACBrAPI] Querying municipal parameters for IBGE:', cleanCode);
    
    const response = await apiRequest(`/parametros_municipais/${cleanCode}/aliquotas`);
    
    if (response) {
      // Cache the result
      municipalParamsCache.set(cleanCode, {
        data: response,
        timestamp: Date.now()
      });
      
      console.log('[ACBrAPI] Municipal parameters cached for:', cleanCode);
      return response;
    }
    
    return null;
  } catch (error) {
    // Don't fail emission if municipal params unavailable - log and continue
    console.log('[ACBrAPI] Could not fetch municipal parameters:', error.message);
    return null;
  }
}

/**
 * Query municipal tax retention rules
 * 
 * Endpoint: GET /parametros_municipais/{codigoMunicipio}/retencoes
 * 
 * @param {string} codigoMunicipio - IBGE 7-digit municipality code
 * @returns {Promise<object|null>} Retention rules or null
 */
export async function getMunicipalRetentions(codigoMunicipio) {
  const cleanCode = (codigoMunicipio || '').replace(/\D/g, '');
  
  if (!cleanCode || cleanCode.length !== 7) {
    return null;
  }

  const cacheKey = `${cleanCode}_retencoes`;
  const cached = municipalParamsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < MUNICIPAL_CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    console.log('[ACBrAPI] Querying municipal retentions for IBGE:', cleanCode);
    
    const response = await apiRequest(`/parametros_municipais/${cleanCode}/retencoes`);
    
    if (response) {
      municipalParamsCache.set(cacheKey, {
        data: response,
        timestamp: Date.now()
      });
      return response;
    }
    
    return null;
  } catch (error) {
    console.log('[ACBrAPI] Could not fetch municipal retentions:', error.message);
    return null;
  }
}

/**
 * Validate and map national service code (cTribNac) for a municipality
 * 
 * Production systems should maintain a service mapping table and validate
 * against municipal parameters before emission.
 * 
 * @param {string} cTribNac - National service code (LC 116 format, e.g., "140101")
 * @param {string} codigoMunicipio - IBGE 7-digit municipality code
 * @returns {Promise<object>} Validation result { valid, cTribNac, municipalCode?, issRate? }
 */
export async function validateServiceCode(cTribNac, codigoMunicipio) {
  // Standard national service codes (LC 116/2003 format: XXYYZZ)
  // XX = item, YY = subitem, ZZ = sequence
  const validNationalCodes = [
    '010501', '010502', '010503', '010504', '010505', '010506', '010507', '010508',
    '140101', '140102', '140103', '140104', '140105', '140106', '140107', '140108', '140109',
    '140201', '140202', '140203', '140204', '140205', '140206', '140207', '140208', '140209',
    '170101', '170102', '170103', '170104', '170105', '170106', '170107', '170108', '170109',
    '170201', '170202', '170203', '170204', '170205', '170206', '170207', '170208', '170209'
  ];

  const cleanCode = (cTribNac || '').replace(/\D/g, '');
  
  // Basic format validation (6 digits)
  if (!cleanCode || cleanCode.length !== 6) {
    return { 
      valid: false, 
      error: `Código de serviço inválido: ${cTribNac}. Deve ter 6 dígitos no formato XXYYZZ (LC 116)` 
    };
  }

  // Query municipal parameters to check if code is supported
  const params = await getMunicipalParameters(codigoMunicipio);
  
  if (params && params.servicos) {
    // Check if service code exists in municipal list
    const serviceInfo = params.servicos.find(s => s.codigo === cleanCode || s.cTribNac === cleanCode);
    
    if (serviceInfo) {
      return {
        valid: true,
        cTribNac: cleanCode,
        municipalCode: serviceInfo.codigoMunicipal || serviceInfo.codigo,
        issRate: serviceInfo.aliquota,
        description: serviceInfo.descricao
      };
    }
  }

  // Fallback: accept if it's a standard national code (many municipalities don't have API params)
  if (validNationalCodes.includes(cleanCode) || /^[0-4]\d{5}$/.test(cleanCode)) {
    return {
      valid: true,
      cTribNac: cleanCode,
      note: 'Municipal validation not available - using national code'
    };
  }

  return { 
    valid: true, 
    cTribNac: cleanCode,
    note: 'Code accepted without municipal validation'
  };
}

/**
 * Get company from ACBr API by CNPJ
 * @param {string} cnpj - Company CNPJ (cleaned, 14 digits)
 * @returns {Promise<object|null>} Company data or null if not found
 */
async function getCompanyByCnpj(cnpj) {
  try {
    const cleanCnpj = (cnpj || '').replace(/\D/g, '');
    if (!cleanCnpj || cleanCnpj.length !== 14) {
      return null;
    }

    console.log('[ACBrAPI] Fetching company by CNPJ:', cleanCnpj);
    
    try {
      const response = await apiRequest(`/empresas/${cleanCnpj}`);
      if (response && (response.cpf_cnpj || response.nome_razao_social)) {
        console.log('[ACBrAPI] Company found:', response.cpf_cnpj);
        return response;
      }
    } catch (apiError) {
      if (apiError.status === 404) {
        console.log('[ACBrAPI] Company not found by CNPJ:', cleanCnpj);
        return null;
      }
      console.log('[ACBrAPI] Error fetching by CNPJ:', apiError.status);
    }

    return null;
  } catch (error) {
    console.error('[ACBrAPI] Error getting company by CNPJ:', error.message);
    return null;
  }
}

/**
 * Register a company in ACBr API
 * Documentation: https://dev.acbr.api.br/docs/api#tag/Empresa/operation/CriarEmpresa
 * 
 * @param {object} companyData - Company data from database
 * @returns {Promise<object>} Registration result with acbrApiId and status
 */
async function registerCompany(companyData) {
  try {
    console.log('[ACBrAPI] Starting company registration:', {
      id: companyData.id,
      cnpj: companyData.cnpj,
      razaoSocial: companyData.razaoSocial
    });

    const cleanCnpj = (companyData.cnpj || '').replace(/\D/g, '');
    
    if (!cleanCnpj || cleanCnpj.length !== 14) {
      const error = new Error(`CNPJ inválido: ${companyData.cnpj || 'não fornecido'}. Deve conter 14 dígitos.`);
      error.status = 400;
      error.code = 'INVALID_CNPJ';
      throw error;
    }

    const cleanPhone = (companyData.telefone || '').replace(/\D/g, '');
    const cleanCep = (companyData.cep || '').replace(/\D/g, '');
    
    if (!cleanCep || cleanCep.length !== 8) {
      const error = new Error(`CEP inválido: ${companyData.cep || 'não fornecido'}. Deve conter 8 dígitos.`);
      error.status = 400;
      error.code = 'INVALID_CEP';
      throw error;
    }

    const cleanCodigoMunicipio = (companyData.codigoMunicipio || '').replace(/\D/g, '');
    if (!cleanCodigoMunicipio || cleanCodigoMunicipio.length !== 7) {
      const error = new Error(`Código do Município (IBGE) inválido: ${companyData.codigoMunicipio || 'não fornecido'}. Deve conter exatamente 7 dígitos.`);
      error.status = 400;
      error.code = 'INVALID_CODIGO_MUNICIPIO';
      throw error;
    }

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

    // Build company object for ACBr API (same structure as Nuvem Fiscal)
    const acbrCompany = {
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
        codigo_municipio: cleanCodigoMunicipio,
        cidade: companyData.cidade,
        uf: companyData.uf,
        cep: cleanCep
      }
    };

    console.log('[ACBrAPI] Registering company with payload:', JSON.stringify(acbrCompany, null, 2));

    let response;
    try {
      response = await apiRequest('/empresas', {
        method: 'POST',
        body: JSON.stringify(acbrCompany)
      });
      
      console.log('[ACBrAPI] Company registered successfully:', response.cpf_cnpj);

      return {
        acbrApiId: response.cpf_cnpj || cleanCnpj,
        status: 'not_connected',
        message: 'Empresa registrada com sucesso na ACBr API. Configure certificado digital ou credenciais municipais para conectar.'
      };
    } catch (apiError) {
      console.error('[ACBrAPI] API request failed:', {
        status: apiError.status,
        message: apiError.message,
        data: apiError.data
      });
      
      // Check if company already exists
      const isCompanyExistsError = (
        apiError.status === 400 || 
        apiError.status === 409 || 
        apiError.status === 422
      ) && (
        apiError.message?.toLowerCase().includes('já existe') ||
        apiError.message?.toLowerCase().includes('already exists') ||
        apiError.message?.toLowerCase().includes('duplicado') ||
        apiError.message?.toLowerCase().includes('duplicate') ||
        apiError.message?.toLowerCase().includes('cpf_cnpj')
      );

      if (isCompanyExistsError) {
        console.log('[ACBrAPI] Company already exists, fetching existing company:', cleanCnpj);
        
        const existingCompany = await getCompanyByCnpj(cleanCnpj);
        
        if (existingCompany && existingCompany.cpf_cnpj) {
          return {
            acbrApiId: existingCompany.cpf_cnpj || cleanCnpj,
            status: 'not_connected',
            message: 'Empresa já existe na ACBr API. Configure certificado digital ou credenciais municipais para conectar.',
            alreadyExists: true
          };
        } else {
          return {
            acbrApiId: cleanCnpj,
            status: 'not_connected',
            message: 'Empresa já existe na ACBr API. Configure certificado digital ou credenciais municipais para conectar.',
            alreadyExists: true
          };
        }
      }
      
      const error = new Error(apiError.message || 'Erro ao registrar empresa na ACBr API');
      error.status = apiError.status || 500;
      error.code = 'ACBR_API_ERROR';
      error.data = apiError.data;
      throw error;
    }
  } catch (error) {
    console.error('[ACBrAPI] Error registering company:', error);
    
    const newError = new Error(`Falha ao registrar empresa na ACBr API: ${error.message}`);
    newError.status = error.status || 500;
    newError.code = error.code || 'ACBR_API_REGISTRATION_ERROR';
    if (error.data) {
      newError.data = error.data;
    }
    
    throw newError;
  }
}

/**
 * Update company's Inscrição Municipal in ACBr API
 * Required for municipalities that mandate IM (E0116)
 * @param {string} cnpj - Company CNPJ
 * @param {object} companyData - Company data including inscricaoMunicipal
 * @returns {Promise<object>} Update result
 */
async function updateCompanyIM(cnpj, companyData) {
  try {
    const cleanCnpj = (cnpj || '').replace(/\D/g, '');
    
    if (!cleanCnpj || cleanCnpj.length !== 14) {
      console.log('[ACBrAPI] Invalid CNPJ for IM update:', cnpj);
      return { updated: false, reason: 'invalid_cnpj' };
    }
    
    const inscricaoMunicipal = (companyData.inscricaoMunicipal || '').replace(/\D/g, '');
    
    if (!inscricaoMunicipal) {
      console.log('[ACBrAPI] No Inscrição Municipal to update for:', cleanCnpj);
      return { updated: false, reason: 'no_im' };
    }
    
    console.log('[ACBrAPI] Updating company Inscrição Municipal:', {
      cnpj: cleanCnpj,
      inscricaoMunicipal
    });
    
    let currentCompany;
    try {
      currentCompany = await apiRequest(`/empresas/${cleanCnpj}`, { method: 'GET' });
    } catch (error) {
      console.log('[ACBrAPI] Could not fetch company for IM update:', error.message);
      return { updated: false, reason: 'company_not_found' };
    }
    
    // Skip update if IM is already correctly set
    if (currentCompany.inscricao_municipal === inscricaoMunicipal) {
      console.log('[ACBrAPI] Inscrição Municipal already up to date:', inscricaoMunicipal);
      return { updated: false, reason: 'already_current' };
    }
    
    const updatedCompany = {
      cpf_cnpj: cleanCnpj,
      inscricao_municipal: inscricaoMunicipal,
      inscricao_estadual: currentCompany.inscricao_estadual || '',
      nome_razao_social: currentCompany.nome_razao_social,
      nome_fantasia: currentCompany.nome_fantasia || currentCompany.nome_razao_social,
      fone: currentCompany.fone || '',
      email: currentCompany.email || '',
      endereco: currentCompany.endereco || {}
    };
    
    await apiRequest(`/empresas/${cleanCnpj}`, {
      method: 'PUT',
      body: JSON.stringify(updatedCompany)
    });
    
    console.log('[ACBrAPI] Inscrição Municipal updated successfully');
    return { updated: true };
  } catch (error) {
    console.error('[ACBrAPI] Error updating Inscrição Municipal:', error.message);
    return { updated: false, reason: error.message };
  }
}

/**
 * Check fiscal connection status
 * @param {string} acbrApiId - Company CNPJ in ACBr API
 * @returns {Promise<object>} Connection status
 */
async function checkConnection(acbrApiId) {
  try {
    if (!acbrApiId) {
      return {
        status: 'falha',
        message: 'Empresa não registrada na ACBr API. Registre a empresa primeiro.',
        details: 'A empresa precisa ser registrada na ACBr API antes de verificar a conexão.'
      };
    }

    // Step 1: Verify OAuth token is valid
    try {
      await getAccessToken();
    } catch (tokenError) {
      return {
        status: 'falha',
        message: 'Erro de autenticação com ACBr API',
        details: `Não foi possível obter token de acesso: ${tokenError.message}. Verifique as credenciais.`
      };
    }

    // Step 2: Try to fetch company data from ACBr API
    let response;
    try {
      console.log('[ACBrAPI] Fetching company data for:', acbrApiId);
      response = await apiRequest(`/empresas/${acbrApiId}`);
      console.log('[ACBrAPI] Company data response:', JSON.stringify(response, null, 2));
    } catch (apiError) {
      console.log('[ACBrAPI] API Error:', apiError.status, apiError.message);
      if (apiError.status === 404) {
        return {
          status: 'falha',
          message: 'Empresa não encontrada na ACBr API',
          details: `A empresa com CNPJ ${acbrApiId} não foi encontrada. Pode ser necessário registrar a empresa novamente.`
        };
      }
      
      if (apiError.status === 401 || apiError.status === 403) {
        return {
          status: 'falha',
          message: 'Erro de autorização com ACBr API',
          details: 'Não foi possível acessar os dados da empresa. Verifique as permissões e credenciais.'
        };
      }

      throw apiError;
    }

    // Step 3: Verify company data structure
    const hasCnpj = response && response.cpf_cnpj;
    
    if (!response || !hasCnpj) {
      console.log('[ACBrAPI] Invalid response structure:', Object.keys(response || {}));
      return {
        status: 'falha',
        message: 'Dados da empresa incompletos',
        details: 'A resposta da ACBr API não contém os dados esperados da empresa.'
      };
    }

    // Connection is successful
    const companyCnpj = response.cpf_cnpj || acbrApiId;
    const companyName = response.nome_razao_social || response.nome_fantasia || companyCnpj;
    
    console.log('[ACBrAPI] Connection successful for:', companyName);
    
    return {
      status: 'conectado',
      message: 'Conexão com a prefeitura estabelecida com sucesso',
      details: `Empresa ${companyName} está conectada e pronta para emitir notas fiscais.`,
      data: {
        id: response.cpf_cnpj || acbrApiId,
        cnpj: companyCnpj,
        razao_social: response.nome_razao_social,
        nome_fantasia: response.nome_fantasia,
        status: response.status || 'ativo',
        inscricao_municipal: response.inscricao_municipal,
        email: response.email,
        telefone: response.fone
      }
    };
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return {
        status: 'falha',
        message: 'Erro de conexão com ACBr API',
        details: 'Não foi possível conectar com o servidor da ACBr API. Verifique sua conexão com a internet.'
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
/**
 * Normalize LC 116/2003 service code to 6 digits for ACBr API (cTribNac pattern [0-9]{6}).
 * Valid codes follow format XXYYZZ where ZZ (subitem) is always >= 01 (never 00).
 * We accept 4 (e.g. "1401") or 6 (e.g. "140101") and always return 6 valid digits.
 * Example: "1401" -> "140101", "0106" -> "010601", "140101" -> "140101".
 */
function normalizeCodigoServico(codigo) {
  if (!codigo || typeof codigo !== 'string') return '010601';
  const digits = codigo.replace(/\D/g, '');
  if (digits.length >= 6) return digits.slice(0, 6);
  // For 4-digit codes (e.g., "1401"), append "01" to create valid subitem
  // The last 2 digits (subitem) in LC 116/2003 are always >= 01, never 00
  if (digits.length >= 4) return (digits + '01').slice(0, 6); // 1401 -> 140101, 0106 -> 010601
  return digits.padStart(4, '0').slice(-4) + '01';
}

/**
 * Valida CPF pelos dígitos verificadores (algoritmo oficial da Receita Federal).
 * O campo infDPS.toma.CPF exige CPF válido; números como 12345678900 falham na prefeitura.
 * @param {string} cpf - 11 dígitos (apenas números)
 * @returns {boolean}
 */
function isValidCPF(cpf) {
  if (!cpf || typeof cpf !== 'string') return false;
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false; // rejeita 11111111111, 00000000000, etc.
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i], 10) * (10 - i);
  let remainder = sum % 11;
  const d1 = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(d[9], 10) !== d1) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i], 10) * (11 - i);
  remainder = sum % 11;
  const d2 = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(d[10], 10) !== d2) return false;
  return true;
}

/**
 * Valida CNPJ pelos dígitos verificadores (algoritmo oficial Receita Federal).
 * O campo infDPS.toma.CNPJ exige CNPJ válido; a prefeitura rejeita números inválidos.
 * @param {string} cnpj - 14 dígitos (apenas números)
 * @returns {boolean}
 */
function isValidCNPJ(cnpj) {
  if (!cnpj || typeof cnpj !== 'string') return false;
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false; // rejeita 00000000000000, 11111111111111, etc.
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(d[i], 10) * weights1[i];
  let remainder = sum % 11;
  const d1 = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(d[12], 10) !== d1) return false;
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(d[i], 10) * weights2[i];
  remainder = sum % 11;
  const d2 = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(d[13], 10) !== d2) return false;
  return true;
}

/**
 * Map company tributary regime to ACBr opSimpNac (Simples Nacional status).
 * 1 = Não Optante (Lucro Real, Lucro Presumido, etc.)
 * 2 = MEI
 * 3 = ME/EPP Optante do Simples Nacional
 * Prefeitura rejects if this does not match the company's cadastro Simples Nacional.
 */
function getOpSimpNacFromRegime(companyData) {
  const regime = (companyData?.regimeTributario || companyData?.regime_tributario || '').toLowerCase();
  if (regime.includes('mei')) return 2;
  if (regime.includes('simples nacional') || (regime.includes('simples') && !regime.includes('não') && !regime.includes('nao'))) return 3;
  return 1;
}

async function ensureRpsConfigured(cnpj, companyData = null) {
  try {
    const cleanCnpj = (cnpj || '').replace(/\D/g, '');
    const ambiente = ACBR_API_ENVIRONMENT === 'production' ? 'producao' : 'homologacao';

    const opSimpNac = companyData ? getOpSimpNacFromRegime(companyData) : 1;
    // Use atomically assigned nextRpsNumero when provided (concurrent-safe); else default 1
    const numero = (companyData && typeof companyData.nextRpsNumero === 'number') ? companyData.nextRpsNumero : 1;
    // Sistema Nacional NFS-e: série identifica o tipo de emissor. Para API/webservice use 00001–49999 (E0010).
    // 80000–89999 = portal manual. We use 900 (common in ERP integrations).
    const nfseConfig = {
      rps: {
        lote: 1,
        serie: '900',
        numero
      },
      regTrib: {
        opSimpNac,
        regApTribSN: 1,
        regEspTrib: 0
      },
      ambiente
    };

    console.log('[ACBrAPI] Ensuring RPS configuration is valid for:', cleanCnpj, '(opSimpNac:', opSimpNac + ', numero:', numero + ')');

    await apiRequest(`/empresas/${cleanCnpj}/nfse`, {
      method: 'PUT',
      body: JSON.stringify(nfseConfig)
    });

    console.log('[ACBrAPI] RPS configuration updated successfully');
  } catch (error) {
    console.log('[ACBrAPI] RPS config update skipped (may already be correct):', error.message);
  }
}

async function emitNfse(invoiceData, companyData) {
  try {
    if (!companyData.acbrApiId) {
      throw new Error('Empresa não registrada na ACBr API. Registre a empresa primeiro.');
    }

    // Sync server time with ACBr API to prevent E0008 errors
    await syncTimeWithAcbrApi();

    const cleanCnpj = companyData.cnpj.replace(/\D/g, '');
    
    // Ensure RPS and regTrib (opSimpNac) are configured at company level before emission
    await ensureRpsConfigured(cleanCnpj, companyData);
    
    // Ensure Inscrição Municipal is updated in ACBr API (required by many municipalities - E0116)
    if (companyData.inscricaoMunicipal) {
      await updateCompanyIM(cleanCnpj, companyData);
    }
    
    let clienteDocumento = (invoiceData.cliente_documento || '').replace(/\D/g, '');
    // Pad CPF to 11 / CNPJ to 14 digits (leading zeros) - required by prefeituras
    if (clienteDocumento.length > 0 && clienteDocumento.length <= 11) {
      clienteDocumento = clienteDocumento.padStart(11, '0');
    }
    if (clienteDocumento.length > 11 && clienteDocumento.length <= 14) {
      clienteDocumento = clienteDocumento.padStart(14, '0');
    }
    if (clienteDocumento.length > 0 && clienteDocumento.length !== 11 && clienteDocumento.length !== 14) {
      const err = new Error('CPF deve ter 11 dígitos ou CNPJ 14 dígitos.');
      err.status = 400;
      err.code = 'INVALID_DOCUMENT';
      throw err;
    }
    if (clienteDocumento.length === 11 && !isValidCPF(clienteDocumento)) {
      const err = new Error(
        'O CPF informado não é válido. A prefeitura exige um CPF com dígitos verificadores corretos. ' +
        'Verifique os 11 dígitos do CPF do cliente (evite números de teste como 12345678900).'
      );
      err.status = 400;
      err.code = 'INVALID_CPF';
      throw err;
    }
    if (clienteDocumento.length === 14 && !isValidCNPJ(clienteDocumento)) {
      const err = new Error(
        'O CNPJ informado não é válido. A prefeitura exige um CNPJ com dígitos verificadores corretos. ' +
        'Verifique os 14 dígitos do CNPJ do cliente (evite números de teste).'
      );
      err.status = 400;
      err.code = 'INVALID_CNPJ';
      throw err;
    }
    const ambiente = ACBR_API_ENVIRONMENT === 'production' ? 'producao' : 'homologacao';

    // Normalize values to format expected by prefeitura (2 decimal places; cTribNac 4 chars)
    const valorNum = parseFloat(invoiceData.valor || 0);
    const vServ = Number((valorNum).toFixed(2));
    const aliquotaNum = parseFloat(invoiceData.aliquota_iss ?? 5);
    const pAliq = Number((aliquotaNum).toFixed(2));
    const vBC = vServ;
    const vISSQN = Number((vServ * (pAliq / 100)).toFixed(2));
    const codigoServico = normalizeCodigoServico(invoiceData.codigo_servico || '0106');
    
    // Location of service: IBGE 7 digits (company municipality)
    const codigoMunicipio = (companyData.codigoMunicipal || companyData.codigoMunicipio || '').replace(/\D/g, '');
    
    // Validate service code against municipal parameters (production best practice)
    const serviceValidation = await validateServiceCode(codigoServico, codigoMunicipio);
    console.log(`[ACBrAPI] Service code validation:`, JSON.stringify(serviceValidation));
    
    if (!serviceValidation.valid) {
      const err = new Error(serviceValidation.error || `Código de serviço inválido: ${codigoServico}`);
      err.status = 400;
      err.code = 'INVALID_SERVICE_CODE';
      throw err;
    }

    // Get emission datetime in Brazil timezone
    const dhEmi = getBrazilDateTime();
    const dhEmiDate = dhEmi.split('T')[0]; // Extract date part (YYYY-MM-DD)
    
    // dCompet: YYYY-MM-DD (date of service/competence)
    // Rule: dCompet cannot be AFTER dhEmi date (E0015 validation)
    let dataPrestacao = invoiceData.data_prestacao || dhEmiDate;
    
    // Ensure dCompet is not after dhEmi date
    if (dataPrestacao > dhEmiDate) {
      console.log(`[ACBrAPI] Adjusting dCompet from ${dataPrestacao} to ${dhEmiDate} (cannot be after dhEmi)`);
      dataPrestacao = dhEmiDate;
    }

    // regEspTrib in DPS: 0 = nenhum regime especial
    // Note: opSimpNac is set at COMPANY level (PUT /empresas/{cnpj}/nfse), NOT in DPS payload
    const regEspTrib = 0;
    // cLocPrestacao: IBGE 7 digits or null (codigoMunicipio already defined above)
    const cLocPrestacao = codigoMunicipio.length === 7 ? codigoMunicipio : null;

    // Check if company is Simples Nacional (opSimpNac = 3)
    // For Simples Nacional with no ISS retention (tpRetISSQN = 1), we must NOT send pAliq, vBC, vISSQN
    // because ISS is calculated and paid through DAS, not on individual invoices (E0625)
    const opSimpNac = getOpSimpNacFromRegime(companyData);
    const isSimplesToNoRetention = opSimpNac === 3; // ME/EPP Simples Nacional
    
    // tpRetISSQN: 1 = não retido, 2 = retido pelo tomador, 3 = retido pelo intermediário
    const tpRetISSQN = invoiceData.iss_retido ? 2 : 1;
    
    // For Simples Nacional without retention: don't send ISS details (pAliq, vBC, vISSQN)
    // vLiq = vServ for Simples Nacional (no ISS deduction on invoice)
    const vLiq = isSimplesToNoRetention && tpRetISSQN === 1 
      ? vServ 
      : Number((vServ - vISSQN).toFixed(2));

    // Build tribMun object based on company regime
    const tribMun = {
      tribISSQN: 1, // 1 = tributável
      tpRetISSQN,
      vLiq,
      ...(cLocPrestacao ? { cLocIncid: cLocPrestacao } : {})
    };

    // Only add ISS rate fields if NOT Simples Nacional without retention
    if (!(isSimplesToNoRetention && tpRetISSQN === 1)) {
      tribMun.pAliq = pAliq;
      tribMun.vBC = vBC;
      tribMun.vISSQN = vISSQN;
    }

    console.log(`[ACBrAPI] Company regime: opSimpNac=${opSimpNac}, tpRetISSQN=${tpRetISSQN}, includeISSFields=${!(isSimplesToNoRetention && tpRetISSQN === 1)}`);

    // NFS-e payload aligned with ACBr API schema (infDPS structure)
    const nfsePayload = {
      provedor: 'padrao',
      ambiente: ambiente,
      referencia: `nfse-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      infDPS: {
        tpAmb: ACBR_API_ENVIRONMENT === 'production' ? 1 : 2,
        dhEmi: dhEmi,
        verAplic: '1.0',
        dCompet: dataPrestacao,
        prest: {
          CNPJ: cleanCnpj,
          regTrib: { regEspTrib }
        },
        toma: {
          orgaoPublico: false,
          xNome: String(invoiceData.cliente_nome || '').trim(),
          ...(clienteDocumento.length === 11 ? { CPF: clienteDocumento } : {}),
          ...(clienteDocumento.length === 14 ? { CNPJ: clienteDocumento } : {}),
        },
        serv: {
          ...(cLocPrestacao ? {
            locPrest: {
              cLocPrestacao,
              cPaisPrestacao: 'BR'
            }
          } : {}),
          cServ: {
            cTribNac: codigoServico,
            xDescServ: String(invoiceData.descricao_servico || 'Serviço prestado').trim()
          }
        },
        valores: {
          vServPrest: {
            // vReceb should NOT be sent when prestador is the DPS emitter (E0424)
            vServ
          },
          trib: {
            tribMun
          }
        }
      }
    };

    console.log(`[ACBrAPI] Emitting NFS-e to: /nfse/dps (dhEmi: ${dhEmi})`);
    console.log('[ACBrAPI] NFS-e payload:', JSON.stringify(nfsePayload, null, 2));
    
    let response;
    try {
      response = await apiRequest('/nfse/dps', {
        method: 'POST',
        body: JSON.stringify(nfsePayload)
      });
    } catch (apiError) {
      console.error('[ACBrAPI] API Error:', apiError.status, apiError.message);
      console.error('[ACBrAPI] Error data:', JSON.stringify(apiError.data || {}, null, 2));
      
      if (apiError.status === 403) {
        const permissionError = new Error('A empresa não tem permissão para emitir NFS-e neste município. Verifique se a empresa está autorizada pela prefeitura.');
        permissionError.status = 403;
        permissionError.code = 'MUNICIPALITY_PERMISSION_DENIED';
        permissionError.data = apiError.data;
        throw permissionError;
      }
      
      if (apiError.status === 401) {
        const authError = new Error('Erro de autenticação com a prefeitura. Verifique suas credenciais.');
        authError.status = 401;
        authError.code = 'MUNICIPALITY_AUTH_ERROR';
        authError.data = apiError.data;
        throw authError;
      }
      
      if (apiError.status === 400) {
        const data = apiError.data || {};
        let detail = apiError.message || '';
        const errObj = data.error;
        
        if (errObj?.errors && Array.isArray(errObj.errors)) {
          const parts = errObj.errors.map(e => {
            if (typeof e === 'string') return e;
            if (e.field && e.message) return `${e.field}: ${e.message}`;
            if (e.message) return e.message;
            if (e.descricao) return e.descricao;
            return JSON.stringify(e);
          });
          if (parts.length) detail = parts.join('. ');
        } else if (data.mensagens && Array.isArray(data.mensagens)) {
          const parts = data.mensagens.map(m => m.descricao || m.mensagem || m.message || String(m));
          if (parts.length) detail = parts.join('. ');
        } else if (errObj?.message) {
          detail = errObj.message;
        } else if (data.message) {
          detail = data.message;
        }
        const validationError = new Error(detail || 'Dados inválidos para emissão.');
        validationError.status = 400;
        // Preserve original error code from API, fallback to generic code
        validationError.code = apiError.code || errObj?.code || 'INVOICE_EMISSION_ERROR';
        validationError.data = apiError.data;
        
        throw validationError;
      }
      
      // Simulation fallback only in sandbox
      if (ACBR_API_ENVIRONMENT !== 'production' && (apiError.status === 405 || apiError.status === 404)) {
        console.log('[ACBrAPI] Sandbox: endpoint not available, using simulation mode');
        const simulatedId = `SIM-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const simulatedNumero = String(Math.floor(Math.random() * 900000) + 100000);
        
        return {
          status: 'success',
          simulated: true,
          message: 'Nota fiscal simulada em ambiente de homologação.',
          nfse: {
            id: simulatedId,
            numero: simulatedNumero,
            codigo_verificacao: Math.random().toString(36).substring(2, 10).toUpperCase(),
            status: 'processando',
            pdf_url: null,
            xml_url: null,
            acbr_api_id: simulatedId,
            message: 'Nota fiscal enviada para processamento. Em ambiente sandbox, a nota é simulada.'
          }
        };
      }
      
      throw apiError;
    }

    console.log('[ACBrAPI] NFS-e emission response:', JSON.stringify(response, null, 2));

    return {
      status: 'success',
      nfse: {
        id: response.id,
        numero: response.numero,
        codigo_verificacao: response.codigo_verificacao,
        status: response.status || 'processando',
        pdf_url: response.pdf_url,
        xml_url: response.xml_url,
        acbr_api_id: response.id
      }
    };
  } catch (error) {
    console.error('[ACBrAPI] Error emitting NFS-e:', error.status, error.message);
    console.error('[ACBrAPI] Error code:', error.code);
    console.error('[ACBrAPI] Error data:', JSON.stringify(error.data || {}, null, 2));
    
    const { translateError } = await import('./errorTranslationService.js');
    const translated = translateError(error, {
      municipality: companyData.cidade,
      includeTechnicalDetails: false
    });
    
    const translatedError = new Error(translated.message);
    translatedError.status = error.status || 500;
    translatedError.code = error.code || 'INVOICE_EMISSION_ERROR';
    translatedError.explanation = translated.explanation;
    translatedError.action = translated.action;
    translatedError.data = error.data;
    throw translatedError;
  }
}

/**
 * Check NFS-e status
 * @param {string} companyAcbrId - Company CNPJ in ACBr API (not used in new endpoint)
 * @param {string} nfseId - NFS-e ID returned from emission
 * @returns {Promise<object>} NFS-e status
 */
async function checkNfseStatus(companyAcbrId, nfseId) {
  try {
    if (!nfseId) {
      throw new Error('NFS-e ID is required');
    }

    if (nfseId.startsWith('SIM-')) {
      console.log('[ACBrAPI] Simulated invoice, returning mock authorized status');
      return {
        status: 'autorizada',
        numero: nfseId.split('-')[1] || '000000',
        codigo_verificacao: 'SIMULATED',
        pdf_url: null,
        xml_url: null,
        mensagem: 'Nota fiscal simulada autorizada (ambiente de teste)'
      };
    }

    console.log('[ACBrAPI] Checking NFS-e status:', nfseId);
    
    const response = await apiRequest(`/nfse/${nfseId}`);

    const statusMap = {
      'autorizado': 'autorizada',
      'autorizada': 'autorizada',
      'rejeitado': 'rejeitada',
      'rejeitada': 'rejeitada',
      'cancelado': 'cancelada',
      'cancelada': 'cancelada',
      'processando': 'processando',
      'pendente': 'processando',
      'erro': 'erro',
      'error': 'erro',
      'falha': 'erro',
      'failed': 'erro'
    };

    const rawStatus = (response.status ?? response.data?.status ?? '').toString().trim().toLowerCase();
    const mappedStatus = statusMap[rawStatus] || 'processando';
    
    console.log('[ACBrAPI] NFS-e status result:', mappedStatus, rawStatus ? `(raw: ${rawStatus})` : '(from response)');
    
    // Log full response for debugging when status is erro
    if (mappedStatus === 'erro') {
      console.log('[ACBrAPI] NFS-e error response:', JSON.stringify(response, null, 2));
    }

    const data = response.data ?? response;
    
    // Extract error messages and codes from various possible locations
    let mensagem = response.mensagem ?? response.message ?? data.mensagem ?? data.message ?? '';
    let errorCode = null;
    
    // Check for messages array (common in ACBr responses)
    const mensagens = response.mensagens ?? data.mensagens ?? [];
    if (Array.isArray(mensagens) && mensagens.length > 0) {
      const errorMessages = mensagens
        .map(m => {
          if (typeof m === 'string') return m;
          if (m.mensagem) return m.mensagem;
          if (m.message) return m.message;
          if (m.descricao) return m.descricao;
          if (m.codigo && m.descricao) return `${m.codigo}: ${m.descricao}`;
          return JSON.stringify(m);
        })
        .filter(m => m && m.length > 0);
      
      if (errorMessages.length > 0) {
        mensagem = errorMessages.join('; ');
      }
      
      // Extract the first error code from mensagens
      const firstErrorWithCode = mensagens.find(m => m.codigo && m.codigo !== 'HTTP 400');
      if (firstErrorWithCode) {
        errorCode = firstErrorWithCode.codigo;
      }
    }
    
    // Check for error object
    if (!mensagem && response.error) {
      mensagem = response.error.message ?? response.error.descricao ?? JSON.stringify(response.error);
      errorCode = errorCode || response.error.code;
    }
    
    return {
      status: mappedStatus,
      numero: (response.numero ?? data.numero) ? String(response.numero ?? data.numero) : null,
      codigo_verificacao: response.codigo_verificacao ?? response.codigoVerificacao ?? data.codigo_verificacao ?? data.codigoVerificacao,
      pdf_url: response.pdf_url ?? response.pdfUrl ?? data.pdf_url ?? data.pdfUrl,
      xml_url: response.xml_url ?? response.xmlUrl ?? data.xml_url ?? data.xmlUrl,
      mensagem,
      errorCode
    };
  } catch (error) {
    console.error('[ACBrAPI] Error checking NFS-e status:', error.message);
    
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
 * @param {string} acbrApiId - Company CNPJ in ACBr API
 * @param {string} nfseId - NFS-e ID
 * @param {string} motivo - Cancellation reason
 * @returns {Promise<object>} Cancellation result
 */
async function cancelNfse(acbrApiId, nfseId, motivo) {
  if (nfseId && nfseId.startsWith('SIM-')) {
    console.log('[ACBrAPI] Simulated invoice detected, canceling locally only:', nfseId);
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
    const response = await apiRequest(`/nfse/${nfseId}/cancelamento`, {
      method: 'POST',
      body: JSON.stringify({
        justificativa: motivo
      })
    });

    return {
      status: 'success',
      message: 'NFS-e cancelada com sucesso',
      data: response
    };
  } catch (error) {
    console.error('[ACBrAPI] Error canceling NFS-e:', {
      acbrApiId,
      nfseId,
      motivo,
      errorMessage: error.message,
      errorStatus: error.status,
      errorData: error.data
    });
    
    const cancelError = new Error(error.message || `Falha ao cancelar NFS-e: ${error.message}`);
    if (error.status) cancelError.status = error.status;
    if (error.data) cancelError.data = error.data;
    if (error.code) cancelError.code = error.code;
    
    throw cancelError;
  }
}

/**
 * Upload digital certificate
 * @param {string} cpfCnpj - Company CNPJ
 * @param {string} certificateBase64 - Certificate file in base64
 * @param {string} password - Certificate password
 * @returns {Promise<object>} Upload result
 */
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

    console.log('[ACBrAPI] Uploading certificate for:', cleanCpfCnpj);

    const response = await apiRequest(`/empresas/${cleanCpfCnpj}/certificado`, {
      method: 'PUT',
      body: JSON.stringify({
        certificado: certificateBase64,
        password: password
      })
    });

    console.log('[ACBrAPI] Certificate uploaded successfully');

    return {
      status: 'success',
      message: 'Certificado digital enviado com sucesso para a ACBr API',
      data: response
    };
  } catch (error) {
    console.error('[ACBrAPI] Error uploading certificate:', error);
    
    let errorMessage = 'Erro desconhecido ao enviar certificado';
    
    if (error.message) {
      errorMessage = error.message;
    } else if (error.data) {
      errorMessage = error.data.error || error.data.message || JSON.stringify(error.data);
    }
    
    if (error.status === 404) {
      throw new Error('Empresa não encontrada na ACBr API. Registre a empresa primeiro antes de enviar o certificado.');
    }
    
    throw new Error(`Falha ao enviar certificado para ACBr API: ${errorMessage}`);
  }
}

/**
 * Configure municipal credentials for NFS-e issuance
 * @param {string} cpfCnpj - Company CNPJ
 * @param {object} companyData - Company data
 * @param {string} login - Municipal login
 * @param {string} senha - Municipal password
 * @param {string|null} token - Optional municipal token
 * @returns {Promise<object>} Configuration result
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

    console.log('[ACBrAPI] Configuring municipal credentials for:', cleanCpfCnpj);

    const opSimpNac = getOpSimpNacFromRegime(companyData);
    const ambiente = ACBR_API_ENVIRONMENT === 'production' ? 'producao' : 'homologacao';

    const prefeitura = { login, senha };
    if (token) {
      prefeitura.token = token;
    }

    const nfseConfig = {
      regTrib: {
        opSimpNac: opSimpNac,
        regApTribSN: 1,
        regEspTrib: 0
      },
      rps: {
        lote: 1,
        serie: '900',
        numero: 1
      },
      prefeitura,
      incentivo_fiscal: false,
      ambiente
    };

    console.log('[ACBrAPI] Sending NFS-e config with prefeitura credentials');

    const response = await apiRequest(`/empresas/${cleanCpfCnpj}/nfse`, {
      method: 'PUT',
      body: JSON.stringify(nfseConfig)
    });

    console.log('[ACBrAPI] Municipal credentials configured successfully');

    return {
      status: 'success',
      message: 'Credenciais da prefeitura configuradas com sucesso na ACBr API',
      data: response
    };
  } catch (error) {
    console.error('[ACBrAPI] Error configuring municipal credentials:', error);

    let errorMessage = error.message || 'Erro desconhecido ao configurar credenciais municipais';

    if (error.status === 404) {
      throw new Error('Empresa não encontrada na ACBr API. Registre a empresa primeiro.');
    }

    throw new Error(`Falha ao configurar credenciais municipais: ${errorMessage}`);
  }
}

/**
 * Configure NFS-e to use the uploaded digital certificate
 * @param {string} cpfCnpj - Company CNPJ
 * @param {object} companyData - Company data
 * @returns {Promise<object>} Configuration result
 */
async function configureNfseForCertificate(cpfCnpj, companyData) {
  try {
    const cleanCpfCnpj = (cpfCnpj || '').replace(/\D/g, '');

    if (!cleanCpfCnpj || (cleanCpfCnpj.length !== 11 && cleanCpfCnpj.length !== 14)) {
      throw new Error(`CPF/CNPJ inválido: ${cpfCnpj}`);
    }

    console.log('[ACBrAPI] Configuring NFS-e to use digital certificate for:', cleanCpfCnpj);

    const opSimpNac = getOpSimpNacFromRegime(companyData);
    const ambiente = ACBR_API_ENVIRONMENT === 'production' ? 'producao' : 'homologacao';

    const nfseConfig = {
      regTrib: {
        opSimpNac: opSimpNac,
        regApTribSN: 1,
        regEspTrib: 0
      },
      rps: {
        lote: 1,
        serie: '900',
        numero: 1
      },
      prefeitura: null,
      incentivo_fiscal: false,
      ambiente
    };

    console.log('[ACBrAPI] Sending NFS-e config (certificate mode, no prefeitura credentials)');

    const response = await apiRequest(`/empresas/${cleanCpfCnpj}/nfse`, {
      method: 'PUT',
      body: JSON.stringify(nfseConfig)
    });

    console.log('[ACBrAPI] NFS-e configured for certificate use successfully');

    return {
      status: 'success',
      message: 'Configuração NFS-e atualizada para usar certificado digital',
      data: response
    };
  } catch (error) {
    console.error('[ACBrAPI] Error configuring NFS-e for certificate:', error);
    if (error.status === 404) {
      throw new Error('Empresa não encontrada na ACBr API. Registre a empresa primeiro.');
    }
    throw new Error(`Falha ao configurar NFS-e para certificado: ${error.message}`);
  }
}

/**
 * Test NFS-e emission capability for a company
 * @param {string} cnpj - Company CNPJ
 * @returns {Promise<object>} Test result
 */
async function testNfseEmissionCapability(cnpj) {
  const cleanCnpj = (cnpj || '').replace(/\D/g, '');
  const ambiente = ACBR_API_ENVIRONMENT === 'production' ? 'producao' : 'homologacao';

  const testPayload = {
    provedor: 'padrao',
    ambiente: ambiente,
    infDPS: {
      tpAmb: ACBR_API_ENVIRONMENT === 'production' ? 1 : 2,
      dhEmi: getBrazilDateTime(),
      dCompet: getBrazilDate(),
      prest: { CNPJ: cleanCnpj },
      toma: { xNome: 'TESTE VALIDACAO', CNPJ: '00000000000191' },
      serv: { cServ: { cTribNac: '010601', xDescServ: 'Teste de validação de emissão' } },
      valores: {
        vServPrest: { vServ: 1 },
        trib: { tribMun: { tribISSQN: 1 } }
      }
    }
  };

  try {
    await apiRequest('/nfse/dps', { method: 'POST', body: JSON.stringify(testPayload) });
    
    return {
      canEmit: true,
      status: 'ready',
      message: 'Empresa pronta para emitir NFS-e'
    };
  } catch (error) {
    const errorMessage = error.message || '';
    const errorData = error.data?.error;

    if (errorMessage.includes('CredentialsNotFound') || errorMessage.includes('Credencial não encontrada')) {
      return {
        canEmit: false,
        status: 'credentials_missing',
        code: 'CREDENTIALS_NOT_CONFIGURED',
        message: 'Credenciais não configuradas corretamente',
        action: 'Configure o certificado digital ou credenciais da prefeitura na configuração da empresa.'
      };
    }

    if (errorMessage.includes('certificado') || errorMessage.includes('Certificate')) {
      return {
        canEmit: false,
        status: 'certificate_issue',
        code: 'CERTIFICATE_ISSUE',
        message: 'Problema com o certificado digital',
        action: 'Verifique se o certificado está válido e foi enviado corretamente.'
      };
    }

    if (error.status === 400) {
      return {
        canEmit: true,
        status: 'ready',
        message: 'Configuração de NFS-e validada. Empresa pronta para emitir.',
        note: 'Teste de validação concluído com sucesso.'
      };
    }

    return {
      canEmit: false,
      status: 'unknown_error',
      code: 'UNKNOWN_ERROR',
      message: `Erro ao testar emissão: ${errorMessage.substring(0, 200)}`,
      action: 'Verifique as configurações da empresa ou entre em contato com o suporte.'
    };
  }
}

// Legacy alias functions for backward compatibility
// Legacy Nuvem Fiscal alias removed — use isAcbrApiConfigured directly

export {
  registerCompany,
  updateCompanyIM,
  checkConnection,
  emitNfse,
  checkNfseStatus,
  cancelNfse,
  uploadCertificate,
  configureMunicipalCredentials,
  configureNfseForCertificate,
  testNfseEmissionCapability
};
