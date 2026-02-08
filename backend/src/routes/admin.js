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
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    prisma.invoice.count(),
    prisma.invoice.count({ where: { dataEmissao: { gte: startOfMonth } } }),
    prisma.payment.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
    prisma.payment.aggregate({ 
      where: { status: 'PAID', paidAt: { gte: startOfMonth } }, 
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
        where: { status: 'PAID', paidAt: { gte: startDate, lte: endDate } },
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
  body('status').isIn(['ACTIVE', 'PENDING', 'PAST_DUE', 'CANCELED', 'EXPIRED'])
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

// ==========================================
// ACTIVITY LOGS
// ==========================================

/**
 * GET /api/admin/activity
 * Get recent activity logs
 */
router.get('/activity', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('type').optional().isIn(['all', 'users', 'subscriptions', 'invoices', 'companies'])
], validateRequest, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  const type = req.query.type || 'all';

  // Get recent activity based on type
  const activities = [];

  if (type === 'all' || type === 'users') {
    const recentUsers = await prisma.user.findMany({
      take: type === 'users' ? limit : 5,
      skip: type === 'users' ? skip : 0,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, createdAt: true }
    });
    activities.push(...recentUsers.map(u => ({
      type: 'user_created',
      entity: 'user',
      entityId: u.id,
      description: `Novo usuário: ${u.name || u.email}`,
      timestamp: u.createdAt,
      data: u
    })));
  }

  if (type === 'all' || type === 'subscriptions') {
    const recentSubs = await prisma.subscription.findMany({
      take: type === 'subscriptions' ? limit : 5,
      skip: type === 'subscriptions' ? skip : 0,
      orderBy: { updatedAt: 'desc' },
      include: { user: { select: { name: true, email: true } } }
    });
    activities.push(...recentSubs.map(s => ({
      type: 'subscription_updated',
      entity: 'subscription',
      entityId: s.id,
      description: `Assinatura ${s.status}: ${s.user?.name || s.user?.email}`,
      timestamp: s.updatedAt,
      data: s
    })));
  }

  if (type === 'all' || type === 'invoices') {
    const recentInvoices = await prisma.invoice.findMany({
      take: type === 'invoices' ? limit : 5,
      skip: type === 'invoices' ? skip : 0,
      orderBy: { dataEmissao: 'desc' },
      include: { company: { select: { razaoSocial: true, nomeFantasia: true } } }
    });
    activities.push(...recentInvoices.map(i => ({
      type: 'invoice_created',
      entity: 'invoice',
      entityId: i.id,
      description: `Nota #${i.numero || 'N/A'}: R$ ${parseFloat(i.valor || 0).toFixed(2)}`,
      timestamp: i.dataEmissao,
      data: i
    })));
  }

  if (type === 'all' || type === 'companies') {
    const recentCompanies = await prisma.company.findMany({
      take: type === 'companies' ? limit : 5,
      skip: type === 'companies' ? skip : 0,
      orderBy: { createdAt: 'desc' },
      select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true, createdAt: true }
    });
    activities.push(...recentCompanies.map(c => ({
      type: 'company_created',
      entity: 'company',
      entityId: c.id,
      description: `Nova empresa: ${c.razaoSocial || c.nomeFantasia}`,
      timestamp: c.createdAt,
      data: c
    })));
  }

  // Sort by timestamp
  activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  sendSuccess(res, 'Activity retrieved', {
    activities: activities.slice(0, limit),
    pagination: { page, limit }
  });
}));

// ==========================================
// PLAN MANAGEMENT
// ==========================================

/**
 * PUT /api/admin/subscriptions/:id/plan
 * Change subscription plan
 */
router.put('/subscriptions/:id/plan', [
  body('planId').isIn(['pay_per_use', 'essential', 'professional', 'accountant']),
  body('billingCycle').optional().isIn(['monthly', 'annual'])
], validateRequest, asyncHandler(async (req, res) => {
  const { planId, billingCycle } = req.body;

  const subscription = await prisma.subscription.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { name: true, email: true } } }
  });

  if (!subscription) {
    throw new AppError('Subscription not found', 404, 'NOT_FOUND');
  }

  const updated = await prisma.subscription.update({
    where: { id: req.params.id },
    data: {
      planId,
      billingCycle: billingCycle || subscription.billingCycle,
      updatedAt: new Date()
    },
    include: { user: { select: { name: true, email: true } } }
  });

  sendSuccess(res, 'Plan updated', { subscription: updated });
}));

/**
 * POST /api/admin/subscriptions/:id/extend
 * Extend subscription period
 */
router.post('/subscriptions/:id/extend', [
  body('days').isInt({ min: 1, max: 365 })
], validateRequest, asyncHandler(async (req, res) => {
  const { days } = req.body;

  const subscription = await prisma.subscription.findUnique({
    where: { id: req.params.id }
  });

  if (!subscription) {
    throw new AppError('Subscription not found', 404, 'NOT_FOUND');
  }

  const currentEnd = subscription.currentPeriodEnd || new Date();
  const newEnd = new Date(currentEnd);
  newEnd.setDate(newEnd.getDate() + days);

  const updated = await prisma.subscription.update({
    where: { id: req.params.id },
    data: {
      currentPeriodEnd: newEnd,
      status: 'ACTIVE'
    },
    include: { user: { select: { name: true, email: true } } }
  });

  sendSuccess(res, `Subscription extended by ${days} days`, { subscription: updated });
}));

