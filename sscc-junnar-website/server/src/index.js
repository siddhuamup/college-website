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
import { errorHandler } from './middleware/errorHandler.js';
import { globalApiLimiter } from './middleware/rateLimit.js';
import { prisma } from './db/client.js';
import { createAuthMiddleware } from './middleware/auth.js';

// ─── .ENV VALIDATION ────────────────────────────────────────────────────────
// Crash immediately on missing/weak critical env vars — never silently fallback.

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 64) {
  console.error('═══════════════════════════════════════════════════════════');
  console.error('  FATAL: JWT_SECRET is missing or too short.');
  console.error('  It must be set in server/.env and be at least 64 characters.');
  console.error('  Generate one: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  console.error('═══════════════════════════════════════════════════════════');
  process.exit(1);
}

const ADMIN_ACCESS_KEY = process.env.ADMIN_ACCESS_KEY;
if (!ADMIN_ACCESS_KEY || ADMIN_ACCESS_KEY.length < 16) {
  console.error('═══════════════════════════════════════════════════════════');
  console.error('  FATAL: ADMIN_ACCESS_KEY is missing or too short (min 16 chars).');
  console.error('  Set a strong, unique key in server/.env');
  console.error('═══════════════════════════════════════════════════════════');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL not set in .env');
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.join(__dirname, '..', '..');
const PORT = Number(process.env.PORT) || 3000;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

ensureUploadDirs();
const uploadsRoot = uploadsPath();

const app = express();

// ─── SECURITY MIDDLEWARE ────────────────────────────────────────────────────

// Helmet — secure HTTP headers (X-Frame-Options, CSP, etc.)
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts for vanilla JS frontend
  crossOriginEmbedderPolicy: false,
}));

// CORS — configurable whitelist (no more origin:true)
const CORS_ORIGIN = process.env.CORS_ORIGIN || `http://localhost:${PORT}`;
app.use(cors({
  origin: CORS_ORIGIN.split(',').map(s => s.trim()),
  credentials: true,
}));

app.use(express.json({ limit: '2mb' }));

// Global rate limit on all API routes
app.use('/api', globalApiLimiter);

// ─── UPLOAD ACCESS CONTROL (HYBRID) ────────────────────────────────────────
// Public uploads: gallery, materials, avatars, notices — accessible without auth
// Protected uploads: admissions — require valid JWT (sensitive PII: marksheets, photos)

app.use('/uploads/gallery', express.static(path.join(uploadsRoot, 'gallery')));
app.use('/uploads/materials', express.static(path.join(uploadsRoot, 'materials')));
app.use('/uploads/avatars', express.static(path.join(uploadsRoot, 'avatars')));
app.use('/uploads/notices', express.static(path.join(uploadsRoot, 'notices')));

// Protected: admission documents require authentication
const authGuardForUploads = createAuthMiddleware(JWT_SECRET);
app.use('/uploads/admissions', authGuardForUploads, express.static(path.join(uploadsRoot, 'admissions')));

// Fallback: any other uploads subdirectory (e.g. future ones) requires auth
app.use('/uploads', authGuardForUploads, express.static(uploadsRoot));

// ─── API ROUTES ─────────────────────────────────────────────────────────────

app.get('/api/health', async (_req, res) => {
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }
  res.json({
    ok: true,
    database: dbOk ? 'connected' : 'error',
    uptimeSec: Math.round(process.uptime()),
  });
});

app.use('/api/auth', authRouter({ jwtSecret: JWT_SECRET, jwtExpiresIn: JWT_EXPIRES_IN }));
app.use('/api/public', publicRouter());
app.use('/api/admin', adminRouter({ jwtSecret: JWT_SECRET }));
app.use('/api/admin/placement', adminPlacementRouter({ jwtSecret: JWT_SECRET }));
app.use('/api/admin/timetable', adminTimetableRouter({ jwtSecret: JWT_SECRET }));
app.use('/api/admin/library', adminLibraryRouter({ jwtSecret: JWT_SECRET }));
app.use('/api/admin/exams', adminExamRouter({ jwtSecret: JWT_SECRET }));
app.use('/api/teacher', teacherRouter({ jwtSecret: JWT_SECRET, jwtExpiresIn: JWT_EXPIRES_IN }));
app.use('/api/teacher/timetable', teacherTimetableRouter({ jwtSecret: JWT_SECRET }));
app.use('/api/teacher/exams', teacherExamRouter({ jwtSecret: JWT_SECRET }));
app.use('/api/student', studentRouter({ jwtSecret: JWT_SECRET, jwtExpiresIn: JWT_EXPIRES_IN }));
app.use('/api/student/placement', studentPlacementRouter({ jwtSecret: JWT_SECRET, jwtExpiresIn: JWT_EXPIRES_IN }));
app.use('/api/student/timetable', studentTimetableRouter({ jwtSecret: JWT_SECRET }));
app.use('/api/student/library', studentLibraryRouter({ jwtSecret: JWT_SECRET }));
app.use('/api/student/exams', studentExamRouter({ jwtSecret: JWT_SECRET }));

app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  next();
});

app.get(['/admin', '/admin/'], (req, res) => {
  res.sendFile(path.join(siteRoot, 'admin', 'index.html'));
});

app.use(express.static(siteRoot));

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

    const shutdown = async (signal) => {
      console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
      server.close(async () => {
        console.log('HTTP server closed.');
        try {
          await prisma.$disconnect();
          console.log('Prisma disconnected.');
          process.exit(0);
        } catch (err) {
          console.error('Error during Prisma disconnect:', err);
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

  } catch (err) {
    console.error('Database connection failed:', err.message);
    console.error('Run: npx prisma db push');
    console.error('Set DATABASE_URL in server/.env (see .env.example)');
    process.exit(1);
  }
}

boot();
