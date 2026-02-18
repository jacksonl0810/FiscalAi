/**
 * Municipality Service
 * Handles municipality coverage validation, support checking, and authentication requirements
 * 
 * Uses Nuvem Fiscal endpoints:
 * - CidadesAtendidas: List all supported municipalities
 * - /nfse/cidades/{codigo_ibge}: Get specific municipality details including auth requirements
 * 
 * Documentation: https://dev.nuvemfiscal.com.br/docs/api#tag/Nfse
 */

import { apiRequest, getBaseUrl, isNuvemFiscalConfigured } from './nuvemFiscal.js';
import { prisma } from '../lib/prisma.js';

// Cache for municipality auth requirements (refresh every 24 hours)
let municipalityAuthCache = {
  data: new Map(),
  TTL: 24 * 60 * 60 * 1000 // 24 hours
};

// Cache for supported municipalities (refresh every 24 hours)
let municipalityCache = {
  data: null,
  lastFetch: null,
  TTL: 24 * 60 * 60 * 1000 // 24 hours
};

/**
 * Get list of all supported municipalities from Nuvem Fiscal
 * Uses the CidadesAtendidas endpoint
 * 
 * @returns {Promise<Array>} List of supported municipalities
 */
export async function getSupportedMunicipalities() {
  // Check cache first
  if (municipalityCache.data && 
      municipalityCache.lastFetch && 
      (Date.now() - municipalityCache.lastFetch) < municipalityCache.TTL) {
    return municipalityCache.data;
  }

  if (!isNuvemFiscalConfigured()) {
    console.warn('[Municipality] Nuvem Fiscal not configured, skipping municipality check');
    return null;
  }

  try {
    // Nuvem Fiscal NFS-e CidadesAtendidas endpoint
    // This returns list of municipalities that support NFS-e issuance
    const response = await apiRequest('/nfse/cidades', {
      method: 'GET'
    });

    // Response format: { data: [{ codigo_ibge, nome, uf, ... }] } or array directly
    const cities = Array.isArray(response) ? response : (response.data || response.items || []);
    
    // Cache the result
    municipalityCache.data = cities;
    municipalityCache.lastFetch = Date.now();

    console.log(`[Municipality] Cached ${cities.length} supported municipalities`);
    return cities;
  } catch (error) {
    console.error('[Municipality] Error fetching supported municipalities:', error.message);
    
    // If the /nfse/cidades endpoint doesn't exist, try alternative endpoints
    try {
      const altResponse = await apiRequest('/cidades', { method: 'GET' });
      const cities = Array.isArray(altResponse) ? altResponse : (altResponse.data || []);
      
      municipalityCache.data = cities;
      municipalityCache.lastFetch = Date.now();
      
      return cities;
    } catch (altError) {
      console.error('[Municipality] Alternative endpoint also failed:', altError.message);
      return null;
    }
  }
}

/**
 * Get municipality authentication requirements from Nuvem Fiscal
 * Uses the /nfse/cidades/{codigo_ibge} endpoint
 * 
 * The `credenciais` field indicates what authentication methods are required:
 * - ["certificado"] = only digital certificate needed
 * - ["login_senha"] = only municipal credentials (login/password) needed  
 * - ["certificado", "login_senha"] = BOTH methods are required
 * 
 * @param {string} codigoMunicipio - IBGE municipality code (7 digits)
 * @returns {Promise<object>} Municipality auth requirements
 */