// ==========================================
// BULK ACTIONS
// ==========================================

/**
 * POST /api/admin/users/bulk-action
 * Perform bulk action on users
 */
router.post('/users/bulk-action', [
  body('userIds').isArray({ min: 1 }),
  body('action').isIn(['delete', 'make_admin', 'remove_admin'])
], validateRequest, asyncHandler(async (req, res) => {
  const { userIds, action } = req.body;

  // Filter out current admin from deletion
  const filteredIds = userIds.filter(id => id !== req.user.id);

  let result;
  switch (action) {
    case 'delete':
      result = await prisma.user.deleteMany({
        where: { id: { in: filteredIds } }
      });
      break;
    case 'make_admin':
      result = await prisma.user.updateMany({
        where: { id: { in: filteredIds } },
        data: { isAdmin: true }
      });
      break;
    case 'remove_admin':
      result = await prisma.user.updateMany({
        where: { id: { in: filteredIds } },
        data: { isAdmin: false }
      });
      break;
  }

  sendSuccess(res, `Bulk action completed: ${result.count} users affected`);
}));

/**
 * POST /api/admin/subscriptions/bulk-action
 * Perform bulk action on subscriptions
 */
router.post('/subscriptions/bulk-action', [
  body('subscriptionIds').isArray({ min: 1 }),
  body('action').isIn(['activate', 'cancel', 'suspend'])
], validateRequest, asyncHandler(async (req, res) => {
  const { subscriptionIds, action } = req.body;

  const statusMap = {
    activate: 'ACTIVE',
    cancel: 'CANCELED',
    suspend: 'PAST_DUE'
  };

  const result = await prisma.subscription.updateMany({
    where: { id: { in: subscriptionIds } },
    data: { status: statusMap[action] }
  });

  sendSuccess(res, `Bulk action completed: ${result.count} subscriptions affected`);
}));

// ==========================================
// EXPORT DATA
// ==========================================

/**
 * GET /api/admin/export/users
 * Export users data as JSON
 */
router.get('/export/users', asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      isAdmin: true,
      createdAt: true,
      subscription: {
        select: { planId: true, status: true }
      },
      _count: { select: { companies: true } }
    }
  });

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=users-export-${new Date().toISOString().split('T')[0]}.json`);
  res.send(JSON.stringify(users, null, 2));
}));

/**
 * GET /api/admin/export/subscriptions
 * Export subscriptions data as JSON
 */
router.get('/export/subscriptions', asyncHandler(async (req, res) => {
  const subscriptions = await prisma.subscription.findMany({
    include: {
      user: { select: { name: true, email: true } }
    }
  });

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=subscriptions-export-${new Date().toISOString().split('T')[0]}.json`);
  res.send(JSON.stringify(subscriptions, null, 2));
}));

/**
 * GET /api/admin/export/invoices
 * Export invoices data as JSON
 */
router.get('/export/invoices', asyncHandler(async (req, res) => {
  const invoices = await prisma.invoice.findMany({
    include: {
      company: { select: { razaoSocial: true, cnpj: true } }
    }
  });

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=invoices-export-${new Date().toISOString().split('T')[0]}.json`);
  res.send(JSON.stringify(invoices, null, 2));
}));

// ==========================================
// SYSTEM HEALTH
// ==========================================

/**
 * GET /api/admin/health
 * Get system health status
 */
router.get('/health', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  // Check database connection
  let dbStatus = 'healthy';
  let dbLatency = 0;
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatency = Date.now() - dbStart;
  } catch (error) {
    dbStatus = 'unhealthy';
  }

  // Get system stats
  const [userCount, activeSubCount, invoiceCount] = await Promise.all([
    prisma.user.count(),
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    prisma.invoice.count()
  ]);

  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();

  sendSuccess(res, 'Health check completed', {
    status: dbStatus === 'healthy' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    responseTime: Date.now() - startTime,
    database: {
      status: dbStatus,
      latency: dbLatency
    },
    system: {
      uptime: Math.floor(uptime),
      uptimeFormatted: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
      memory: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024)
      }
    },
    counts: {
      users: userCount,
      activeSubscriptions: activeSubCount,
      invoices: invoiceCount
    }
  });
}));

// ==========================================
// ADMIN AUTHENTICATION
// ==========================================

/**
 * POST /api/admin/verify-password
 * Verify admin password for step-up authentication
 * This endpoint allows admins to re-authenticate without creating a new session
 */
router.post('/verify-password', [
  body('password').notEmpty().withMessage('Password is required')
], validateRequest, asyncHandler(async (req, res) => {
  const { password } = req.body;

  // Get current user with password hash
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, passwordHash: true, isAdmin: true }
  });

  if (!user) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }

  if (!user.isAdmin) {
    throw new AppError('Access denied. Admin privileges required.', 403, 'FORBIDDEN');
  }

  if (!user.passwordHash) {
    throw new AppError('This account uses Google authentication. Password verification not available.', 400, 'GOOGLE_AUTH_USER');
  }

  // Verify password
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new AppError('Invalid password', 401, 'INVALID_PASSWORD');
  }

  sendSuccess(res, 'Password verified', { verified: true });
}));

export default router;
