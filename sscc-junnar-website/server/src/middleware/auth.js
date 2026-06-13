import { verifyToken } from '../utils/auth.js';

export function createAuthMiddleware(jwtSecret) {
  return function requireAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    try {
      const payload = verifyToken(token, jwtSecret);
      req.user = { id: payload.sub, role: payload.role, email: payload.email };
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