export async function getMunicipalityAuthRequirements(codigoMunicipio) {
  try {
    const cleanCodigo = (codigoMunicipio || '').replace(/\D/g, '');
    
    if (!cleanCodigo || cleanCodigo.length !== 7) {
      return {
        supported: false,
        message: `Código do município inválido: ${codigoMunicipio}. Deve conter exatamente 7 dígitos (código IBGE).`,
        authRequirements: null,
        checkedAt: new Date()
      };
    }

    // Check cache first
    const cacheKey = cleanCodigo;
    const cached = municipalityAuthCache.data.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < municipalityAuthCache.TTL) {
      console.log('[Municipality] Returning cached auth requirements for:', cleanCodigo);
      return cached.data;
    }

    if (!isNuvemFiscalConfigured()) {
      return {
        supported: null,
        message: 'Nuvem Fiscal não configurada. Não foi possível verificar os requisitos de autenticação do município.',
        authRequirements: null,
        checkedAt: new Date()
      };
    }

    console.log('[Municipality] Fetching auth requirements for municipality:', cleanCodigo);

    // Fetch municipality details from Nuvem Fiscal
    const response = await apiRequest(`/nfse/cidades/${cleanCodigo}`, {
      method: 'GET'
    });

    console.log('[Municipality] API response:', JSON.stringify(response, null, 2));

    // Parse the credentials field
    // Nuvem Fiscal returns: { credenciais: ["certificado"] } or { credenciais: ["certificado", "login_senha"] }
    const credenciais = response.credenciais || [];
    
    const requiresCertificate = credenciais.includes('certificado');
    const requiresLoginSenha = credenciais.includes('login_senha');

    // Determine auth mode
    let authMode = 'none';
    let authModeDescription = 'Não foi possível determinar o método de autenticação';
    
    if (requiresCertificate && requiresLoginSenha) {
      authMode = 'both';
      authModeDescription = 'Este município requer AMBOS: certificado digital E credenciais da prefeitura (login/senha)';
    } else if (requiresCertificate) {
      authMode = 'certificate_only';
      authModeDescription = 'Este município requer apenas certificado digital (e-CNPJ A1)';
    } else if (requiresLoginSenha) {
      authMode = 'municipal_only';
      authModeDescription = 'Este município requer apenas credenciais da prefeitura (login/senha)';
    } else if (credenciais.length === 0) {
      authMode = 'unknown';
      authModeDescription = 'Não foi possível determinar os requisitos de autenticação do município';
    }

    const result = {
      supported: true,
      codigoIbge: cleanCodigo,
      nome: response.nome || response.cidade || 'N/A',
      uf: response.uf || response.estado || 'N/A',
      provedor: response.provedor || null,
      ambiente: response.ambiente || null,
      authRequirements: {
        raw: credenciais,
        requiresCertificate,
        requiresLoginSenha,
        authMode,
        authModeDescription
      },
      message: authModeDescription,
      checkedAt: new Date()
    };

    // Cache the result
    municipalityAuthCache.data.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    console.log('[Municipality] Auth requirements determined:', authMode);
    return result;

  } catch (error) {
    console.error('[Municipality] Error fetching auth requirements:', error.message);
    
    // If 404, municipality not supported
    if (error.status === 404) {
      return {
        supported: false,
        message: `O município com código IBGE ${codigoMunicipio} não está na lista de municípios suportados pela Nuvem Fiscal para emissão de NFS-e.`,
        authRequirements: null,
        checkedAt: new Date(),
        hint: 'Verifique se o código IBGE está correto. Consulte: https://www.ibge.gov.br/explica/codigos-dos-municipios.php'
      };
    }

    return {
      supported: null,
      message: `Erro ao verificar requisitos do município: ${error.message}`,
      authRequirements: null,
      checkedAt: new Date(),
      error: error.message
    };
  }
}

/**
 * Check if a municipality is supported for NFS-e issuance
 * Uses Nuvem Fiscal CidadesAtendidas endpoint
 * 
 * @param {string} codigoMunicipio - IBGE municipality code (7 digits)
 * @returns {Promise<object>} Support status and message
 */
