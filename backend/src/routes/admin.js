/**
 * Admin Routes
 * Platform administration endpoints
 */

import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { sendSuccess, sendError } from '../utils/response.js';
import bcrypt from 'bcryptjs';

const router = express.Router();

// All admin routes require authentication and admin privileges
router.use(authenticate);
router.use(requireAdmin);

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 'Validation failed', 400, errors.array());
  }
  next();
};

// ==========================================
// DASHBOARD STATISTICS
// ==========================================

/**
 * GET /api/admin/stats
 * Get platform statistics for dashboard
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  // Get counts
  const [
    totalUsers,
    newUsersThisMonth,
    newUsersLastMonth,
    totalCompanies,
    totalSubscriptions,
    activeSubscriptions,
    totalInvoices,
    invoicesThisMonth,
    totalRevenue,
    revenueThisMonth
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.user.count({ where: { createdAt: { gte: startOfLastMonth, lt: startOfMonth } } }),
    prisma.company.count(),
    prisma.subscription.count(),
    prisma.subscription.count({ where: { status: 'ativo' } }),
    prisma.invoice.count(),
    prisma.invoice.count({ where: { dataEmissao: { gte: startOfMonth } } }),
    prisma.payment.aggregate({ where: { status: 'paid' }, _sum: { amount: true } }),
    prisma.payment.aggregate({ 
      where: { status: 'paid', paidAt: { gte: startOfMonth } }, 
      _sum: { amount: true } 
    })
  ]);

  // Calculate growth percentages
  const userGrowth = newUsersLastMonth > 0 
    ? ((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth * 100).toFixed(1)
    : newUsersThisMonth > 0 ? 100 : 0;

  // Get recent activity
  const recentUsers = await prisma.user.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      isAdmin: true
    }
  });

  const recentInvoices = await prisma.invoice.findMany({
    take: 5,
    orderBy: { dataEmissao: 'desc' },
    select: {
      id: true,
      numero: true,
      clienteNome: true,
      valor: true,
      status: true,
      dataEmissao: true
    }
  });

  // Get subscription breakdown
  const subscriptionBreakdown = await prisma.subscription.groupBy({
    by: ['status'],
    _count: { status: true }
  });

  sendSuccess(res, 'Statistics retrieved', {
    overview: {
      totalUsers,
      newUsersThisMonth,
      userGrowth: parseFloat(userGrowth),
      totalCompanies,
      totalSubscriptions,
      activeSubscriptions,
      totalInvoices,
      invoicesThisMonth,
      totalRevenue: totalRevenue._sum.amount || 0,
      revenueThisMonth: revenueThisMonth._sum.amount || 0
    },
    recentUsers,
    recentInvoices,
    subscriptionBreakdown: subscriptionBreakdown.reduce((acc, item) => {
      acc[item.status] = item._count.status;
      return acc;
    }, {})
  });
}));

/**
 * GET /api/admin/stats/chart
 * Get chart data for revenue and users over time
 */
router.get('/stats/chart', asyncHandler(async (req, res) => {
  const months = 6;
  const now = new Date();
  const chartData = [];

  for (let i = months - 1; i >= 0; i--) {
    const startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

    const [users, revenue, invoices] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: startDate, lte: endDate } } }),
      prisma.payment.aggregate({
        where: { status: 'paid', paidAt: { gte: startDate, lte: endDate } },
        _sum: { amount: true }
      }),
      prisma.invoice.count({ where: { dataEmissao: { gte: startDate, lte: endDate } } })
    ]);

    chartData.push({
      month: startDate.toLocaleDateString('pt-BR', { month: 'short' }),
      year: startDate.getFullYear(),
      users,
      revenue: revenue._sum.amount || 0,
      invoices
    });
  }

  sendSuccess(res, 'Chart data retrieved', { chartData });
}));

// ==========================================
// USER MANAGEMENT
// ==========================================

/**
 * GET /api/admin/users
 * List all users with pagination and filters
 */
router.get('/users', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().trim(),
  query('status').optional().isIn(['all', 'active', 'pending', 'blocked'])
], validateRequest, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  const search = req.query.search || '';

  const where = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } }
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true,
        subscription: {
          select: {
            status: true,
            planId: true,
            currentPeriodEnd: true
          }
        },
        _count: {
          select: {
            companies: true,
            notifications: true
          }
        }
      }
    }),
    prisma.user.count({ where })
  ]);

  sendSuccess(res, 'Users retrieved', {
    users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}));

/**
 * GET /api/admin/users/:id
 * Get user details
 */
router.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: {
      subscription: true,
      companies: {
        select: {
          id: true,
          razaoSocial: true,
          nomeFantasia: true,
          cnpj: true,
          regimeTributario: true,
          createdAt: true
        }
      },
      _count: {
        select: {
          notifications: true,
          conversationMessages: true
        }
      }
    }
  });

  if (!user) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }

  // Remove sensitive data
  const { passwordHash, ...safeUser } = user;

  sendSuccess(res, 'User retrieved', { user: safeUser });
}));

/**
 * PUT /api/admin/users/:id
 * Update user details
 */
