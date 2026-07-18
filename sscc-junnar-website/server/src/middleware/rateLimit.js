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