export async function checkMunicipalitySupport(codigoMunicipio) {
  try {
    // Clean and validate IBGE code
    const cleanCodigo = (codigoMunicipio || '').replace(/\D/g, '');
    
    if (!cleanCodigo || cleanCodigo.length !== 7) {
      return {
        supported: false,
        message: `Código do município inválido: ${codigoMunicipio}. Deve conter exatamente 7 dígitos (código IBGE).`,
        checkedAt: new Date()
      };
    }

    // If Nuvem Fiscal is not configured, allow (don't block)
    if (!isNuvemFiscalConfigured()) {
      return {
        supported: null,
        message: 'Nuvem Fiscal não configurada. Verifique manualmente se o município é suportado.',
        checkedAt: new Date()
      };
    }

    // Get list of supported municipalities
    const supportedCities = await getSupportedMunicipalities();

    if (!supportedCities) {
      // API unavailable - return unknown status (don't block)
      return {
        supported: null,
        message: 'Não foi possível verificar se o município é suportado. O sistema tentará emitir mesmo assim.',
        checkedAt: new Date(),
        error: 'API unavailable'
      };
    }

    // Search for municipality in the list
    // Try multiple field names as API format may vary
    const municipality = supportedCities.find(city => {
      const cityCode = (city.codigo_ibge || city.codigo_municipio || city.ibge || city.codigo || '').toString();
      return cityCode === cleanCodigo;
    });

    if (municipality) {
      return {
        supported: true,
        message: `Município suportado para emissão de NFS-e.`,
        checkedAt: new Date(),
        data: {
          codigo: cleanCodigo,
          nome: municipality.nome || municipality.cidade || municipality.municipio || 'N/A',
          uf: municipality.uf || municipality.estado || 'N/A',
          provedor: municipality.provedor || municipality.provider || null,
          ambiente: municipality.ambiente || null
        }
      };
    }

    // Municipality not in the supported list
    return {
      supported: false,
      message: `O município com código IBGE ${cleanCodigo} não está na lista de municípios suportados pela Nuvem Fiscal para emissão de NFS-e. Verifique se o código está correto.`,
      checkedAt: new Date(),
      hint: 'Consulte o código IBGE correto em: https://www.ibge.gov.br/explica/codigos-dos-municipios.php'
    };
  } catch (error) {
    console.error('[Municipality] Error checking support:', error);
    return {
      supported: null,
      message: `Erro ao verificar suporte do município: ${error.message}`,
      checkedAt: new Date(),
      error: error.message
    };
  }
}

/**
 * Check municipality availability (is the system online?)
 * 
 * @param {string} codigoMunicipio - IBGE municipality code
 * @returns {Promise<object>} Availability status
 */
export async function checkMunicipalityAvailability(codigoMunicipio) {
  try {
    const cleanCodigo = (codigoMunicipio || '').replace(/\D/g, '');
    
    if (!isNuvemFiscalConfigured()) {
      return {
        available: null,
        message: 'Nuvem Fiscal não configurada',
        checkedAt: new Date()
      };
    }

    // Try to check municipality status via Nuvem Fiscal
    // This endpoint may return status information about the municipality's system
    try {
      const response = await apiRequest(`/nfse/cidades/${cleanCodigo}/status`, {
        method: 'GET'
      });

      const isOnline = response.status === 'online' || 
                       response.disponivel === true ||
                       response.available === true;

      return {
        available: isOnline,
        message: isOnline 
          ? 'Sistema da prefeitura disponível' 
          : 'Sistema da prefeitura temporariamente indisponível',
        checkedAt: new Date(),
        data: response
      };
    } catch (statusError) {
      // Status endpoint may not exist - assume available
      if (statusError.status === 404) {
        return {
          available: true, // Assume available if endpoint doesn't exist
          message: 'Município suportado (status não verificado)',
          checkedAt: new Date()
        };
      }

      // Other errors might indicate the system is down
      if (statusError.status === 503 || statusError.status === 502) {
        return {
          available: false,
          message: 'Sistema da prefeitura temporariamente indisponível',
          checkedAt: new Date(),
          error: statusError.message
        };
      }

      return {
        available: null,
        message: `Não foi possível verificar disponibilidade: ${statusError.message}`,
        checkedAt: new Date()
      };
    }
  } catch (error) {
    console.error('[Municipality] Error checking availability:', error);
    return {
      available: null,
      message: `Erro ao verificar disponibilidade: ${error.message}`,
      checkedAt: new Date()
    };
  }
}

