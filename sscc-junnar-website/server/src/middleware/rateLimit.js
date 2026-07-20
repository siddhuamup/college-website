/**
 * Rate Limiting Middleware — Security hardening for brute-force protection.
 *
 * Limiters:
 *   loginLimiter        — 10 req / 15 min per IP (login endpoints)
 *   adminAccessLimiter  — 5 req / 15 min per IP (admin key endpoint)
 *   publicFormLimiter   — 20 req / 15 min per IP (admissions, feedback)
 *   globalApiLimiter    — 100 req / 1 min per IP (all /api/* routes)
 *
 * When a 429 is triggered, the attempt is logged with IP, route, and timestamp
 * so brute-force attempts can be traced.
 */
import rateLimit from 'express-rate-limit';

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
  message: { error: 'Too many admin access attempts. Please try again after 15 minutes.' },
  handler: (req, res, next, options) => {
    rateLimitAuditLog(req, res, next);
    res.status(429).json(options.message);
  },
}));

export const meLimiter = skipInTest(rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
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
  message: { error: 'Too many submissions. Please try again later.' },
  handler: (req, res, next, options) => {
    rateLimitAuditLog(req, res, next);
    res.status(429).json(options.message);
  },
}));

export const globalApiLimiter = skipInTest(rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
  handler: (req, res, next, options) => {
    rateLimitAuditLog(req, res, next);
    res.status(429).json(options.message);
  },
}));

// ── Account Lockout (email-based) ────────────────────────────────────────
// Tracks consecutive failed login attempts per email.
// After 5 failures in 15 minutes → account is locked out for 15 minutes.

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// Map<email, { count, firstFailure, lockedUntil }>
const loginAttempts = new Map();

// Prune expired lockout entries every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [email, entry] of loginAttempts) {
    if (entry.lockedUntil && entry.lockedUntil <= now) {
      loginAttempts.delete(email);
    } else if (now - entry.firstFailure > LOCKOUT_DURATION_MS) {
      loginAttempts.delete(email);
    }
  }
}, 30 * 60 * 1000).unref();

/**
 * Middleware to check if the email in req.body is locked out.
 * Use BEFORE the login handler.
 */
export function checkAccountLockout(req, res, next) {
  if (process.env.NODE_ENV === 'test') return next();
  const email = String(req.body?.email || '').toLowerCase().trim();
  if (!email) return next();

  const entry = loginAttempts.get(email);
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
  }
  next();
}

/**
 * Record a failed login attempt for the given email.
 * Call this from the login route when credentials are invalid.
 */
export function recordFailedLogin(email) {
  if (process.env.NODE_ENV === 'test' || !email) return;
  const key = String(email).toLowerCase().trim();
  const now = Date.now();
  const entry = loginAttempts.get(key) || { count: 0, firstFailure: now, lockedUntil: null };

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
}

/**
 * Clear failed login attempts for an email (call on successful login).
 */
export function clearFailedLogins(email) {
  if (!email) return;
  loginAttempts.delete(String(email).toLowerCase().trim());
}
