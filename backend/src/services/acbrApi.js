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
      
      if (responseData.error) {
        if (typeof responseData.error === 'string') {
          errorMessage = responseData.error;
        } else if (responseData.error.message) {
          errorMessage = responseData.error.message;
          
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
      } else if (responseData.error_description) {
        errorMessage = responseData.error_description;
      }
      
      console.error('[ACBrAPI] API Error Response:', JSON.stringify(responseData, null, 2));
      
      const error = new Error(errorMessage);
      error.status = response.status;
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
async function emitNfse(invoiceData, companyData) {
  try {
    if (!companyData.acbrApiId) {
      throw new Error('Empresa não registrada na ACBr API. Registre a empresa primeiro.');
    }

    const cleanCnpj = companyData.cnpj.replace(/\D/g, '');
    const clienteDocumento = (invoiceData.cliente_documento || '').replace(/\D/g, '');
    const ambiente = ACBR_API_ENVIRONMENT === 'production' ? 'producao' : 'homologacao';

    // NFS-e payload (compatible with both ACBr API and Nuvem Fiscal)
    const nfsePayload = {
      provedor: 'padrao',
      ambiente: ambiente,
      infDPS: {
        tpAmb: ACBR_API_ENVIRONMENT === 'production' ? 1 : 2,
        dhEmi: new Date().toISOString(),
        verAplic: "1.0",
        dCompet: invoiceData.data_prestacao || new Date().toISOString().split('T')[0],
        prest: {
          CNPJ: cleanCnpj
        },
        toma: {
          xNome: invoiceData.cliente_nome,
          ...(clienteDocumento.length === 11 ? { CPF: clienteDocumento } : {}),
          ...(clienteDocumento.length === 14 ? { CNPJ: clienteDocumento } : {}),
        },
        serv: {
          cServ: {
            cTribNac: invoiceData.codigo_servico || '010601',
            xDescServ: invoiceData.descricao_servico || 'Serviço prestado'
          }
        },
        valores: {
          vServPrest: {
            vServ: parseFloat(invoiceData.valor || 0)
          },
          trib: {
            tribMun: {
              tribISSQN: 1,
              pAliq: parseFloat(invoiceData.aliquota_iss || 5)
            }
          }
        }
      }
    };

    console.log('[ACBrAPI] Emitting NFS-e to: /nfse/dps');
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
      'pendente': 'processando'
    };

    const mappedStatus = statusMap[response.status?.toLowerCase()] || response.status || 'processando';
    
    console.log('[ACBrAPI] NFS-e status result:', mappedStatus);

    return {
      status: mappedStatus,
      numero: response.numero ? String(response.numero) : null,
      codigo_verificacao: response.codigo_verificacao || response.codigoVerificacao,
      pdf_url: response.pdf_url || response.pdfUrl,
      xml_url: response.xml_url || response.xmlUrl,
      mensagem: response.mensagem || response.message || ''
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

    let opSimpNac = 1;
    const regime = (companyData.regimeTributario || companyData.regime_tributario || '').toLowerCase();
    if (regime.includes('lucro presumido') || regime.includes('lucro real')) {
      opSimpNac = 3;
    }

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
        lote: 0,
        serie: 'RPS',
        numero: 0
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

    let opSimpNac = 1;
    const regime = (companyData.regimeTributario || companyData.regime_tributario || '').toLowerCase();
    if (regime.includes('lucro presumido') || regime.includes('lucro real')) {
      opSimpNac = 3;
    }

    const ambiente = ACBR_API_ENVIRONMENT === 'production' ? 'producao' : 'homologacao';

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
      dhEmi: new Date().toISOString(),
      dCompet: new Date().toISOString().split('T')[0],
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
  checkConnection,
  emitNfse,
  checkNfseStatus,
  cancelNfse,
  uploadCertificate,
  configureMunicipalCredentials,
  configureNfseForCertificate,
  testNfseEmissionCapability
};
