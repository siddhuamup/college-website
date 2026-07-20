import { verifyToken } from '../utils/auth.js';
import { prisma } from '../db/client.js';
import { isBlacklisted } from '../utils/tokenBlacklist.js';

/**
 * JWT authentication middleware.
 * Reads JWT from httpOnly cookie (preferred) or Authorization header (fallback for API clients).
 * Checks the token blacklist and verifies the user is still active in the database.
 */
export function createAuthMiddleware(jwtSecret) {
  return async function requireAuth(req, res, next) {
    // Prefer httpOnly cookie, fall back to Authorization header for API/test clients
    let token = req.cookies?.ssc_token || null;
    if (!token) {
      const header = req.headers.authorization || '';
      token = header.startsWith('Bearer ') ? header.slice(7) : null;
    }
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check token blacklist (logout invalidation)
    if (isBlacklisted(token)) {
      return res.status(401).json({ error: 'Token has been invalidated. Please log in again.' });
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
      req._token = token; // Store for logout blacklisting
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
