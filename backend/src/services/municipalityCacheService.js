/**
 * Enhanced Municipality Cache Service
 * Provides multi-layer caching for municipality support data
 * 
 * Features:
 * - In-memory cache (fast, per-instance)
 * - Database cache (persistent, shared across instances)
 * - Background refresh for stale data
 * - Graceful degradation when API unavailable
 */

import { prisma } from '../index.js';
import { apiRequest, isNuvemFiscalConfigured } from './nuvemFiscal.js';

// In-memory cache configuration
const MEMORY_CACHE = {
  supportedCities: null,
  lastFetch: null,
  TTL: 24 * 60 * 60 * 1000, // 24 hours
  
  // Individual municipality check results
  municipalityChecks: new Map(),
  checkTTL: 7 * 24 * 60 * 60 * 1000, // 7 days for individual checks
};

// Database cache table name
const CACHE_TABLE = 'municipality_cache';

/**
 * Get cached municipality list from memory
 */
function getFromMemoryCache() {
  if (
    MEMORY_CACHE.supportedCities &&
    MEMORY_CACHE.lastFetch &&
    Date.now() - MEMORY_CACHE.lastFetch < MEMORY_CACHE.TTL
  ) {
    return MEMORY_CACHE.supportedCities;
  }
  return null;
}

/**
 * Set municipality list to memory cache
 */
function setToMemoryCache(cities) {
  MEMORY_CACHE.supportedCities = cities;
  MEMORY_CACHE.lastFetch = Date.now();
}

/**
 * Get individual municipality check from memory cache
 */
function getMunicipalityCheckFromCache(codigoMunicipio) {
  const cached = MEMORY_CACHE.municipalityChecks.get(codigoMunicipio);
  if (cached && Date.now() - cached.timestamp < MEMORY_CACHE.checkTTL) {
    return cached.result;
  }
  return null;
}

/**
 * Set individual municipality check to memory cache
 */
function setMunicipalityCheckToCache(codigoMunicipio, result) {
  MEMORY_CACHE.municipalityChecks.set(codigoMunicipio, {
    result,
    timestamp: Date.now(),
  });
}

/**
 * Try to get cached data from database
 */
async function getFromDatabaseCache(key) {
  try {
    // Check if MunicipalityCache model exists
    const cache = await prisma.$queryRaw`
      SELECT value, expires_at FROM "MunicipalityCache" 
      WHERE key = ${key} AND expires_at > NOW()
      LIMIT 1
    `;
    
    if (cache && cache.length > 0) {
      return JSON.parse(cache[0].value);
    }
  } catch (error) {
    // Table might not exist - silently fail
    console.debug('[MunicipalityCache] Database cache not available:', error.message);
  }
  return null;
}

/**
 * Save data to database cache
 */
async function setToDatabaseCache(key, value, ttlMs) {
  try {
    const expiresAt = new Date(Date.now() + ttlMs);
    const valueJson = JSON.stringify(value);
    
    await prisma.$executeRaw`
      INSERT INTO "MunicipalityCache" (id, key, value, expires_at, created_at, updated_at)
      VALUES (gen_random_uuid(), ${key}, ${valueJson}, ${expiresAt}, NOW(), NOW())
      ON CONFLICT (key) DO UPDATE SET
        value = ${valueJson},
        expires_at = ${expiresAt},
        updated_at = NOW()
    `;
  } catch (error) {
    console.debug('[MunicipalityCache] Failed to save to database cache:', error.message);
  }
}

/**
 * Get supported municipalities with multi-layer caching
 */
