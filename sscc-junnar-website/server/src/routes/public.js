import { Router } from 'express';
import { prisma, withMongoId } from '../db/client.js';
import { uploadAdmissionDocs } from '../multer/configure.js';
import { nextApplicationNumber } from '../lib/admissionNumber.js';
import { Role } from '@prisma/client';
import { filterNotices } from '../utils/notices.js';
import { noticeDto as buildNoticeDto } from '../utils/noticeDto.js';
import { publicFormLimiter } from '../middleware/rateLimit.js';

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
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const filtered = filterNotices(items, { surface: 'public' });
    res.json(filtered.map((n) => withMongoId(buildNoticeDto(n))));
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

  r.post('/feedback', publicFormLimiter, async (req, res) => {
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

  r.post('/admissions', publicFormLimiter, uploadAdmissionDocs.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'signature', maxCount: 1 },
    { name: 'marksheet', maxCount: 1 },
    { name: 'leavingCertificate', maxCount: 1 }
  ]), async (req, res) => {
    const body = req.body || {};
    const fullName = body.fullName?.trim();
    const email = body.email?.trim()?.toLowerCase();
    const phone = body.phone?.trim();
    const address = body.address?.trim();
    const courseApplied = body.courseApplied?.trim();
    const marks12 = Number(body.marks12);
    const maxMarks12 = Number(body.maxMarks12) || 600;
    const board12 = body.board12?.trim() || '';

    // Upgraded admission fields
    const dob = body.dob?.trim() || '';
    const gender = body.gender?.trim() || 'Male';
    const parentContact = body.parentContact?.trim() || '';
    const sscMarks = Number(body.sscMarks) || 0;
    const previousCollege = body.previousCollege?.trim() || '';
    const passingYear = Number(body.passingYear) || 2026;
    const category = body.category?.trim() || 'General';

    if (!fullName || !email || !phone || !address || !courseApplied || Number.isNaN(marks12)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (!isPlausibleINPhone(phone)) {
      return res.status(400).json({ error: 'Enter a valid phone number (10-digit mobile or standard landline).' });
    }

    // Compute academic year (June–May cycle: applications after June belong to next year)
    const now = new Date();
    const academicYear = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;

    // Duplicate prevention: same email + courseApplied + academicYear
    const existing = await prisma.admissionApplication.findFirst({
      where: { email, courseApplied, academicYear, isDeleted: false },
    });
    if (existing) {
      return res.status(409).json({
        error: `You have already applied for ${courseApplied} in the ${academicYear}-${academicYear + 1} academic year.`,
      });
    }

    const applicationNumber = await nextApplicationNumber();
    const documentFiles = [];
    if (req.files) {
      const fieldNames = ['photo', 'signature', 'marksheet', 'leavingCertificate'];
      fieldNames.forEach((fieldName) => {
        const files = req.files[fieldName];
        if (files && files.length > 0) {
          const f = files[0];
          documentFiles.push({
            field: fieldName,
            originalName: f.originalname,
            storedName: f.filename,
            mimeType: f.mimetype,
          });
        }
      });
    }

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
        dob,
        gender,
        parentContact,
        sscMarks,
        previousCollege,
        passingYear,
        category,
        academicYear,
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
