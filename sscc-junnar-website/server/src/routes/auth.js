import { Router } from 'express';
import { prisma, withMongoId } from '../db/client.js';
import { hashPassword, verifyPassword, signToken, verifyToken } from '../utils/auth.js';
import { Role } from '@prisma/client';
import { loginLimiter, adminAccessLimiter } from '../middleware/rateLimit.js';
import { createAuthMiddleware } from '../middleware/auth.js';

export function authRouter({ jwtSecret, jwtExpiresIn }) {
  const r = Router();

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
  }

  r.post('/register-student', async (req, res) => {
    return res.status(403).json({ error: 'Self-registration is disabled. Students must be admitted by the administrator.' });
  });

  /** Unlock admin UI with server-side key from .env; issues JWT for existing admin user. */
  r.post('/admin-access', adminAccessLimiter, async (req, res) => {
    const expected = process.env.ADMIN_ACCESS_KEY;
    if (expected == null || String(expected).trim() === '') {
      return res.status(503).json({ error: 'ADMIN_ACCESS_KEY is not set in server/.env' });
    }
    const { accessKey } = req.body || {};
    if (String(accessKey || '') !== String(expected)) {
      // Log failed admin access attempt for security audit
      const ip = req.ip || req.connection?.remoteAddress || 'unknown';
      console.warn(`[SECURITY] Failed admin-access attempt from IP: ${ip} at ${new Date().toISOString()}`);
      return res.status(401).json({ error: 'Invalid access key' });
    }
    const admin = await prisma.user.findFirst({
      where: { role: Role.admin, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!admin) {
      return res.status(503).json({ error: 'No admin user in database. Run npm run seed in server/ once.' });
    }
    const token = signToken({ _id: admin.id, role: admin.role, email: admin.email }, jwtSecret, jwtExpiresIn);
    res.json({
      token,
      user: withMongoId({
        id: admin.id,
        email: admin.email,
        role: admin.role,
        name: admin.name,
        phone: admin.phone,
        teacherProfile: admin.teacherProfile,
        studentProfile: admin.studentProfile,
      }),
    });
  });

  r.post('/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const searchId = String(email).toLowerCase().trim();
    let user = await prisma.user.findUnique({
      where: { email: searchId },
    });
    if (!user) {
      const allStudents = await prisma.user.findMany({
        where: { role: Role.student }
      });
      user = allStudents.find(s => {
        const sp = s.studentProfile && typeof s.studentProfile === 'object' ? s.studentProfile : {};
        const sId = String(sp.studentId || '').toLowerCase().trim();
        const pEmail = String(sp.personalEmail || '').toLowerCase().trim();
        const cEmail = String(sp.collegeEmail || '').toLowerCase().trim();
        return sId === searchId || pEmail === searchId || cEmail === searchId;
      });
    }
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken({ _id: user.id, role: user.role, email: user.email }, jwtSecret, jwtExpiresIn);
    res.json({
      token,
      mustChangePassword: user.mustChangePassword || false,
      user: withMongoId({
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        phone: user.phone,
        teacherProfile: user.teacherProfile,
        studentProfile: user.studentProfile,
      }),
    });
  });

  // ── Change Password ───────────────────────────────────────────────────
  const auth = createAuthMiddleware(jwtSecret);

  r.post('/change-password', auth, async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }
    // Strength: must contain uppercase, lowercase, digit, special
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasDigit = /[0-9]/.test(newPassword);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"|,.<>\/?]/.test(newPassword);
    if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
      return res.status(400).json({ error: 'Password must contain uppercase, lowercase, digit, and special character' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(newPassword),
        mustChangePassword: false,
      },
    });

    res.json({ ok: true, message: 'Password changed successfully' });
  });

  r.get('/me', async (req, res) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    try {
      const payload = verifyToken(token, jwtSecret);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          role: true,
          name: true,
          phone: true,
          avatarUrl: true,
          bio: true,
          teacherProfile: true,
          studentProfile: true,
          isActive: true,
          mustChangePassword: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid user' });
      res.json({ user: withMongoId(user) });
    } catch {
      res.status(401).json({ error: 'Invalid token' });
    }
  });

  return r;
}
