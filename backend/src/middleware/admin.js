/**
 * Admin Middleware
 * Verifies that the authenticated user has admin privileges
 */

import { prisma } from '../index.js';
import { AppError } from './errorHandler.js';

/**
 * Middleware to require admin access
 * Must be used after authenticate middleware
 */
export const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Não autenticado', 401, 'UNAUTHORIZED');
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { isAdmin: true }
    });

    if (!user || !user.isAdmin) {
      throw new AppError('Acesso negado. Privilégios de administrador necessários.', 403, 'FORBIDDEN');
    }

    next();
  } catch (error) {
    next(error);
  }
};

export default { requireAdmin };