/**
 * Check and update municipality support status for a company
 * 
 * @param {string} companyId - Company ID
 * @returns {Promise<object>} Updated support status
 */
export async function checkAndUpdateMunicipalitySupport(companyId) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      codigoMunicipio: true,
      municipalitySupported: true
    }
  });

  if (!company) {
    throw new Error('Company not found');
  }

  if (!company.codigoMunicipio) {
    return {
      supported: false,
      message: 'Código do município não informado. Configure o código IBGE do município primeiro.',
      checkedAt: new Date()
    };
  }

  const supportStatus = await checkMunicipalitySupport(company.codigoMunicipio);

  // Update company with support status
  await prisma.company.update({
    where: { id: companyId },
    data: {
      municipalitySupported: supportStatus.supported,
      municipalitySupportCheckedAt: supportStatus.checkedAt
    }
  });

  return supportStatus;
}

/**
 * Validate municipality support before invoice issuance
 * More lenient approach: only block if explicitly not supported AND we're confident
 * 
 * @param {object} company - Company object with codigoMunicipio
 * @throws {Error} If municipality code is missing
 */
export async function validateMunicipalitySupport(company) {
  if (!company.codigoMunicipio) {
    throw new Error('Código do município (IBGE) não informado. Configure o município da empresa primeiro em "Minha Empresa".');
  }

  const cleanCodigo = (company.codigoMunicipio || '').replace(/\D/g, '');
  if (cleanCodigo.length !== 7) {
    throw new Error(`Código do município inválido: ${company.codigoMunicipio}. Deve ter exatamente 7 dígitos (código IBGE).`);
  }

  let supported = company.municipalitySupported;
  
  const shouldRecheck = 
    supported === null || 
    supported === undefined ||
    !company.municipalitySupportCheckedAt ||
    (new Date() - new Date(company.municipalitySupportCheckedAt)) > 7 * 24 * 60 * 60 * 1000;

  if (shouldRecheck) {
    try {
      const supportStatus = await checkMunicipalitySupport(company.codigoMunicipio);
      supported = supportStatus.supported;
      
      await prisma.company.update({
        where: { id: company.id },
        data: {
          municipalitySupported: supported,
          municipalitySupportCheckedAt: supportStatus.checkedAt
        }
      });
    } catch (error) {
      console.warn(`[Municipality] Error checking support for ${company.codigoMunicipio}:`, error.message);
      supported = null;
    }
  }

  if (supported === false) {
    console.warn(`[Municipality] ${company.codigoMunicipio} marked as unsupported, but proceeding to let Nuvem Fiscal decide.`);
  }

  if (supported === null || supported === undefined) {
    console.warn(`[Municipality] Support status unknown for ${company.codigoMunicipio}. Proceeding with issuance.`);
  }

  return true;
}

/**
 * Get municipality support status for a company
 * 
 * @param {string} companyId - Company ID
 * @returns {Promise<object>} Support status
 */
export async function getMunicipalitySupportStatus(companyId) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      codigoMunicipio: true,
      municipalitySupported: true,
      municipalitySupportCheckedAt: true,
      cidade: true,
      uf: true
    }
  });

  if (!company) {
    throw new Error('Company not found');
  }

  if (!company.codigoMunicipio) {
    return {
      supported: false,
      message: 'Código do município não informado',
      checkedAt: null,
      codigoMunicipio: null
    };
  }

  return {
    supported: company.municipalitySupported,
    checkedAt: company.municipalitySupportCheckedAt,
    codigoMunicipio: company.codigoMunicipio,
    cidade: company.cidade,
    uf: company.uf,
    needsCheck: company.municipalitySupported === null || 
                company.municipalitySupported === undefined ||
                !company.municipalitySupportCheckedAt
  };
}
