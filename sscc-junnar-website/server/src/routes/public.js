import { Router } from 'express';
import { prisma, withMongoId } from '../db/client.js';
import { uploadAdmissionDocs } from '../multer/configure.js';
import { nextApplicationNumber } from '../lib/admissionNumber.js';
import { Role } from '@prisma/client';

function normalizePhoneIN(phone) {
  let p = String(phone || '').replace(/[\s-]/g, '');
  if (p.startsWith('+91')) p = p.slice(3);
  if (p.length === 11 && p.startsWith('0')) p = p.slice(1);
  return p;
}

function isPlausibleINPhone(phone) {
  const p = normalizePhoneIN(phone);
  if (/^[6-9]\d{9}$/.test(p)) return true;
  if (/^\d{10,11}$/.test(p)) return true;
  return false;
}

export function publicRouter() {
  const r = Router();

  r.get('/notices', async (_req, res) => {
    const items = await prisma.notice.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(
      items.map((n) => {
        const pdf = n.pdfFile && typeof n.pdfFile === 'object' && n.pdfFile !== null && 'storedName' in n.pdfFile
          ? (n.pdfFile).storedName
          : null;
        return withMongoId({
          ...n,
          pdfUrl: pdf ? `/uploads/notices/${pdf}` : null,
        });
      })
    );
  });

  r.get('/gallery', async (_req, res) => {
    const items = await prisma.galleryItem.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    res.json(
      items.map((g) => {
        const img = g.imageFile && typeof g.imageFile === 'object' && g.imageFile !== null && 'storedName' in g.imageFile
          ? g.imageFile.storedName
          : null;
        return withMongoId({
          ...g,
          imageUrl: img ? `/uploads/gallery/${img}` : null,
        });
      })
    );
  });

  r.get('/courses', async (_req, res) => {
    const courses = await prisma.course.findMany({
      include: { department: { select: { id: true, name: true, stream: true } } },
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

  r.get('/departments', async (_req, res) => {
    const deps = await prisma.department.findMany({
      orderBy: [{ stream: 'asc' }, { name: 'asc' }],
    });
    res.json(deps.map(withMongoId));
  });

  r.get('/faculty', async (_req, res) => {
    const teachers = await prisma.user.findMany({
      where: { role: Role.teacher, isActive: true },
      select: { id: true, name: true, teacherProfile: true, bio: true, avatarUrl: true },
      orderBy: { name: 'asc' },
    });
    res.json(teachers.map(withMongoId));
  });

  r.get('/student-directory', async (_req, res) => {
    const users = await prisma.user.findMany({
      where: { role: Role.student, isActive: true },
      select: { name: true, studentProfile: true },
      orderBy: { name: 'asc' },
    });
    res.json(
      users.map((u) => {
        const sp = u.studentProfile && typeof u.studentProfile === 'object' ? u.studentProfile : {};
        return {
          name: u.name,
          rollNumber: String(sp.rollNumber || ''),
          className: String(sp.className || ''),
          courseName: String(sp.courseName || ''),
          year: String(sp.year || ''),
        };
      })
    );
  });

  r.get('/settings', async (_req, res) => {
    const rows = await prisma.collegeSettings.findMany();
    const obj = {};
    for (const row of rows) obj[row.key] = row.value;
    res.json(obj);
  });

  r.post('/feedback', async (req, res) => {
    const { name, email, message, rating } = req.body || {};
    if (!name || !message) return res.status(400).json({ error: 'Name and message required' });
    const em = email ? String(email).trim().toLowerCase() : '';
    if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    const fb = await prisma.feedback.create({
      data: {
        name: String(name).trim(),
        email: em,
        message: String(message).trim(),
        rating: Math.min(5, Math.max(1, Number(rating) || 5)),
        category: 'contact',
      },
    });
    res.status(201).json({ ok: true, id: fb.id, _id: fb.id });
  });

  r.post('/admissions', uploadAdmissionDocs.array('documents', 5), async (req, res) => {
    const body = req.body || {};
    const fullName = body.fullName?.trim();
    const email = body.email?.trim()?.toLowerCase();
    const phone = body.phone?.trim();
    const address = body.address?.trim();
    const courseApplied = body.courseApplied?.trim();
    const marks12 = Number(body.marks12);
    const maxMarks12 = Number(body.maxMarks12) || 600;
    const board12 = body.board12?.trim() || '';

    if (!fullName || !email || !phone || !address || !courseApplied || Number.isNaN(marks12)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (!isPlausibleINPhone(phone)) {
      return res.status(400).json({ error: 'Enter a valid phone number (10-digit mobile or standard landline).' });
    }

    const applicationNumber = await nextApplicationNumber();
    const documentFiles = (req.files || []).map((f) => ({
      originalName: f.originalname,
      storedName: f.filename,
      mimeType: f.mimetype,
    }));

    const appDoc = await prisma.admissionApplication.create({
      data: {
        applicationNumber,
        fullName,
        email,
        phone,
        address,
        courseApplied,
        board12,
        marks12,
        maxMarks12,
        documentFiles,
      },
    });

    res.status(201).json({
      ok: true,
      applicationNumber: appDoc.applicationNumber,
      id: appDoc.id,
      _id: appDoc.id,
      status: appDoc.status,
    });
  });

  r.get('/admission-status', async (req, res) => {
    const email = String(req.query.email || '').toLowerCase().trim();
    const applicationNumber = String(req.query.applicationNumber || '').trim();
    if (!email || !applicationNumber) {
      return res.status(400).json({ error: 'email and applicationNumber required' });
    }
    const doc = await prisma.admissionApplication.findFirst({
      where: { email, applicationNumber },
    });
    if (!doc) return res.status(404).json({ error: 'Application not found' });
    res.json({
      applicationNumber: doc.applicationNumber,
      status: doc.status,
      fullName: doc.fullName,
      courseApplied: doc.courseApplied,
      verificationNotes: doc.verificationNotes,
      documentsVerified: doc.documentsVerified,
      updatedAt: doc.updatedAt,
    });
  });

  r.get('/facilities', (_req, res) => {
    res.json({
      library:
        'Central library with over 1,09,000 books, 14 daily newspapers, e-books, reputed journals, reading hall, and e-learning/computer section.',
      sports:
        'Multi-activity indoor sports stadium, gymnasium, large outdoor playground; table tennis, badminton, basketball, and wrestling.',
      hostel: "Boys' hostel on campus (~40 students) with reading room and purified drinking water.",
      laboratories: '17 advanced laboratories for Science and Computer/IT programmes.',
      other:
        'Primary medical health centre, two cafeterias/canteens, and strong IT infrastructure.',
    });
  });

  return r;
}
