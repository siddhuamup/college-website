/**
 * Rate Limiting Middleware — Security hardening for brute-force protection.
 *
 * Limiters:
 *   loginLimiter        — 10 req / 15 min per IP (login endpoints)
 *   adminAccessLimiter  — 5 req / 15 min per IP (admin key endpoint)
 *   publicFormLimiter   — 20 req / 15 min per IP (admissions, feedback)
 *   globalApiLimiter    — 100 req / 1 min per IP (all /api/* routes)
 *
 * Uses Redis store when REDIS_URL is set (persists across restarts/cluster instances).
 * Falls back to in-memory store when Redis is unavailable.
 */
import rateLimit from 'express-rate-limit';
import { prisma } from '../db/client.js';

// Build Redis store if available, otherwise use default in-memory
let redisStore = undefined;
try {
  if (process.env.REDIS_URL) {
    const { default: RedisStore } = await import('rate-limit-redis');
    const { default: Redis } = await import('ioredis');
    const redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
    redisStore = new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
      prefix: 'rl:',
    });
    console.log('[RATE-LIMIT] Using Redis store');
  }
} catch {
  console.warn('[RATE-LIMIT] Redis store unavailable, using in-memory fallback');
}

function rateLimitAuditLog(req, _res, _next) {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const route = req.originalUrl || req.url;
  const method = req.method;
  const timestamp = new Date().toISOString();
  console.warn(
    `[RATE-LIMIT-BLOCKED] ${timestamp} | IP: ${ip} | ${method} ${route}`
  );
}

// Helper middleware to bypass rate limits during testing
const skipInTest = (limiter) => {
  return (req, res, next) => {
    if (process.env.NODE_ENV === 'test') {
      return next();
    }
    return limiter(req, res, next);
  };
};

export const loginLimiter = skipInTest(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
  handler: (req, res, next, options) => {
    rateLimitAuditLog(req, res, next);
    res.status(429).json(options.message);
  },
}));

export const adminAccessLimiter = skipInTest(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,
  message: { error: 'Too many admin access attempts. Please try again after 15 minutes.' },
  handler: (req, res, next, options) => {
    rateLimitAuditLog(req, res, next);
    res.status(429).json(options.message);
  },
}));

export const meLimiter = skipInTest(rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,
  message: { error: 'Too many identity verification attempts. Please slow down.' },
  handler: (req, res, next, options) => {
    rateLimitAuditLog(req, res, next);
    res.status(429).json(options.message);
  },
}));

export const publicFormLimiter = skipInTest(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,
  message: { error: 'Too many submissions. Please try again later.' },
  handler: (req, res, next, options) => {
    rateLimitAuditLog(req, res, next);
    res.status(429).json(options.message);
  },
}));

export const globalApiLimiter = skipInTest(rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,
  message: { error: 'Too many requests. Please slow down.' },
  handler: (req, res, next, options) => {
    rateLimitAuditLog(req, res, next);
    res.status(429).json(options.message);
  },
}));

// ── Account Lockout (email-based with DB persistence) ──────────────────────
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const loginAttempts = new Map();

// Periodic DB cleanup of expired lockouts
setInterval(async () => {
  const now = Date.now();
  for (const [email, entry] of loginAttempts) {
    if (entry.lockedUntil && entry.lockedUntil <= now) {
      loginAttempts.delete(email);
    } else if (now - entry.firstFailure > LOCKOUT_DURATION_MS) {
      loginAttempts.delete(email);
    }
  }
  try {
    const records = await prisma.collegeSettings.findMany({
      where: { key: { startsWith: 'lockout:' } }
    });
    for (const rec of records) {
      const val = rec.value || {};
      if (val.lockedUntil && val.lockedUntil <= now) {
        await prisma.collegeSettings.delete({ where: { key: rec.key } }).catch(() => {});
      } else if (val.firstFailure && (now - val.firstFailure > LOCKOUT_DURATION_MS)) {
        await prisma.collegeSettings.delete({ where: { key: rec.key } }).catch(() => {});
      }
    }
  } catch { /* DB transient error catch */ }
}, 30 * 60 * 1000).unref();

