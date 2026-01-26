import express from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../index.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { sendSuccess } from '../utils/response.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/notifications
 * List all notifications for the current user
 */
router.get('/', asyncHandler(async (req, res) => {
  const { sort = '-created_at', unread } = req.query;

  const where = { userId: req.user.id };
  if (unread === 'true') {
    where.lida = false;
  }

  const orderBy = {};
  if (sort.startsWith('-')) {
    const field = sort.substring(1);
    orderBy[field === 'created_at' ? 'createdAt' : field] = 'desc';
  } else {
    orderBy[sort === 'created_at' ? 'createdAt' : sort] = 'asc';
  }

  const notifications = await prisma.notification.findMany({
    where,
    orderBy
  });

  // Map to frontend format
  const result = notifications.map(n => ({
    id: n.id,
    user_id: n.userId,
    titulo: n.titulo,
    mensagem: n.mensagem,
    tipo: n.tipo,
    lida: n.lida,
    invoice_id: n.invoiceId,
    created_at: n.createdAt
  }));

  res.json(result);
}));

/**
 * GET /api/notifications/unread-count
 * Get count of unread notifications
 */
router.get('/unread-count', asyncHandler(async (req, res) => {
  const count = await prisma.notification.count({
    where: {
      userId: req.user.id,
      lida: false
    }
  });

  res.json({ count });
}));

/**
 * GET /api/notifications/:id
 * Get a single notification
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const notification = await prisma.notification.findFirst({
    where: {
      id: req.params.id,
      userId: req.user.id
    }
  });

  if (!notification) {
    throw new AppError('Notification not found', 404, 'NOT_FOUND');
  }

  res.json({
    id: notification.id,
    user_id: notification.userId,
    titulo: notification.titulo,
    mensagem: notification.mensagem,
    tipo: notification.tipo,
    lida: notification.lida,
    invoice_id: notification.invoiceId,
    created_at: notification.createdAt
  });
}));

/**
 * POST /api/notifications
 * Create a new notification
 */
router.post('/', [
  body('titulo').notEmpty().withMessage('Title is required'),
  body('mensagem').notEmpty().withMessage('Message is required'),
  body('tipo').isIn(['sucesso', 'erro', 'alerta', 'info']).withMessage('Invalid notification type')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ status: 'error', message: 'Validation failed', errors: errors.array() });
  }

  const { titulo, mensagem, tipo, invoice_id } = req.body;

  const notification = await prisma.notification.create({
    data: {
      userId: req.user.id,
      titulo,
      mensagem,
      tipo,
      invoiceId: invoice_id
    }
  });

  res.status(201).json({
    id: notification.id,
    user_id: notification.userId,
    titulo: notification.titulo,
    mensagem: notification.mensagem,
    tipo: notification.tipo,
    lida: notification.lida,
    invoice_id: notification.invoiceId,
    created_at: notification.createdAt
  });
}));

/**
 * PUT /api/notifications/:id
 * Update a notification (mark as read)
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const existing = await prisma.notification.findFirst({
    where: {
      id: req.params.id,
      userId: req.user.id
    }
  });

  if (!existing) {
    throw new AppError('Notification not found', 404, 'NOT_FOUND');
  }

  const { lida } = req.body;

  const notification = await prisma.notification.update({
    where: { id: req.params.id },
    data: { lida: lida ?? true }
  });

  res.json({
    id: notification.id,
    user_id: notification.userId,
    titulo: notification.titulo,
    mensagem: notification.mensagem,
    tipo: notification.tipo,
    lida: notification.lida,
    invoice_id: notification.invoiceId,
    created_at: notification.createdAt
  });
}));

/**
 * POST /api/notifications/mark-all-read
 * Mark all notifications as read
 */
router.post('/mark-all-read', asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({
    where: {
      userId: req.user.id,
      lida: false
    },
    data: { lida: true }
  });

  sendSuccess(res, 'All notifications marked as read');
}));

/**
 * DELETE /api/notifications/delete-all
 * Delete all notifications for the current user
 * NOTE: This route must come before DELETE /:id to avoid route conflicts
 */
router.delete('/delete-all', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  console.log('[Notifications] Delete all request from user:', userId);
  
  try {
    // Count notifications before deletion for verification
    const countBefore = await prisma.notification.count({
      where: {
        userId: userId
      }
    });
    console.log('[Notifications] Notifications count before deletion:', countBefore);
    
    if (countBefore === 0) {
      return sendSuccess(res, 'No notifications to delete', { 
        deletedCount: 0,
        countBefore: 0,
        countAfter: 0
      });
    }
    
    // Delete all notifications for the user
    const deletedCount = await prisma.notification.deleteMany({
      where: {
        userId: userId
      }
    });

    console.log('[Notifications] Deleted count:', deletedCount.count);
    
    // Verify deletion by counting again
    const countAfter = await prisma.notification.count({
      where: {
        userId: userId
      }
    });
    console.log('[Notifications] Notifications count after deletion:', countAfter);

    if (deletedCount.count === 0 && countBefore > 0) {
      console.warn('[Notifications] Warning: No notifications were deleted despite countBefore > 0');
      throw new AppError('Failed to delete notifications', 500, 'DELETE_FAILED');
    }

    if (countAfter > 0) {
      console.warn('[Notifications] Warning: Some notifications may not have been deleted. countAfter:', countAfter);
    }

    sendSuccess(res, `All notifications deleted successfully`, { 
      deletedCount: deletedCount.count,
      countBefore,
      countAfter
    });
  } catch (error) {
    console.error('[Notifications] Error deleting all notifications:', error);
    throw error;
  }
}));

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const existing = await prisma.notification.findFirst({
    where: {
      id: req.params.id,
      userId: req.user.id
    }
  });

  if (!existing) {
    throw new AppError('Notification not found', 404, 'NOT_FOUND');
  }

  await prisma.notification.delete({ where: { id: req.params.id } });

  sendSuccess(res, 'Notification deleted successfully');
}));

export default router;
