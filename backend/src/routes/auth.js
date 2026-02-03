import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { createOrUpdateCustomer } from '../services/stripeSDK.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { sendWelcomeEmail } from '../services/email.js';
import {
  isGoogleAuthConfigured,
  generateState,
  getGoogleAuthUrl,
  getTokensFromCode,
  getGoogleUserInfo,
} from '../services/googleAuth.js';

const router = express.Router();

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Generate tokens
const generateTokens = (userId) => {
  const token = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

  return { token, refreshToken };
};

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', authLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('name').trim().notEmpty().withMessage('Name is required')
], validateRequest, asyncHandler(async (req, res) => {
  const { email, password, name } = req.body;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name
    },
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      createdAt: true
    }
  });

  // Create customer in Stripe (optional - can be done later during checkout)
  let stripeCustomerId = null;
  try {
    if (req.body.cpf_cnpj) {
      const customer = await createOrUpdateCustomer({
        email: user.email,
        name: user.name,
        phone: req.body.phone || '',
        metadata: {
          userId: user.id,
          cpfCnpj: req.body.cpf_cnpj
        }
      });
      stripeCustomerId = customer.id;

      // Update user with Stripe customer ID
      await prisma.user.update({
        where: { id: user.id },
        data: {
          stripeCustomerId: customer.id,
          cpfCnpj: req.body.cpf_cnpj.replace(/\D/g, '') // Store numbers only
        }
      });
    }
  } catch (error) {
    // Log error but don't fail registration if Stripe fails
    console.error('Failed to create Stripe customer during registration:', error);
    // User can complete registration and add payment info later
  }

  // Generate tokens
  const { token, refreshToken } = generateTokens(user.id);

  // Store refresh token
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  
  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt
    }
  });

  // Create default settings
  await prisma.userSettings.create({
    data: {
      userId: user.id
    }
  });

  // Send welcome email (async, don't block registration)
  sendWelcomeEmail(user).catch(err => {
    console.error('[Auth] Failed to send welcome email:', err);
  });

  res.status(201).json({
    user,
    token,
    refreshToken
  });
}));

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', authLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], validateRequest, asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  // Check password
  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  // Generate tokens
  const { token, refreshToken } = generateTokens(user.id);

  // Store refresh token
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  
  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt
    }
  });

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      createdAt: user.createdAt
    },
    token,
    refreshToken
  });
}));

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError('Refresh token is required', 400, 'NO_REFRESH_TOKEN');
  }

  // Verify refresh token
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (error) {
    throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
  }

  // Check if token exists in database
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: refreshToken }
  });

  if (!storedToken || storedToken.expiresAt < new Date()) {
    throw new AppError('Refresh token expired or invalid', 401, 'INVALID_REFRESH_TOKEN');
  }

  // Delete old refresh token
  await prisma.refreshToken.delete({ where: { id: storedToken.id } });

  // Generate new tokens
  const tokens = generateTokens(decoded.userId);

  // Store new refresh token
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  
  await prisma.refreshToken.create({
    data: {
      token: tokens.refreshToken,
      userId: decoded.userId,
      expiresAt
    }
  });

  res.json(tokens);
}));

