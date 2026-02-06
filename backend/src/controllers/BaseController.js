/**
 * Base Controller
 * Provides common controller functionality
 */

import { HTTP_STATUS } from '../constants/index.js';
import { sendSuccess, sendError } from '../utils/response.js';

export class BaseController {
  /**
   * Send success response
   */
  static success(res, message, data = null, statusCode = HTTP_STATUS.OK) {
    return sendSuccess(res, message, data, statusCode);
  }

  /**
   * Send error response
   */
  static error(res, message, statusCode = HTTP_STATUS.BAD_REQUEST, errorCode = null) {
    return sendError(res, message, statusCode, errorCode);
  }

  /**
   * Send created response
   */
  static created(res, message, data = null) {
    return sendSuccess(res, message, data, HTTP_STATUS.CREATED);
  }

  /**
   * Send no content response
   */
  static noContent(res) {
    return res.status(HTTP_STATUS.NO_CONTENT).send();
  }

  /**
   * Handle pagination
   */
  static paginate(data, page, limit, total) {
    return {
      data,
      pagination: {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        total,
        totalPages: Math.ceil(total / (parseInt(limit) || 20)),
      },
    };
  }
}
