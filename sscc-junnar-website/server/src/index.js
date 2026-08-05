import 'dotenv/config';
import express from 'express';
import 'express-async-errors';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { ensureUploadDirs, uploadsPath } from './multer/configure.js';
import { authRouter } from './routes/auth.js';
import { publicRouter } from './routes/public.js';
import { adminRouter } from './routes/admin.js';
import { teacherRouter } from './routes/teacher.js';
import { studentRouter } from './routes/student.js';
import { adminPlacementRouter, studentPlacementRouter } from './routes/placement.js';
import { adminTimetableRouter, teacherTimetableRouter, studentTimetableRouter } from './routes/timetable.js';
import { adminLibraryRouter, studentLibraryRouter } from './routes/library.js';
import { adminExamRouter, teacherExamRouter, studentExamRouter } from './routes/exam.js';
import { adminFeeRouter, studentFeeRouter } from './routes/fees.js';
import { messengerRouter } from './routes/messenger.js';
import { notificationsRouter } from './routes/notifications.js';
import { paymentsRouter } from './routes/payments.js';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/errorHandler.js';
import { globalApiLimiter } from './middleware/rateLimit.js';
import { prisma } from './db/client.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { correlationId } from './middleware/correlationId.js';
import { logger, requestLogger } from './utils/logger.js';
import { initRedis, disconnectRedis } from './utils/redis.js';
import { openApiSpec } from './docs/openapi.js';
import { createAuditLogger } from './middleware/audit.js';

const auditLog = createAuditLogger(prisma);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.join(__dirname, '..', '..');
const PORT = Number(process.env.PORT) || 3000;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}

ensureUploadDirs();
const uploadsRoot = uploadsPath();

const app = express();

// ─── CORRELATION & REQUEST LOGGING ──────────────────────────────────────────
app.use(correlationId);
app.use(requestLogger);

// ─── SECURITY MIDDLEWARE ────────────────────────────────────────────────────

// Helmet — secure HTTP headers (X-Frame-Options, CSP, etc.)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      frameSrc: ["'self'", "https://www.google.com", "https://maps.google.com"],
      frameAncestors: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  crossOriginEmbedderPolicy: false,
}));

// Optional HTTPS enforcement middleware for production reverse proxies (Nginx/Traefik)
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] === 'http') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});

// CORS — configurable whitelist (no more origin:true)
const CORS_ORIGIN = process.env.CORS_ORIGIN || `http://localhost:${PORT}`;
app.use(cors({
  origin: CORS_ORIGIN.split(',').map(s => s.trim()),
  credentials: true,
}));

// Global Origin/Referer check to protect mutating methods from CSRF
app.use((req, res, next) => {
  const mutatingMethods = ['POST', 'PATCH', 'DELETE', 'PUT'];
  if (mutatingMethods.includes(req.method)) {
    const origin = req.headers.origin || '';
    const referer = req.headers.referer || '';
    const expected = process.env.CORS_ORIGIN || `http://localhost:${PORT}`;
    const allowedOrigins = expected.split(',').map(s => s.trim().toLowerCase());
    
    let isAllowed = false;
    if (origin) {
      isAllowed = allowedOrigins.some(ao => {
        const o = origin.toLowerCase();
        return o === ao || o === `${ao}/`;
      });
    } else if (referer) {
      isAllowed = allowedOrigins.some(ao => {
        const r = referer.toLowerCase();
        return r === ao || r.startsWith(`${ao}/`);
      });
    } else {
      // Programmatic requests (not from browser sandbox) are safe from browser-based CSRF
      isAllowed = true;
    }
    
    if (!isAllowed) {
      console.warn(`[CSRF-BLOCKED] Request from origin "${origin}" or referer "${referer}" blocked.`);
      return res.status(403).json({ error: 'CSRF validation failed. Request origin not allowed.' });
    }
  }
  next();
});

app.use(cookieParser());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Global rate limit on all API routes
app.use('/api', globalApiLimiter);

// ─── UPLOAD ACCESS CONTROL (HYBRID) ────────────────────────────────────────
// Public uploads: gallery, materials, avatars, notices — accessible without auth
// Protected uploads: admissions — require valid JWT (sensitive PII: marksheets, photos)

app.use('/uploads/gallery', globalApiLimiter, express.static(path.join(uploadsRoot, 'gallery')));
app.use('/uploads/materials', globalApiLimiter, express.static(path.join(uploadsRoot, 'materials')));
app.use('/uploads/avatars', globalApiLimiter, express.static(path.join(uploadsRoot, 'avatars')));
app.use('/uploads/notices', globalApiLimiter, express.static(path.join(uploadsRoot, 'notices')));

// Protected: admission documents require authentication
const authGuardForUploads = createAuthMiddleware(JWT_SECRET);
app.use('/uploads/admissions', authGuardForUploads, express.static(path.join(uploadsRoot, 'admissions')));

// Fallback: any other uploads subdirectory (e.g. future ones) requires auth
app.use('/uploads', authGuardForUploads, express.static(uploadsRoot));

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const mem = process.memoryUsage();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
      memory: {
        usedMB: Math.round(mem.heapUsed / 1024 / 1024),
        totalMB: Math.round(mem.heapTotal / 1024 / 1024),
      },
      uptime: process.uptime(),
    });
  } catch (e) {
    res.status(503).json({ status: 'error', error: e.message });
  }
});

