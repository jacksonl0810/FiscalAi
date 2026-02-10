import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { createOrUpdateCustomer } from '../services/stripeSDK.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { sendWelcomeEmail, sendPasswordResetEmail, sendEmailVerificationEmail } from '../services/email.js';
import crypto from 'crypto';
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

  // Generate email verification token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationExpiresAt = new Date();
  verificationExpiresAt.setHours(verificationExpiresAt.getHours() + 24); // 24 hours

  await prisma.emailVerificationToken.create({
    data: {
      token: verificationToken,
      userId: user.id,
      expiresAt: verificationExpiresAt
    }
  });

  // Send email verification email (async, don't block registration)
  // Note: Welcome email is NOT sent here - user will receive welcome content after verification
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;
  
  sendEmailVerificationEmail(user, verificationUrl).catch(err => {
    console.error('[Auth] Failed to send email verification:', err);
  });

  res.status(201).json({
    user: {
      ...user,
      emailVerified: false
    },
    token,
    refreshToken,
    requiresEmailVerification: true
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

  // Check if user has a password (might be Google-only user)
  if (!user.passwordHash) {
    throw new AppError('This account uses Google login. Please sign in with Google.', 401, 'USE_GOOGLE_LOGIN');
  }

  // Check password
  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  // Check email verification (skip for Google users as their email is already verified)
  if (!user.emailVerified && user.authProvider !== 'google') {
    // Generate a new verification token if needed
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    
    return res.status(403).json({
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Por favor, verifique seu email antes de fazer login.',
      email: user.email,
      canResendVerification: true
    });
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
      isAdmin: user.isAdmin || false,
      emailVerified: user.emailVerified,
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

  let subscriptionStatus = null;
  let plan = null;
  let daysRemaining = 0;
  let currentPeriodEnd = null;

  const now = new Date();

  if (subscription) {
    // ✅ PRIORITY 1: Canceled but still in paid period (DB enum is 'CANCELED')
    if ((subscription.status === 'CANCELED' || subscription.status === 'cancelado') && subscription.currentPeriodEnd) {
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
    // ✅ PRIORITY 2: Active subscription (DB enum is 'ACTIVE'; support legacy 'ativo')
    else if (subscription.status === 'ACTIVE' || subscription.status === 'ativo') {
      subscriptionStatus = 'ativo';
      plan = subscription.planId;
      currentPeriodEnd = subscription.currentPeriodEnd;
      
      if (currentPeriodEnd) {
        daysRemaining = Math.max(0, Math.ceil((new Date(currentPeriodEnd) - now) / (1000 * 60 * 60 * 24)));
      }
    }
    // ✅ PRIORITY 3: Pending payment
    else if (subscription.status === 'pending' || subscription.status === 'PENDING') {
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
    // No subscription record - user needs to select a plan
    subscriptionStatus = null;
    plan = null;
    daysRemaining = 0;
    currentPeriodEnd = null;
  }

  // Return user with subscription info
  res.json({
    ...user,
    subscription_status: subscriptionStatus,
    plan: plan,
    days_remaining: daysRemaining,
    current_period_end: currentPeriodEnd
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
// PASSWORD RESET ROUTES
// ==========================================

/**
 * POST /api/auth/forgot-password
 * Request password reset email
 */
router.post('/forgot-password', authLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required')
], validateRequest, asyncHandler(async (req, res) => {
  const { email } = req.body;

  // Find user by email
  const user = await prisma.user.findUnique({ where: { email } });

  // Always return success to prevent email enumeration attacks
  if (!user) {
    console.log('[Auth] Password reset requested for non-existent email:', email);
    return res.json({ 
      message: 'Se o email existir em nossa base, você receberá as instruções de recuperação.' 
    });
  }

  // Check if user uses Google auth (no password set)
  if (!user.passwordHash && user.googleId) {
    console.log('[Auth] Password reset requested for Google auth user:', email);
    return res.json({ 
      message: 'Se o email existir em nossa base, você receberá as instruções de recuperação.' 
    });
  }

  // Delete any existing password reset tokens for this user
  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id }
  });

  // Generate a secure token
  const token = crypto.randomBytes(32).toString('hex');
  
  // Token expires in 1 hour
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);

  // Store the token
  await prisma.passwordResetToken.create({
    data: {
      token,
      userId: user.id,
      expiresAt
    }
  });

  // Send password reset email
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

  sendPasswordResetEmail(user, resetUrl).catch(err => {
    console.error('[Auth] Failed to send password reset email:', err);
  });

  console.log('[Auth] Password reset email sent to:', email);

  res.json({ 
    message: 'Se o email existir em nossa base, você receberá as instruções de recuperação.' 
  });
}));

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', authLimiter, [
  body('token').notEmpty().withMessage('Token is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], validateRequest, asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  // Find the token
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true }
  });

  // Validate token
  if (!resetToken) {
    throw new AppError('Token inválido ou expirado', 400, 'INVALID_TOKEN');
  }

  if (resetToken.used) {
    throw new AppError('Este token já foi utilizado', 400, 'TOKEN_USED');
  }

  if (resetToken.expiresAt < new Date()) {
    throw new AppError('Token expirado. Solicite um novo link de recuperação.', 400, 'TOKEN_EXPIRED');
  }

  // Hash the new password
  const passwordHash = await bcrypt.hash(password, 12);

  // Update user password and mark token as used
  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash }
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { used: true }
    }),
    // Invalidate all refresh tokens for security
    prisma.refreshToken.deleteMany({
      where: { userId: resetToken.userId }
    })
  ]);

  console.log('[Auth] Password reset successfully for user:', resetToken.user.email);

  res.json({ message: 'Senha alterada com sucesso! Você já pode fazer login.' });
}));

