import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';

// Import routes
import authRoutes from './routes/auth.js';
import companiesRoutes from './routes/companies.js';
import invoicesRoutes from './routes/invoices.js';
import notificationsRoutes from './routes/notifications.js';
import settingsRoutes from './routes/settings.js';
import taxesRoutes from './routes/taxes.js';
import assistantRoutes from './routes/assistant.js';
import subscriptionsRoutes from './routes/subscriptions.js';
import municipalitiesRoutes from './routes/municipalities.js';
import webhooksRoutes from './routes/webhooks.js';
import monitoringRoutes from './routes/monitoring.js';
import accountantReviewRoutes from './routes/accountantReview.js';
import adminRoutes from './routes/admin.js';

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';

// Load environment variables
dotenv.config();

// Initialize Prisma client
export const prisma = new PrismaClient();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration - Enhanced for Pagar.me checkout flow
const corsOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'];
const isDevelopment = process.env.NODE_ENV !== 'production';

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    if (corsOrigins.includes('*')) {
      return callback(null, true);
    }
    
    if (corsOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    
    if (isDevelopment) {
      return callback(null, true);
    }
    
    const originHost = origin.replace(/^https?:\/\//, '').split(':')[0];
    const allowedHosts = corsOrigins.map(o => o.replace(/^https?:\/\//, '').split(':')[0]);
    
    if (allowedHosts.some(host => originHost.includes(host) || host.includes(originHost))) {
      return callback(null, true);
    }
    
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 86400
}));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parser for OAuth state management
app.use(cookieParser());

// Apply general rate limiting to all API routes
import { apiLimiter } from './middleware/rateLimiter.js';
app.use('/api', apiLimiter);

// Multer configuration for file uploads (memory storage for audio)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB max file size (Whisper API limit)
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/taxes', taxesRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/municipalities', municipalitiesRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/accountant-review', accountantReviewRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handler middleware
app.use(errorHandler);

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📚 API available at http://localhost:${PORT}/api`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📝 Nuvem Fiscal: Check backend/NUVEM_FISCAL_OPTIONAL.md for setup`);
  
  // Start background tasks (enabled by default, can be disabled with ENABLE_BACKGROUND_TASKS=false)
  const enableBackgroundTasks = process.env.ENABLE_BACKGROUND_TASKS !== 'false';
  
  if (enableBackgroundTasks) {
    try {
      const { startAllBackgroundTasks } = await import('./workers/backgroundTasks.js');
      await startAllBackgroundTasks();
      console.log(`⚙️  Background tasks started (polling, certificate monitoring, retry queue)`);
    } catch (error) {
      console.error('[Server] Error starting background tasks:', error.message);
      console.log('[Server] Background tasks will be disabled. Set ENABLE_BACKGROUND_TASKS=false to suppress this warning.');
    }
  } else {
    console.log(`⚙️  Background tasks disabled (ENABLE_BACKGROUND_TASKS=false)`);
  }
});

export default app;



