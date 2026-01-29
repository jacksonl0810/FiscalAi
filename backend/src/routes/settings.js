import express from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/settings
 * Get current user settings
 */
router.get('/', asyncHandler(async (req, res) => {
  let settings = await prisma.userSettings.findUnique({
    where: { userId: req.user.id }
  });

  // Create default settings if not exists
  if (!settings) {
    settings = await prisma.userSettings.create({
      data: { userId: req.user.id }
    });
  }

  res.json({
    id: settings.id,
    user_id: settings.userId,
    theme: settings.theme,
    font_size: settings.fontSize,
    active_company_id: settings.activeCompanyId,
    created_at: settings.createdAt,
    updated_at: settings.updatedAt
  });
}));

/**
 * PUT /api/settings
 * Create or update user settings (full update)
 */
router.put('/', [
  body('theme').optional().isIn(['dark', 'light']).withMessage('Theme must be dark or light'),
  body('font_size').optional().isIn(['small', 'medium', 'large']).withMessage('Invalid font size')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ status: 'error', message: 'Validation failed', errors: errors.array() });
  }

  const { theme, font_size, active_company_id } = req.body;

  // Verify company ownership if active_company_id is provided
  if (active_company_id) {
    const company = await prisma.company.findFirst({
      where: { id: active_company_id, userId: req.user.id }
    });
    if (!company) {
      throw new AppError('Company not found', 404, 'NOT_FOUND');
    }
  }

  const settings = await prisma.userSettings.upsert({
    where: { userId: req.user.id },
    update: {
      theme: theme || 'dark',
      fontSize: font_size || 'medium',
      activeCompanyId: active_company_id || null
    },
    create: {
      userId: req.user.id,
      theme: theme || 'dark',
      fontSize: font_size || 'medium',
      activeCompanyId: active_company_id || null
    }
  });

  res.json({
    id: settings.id,
    user_id: settings.userId,
    theme: settings.theme,
    font_size: settings.fontSize,
    active_company_id: settings.activeCompanyId,
    created_at: settings.createdAt,
    updated_at: settings.updatedAt
  });
}));

/**
 * PATCH /api/settings
 * Partial update of user settings
 */
router.patch('/', [
  body('theme').optional().isIn(['dark', 'light']).withMessage('Theme must be dark or light'),
  body('font_size').optional().isIn(['small', 'medium', 'large']).withMessage('Invalid font size')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ status: 'error', message: 'Validation failed', errors: errors.array() });
  }

  const { theme, font_size, active_company_id } = req.body;
  const updateData = {};

  if (theme !== undefined) updateData.theme = theme;
  if (font_size !== undefined) updateData.fontSize = font_size;
  if (active_company_id !== undefined) {
    // Verify company ownership
    if (active_company_id) {
      const company = await prisma.company.findFirst({
        where: { id: active_company_id, userId: req.user.id }
      });
      if (!company) {
        throw new AppError('Company not found', 404, 'NOT_FOUND');
      }
    }
    updateData.activeCompanyId = active_company_id || null;
  }

  // Ensure settings exist
  let settings = await prisma.userSettings.findUnique({
    where: { userId: req.user.id }
  });

  if (!settings) {
    settings = await prisma.userSettings.create({
      data: {
        userId: req.user.id,
        ...updateData
      }
    });
  } else {
    settings = await prisma.userSettings.update({
      where: { userId: req.user.id },
      data: updateData
    });
  }

  res.json({
    id: settings.id,
    user_id: settings.userId,
    theme: settings.theme,
    font_size: settings.fontSize,
    active_company_id: settings.activeCompanyId,
    created_at: settings.createdAt,
    updated_at: settings.updatedAt
  });
}));

export default router;
