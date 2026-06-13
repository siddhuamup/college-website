import 'dotenv/config';
import express from 'express';
import 'express-async-errors';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { ensureUploadDirs, uploadsPath } from './multer/configure.js';
import { authRouter } from './routes/auth.js';
import { publicRouter } from './routes/public.js';
import { adminRouter } from './routes/admin.js';
import { teacherRouter } from './routes/teacher.js';
import { studentRouter } from './routes/student.js';
import { errorHandler } from './middleware/errorHandler.js';
import { prisma } from './db/client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.join(__dirname, '..', '..');
const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

ensureUploadDirs();
const uploadsRoot = uploadsPath();

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.use('/uploads', express.static(uploadsRoot));

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
app.use('/api/teacher', teacherRouter({ jwtSecret: JWT_SECRET, jwtExpiresIn: JWT_EXPIRES_IN }));
app.use('/api/student', studentRouter({ jwtSecret: JWT_SECRET, jwtExpiresIn: JWT_EXPIRES_IN }));

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
    app.listen(PORT, () => {
      console.log(`SSC College CMS running at http://localhost:${PORT}`);
      console.log(`SQLite via Prisma (DATABASE_URL in .env)`);
      console.log(`Health: http://localhost:${PORT}/api/health`);
    });
  } catch (err) {
    console.error('Database connection failed:', err.message);
    console.error('Run: npx prisma db push');
    console.error('Set DATABASE_URL in server/.env (see .env.example)');
    process.exit(1);
  }
}

boot();