/**
 * GET /api/auth/me
 * Get current user with subscription status
 * 👉 This is the SOURCE OF TRUTH for frontend access control
 */
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  // Get user with subscription
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      cpfCnpj: true,
      isAdmin: true,
      createdAt: true,
      updatedAt: true
    }
  });

  // Get active subscription
  const subscription = await prisma.subscription.findUnique({
    where: { userId: req.user.id }
  });

  // Get full user with trial info
  const fullUser = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { 
      hasUsedTrial: true, 
      trialStartedAt: true,
      createdAt: true 
    }
  });

  let subscriptionStatus = null;
  let plan = null;
  let daysRemaining = 0;
  let currentPeriodEnd = null;
  let trialDaysRemaining = 0;
  let isInTrialPeriod = false;

  const now = new Date();

  // Helper: Check if user is in active trial period
  const checkTrialPeriod = () => {
    if (subscription && subscription.status === 'trial' && subscription.trialEndsAt) {
      const trialEnd = new Date(subscription.trialEndsAt);
      if (now <= trialEnd) {
        trialDaysRemaining = Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)));
        isInTrialPeriod = true;
        return { valid: true, daysRemaining: trialDaysRemaining, endDate: trialEnd };
      }
    }
    // Also check user's trialStartedAt for implicit trial
    if (fullUser?.trialStartedAt) {
      const trialStart = new Date(fullUser.trialStartedAt);
      const trialEnd = new Date(trialStart);
      trialEnd.setDate(trialEnd.getDate() + 7); // 7-day trial
      if (now <= trialEnd) {
        trialDaysRemaining = Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)));
        isInTrialPeriod = true;
        return { valid: true, daysRemaining: trialDaysRemaining, endDate: trialEnd };
      }
    }
    return { valid: false, daysRemaining: 0, endDate: null };
  };

  if (subscription) {
    const trialCheck = checkTrialPeriod();

    // ✅ PRIORITY 1: If user has active trial, allow access regardless of pending payment
    if (subscription.status === 'pending' && trialCheck.valid) {
      // User tried to upgrade but payment is pending - still allow trial access
      subscriptionStatus = 'trial';
      plan = 'trial';
      daysRemaining = trialCheck.daysRemaining;
      currentPeriodEnd = trialCheck.endDate;
      console.log('[Auth] User has pending payment but still in trial period. Allowing access.');
    }
    // ✅ PRIORITY 2: Active trial subscription
    else if (subscription.status === 'trial') {
      if (trialCheck.valid) {
        subscriptionStatus = 'trial';
        plan = 'trial';
        daysRemaining = trialCheck.daysRemaining;
        currentPeriodEnd = subscription.trialEndsAt || trialCheck.endDate;
      } else {
        // Trial expired
        subscriptionStatus = 'trial_expired';
        plan = null;
        daysRemaining = 0;
        currentPeriodEnd = subscription.trialEndsAt;
      }
    }
    // ✅ PRIORITY 3: Canceled but still in paid period (DB enum is 'CANCELED')
    else if ((subscription.status === 'CANCELED' || subscription.status === 'cancelado') && subscription.currentPeriodEnd) {
      const periodEnd = new Date(subscription.currentPeriodEnd);
      
      if (now <= periodEnd) {
        subscriptionStatus = 'ativo'; // Frontend sees as active
        plan = subscription.planId;
        currentPeriodEnd = subscription.currentPeriodEnd;
        daysRemaining = Math.max(0, Math.ceil((periodEnd - now) / (1000 * 60 * 60 * 24)));
      } else {
        subscriptionStatus = 'cancelado';
        plan = subscription.planId;
        currentPeriodEnd = subscription.currentPeriodEnd;
        daysRemaining = 0;
      }
    }
    // ✅ PRIORITY 4: Active subscription (DB enum is 'ACTIVE'; support legacy 'ativo')
    else if (subscription.status === 'ACTIVE' || subscription.status === 'ativo') {
      subscriptionStatus = 'ativo';
      plan = subscription.planId;
      currentPeriodEnd = subscription.currentPeriodEnd;
      
      if (currentPeriodEnd) {
        daysRemaining = Math.max(0, Math.ceil((new Date(currentPeriodEnd) - now) / (1000 * 60 * 60 * 24)));
      }
    }
    // ✅ PRIORITY 5: Pending payment (no active trial)
    else if (subscription.status === 'pending') {
      subscriptionStatus = 'pending';
      plan = subscription.planId;
      daysRemaining = 0;
      currentPeriodEnd = null;
    }
    // Other statuses
    else {
      subscriptionStatus = subscription.status;
      plan = subscription.planId;
      currentPeriodEnd = subscription.currentPeriodEnd;
      
      if (currentPeriodEnd) {
        daysRemaining = Math.max(0, Math.ceil((new Date(currentPeriodEnd) - now) / (1000 * 60 * 60 * 24)));
      }
    }
  } else {
    // No subscription record
    // Check if user is in implicit trial period (first 7 days after registration)
    const userCreatedAt = new Date(fullUser?.createdAt || user.createdAt);
    const implicitTrialEnd = new Date(userCreatedAt);
    implicitTrialEnd.setDate(implicitTrialEnd.getDate() + 7);

    if (now <= implicitTrialEnd && !fullUser?.hasUsedTrial) {
      // New user in implicit trial period - they need to select a plan
      // But we'll still allow limited access
      subscriptionStatus = null; // Redirect to pricing
      plan = null;
      daysRemaining = Math.max(0, Math.ceil((implicitTrialEnd - now) / (1000 * 60 * 60 * 24)));
      currentPeriodEnd = implicitTrialEnd;
    } else {
      // No trial, no subscription
    subscriptionStatus = null;
    plan = null;
    daysRemaining = 0;
    currentPeriodEnd = null;
    }
  }

  // Return user with subscription info
  res.json({
    ...user,
    subscription_status: subscriptionStatus,
    plan: plan,
    days_remaining: daysRemaining,
    current_period_end: currentPeriodEnd,
    is_in_trial: isInTrialPeriod,
    trial_days_remaining: trialDaysRemaining
  });
}));