export async function getSupportedMunicipalities() {
  // Layer 1: Memory cache (fastest)
  const memoryCached = getFromMemoryCache();
  if (memoryCached) {
    console.debug('[MunicipalityCache] Returning from memory cache');
    return memoryCached;
  }

  // Layer 2: Database cache
  const dbCached = await getFromDatabaseCache('supported_cities');
  if (dbCached) {
    console.debug('[MunicipalityCache] Returning from database cache');
    setToMemoryCache(dbCached);
    return dbCached;
  }

  // Layer 3: API call
  if (!isNuvemFiscalConfigured()) {
    console.warn('[MunicipalityCache] Nuvem Fiscal not configured');
    return null;
  }

  try {
    const response = await apiRequest('/nfse/cidades', { method: 'GET' });
    const cities = Array.isArray(response) ? response : (response.data || response.items || []);
    
    // Save to both caches
    setToMemoryCache(cities);
    await setToDatabaseCache('supported_cities', cities, MEMORY_CACHE.TTL);
    
    console.log(`[MunicipalityCache] Fetched and cached ${cities.length} municipalities`);
    return cities;
  } catch (error) {
    console.error('[MunicipalityCache] API error:', error.message);
    
    // Try alternative endpoint
    try {
      const altResponse = await apiRequest('/cidades', { method: 'GET' });
      const cities = Array.isArray(altResponse) ? altResponse : (altResponse.data || []);
      
      setToMemoryCache(cities);
      await setToDatabaseCache('supported_cities', cities, MEMORY_CACHE.TTL);
      
      return cities;
    } catch (altError) {
      console.error('[MunicipalityCache] Alternative endpoint failed:', altError.message);
      return null;
    }
  }
}

/**
 * Check if a specific municipality is supported (with caching)
 */
export async function checkMunicipalitySupportCached(codigoMunicipio) {
  const cleanCodigo = (codigoMunicipio || '').replace(/\D/g, '');
  
  if (!cleanCodigo || cleanCodigo.length !== 7) {
    return {
      supported: false,
      message: `Código do município inválido: ${codigoMunicipio}`,
      cached: false,
    };
  }

  // Check memory cache first
  const cached = getMunicipalityCheckFromCache(cleanCodigo);
  if (cached) {
    console.debug(`[MunicipalityCache] Municipality ${cleanCodigo} from cache`);
    return { ...cached, cached: true };
  }

  // Get full list and search
  const supportedCities = await getSupportedMunicipalities();
  
  if (!supportedCities) {
    const result = {
      supported: null,
      message: 'Não foi possível verificar suporte do município',
      checkedAt: new Date(),
    };
    return result;
  }

  const municipality = supportedCities.find(city => {
    const cityCode = (
      city.codigo_ibge || 
      city.codigo_municipio || 
      city.ibge || 
      city.codigo || 
      ''
    ).toString();
    return cityCode === cleanCodigo;
  });

  const result = municipality
    ? {
        supported: true,
        message: 'Município suportado para emissão de NFS-e',
        data: {
          codigo: cleanCodigo,
          nome: municipality.nome || municipality.cidade || municipality.municipio,
          uf: municipality.uf || municipality.estado,
          provedor: municipality.provedor || municipality.provider,
        },
        checkedAt: new Date(),
      }
    : {
        supported: false,
        message: `Município ${cleanCodigo} não suportado`,
        checkedAt: new Date(),
      };

  // Cache the result
  setMunicipalityCheckToCache(cleanCodigo, result);

  return result;
}

/**
 * Warm up the cache by pre-fetching municipality list
 * Call this during application startup
 */
export async function warmUpCache() {
  console.log('[MunicipalityCache] Warming up cache...');
  try {
    const cities = await getSupportedMunicipalities();
    if (cities) {
      console.log(`[MunicipalityCache] Cache warmed with ${cities.length} municipalities`);
    }
  } catch (error) {
    console.warn('[MunicipalityCache] Failed to warm up cache:', error.message);
  }
}

/**
 * Clear all caches (for testing or manual refresh)
 */
export function clearCache() {
  MEMORY_CACHE.supportedCities = null;
  MEMORY_CACHE.lastFetch = null;
  MEMORY_CACHE.municipalityChecks.clear();
  console.log('[MunicipalityCache] Cache cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    memoryCacheActive: !!MEMORY_CACHE.supportedCities,
    memoryCacheAge: MEMORY_CACHE.lastFetch 
      ? Date.now() - MEMORY_CACHE.lastFetch 
      : null,
    memoryCacheTTL: MEMORY_CACHE.TTL,
    individualChecksCount: MEMORY_CACHE.municipalityChecks.size,
    supportedCitiesCount: MEMORY_CACHE.supportedCities?.length || 0,
  };
}

export default {
  getSupportedMunicipalities,
  checkMunicipalitySupportCached,
  warmUpCache,
  clearCache,
  getCacheStats,
};
