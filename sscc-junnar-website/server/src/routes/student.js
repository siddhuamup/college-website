import { Router } from 'express';
import { prisma, withMongoId } from '../db/client.js';
import { createAuthMiddleware, requireRole } from '../middleware/auth.js';
import { verifyPassword, signToken } from '../utils/auth.js';
import { Role } from '@prisma/client';
import { uploadAvatarImage } from '../multer/configure.js';
import { filterNotices } from '../utils/notices.js';
import { noticeDto as buildNoticeDto } from '../utils/noticeDto.js';
import { loginLimiter } from '../middleware/rateLimit.js';

function noticeDto(n) {
  return withMongoId(buildNoticeDto(n));
}

function studentNoticeContext(user) {
  const sp = user?.studentProfile && typeof user.studentProfile === 'object' ? user.studentProfile : {};
  return {
    surface: 'portal',
    role: 'student',
    userId: user?.id,
    course: sp.courseName || sp.course || '',
    year: sp.year,
    className: sp.className || '',
  };
}

function materialDto(m) {
  const f = m.file;
  const stored = f && typeof f === 'object' && f !== null && 'storedName' in f ? f.storedName : null;
  return withMongoId({
    ...m,
    fileUrl: stored ? `/uploads/materials/${stored}` : null,
  });
}

export function studentRouter({ jwtSecret, jwtExpiresIn }) {
  const r = Router();
  const auth = createAuthMiddleware(jwtSecret);

  r.post('/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const searchId = String(email).toLowerCase().trim();
    let user = await prisma.user.findUnique({
      where: { email: searchId },
    });
    if (!user) {
      // O(1) performance using SQLite JSON extraction function (avoid loading entire database into memory)
      const rawUsers = await prisma.$queryRaw`
        SELECT * FROM User 
        WHERE role = 'student' AND isDeleted = 0 AND (
          lower(json_extract(studentProfile, '$.studentId')) = ${searchId} OR 
          lower(json_extract(studentProfile, '$.personalEmail')) = ${searchId} OR 
          lower(json_extract(studentProfile, '$.collegeEmail')) = ${searchId}
        ) LIMIT 1
      `;
      user = rawUsers[0] || null;
    }
    if (!user || !user.isActive || user.isDeleted || user.role !== Role.student) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const ok = await verifyPassword(String(password), user.passwordHash);
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
        studentProfile: typeof user.studentProfile === 'string' ? JSON.parse(user.studentProfile) : user.studentProfile,
      }),
    });
  });

  r.use(auth, requireRole('student'));

  r.get('/profile', async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        phone: true,
        avatarUrl: true,
        bio: true,
        studentProfile: true,
        teacherProfile: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json(withMongoId(user));
  });

  r.get('/marks', async (req, res) => {
    const list = await prisma.mark.findMany({
      where: { studentId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(list.map(withMongoId));
  });

  r.get('/attendance', async (req, res) => {
    const list = await prisma.attendance.findMany({
      where: { studentId: req.user.id },
      orderBy: { date: 'desc' },
      take: 400,
    });
    res.json(list.map(withMongoId));
  });

  r.get('/materials', async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const sp = user?.studentProfile;
    const className = sp && typeof sp === 'object' && 'className' in sp ? sp.className : null;
    const list = await prisma.studyMaterial.findMany({
      where: className ? { className: String(className) } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    res.json(list.map(materialDto));
  });

  r.get('/notices', async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const items = await prisma.notice.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const ctx = studentNoticeContext(user);
    res.json(filterNotices(items, ctx).map(noticeDto));
  });

  r.post('/feedback', async (req, res) => {
    const { message, rating } = req.body || {};
    if (!message) return res.status(400).json({ error: 'message required' });
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const fb = await prisma.feedback.create({
      data: {
        name: user.name,
        email: user.email,
        message: String(message).trim(),
        rating: Math.min(5, Math.max(1, Number(rating) || 5)),
        userId: user.id,
        category: 'student',
      },
    });
    res.status(201).json({ ok: true, id: fb.id, _id: fb.id });
  });

  r.get('/admission-status', async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const sp = user?.studentProfile;
    let appId =
      sp && typeof sp === 'object' && 'admissionApplicationId' in sp ? sp.admissionApplicationId : null;

    let app = appId
      ? await prisma.admissionApplication.findUnique({ where: { id: String(appId) } })
      : null;
    if (!app) {
      app = await prisma.admissionApplication.findFirst({
        where: { email: user.email },
        orderBy: { createdAt: 'desc' },
      });
    }
    if (!app) return res.json({ linked: false, application: null });
    res.json({
      linked: true,
      application: {
        applicationNumber: app.applicationNumber,
        status: app.status,
        courseApplied: app.courseApplied,
        documentsVerified: app.documentsVerified,
      },
    });
  });

  r.patch('/profile', uploadAvatarImage.single('avatar'), async (req, res) => {
    const { name, phone, bio } = req.body || {};
    const updateData = {};
    if (name !== undefined) updateData.name = String(name).trim();
    if (phone !== undefined) updateData.phone = String(phone).trim();
    if (bio !== undefined) updateData.bio = String(bio).trim();
    if (req.file) {
      updateData.avatarUrl = `/uploads/avatars/${req.file.filename}`;
    }
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        phone: true,
        avatarUrl: true,
        bio: true,
        studentProfile: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      }
    });
    res.json(withMongoId(updatedUser));
  });

  return r;
}
