/**
 * Timeout Configuration Utility
 * 
 * Centralized timeout configuration for external API calls
 */

// Timeout constants (in milliseconds)
export const TIMEOUTS = {
  NUVEM_FISCAL: 30000,      // 30 seconds
  OPENAI: 60000,            // 60 seconds (GPT can take longer)
  STRIPE: 30000,            // 30 seconds
  DEFAULT: 30000            // 30 seconds default
};

/**
 * Create a fetch request with timeout
 * @param {string} url - Request URL
 * @param {object} options - Fetch options
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<Response>} Fetch response
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = TIMEOUTS.DEFAULT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      const timeoutError = new Error(`Timeout: A requisição demorou mais de ${timeoutMs / 1000} segundos`);
      timeoutError.name = 'TimeoutError';
      timeoutError.status = 408;
      throw timeoutError;
    }
    
    throw error;
  }
}

/**
 * Get timeout for a specific service
 * @param {string} service - Service name ('nuvem_fiscal', 'openai', 'stripe')
 * @returns {number} Timeout in milliseconds
 */
export function getTimeout(service) {
  const serviceTimeouts = {
    'nuvem_fiscal': TIMEOUTS.NUVEM_FISCAL,
    'openai': TIMEOUTS.OPENAI,
    'stripe': TIMEOUTS.STRIPE
  };

  return serviceTimeouts[service.toLowerCase()] || TIMEOUTS.DEFAULT;
}
