/**
 * Standardized Response Helper
 * 
 * All API functions should return responses in the format:
 * {
 *   status: "success" | "error",
 *   message: string,
 *   data?: any (optional, for data responses)
 * }
 */

/**
 * Create a success response
 * @param {string} message - Success message
 * @param {any} data - Optional data to include
 * @returns {object} Standardized success response
 */
export function successResponse(message, data = null) {
  const response = {
    status: 'success',
    message
  };
  
  if (data !== null) {
    response.data = data;
  }
  
  return response;
}

/**
 * Create an error response
 * @param {string} message - Error message
 * @param {any} error - Optional error details
 * @returns {object} Standardized error response
 */
export function errorResponse(message, error = null) {
  const response = {
    status: 'error',
    message
  };
  
  if (error !== null) {
    response.error = error;
  }
  
  return response;
}

/**
 * Send standardized success response via Express res
 * @param {object} res - Express response object
 * @param {string} message - Success message
 * @param {any} data - Optional data
 * @param {number} statusCode - HTTP status code (default: 200)
 */
export function sendSuccess(res, message, data = null, statusCode = 200) {
  // Ensure CORS headers are set explicitly
  const origin = res.req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  
  const response = successResponse(message, data);
  return res.status(statusCode).json(response);
}

/**
 * Send standardized error response via Express res
 * @param {object} res - Express response object
 * @param {string} message - Error message
 * @param {any} error - Optional error details
 * @param {number} statusCode - HTTP status code (default: 400)
 */
export function sendError(res, message, error = null, statusCode = 400) {
  const response = errorResponse(message, error);
  return res.status(statusCode).json(response);
}