/**
 * Middleware to check if the email in req.body is locked out.
 * Use BEFORE the login handler.
 */
export async function checkAccountLockout(req, res, next) {
  if (process.env.NODE_ENV === 'test') return next();
  const email = String(req.body?.email || '').toLowerCase().trim();
  if (!email) return next();

  let entry = loginAttempts.get(email);
  if (!entry) {
    try {
      const dbRec = await prisma.collegeSettings.findUnique({
        where: { key: `lockout:${email}` }
      });
      if (dbRec && dbRec.value) {
        entry = dbRec.value;
        loginAttempts.set(email, entry);
      }
    } catch (err) {
      console.warn('Failed to query DB lockout state:', err.message);
    }
  }

  if (entry?.lockedUntil) {
    if (Date.now() < entry.lockedUntil) {
      const remainingMin = Math.ceil((entry.lockedUntil - Date.now()) / 60000);
      console.warn(`[ACCOUNT-LOCKED] ${email} locked for ${remainingMin} more minutes`);
      return res.status(429).json({
        error: `Account temporarily locked due to too many failed attempts. Try again in ${remainingMin} minute(s).`,
      });
    }
    // Lockout expired
    loginAttempts.delete(email);
    prisma.collegeSettings.delete({ where: { key: `lockout:${email}` } }).catch(() => {});
  }
  next();
}

/**
 * Record a failed login attempt for the given email.
 * Call this from the login route when credentials are invalid.
 */
export async function recordFailedLogin(email) {
  if (process.env.NODE_ENV === 'test' || !email) return;
  const key = String(email).toLowerCase().trim();
  const now = Date.now();
  
  if (loginAttempts.size > 5000) {
    let dropped = 0;
    for (const [k, e] of loginAttempts.entries()) {
      const expired = e.lockedUntil && e.lockedUntil <= now;
      const windowExpired = now - e.firstFailure > LOCKOUT_DURATION_MS * 2;
      if (expired || windowExpired) {
        loginAttempts.delete(k);
        dropped++;
      }
      if (dropped >= 1000) break;
    }
    // Fallback: If map is still full of active non-expired locks, force evict to prevent OOM
    if (loginAttempts.size > 5000) {
      let forced = 0;
      for (const k of loginAttempts.keys()) {
        loginAttempts.delete(k);
        if (++forced > 500) break;
      }
    }
  }
  
  let entry = loginAttempts.get(key);
  if (!entry) {
    try {
      const dbRec = await prisma.collegeSettings.findUnique({
        where: { key: `lockout:${key}` }
      });
      if (dbRec && dbRec.value) {
        entry = dbRec.value;
      }
    } catch {}
  }
  
  if (!entry) {
    entry = { count: 0, firstFailure: now, lockedUntil: null };
  }

  // Reset counter if window expired
  if (now - entry.firstFailure > LOCKOUT_DURATION_MS) {
    entry.count = 0;
    entry.firstFailure = now;
    entry.lockedUntil = null;
  }

  entry.count++;
  if (entry.count >= MAX_FAILED_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_DURATION_MS;
    console.warn(`[ACCOUNT-LOCKOUT] ${key} locked after ${entry.count} failed attempts`);
  }
  loginAttempts.set(key, entry);

  try {
    await prisma.collegeSettings.upsert({
      where: { key: `lockout:${key}` },
      update: { value: entry },
      create: { key: `lockout:${key}`, value: entry }
    });
  } catch (err) {
    console.warn('Failed to persist lockout to DB:', err.message);
  }
}

/**
 * Clear failed login attempts for an email (call on successful login).
 */
export async function clearFailedLogins(email) {
  if (!email) return;
  const key = String(email).toLowerCase().trim();
  loginAttempts.delete(key);
  try {
    await prisma.collegeSettings.delete({ where: { key: `lockout:${key}` } });
  } catch {}
}
