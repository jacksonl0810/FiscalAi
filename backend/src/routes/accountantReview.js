/**
 * Accountant Review Routes
 * Handles accountant review requests for Professional plan users
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../index.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireActiveSubscription } from '../middleware/subscriptionAccess.js';
import { getUserPlanId } from '../services/planService.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);
router.use(asyncHandler(requireActiveSubscription));

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

/**
 * Check if user has Professional plan (required for accountant review)
 */
async function checkProfessionalPlan(userId) {
  const planId = await getUserPlanId(userId);
  if (planId !== 'professional') {
    throw new AppError(
      'Revisão contábil está disponível apenas para o plano Professional',
      403,
      'PLAN_NOT_ELIGIBLE',
      { requiredPlan: 'professional', currentPlan: planId }
    );
  }
}

/**
 * POST /api/accountant-review/request
 * Create a new accountant review request
 */
router.post('/request', [
  body('company_id').notEmpty().withMessage('Company ID is required'),
  body('review_type').isIn(['pre_issuance', 'post_issuance', 'correction']).withMessage('Invalid review type'),
  body('invoice_id').optional().isUUID().withMessage('Invalid invoice ID'),
  body('documents').optional().isArray().withMessage('Documents must be an array'),
  body('notes').optional().isString().withMessage('Notes must be a string')
], validateRequest, asyncHandler(async (req, res) => {
  const { company_id, invoice_id, review_type, documents, notes } = req.body;
  const userId = req.user.id;

  // Check if user has Professional plan
  await checkProfessionalPlan(userId);

  // Verify company belongs to user
  const company = await prisma.company.findFirst({
    where: {
      id: company_id,
      userId: userId
    }
  });

  if (!company) {
    throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
  }

  // Verify invoice belongs to company (if provided)
  if (invoice_id) {
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoice_id,
        companyId: company_id
      }
    });

    if (!invoice) {
      throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
    }
  }

  // Create review request
  const review = await prisma.accountantReview.create({
    data: {
      userId,
      companyId: company_id,
      invoiceId: invoice_id || null,
      reviewType: review_type,
      status: 'pending',
      documents: documents || [],
      notes: notes || null
    },
    include: {
      company: {
        select: {
          id: true,
          razaoSocial: true,
          nomeFantasia: true
        }
      },
      invoice: invoice_id ? {
        select: {
          id: true,
          numero: true,
          valor: true,
          status: true
        }
      } : false
    }
  });

  // Create notification
  await prisma.notification.create({
    data: {
      userId,
      titulo: 'Revisão Contábil Solicitada',
      mensagem: `Sua solicitação de revisão contábil foi enviada. Um contador entrará em contato em breve.`,
      tipo: 'info',
      invoiceId: invoice_id || null
    }
  });

  res.status(201).json({
    status: 'success',
    message: 'Revisão contábil solicitada com sucesso',
    review: {
      id: review.id,
      status: review.status,
      review_type: review.reviewType,
      company: review.company,
      invoice: review.invoice,
      requested_at: review.requestedAt
    }
  });
}));

/**
 * GET /api/accountant-review
 * List all review requests for the current user
 */
router.get('/', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const reviews = await prisma.accountantReview.findMany({
    where: { userId },
    include: {
      company: {
        select: {
          id: true,
          razaoSocial: true,
          nomeFantasia: true
        }
      },
      invoice: {
        select: {
          id: true,
          numero: true,
          valor: true,
          status: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  res.json({
    status: 'success',
    reviews: reviews.map(review => ({
      id: review.id,
      status: review.status,
      review_type: review.reviewType,
      company: review.company,
      invoice: review.invoice,
      notes: review.notes,
      accountant_notes: review.accountantNotes,
      documents: review.documents,
      requested_at: review.requestedAt,
      reviewed_at: review.reviewedAt,
      completed_at: review.completedAt,
      created_at: review.createdAt
    }))
  });
}));

/**
 * GET /api/accountant-review/:id
 * Get a specific review request
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const reviewId = req.params.id;

  const review = await prisma.accountantReview.findFirst({
    where: {
      id: reviewId,
      userId: userId
    },
    include: {
      company: {
        select: {
          id: true,
          razaoSocial: true,
          nomeFantasia: true,
          cnpj: true
        }
      },
      invoice: {
        select: {
          id: true,
          numero: true,
          valor: true,
          status: true,
          clienteNome: true,
          descricaoServico: true,
          dataEmissao: true
        }
      }
    }
  });

  if (!review) {
    throw new AppError('Review not found', 404, 'NOT_FOUND');
  }

  res.json({
    status: 'success',
    review: {
      id: review.id,
      status: review.status,
      review_type: review.reviewType,
      company: review.company,
      invoice: review.invoice,
      notes: review.notes,
      accountant_notes: review.accountantNotes,
      documents: review.documents,
      requested_at: review.requestedAt,
      reviewed_at: review.reviewedAt,
      completed_at: review.completedAt,
      created_at: review.createdAt,
      updated_at: review.updatedAt
    }
  });
}));

/**
 * PUT /api/accountant-review/:id/cancel
 * Cancel a pending review request
 */
router.put('/:id/cancel', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const reviewId = req.params.id;

  const review = await prisma.accountantReview.findFirst({
    where: {
      id: reviewId,
      userId: userId
    }
  });

  if (!review) {
    throw new AppError('Review not found', 404, 'NOT_FOUND');
  }

  if (review.status !== 'pending') {
    throw new AppError('Apenas revisões pendentes podem ser canceladas', 400, 'INVALID_STATUS');
  }

  const updatedReview = await prisma.accountantReview.update({
    where: { id: reviewId },
    data: {
      status: 'rejected',
      completedAt: new Date()
    }
  });

  res.json({
    status: 'success',
    message: 'Revisão cancelada com sucesso',
    review: {
      id: updatedReview.id,
      status: updatedReview.status
    }
  });
}));

export default router;