/**
 * POST /api/auth/logout
 * Logout user
 */
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  // Delete all refresh tokens for user
  await prisma.refreshToken.deleteMany({
    where: { userId: req.user.id }
  });

  res.json({ message: 'Logged out successfully' });
}));

/**
 * PUT /api/auth/profile
 * Update user profile
 */
router.put('/profile', authenticate, [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('avatar').optional().isURL().withMessage('Avatar must be a valid URL'),
  body('cpf_cnpj').optional().trim()
], validateRequest, asyncHandler(async (req, res) => {
  const { name, avatar, cpf_cnpj } = req.body;

  const updateData = {};
  if (name) updateData.name = name;
  if (avatar !== undefined) updateData.avatar = avatar;
  if (cpf_cnpj !== undefined) {
    // Store CPF/CNPJ with numbers only
    updateData.cpfCnpj = cpf_cnpj.replace(/\D/g, '');
  }

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      cpfCnpj: true,
      createdAt: true,
      updatedAt: true
    }
  });

  res.json(user);
}));

/**
 * POST /api/auth/change-password
 * Change user password
 */
router.post('/change-password', authenticate, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], validateRequest, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // Get user with password
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });

  // Check if user uses Google auth (no password set)
  if (!user.passwordHash) {
    throw new AppError('Esta conta usa login do Google. Não é possível alterar a senha.', 400, 'GOOGLE_AUTH_USER');
  }

  // Verify current password
  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) {
    throw new AppError('Current password is incorrect', 400, 'INVALID_PASSWORD');
  }

  // Hash new password
  const passwordHash = await bcrypt.hash(newPassword, 12);

  // Update password
  await prisma.user.update({
    where: { id: req.user.id },
    data: { passwordHash }
  });

  // Invalidate all refresh tokens
  await prisma.refreshToken.deleteMany({
    where: { userId: req.user.id }
  });

  res.json({ message: 'Password changed successfully' });
}));

// ==========================================
// GOOGLE OAUTH ROUTES
// ==========================================

/**
 * GET /api/auth/google/check
 * Check if Google OAuth is configured
 */
router.get('/google/check', (req, res) => {
  res.json({
    configured: isGoogleAuthConfigured(),
    message: isGoogleAuthConfigured() 
      ? 'Google OAuth está configurado' 
      : 'Google OAuth não está configurado. Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET.'
  });
});

/**
 * GET /api/auth/google
 * Initiate Google OAuth flow
 */
router.get('/google', asyncHandler(async (req, res) => {
  if (!isGoogleAuthConfigured()) {
    throw new AppError('Google OAuth não está configurado', 500, 'GOOGLE_NOT_CONFIGURED');
  }

  // Generate state for CSRF protection
  const state = generateState();
  
  // Store state in session/cookie for validation
  res.cookie('google_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000 // 10 minutes
  });

  // Redirect to Google
  const authUrl = getGoogleAuthUrl(state);
  res.redirect(authUrl);
}));

/**
 * GET /api/auth/google/callback
 * Handle Google OAuth callback
 */
