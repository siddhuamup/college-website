import { verifyToken } from '../utils/auth.js';
import { prisma } from '../db/client.js';

/**
 * JWT authentication middleware.
 * Verifies the Bearer token AND checks the user is still active in the database.
 * This prevents deactivated users from using valid tokens until expiry.
 */
export function createAuthMiddleware(jwtSecret) {
  return async function requireAuth(req, res, next) {
    const header = req.headers.authorization || '';
    let token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token && req.query.token) {
      token = req.query.token;
    }
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    try {
      const payload = verifyToken(token, jwtSecret);

      // Per-request DB check: verify user still exists and is active.
      // This ensures deactivation takes effect immediately, not after token expiry.
      const dbUser = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { isActive: true, isDeleted: true, mustChangePassword: true },
      });
      if (!dbUser || !dbUser.isActive || dbUser.isDeleted) {
        return res.status(401).json({ error: 'Account deactivated or not found' });
      }

      req.user = {
        id: payload.sub,
        role: payload.role,
        email: payload.email,
        mustChangePassword: dbUser.mustChangePassword,
      };
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

export function requireRole(...roles) {
  const allowed = roles.map((r) => String(r).toLowerCase());
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const role = String(req.user.role || '').toLowerCase();
    if (!allowed.includes(role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