app.get('/api/docs', (_req, res) => {
  res.json(openApiSpec);
});

app.use('/api/auth', authRouter({ jwtSecret: JWT_SECRET, jwtExpiresIn: JWT_EXPIRES_IN, auditLog }));
app.use('/api/public', publicRouter({ jwtSecret: JWT_SECRET, auditLog }));
app.use('/api/admin', adminRouter({ jwtSecret: JWT_SECRET, auditLog }));
app.use('/api/admin/placement', adminPlacementRouter({ jwtSecret: JWT_SECRET, auditLog }));
app.use('/api/admin/timetable', adminTimetableRouter({ jwtSecret: JWT_SECRET, auditLog }));
app.use('/api/admin/library', adminLibraryRouter({ jwtSecret: JWT_SECRET, auditLog }));
app.use('/api/admin/exams', adminExamRouter({ jwtSecret: JWT_SECRET, auditLog }));
app.use('/api/admin/fees', adminFeeRouter({ jwtSecret: JWT_SECRET, auditLog }));
app.use('/api/teacher', teacherRouter({ jwtSecret: JWT_SECRET, jwtExpiresIn: JWT_EXPIRES_IN, auditLog }));
app.use('/api/teacher/timetable', teacherTimetableRouter({ jwtSecret: JWT_SECRET, auditLog }));
app.use('/api/teacher/exams', teacherExamRouter({ jwtSecret: JWT_SECRET, auditLog }));
app.use('/api/student', studentRouter({ jwtSecret: JWT_SECRET, jwtExpiresIn: JWT_EXPIRES_IN, auditLog }));
app.use('/api/student/placement', studentPlacementRouter({ jwtSecret: JWT_SECRET, jwtExpiresIn: JWT_EXPIRES_IN, auditLog }));
app.use('/api/student/timetable', studentTimetableRouter({ jwtSecret: JWT_SECRET, auditLog }));
app.use('/api/student/library', studentLibraryRouter({ jwtSecret: JWT_SECRET, auditLog }));
app.use('/api/student/exams', studentExamRouter({ jwtSecret: JWT_SECRET, auditLog }));
app.use('/api/student/fees', studentFeeRouter({ jwtSecret: JWT_SECRET, auditLog }));
app.use('/api/messenger', messengerRouter({ jwtSecret: JWT_SECRET, auditLog }));
app.use('/api/notifications', notificationsRouter({ jwtSecret: JWT_SECRET }));
app.use('/api/payments', paymentsRouter({ jwtSecret: JWT_SECRET, auditLog }));

app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  next();
});

app.get(['/admin', '/admin/'], (req, res) => {
  res.sendFile(path.join(siteRoot, 'admin', 'index.html'));
});
app.use((req, res, next) => {
  const p = req.path.toLowerCase();
  if (
    p.startsWith('/server') ||
    p.startsWith('/.git') ||
    p.startsWith('/node_modules') ||
    p.includes('.env') ||
    p.endsWith('.json') ||
    p.endsWith('.yml') ||
    p.endsWith('.md')
  ) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
});
app.use(express.static(siteRoot));

// Catch-all: serve 404 page for unmatched non-API routes
app.use((req, res, next) => {
  if (req.accepts('html')) {
    return res.status(404).sendFile(path.join(siteRoot, '404.html'));
  }
  next();
});

app.use(errorHandler);

async function boot() {
  try {
    await prisma.$connect();
    const server = app.listen(PORT, () => {
      console.log(`SSC College CMS running at http://localhost:${PORT}`);
      console.log(`SQLite via Prisma (DATABASE_URL in .env)`);
      console.log(`Health: http://localhost:${PORT}/api/health`);
      console.log(`Security: helmet ✓ | rate-limit ✓ | CORS: ${CORS_ORIGIN}`);
    });
    server.timeout = 30000; // 30 second request timeout

    const shutdown = async (signal) => {
      console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
      server.close(async () => {
        console.log('HTTP server closed.');
        try {
          await disconnectRedis();
          await prisma.$disconnect();
          console.log('Database and Redis disconnected.');
          process.exit(0);
        } catch (err) {
          console.error('Error during shutdown cleanup:', err);
          process.exit(1);
        }
      });
      // Force exit after 10 seconds if hanging
      setTimeout(() => {
        console.error('Graceful shutdown timed out. Forcing exit.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Crash-safe: log and exit on unhandled errors to avoid silent failures
    process.on('unhandledRejection', (reason) => {
      console.error('[FATAL] Unhandled Promise Rejection:', reason);
      shutdown('unhandledRejection');
    });
    process.on('uncaughtException', (err) => {
      console.error('[FATAL] Uncaught Exception:', err);
      shutdown('uncaughtException');
    });

  } catch (err) {
    console.error('Database connection failed:', err.message);
    console.error('Run: npx prisma db push');
    console.error('Set DATABASE_URL in server/.env (see .env.example)');
    process.exit(1);
  }
}

boot();