router.put('/users/:id', [
  body('name').optional().trim().notEmpty(),
  body('email').optional().isEmail(),
  body('isAdmin').optional().isBoolean()
], validateRequest, asyncHandler(async (req, res) => {
  const { name, email, isAdmin } = req.body;

  const existing = await prisma.user.findUnique({
    where: { id: req.params.id }
  });

  if (!existing) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }

  // Check email uniqueness if changing
  if (email && email !== existing.email) {
    const emailExists = await prisma.user.findUnique({ where: { email } });
    if (emailExists) {
      throw new AppError('Email already in use', 409, 'EMAIL_EXISTS');
    }
  }

  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (email !== undefined) updateData.email = email;
  if (isAdmin !== undefined) updateData.isAdmin = isAdmin;

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      isAdmin: true,
      updatedAt: true
    }
  });

  sendSuccess(res, 'User updated', { user });
}));

/**
 * DELETE /api/admin/users/:id
 * Delete a user
 */
router.delete('/users/:id', asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id }
  });

  if (!user) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }

  // Prevent deleting yourself
  if (user.id === req.user.id) {
    throw new AppError('Cannot delete your own account', 400, 'SELF_DELETE');
  }

  await prisma.user.delete({
    where: { id: req.params.id }
  });

  sendSuccess(res, 'User deleted');
}));

/**
 * POST /api/admin/users/:id/reset-password
 * Reset user password
 */
router.post('/users/:id/reset-password', [
  body('newPassword').isLength({ min: 6 })
], validateRequest, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id }
  });

  if (!user) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }

  const passwordHash = await bcrypt.hash(req.body.newPassword, 12);

  await prisma.user.update({
    where: { id: req.params.id },
    data: { passwordHash }
  });

  // Invalidate all refresh tokens for this user
  await prisma.refreshToken.deleteMany({
    where: { userId: req.params.id }
  });

  sendSuccess(res, 'Password reset successfully');
}));

// ==========================================
// SUBSCRIPTION MANAGEMENT
// ==========================================

/**
 * GET /api/admin/subscriptions
 * List all subscriptions
 */
router.get('/subscriptions', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional()
], validateRequest, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  const status = req.query.status;

  const where = {};
  if (status && status !== 'all') {
    where.status = status;
  }

  const [subscriptions, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        payments: {
          take: 3,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            amount: true,
            status: true,
            paidAt: true
          }
        }
      }
    }),
    prisma.subscription.count({ where })
  ]);

  sendSuccess(res, 'Subscriptions retrieved', {
    subscriptions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}));

/**
 * PUT /api/admin/subscriptions/:id
 * Update subscription status
 */
router.put('/subscriptions/:id', [
  body('status').isIn(['ativo', 'pending', 'inadimplente', 'cancelado'])
], validateRequest, asyncHandler(async (req, res) => {
  const subscription = await prisma.subscription.findUnique({
    where: { id: req.params.id }
  });

  if (!subscription) {
    throw new AppError('Subscription not found', 404, 'NOT_FOUND');
  }

  const updated = await prisma.subscription.update({
    where: { id: req.params.id },
    data: { status: req.body.status },
    include: {
      user: {
        select: { name: true, email: true }
      }
    }
  });

  sendSuccess(res, 'Subscription updated', { subscription: updated });
}));

// ==========================================
// COMPANY MANAGEMENT
// ==========================================

/**
 * GET /api/admin/companies
 * List all companies
 */
router.get('/companies', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().trim()
], validateRequest, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  const search = req.query.search || '';

  const where = {};
  if (search) {
    where.OR = [
      { razaoSocial: { contains: search, mode: 'insensitive' } },
      { nomeFantasia: { contains: search, mode: 'insensitive' } },
      { cnpj: { contains: search } }
    ];
  }

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        fiscalIntegrationStatus: {
          select: {
            status: true,
            ultimaVerificacao: true
          }
        },
        _count: {
          select: {
            invoices: true
          }
        }
      }
    }),
    prisma.company.count({ where })
  ]);

  sendSuccess(res, 'Companies retrieved', {
    companies,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}));

// ==========================================
// INVOICE MANAGEMENT
// ==========================================

/**
 * GET /api/admin/invoices
 * List all invoices
 */
router.get('/invoices', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional()
], validateRequest, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  const status = req.query.status;

  const where = {};
  if (status && status !== 'all') {
    where.status = status;
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip,
      take: limit,
      orderBy: { dataEmissao: 'desc' },
      include: {
        company: {
          select: {
            id: true,
            razaoSocial: true,
            nomeFantasia: true,
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        }
      }
    }),
    prisma.invoice.count({ where })
  ]);

  sendSuccess(res, 'Invoices retrieved', {
    invoices,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}));

// ==========================================
// SYSTEM SETTINGS
// ==========================================

/**
 * GET /api/admin/settings
 * Get system settings
 */
router.get('/settings', asyncHandler(async (req, res) => {
  // Return environment info (sanitized)
  const settings = {
    environment: process.env.NODE_ENV || 'development',
    nuvemFiscalConfigured: !!(process.env.NUVEM_FISCAL_CLIENT_ID && process.env.NUVEM_FISCAL_CLIENT_SECRET),
    nuvemFiscalEnvironment: process.env.NUVEM_FISCAL_ENVIRONMENT || 'sandbox',
    stripeConfigured: !!(process.env.STRIPE_SECRET_KEY),
    emailConfigured: process.env.EMAIL_ENABLED === 'true',
    version: '1.0.0'
  };

  sendSuccess(res, 'Settings retrieved', { settings });
}));

export default router;