router.get('/google/callback', asyncHandler(async (req, res) => {
  const { code, state, error } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  // Handle errors from Google
  if (error) {
    console.error('[Google Auth] Error from Google:', error);
    return res.redirect(`${frontendUrl}/login?error=google_auth_failed&message=${encodeURIComponent(error)}`);
  }

  // Validate state (CSRF protection)
  const storedState = req.cookies?.google_oauth_state;
  if (!storedState || storedState !== state) {
    console.error('[Google Auth] State mismatch');
    return res.redirect(`${frontendUrl}/login?error=invalid_state`);
  }

  // Clear state cookie
  res.clearCookie('google_oauth_state');

  try {
    // Exchange code for tokens
    const tokens = await getTokensFromCode(code);
    
    // Get user info from Google
    const googleUser = await getGoogleUserInfo(tokens.accessToken);
    
    if (!googleUser.email) {
      throw new Error('Email não encontrado na conta Google');
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: googleUser.email }
    });

    let isNewUser = false;

    if (!user) {
      // Create new user
      isNewUser = true;
      user = await prisma.user.create({
        data: {
          email: googleUser.email,
          name: googleUser.name || googleUser.email.split('@')[0],
          avatar: googleUser.picture,
          googleId: googleUser.id,
          emailVerified: googleUser.emailVerified,
          passwordHash: null, // No password for Google auth users
        }
      });

      // Create default settings
      await prisma.userSettings.create({
        data: { userId: user.id }
      });

      // Send welcome email
      sendWelcomeEmail(user).catch(err => {
        console.error('[Auth] Failed to send welcome email:', err);
      });

      console.log('[Google Auth] New user created:', user.email);
    } else {
      // Update existing user with Google info if not set
      const updateData = {};
      if (!user.googleId) updateData.googleId = googleUser.id;
      if (!user.avatar && googleUser.picture) updateData.avatar = googleUser.picture;
      if (googleUser.emailVerified && !user.emailVerified) updateData.emailVerified = true;

      if (Object.keys(updateData).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updateData
        });
      }

      console.log('[Google Auth] Existing user logged in:', user.email);
    }

    // Generate tokens
    const { token, refreshToken } = generateTokens(user.id);

    // Store refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt
      }
    });

    // Redirect to frontend with tokens
    const params = new URLSearchParams({
      token,
      refreshToken,
      isNewUser: isNewUser.toString(),
    });

    res.redirect(`${frontendUrl}/auth/google/callback?${params.toString()}`);
  } catch (error) {
    console.error('[Google Auth] Callback error:', error);
    res.redirect(`${frontendUrl}/login?error=google_auth_failed&message=${encodeURIComponent(error.message)}`);
  }
}));

/**
 * POST /api/auth/google/token
 * Login with Google ID token (for frontend SDK)
 */
router.post('/google/token', asyncHandler(async (req, res) => {
  const { credential, clientId } = req.body;

  if (!credential) {
    throw new AppError('Google credential is required', 400, 'NO_CREDENTIAL');
  }

  // Verify the credential is a valid Google ID token
  // The credential from Google Sign-In button is a JWT
  try {
    // Decode the JWT (we'll verify it with Google)
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`
    );

    if (!response.ok) {
      throw new Error('Invalid Google token');
    }

    const payload = await response.json();

    // Verify audience matches our client ID
    const expectedClientId = process.env.GOOGLE_CLIENT_ID;
    if (payload.aud !== expectedClientId) {
      throw new Error('Token não foi emitido para esta aplicação');
    }

    const googleUser = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      emailVerified: payload.email_verified === 'true',
    };

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: googleUser.email }
    });

    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = await prisma.user.create({
        data: {
          email: googleUser.email,
          name: googleUser.name || googleUser.email.split('@')[0],
          avatar: googleUser.picture,
          googleId: googleUser.id,
          emailVerified: googleUser.emailVerified,
          passwordHash: null,
        }
      });

      await prisma.userSettings.create({
        data: { userId: user.id }
      });

      sendWelcomeEmail(user).catch(err => {
        console.error('[Auth] Failed to send welcome email:', err);
      });
    } else {
      // Update Google info if needed
      const updateData = {};
      if (!user.googleId) updateData.googleId = googleUser.id;
      if (!user.avatar && googleUser.picture) updateData.avatar = googleUser.picture;
      if (googleUser.emailVerified && !user.emailVerified) updateData.emailVerified = true;

      if (Object.keys(updateData).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updateData
        });
      }
    }

    // Generate tokens
    const { token, refreshToken } = generateTokens(user.id);

    // Store refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt
      }
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        createdAt: user.createdAt
      },
      token,
      refreshToken,
      isNewUser
    });
  } catch (error) {
    console.error('[Google Auth] Token verification failed:', error);
    throw new AppError(error.message || 'Falha ao verificar token do Google', 401, 'GOOGLE_TOKEN_INVALID');
  }
}));

export default router;
