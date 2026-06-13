import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { prisma, withMongoId } from '../db/client.js';
import { createAuthMiddleware, requireRole } from '../middleware/auth.js';
import { hashPassword } from '../utils/auth.js';
import { uploadNoticePdf, uploadGalleryImage, uploadsPath } from '../multer/configure.js';
import { Role } from '@prisma/client';

function stripHash(user) {
  if (!user) return user;
  const { passwordHash, ...rest } = user;
  return withMongoId(rest);
}

function noticePdfUrl(n) {
  const p = n.pdfFile;
  const stored = p && typeof p === 'object' && p !== null && 'storedName' in p ? p.storedName : null;
  return stored ? `/uploads/notices/${stored}` : null;
}

export function adminRouter({ jwtSecret }) {
  const r = Router();
  const auth = createAuthMiddleware(jwtSecret);
  r.use(auth, requireRole('admin'));

  r.get('/dashboard/stats', async (_req, res) => {
    const [students, teachers, totalAdmissions, pendingAdmissions, noticesCount, feedbackCount] = await Promise.all([
      prisma.user.count({ where: { role: Role.student, isActive: true } }),
      prisma.user.count({ where: { role: Role.teacher, isActive: true } }),
      prisma.admissionApplication.count(),
      prisma.admissionApplication.count({ where: { status: 'pending' } }),
      prisma.notice.count({ where: { isPublished: true } }),
      prisma.feedback.count(),
    ]);
    res.json({ students, teachers, totalAdmissions, pendingAdmissions, noticesCount, feedbackCount });
  });

  r.get('/students', async (_req, res) => {
    const list = await prisma.user.findMany({
      where: { role: Role.student },
      orderBy: { name: 'asc' },
    });
    res.json(list.map(stripHash));
  });

  r.post('/students', async (req, res) => {
    const { email, password, name, phone, rollNumber, className, courseName, year } = req.body || {};
    if (!email || !password || !name) return res.status(400).json({ error: 'email, password, name required' });
    const exists = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
    if (exists) return res.status(409).json({ error: 'Email already registered' });
    const user = await prisma.user.create({
      data: {
        email: String(email).toLowerCase().trim(),
        passwordHash: await hashPassword(String(password)),
        role: Role.student,
        name: String(name).trim(),
        phone: phone || '',
        studentProfile: {
          rollNumber: rollNumber || '',
          className: className || '',
          courseName: courseName || '',
          year: year || '',
        },
      },
    });
    res.status(201).json({ user: stripHash(user) });
  });

  r.patch('/students/:id', async (req, res) => {
    const u = await prisma.user.findFirst({ where: { id: req.params.id, role: Role.student } });
    if (!u) return res.status(404).json({ error: 'Not found' });
    const { name, phone, isActive, studentProfile, password } = req.body || {};
    const data = {};
    if (name) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (isActive !== undefined) data.isActive = isActive;
    if (password) data.passwordHash = await hashPassword(String(password));
    if (studentProfile) {
      const cur = (u.studentProfile && typeof u.studentProfile === 'object' ? u.studentProfile : {}) || {};
      data.studentProfile = { ...cur, ...studentProfile };
    }
    const updated = await prisma.user.update({ where: { id: u.id }, data });
    res.json({ user: stripHash(updated) });
  });

  r.delete('/students/:id', async (req, res) => {
    const r0 = await prisma.user.deleteMany({ where: { id: req.params.id, role: Role.student } });
    if (!r0.count) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  });

  r.get('/teachers', async (_req, res) => {
    const list = await prisma.user.findMany({
      where: { role: Role.teacher },
      orderBy: { name: 'asc' },
    });
    res.json(list.map(stripHash));
  });

  r.post('/teachers', async (req, res) => {
    const { email, password, name, phone, employeeId, department, designation, qualifications, assignments } =
      req.body || {};
    if (!email || !password || !name) return res.status(400).json({ error: 'email, password, name required' });
    const exists = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
    if (exists) return res.status(409).json({ error: 'Email already registered' });
    const user = await prisma.user.create({
      data: {
        email: String(email).toLowerCase().trim(),
        passwordHash: await hashPassword(String(password)),
        role: Role.teacher,
        name: String(name).trim(),
        phone: phone || '',
        teacherProfile: {
          employeeId: employeeId || '',
          department: department || '',
          designation: designation || 'Assistant Professor',
          qualifications: qualifications || '',
          assignments: Array.isArray(assignments) ? assignments : [],
        },
      },
    });
    res.status(201).json({ user: stripHash(user) });
  });

  r.patch('/teachers/:id', async (req, res) => {
    const u = await prisma.user.findFirst({ where: { id: req.params.id, role: Role.teacher } });
    if (!u) return res.status(404).json({ error: 'Not found' });
    const { name, phone, isActive, teacherProfile, password, bio } = req.body || {};
    const data = {};
    if (name) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (bio !== undefined) data.bio = bio;
    if (isActive !== undefined) data.isActive = isActive;
    if (password) data.passwordHash = await hashPassword(String(password));
    if (teacherProfile) {
      const cur = (u.teacherProfile && typeof u.teacherProfile === 'object' ? u.teacherProfile : {}) || {};
      data.teacherProfile = {
        ...cur,
        ...teacherProfile,
        assignments: teacherProfile.assignments ?? cur.assignments ?? [],
      };
    }
    const updated = await prisma.user.update({ where: { id: u.id }, data });
    res.json({ user: stripHash(updated) });
  });

  r.delete('/teachers/:id', async (req, res) => {
    const r0 = await prisma.user.deleteMany({ where: { id: req.params.id, role: Role.teacher } });
    if (!r0.count) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  });

  r.get('/admissions', async (_req, res) => {
    const list = await prisma.admissionApplication.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json(list.map(withMongoId));
  });

  r.get('/admissions/:id', async (req, res) => {
    const doc = await prisma.admissionApplication.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    const rawFiles = doc.documentFiles;
    const files = Array.isArray(rawFiles) ? rawFiles : [];
    const documentFiles = files.map((f) => ({
      originalName: f.originalName,
      mimeType: f.mimeType,
      url: f.storedName ? `/uploads/admissions/${f.storedName}` : null,
    }));
    const { documentFiles: _drop, ...rest } = doc;
    res.json(withMongoId({ ...rest, documentFiles }));
  });

  r.patch('/admissions/:id/verify', async (req, res) => {
    const doc = await prisma.admissionApplication.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    const updated = await prisma.admissionApplication.update({
      where: { id: doc.id },
      data: {
        documentsVerified: Boolean(req.body?.documentsVerified),
        ...(req.body?.verificationNotes !== undefined
          ? { verificationNotes: String(req.body.verificationNotes) }
          : {}),
      },
    });
    res.json(withMongoId(updated));
  });

  r.post('/admissions/:id/decision', async (req, res) => {
    const doc = await prisma.admissionApplication.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    const { status, notes, createAccount, rollNumber, className, courseName, year, defaultPassword } =
      req.body || {};
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    let createdUser;
    let plainPassword;
    if (status === 'approved' && createAccount) {
      const existing = await prisma.user.findUnique({ where: { email: doc.email } });
      if (existing) {
        return res.status(409).json({ error: 'A user with this email already exists' });
      }
      plainPassword = defaultPassword || `SSC${doc.applicationNumber.slice(-6)}!`;
      createdUser = await prisma.user.create({
        data: {
          email: doc.email,
          passwordHash: await hashPassword(plainPassword),
          role: Role.student,
          name: doc.fullName,
          phone: doc.phone,
          studentProfile: {
            rollNumber: rollNumber || doc.applicationNumber,
            className: className || 'FY-General',
            courseName: courseName || doc.courseApplied,
            year: year || '1',
            admissionApplicationId: doc.id,
          },
        },
      });
    }

    const application = await prisma.admissionApplication.update({
      where: { id: doc.id },
      data: {
        status,
        ...(notes !== undefined ? { verificationNotes: String(notes) } : {}),
        reviewedById: req.user.id,
        reviewedAt: new Date(),
        ...(createdUser
          ? {
              createdStudentUserId: createdUser.id,
              tempPasswordHint: 'Use the password returned once to the admin console',
            }
          : {}),
      },
    });

    res.json({
      application: withMongoId(application),
      studentAccount:
        createdUser && plainPassword
          ? { email: createdUser.email, temporaryPassword: plainPassword, userId: createdUser.id }
          : null,
    });
  });

  r.get('/notices', async (_req, res) => {
    const items = await prisma.notice.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(items.map((n) => withMongoId({ ...n, pdfUrl: noticePdfUrl(n) })));
  });

  r.post('/notices', uploadNoticePdf.single('pdf'), async (req, res) => {
    const { title, body, isPublished } = req.body || {};
    if (!title) return res.status(400).json({ error: 'title required' });
    const pdfFile = req.file
      ? { originalName: req.file.originalname, storedName: req.file.filename }
      : undefined;
    const n = await prisma.notice.create({
      data: {
        title: String(title),
        body: body || '',
        pdfFile: pdfFile ?? undefined,
        isPublished: !(isPublished === false || isPublished === 'false'),
        createdById: req.user.id,
      },
    });
    res.status(201).json(withMongoId(n));
  });

  function optionalNoticePdf(req, res, next) {
    if (String(req.headers['content-type'] || '').includes('multipart/form-data')) {
      return uploadNoticePdf.single('pdf')(req, res, next);
    }
    next();
  }

  r.patch('/notices/:id', optionalNoticePdf, async (req, res) => {
    const n = await prisma.notice.findUnique({ where: { id: req.params.id } });
    if (!n) return res.status(404).json({ error: 'Not found' });
    const data = {};
    if (req.body.title) data.title = req.body.title;
    if (req.body.body !== undefined) data.body = req.body.body;
    if (req.body.isPublished !== undefined) {
      const v = req.body.isPublished;
      data.isPublished = !(v === false || v === 'false');
    }
    if (req.file) {
      const old = n.pdfFile;
      const oldName = old && typeof old === 'object' && old !== null && 'storedName' in old ? old.storedName : null;
      if (oldName) {
        const oldPath = path.join(uploadsPath(), 'notices', oldName);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      data.pdfFile = { originalName: req.file.originalname, storedName: req.file.filename };
    }
    const updated = await prisma.notice.update({ where: { id: n.id }, data });
    res.json(withMongoId(updated));
  });

  r.delete('/notices/:id', async (req, res) => {
    const n = await prisma.notice.findUnique({ where: { id: req.params.id } });
    if (!n) return res.status(404).json({ error: 'Not found' });
    const p = n.pdfFile;
    const stored = p && typeof p === 'object' && p !== null && 'storedName' in p ? p.storedName : null;
    if (stored) {
      const fp = path.join(uploadsPath(), 'notices', stored);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    await prisma.notice.delete({ where: { id: n.id } });
    res.json({ ok: true });
  });

  r.get('/departments', async (_req, res) => {
    const list = await prisma.department.findMany({ orderBy: { name: 'asc' } });
    res.json(list.map(withMongoId));
  });

  r.post('/departments', async (req, res) => {
    const d = await prisma.department.create({ data: req.body || {} });
    res.status(201).json(withMongoId(d));
  });

  r.patch('/departments/:id', async (req, res) => {
    try {
      const d = await prisma.department.update({
        where: { id: req.params.id },
        data: req.body || {},
      });
      res.json(withMongoId(d));
    } catch {
      res.status(404).json({ error: 'Not found' });
    }
  });

  r.delete('/departments/:id', async (req, res) => {
    try {
      await prisma.department.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    } catch {
      res.status(404).json({ error: 'Not found' });
    }
  });

  r.get('/courses', async (_req, res) => {
    const courses = await prisma.course.findMany({
      include: { department: true },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });
    res.json(
      courses.map((c) => {
        const { department, ...rest } = c;
        return withMongoId({
          ...rest,
          departmentId: department ? withMongoId(department) : null,
        });
      })
    );
  });

  r.post('/courses', async (req, res) => {
    const c = await prisma.course.create({ data: req.body || {} });
    res.status(201).json(withMongoId(c));
  });

  r.patch('/courses/:id', async (req, res) => {
    try {
      const c = await prisma.course.update({
        where: { id: req.params.id },
        data: req.body || {},
      });
      res.json(withMongoId(c));
    } catch {
      res.status(404).json({ error: 'Not found' });
    }
  });

  r.delete('/courses/:id', async (req, res) => {
    try {
      await prisma.course.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    } catch {
      res.status(404).json({ error: 'Not found' });
    }
  });

  r.get('/gallery', async (_req, res) => {
    const items = await prisma.galleryItem.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json(
      items.map((g) => {
        const img = g.imageFile;
        const stored = img && typeof img === 'object' && img !== null && 'storedName' in img ? img.storedName : null;
        return withMongoId({
          ...g,
          imageUrl: stored ? `/uploads/gallery/${stored}` : null,
        });
      })
    );
  });

  r.post('/gallery', uploadGalleryImage.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'image required' });
    const g = await prisma.galleryItem.create({
      data: {
        caption: req.body?.caption || '',
        sortOrder: Number(req.body?.sortOrder) || 0,
        imageFile: { originalName: req.file.originalname, storedName: req.file.filename },
      },
    });
    res.status(201).json(
      withMongoId({
        ...g,
        imageUrl: `/uploads/gallery/${req.file.filename}`,
      })
    );
  });

  r.delete('/gallery/:id', async (req, res) => {
    const g = await prisma.galleryItem.findUnique({ where: { id: req.params.id } });
    if (!g) return res.status(404).json({ error: 'Not found' });
    const img = g.imageFile;
    const stored = img && typeof img === 'object' && img !== null && 'storedName' in img ? img.storedName : null;
    if (stored) {
      const p = path.join(uploadsPath(), 'gallery', stored);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    await prisma.galleryItem.delete({ where: { id: g.id } });
    res.json({ ok: true });
  });

  r.get('/feedback', async (_req, res) => {
    const list = await prisma.feedback.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    res.json(list.map(withMongoId));
  });

  r.get('/settings', async (_req, res) => {
    const rows = await prisma.collegeSettings.findMany();
    const obj = {};
    for (const row of rows) obj[row.key] = row.value;
    res.json(obj);
  });

  r.put('/settings', async (req, res) => {
    const body = req.body || {};
    for (const [key, value] of Object.entries(body)) {
      await prisma.collegeSettings.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    }
    const rows = await prisma.collegeSettings.findMany();
    const obj = {};
    for (const row of rows) obj[row.key] = row.value;
    res.json(obj);
  });

  r.get('/study-materials', async (_req, res) => {
    const list = await prisma.studyMaterial.findMany({
      include: {
        teacher: {
          select: { name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(list.map(m => {
      const f = m.file;
      const stored = f && typeof f === 'object' && f !== null && 'storedName' in f ? f.storedName : null;
      return withMongoId({
        ...m,
        fileUrl: stored ? `/uploads/materials/${stored}` : null,
      });
    }));
  });

  r.delete('/study-materials/:id', async (req, res) => {
    const m = await prisma.studyMaterial.findUnique({
      where: { id: req.params.id },
    });
    if (!m) return res.status(404).json({ error: 'Not found' });
    const f = m.file;
    const stored = f && typeof f === 'object' && f !== null && 'storedName' in f ? f.storedName : null;
    if (stored) {
      const p = path.join(uploadsPath(), 'materials', stored);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    await prisma.studyMaterial.delete({ where: { id: m.id } });
    res.json({ ok: true });
  });

  return r;
}
