import { Router } from 'express';
import { prisma, withMongoId } from '../db/client.js';
import { hashPassword, verifyPassword, signToken, verifyToken } from '../utils/auth.js';
import { Role } from '@prisma/client';

export function authRouter({ jwtSecret, jwtExpiresIn }) {
  const r = Router();

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
  }

  r.post('/register-student', async (req, res) => {
    return res.status(403).json({ error: 'Self-registration is disabled. Students must be admitted by the administrator.' });
  });

  /** Unlock admin UI with server-side key from .env; issues JWT for existing admin user (same as password login). */
  r.post('/admin-access', async (req, res) => {
    const expected = process.env.ADMIN_ACCESS_KEY;
    if (expected == null || String(expected).trim() === '') {
      return res.status(503).json({ error: 'ADMIN_ACCESS_KEY is not set in server/.env' });
    }
    const { accessKey } = req.body || {};
    if (String(accessKey || '') !== String(expected)) {
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

  r.post('/login', async (req, res) => {
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