/**
 * GET /api/auth/verify-reset-token
 * Verify if a reset token is valid (for frontend validation)
 */
router.get('/verify-reset-token', asyncHandler(async (req, res) => {
  const { token } = req.query;

  if (!token) {
    throw new AppError('Token is required', 400, 'NO_TOKEN');
  }

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token }
  });

  if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
    return res.json({ valid: false });
  }

  res.json({ valid: true });
}));

// ==========================================
// EMAIL VERIFICATION ROUTES
// ==========================================

/**
 * POST /api/auth/verify-email
 * Verify email with token
 */
router.post('/verify-email', asyncHandler(async (req, res) => {
  const { token } = req.body;

  if (!token) {
    throw new AppError('Token is required', 400, 'NO_TOKEN');
  }

  // Find the verification token
  const verificationToken = await prisma.emailVerificationToken.findUnique({
    where: { token },
    include: { user: true }
  });

  // Validate token
  if (!verificationToken) {
    throw new AppError('Token inválido ou expirado', 400, 'INVALID_TOKEN');
  }

  if (verificationToken.used) {
    throw new AppError('Este email já foi verificado', 400, 'ALREADY_VERIFIED');
  }

  if (verificationToken.expiresAt < new Date()) {
    throw new AppError('Token expirado. Solicite um novo link de verificação.', 400, 'TOKEN_EXPIRED');
  }

  // Mark email as verified and token as used
  await prisma.$transaction([
    prisma.user.update({
      where: { id: verificationToken.userId },
      data: { emailVerified: true }
    }),
    prisma.emailVerificationToken.update({
      where: { id: verificationToken.id },
      data: { used: true }
    })
  ]);

  console.log('[Auth] Email verified successfully for user:', verificationToken.user.email);

  // Generate tokens so user can login immediately
  const { token: accessToken, refreshToken } = generateTokens(verificationToken.userId);

  // Store refresh token
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  
  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: verificationToken.userId,
      expiresAt
    }
  });

  res.json({ 
    message: 'Email verificado com sucesso!',
    user: {
      id: verificationToken.user.id,
      email: verificationToken.user.email,
      name: verificationToken.user.name,
      avatar: verificationToken.user.avatar,
      emailVerified: true
    },
    token: accessToken,
    refreshToken
  });
}));

/**
 * POST /api/auth/resend-verification
 * Resend email verification
 */
router.post('/resend-verification', authLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required')
], validateRequest, asyncHandler(async (req, res) => {
  const { email } = req.body;

  // Find user by email
  const user = await prisma.user.findUnique({ where: { email } });

  // Always return success to prevent email enumeration
  if (!user) {
    console.log('[Auth] Verification resend requested for non-existent email:', email);
    return res.json({ 
      message: 'Se o email existir em nossa base, você receberá um novo link de verificação.' 
    });
  }

  // Check if already verified
  if (user.emailVerified) {
    return res.json({ 
      message: 'Este email já foi verificado. Você pode fazer login normalmente.',
      alreadyVerified: true
    });
  }

  // Delete any existing unused verification tokens for this user
  await prisma.emailVerificationToken.deleteMany({
    where: {
      userId: user.id,
      used: false
    }
  });

  // Generate new verification token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours

  await prisma.emailVerificationToken.create({
    data: {
      token: verificationToken,
      userId: user.id,
      expiresAt
    }
  });

  // Send verification email
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;

  sendEmailVerificationEmail(user, verificationUrl).catch(err => {
    console.error('[Auth] Failed to send verification email:', err);
  });

  console.log('[Auth] Verification email resent to:', email);

  res.json({ 
    message: 'Se o email existir em nossa base, você receberá um novo link de verificação.' 
  });
}));

/**
 * GET /api/auth/verify-email-token
 * Check if an email verification token is valid (for frontend validation)
 */
router.get('/verify-email-token', asyncHandler(async (req, res) => {
  const { token } = req.query;

  if (!token) {
    throw new AppError('Token is required', 400, 'NO_TOKEN');
  }

  const verificationToken = await prisma.emailVerificationToken.findUnique({
    where: { token }
  });

  if (!verificationToken || verificationToken.used || verificationToken.expiresAt < new Date()) {
    return res.json({ valid: false });
  }

  res.json({ valid: true });
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

    // Redirect to frontend with tokens and user data
    // Including user data avoids an extra API call on the frontend
    const params = new URLSearchParams({
      token,
      refreshToken,
      isNewUser: isNewUser.toString(),
      // Include user data to avoid extra /api/auth/me call
      userId: user.id,
      userEmail: user.email,
      userName: user.name || '',
      userAvatar: user.avatar || '',
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
