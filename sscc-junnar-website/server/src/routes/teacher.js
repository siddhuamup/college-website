import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { prisma, withMongoId } from '../db/client.js';
import { createAuthMiddleware, requireRole } from '../middleware/auth.js';
import { uploadStudyMaterial, uploadAvatarImage, uploadsPath, verifyMagicBytes } from '../multer/configure.js';
import { Role } from '@prisma/client';
import { verifyPassword, signToken } from '../utils/auth.js';
import { filterNotices } from '../utils/notices.js';
import { noticeDto as buildNoticeDto } from '../utils/noticeDto.js';
import { loginLimiter } from '../middleware/rateLimit.js';
import { validate, markAttendanceSchema, saveMarkSchema } from '../middleware/validation.js';
import { parsePagination, paginatedResponse } from '../utils/pagination.js';

function noticeDto(n) {
  return withMongoId(buildNoticeDto(n));
}
function assignmentCovers(assignments, className, subject) {
  return (assignments || []).some((a) => a.className === className && a.subject === subject);
}

export function teacherRouter({ jwtSecret, jwtExpiresIn }) {
  const r = Router();
  const auth = createAuthMiddleware(jwtSecret);

  r.post('/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await prisma.user.findUnique({
      where: { email: String(email).toLowerCase().trim() },
    });
    if (!user || !user.isActive || user.isDeleted || user.role !== Role.teacher) {
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
        teacherProfile: user.teacherProfile,
      }),
    });
  });

  r.use(auth, requireRole('teacher'));

  r.get('/subjects', async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const tp = user?.teacherProfile;
    const assignments =
      tp && typeof tp === 'object' && Array.isArray(tp.assignments) ? tp.assignments : [];
    res.json(assignments);
  });

  r.get('/students', async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const raw = user?.teacherProfile;
    const assignments = raw && typeof raw === 'object' && 'assignments' in raw && Array.isArray(raw.assignments) ? raw.assignments : [];
    const classes = [...new Set(assignments.map((a) => a.className).filter(Boolean))];
    if (classes.length === 0) return res.json([]);

    const all = await prisma.user.findMany({
      where: { role: Role.student, isActive: true },
      select: { id: true, name: true, email: true, studentProfile: true },
      orderBy: { name: 'asc' },
    });
    const list = all.filter((s) => {
      const sp = s.studentProfile;
      const cls = sp && typeof sp === 'object' && sp !== null && 'className' in sp ? sp.className : null;
      return cls && classes.includes(String(cls));
    });
    res.json(list.map(withMongoId));
  });

  r.post('/marks', validate(saveMarkSchema), async (req, res) => {
    const { studentId, subject, examName, marksObtained, maxMarks, term } = req.body;
    const teacher = await prisma.user.findUnique({ where: { id: req.user.id } });
    const raw = teacher?.teacherProfile;
    const assignments = raw && typeof raw === 'object' && Array.isArray(raw.assignments) ? raw.assignments : [];
    const student = await prisma.user.findFirst({
      where: { id: studentId, role: Role.student, isActive: true },
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    const sp = student.studentProfile;
    const cls = sp && typeof sp === 'object' && 'className' in sp ? sp.className : null;
    if (!cls || !assignmentCovers(assignments, cls, String(subject))) {
      return res.status(403).json({ error: 'You are not assigned to teach this subject for this class' });
    }

    const obtainedNum = Number(marksObtained);
    const maxNum = Number(maxMarks);
    if (isNaN(obtainedNum) || isNaN(maxNum) || obtainedNum < 0 || maxNum <= 0 || obtainedNum > maxNum) {
      return res.status(400).json({ error: `Marks obtained (${obtainedNum}) must be between 0 and max marks (${maxNum}).` });
    }

    const existing = await prisma.mark.findFirst({
      where: { studentId, subject: String(subject), examName: String(examName) },
    });
    if (existing) {
      if (existing.teacherId !== req.user.id) {
        return res.status(403).json({ error: 'Cannot overwrite marks entered by another teacher.' });
      }
      const m = await prisma.mark.update({
        where: { id: existing.id },
        data: {
          marksObtained: obtainedNum,
          maxMarks: maxNum,
          term: term || existing.term,
        },
      });
      return res.json(withMongoId(m));
    }
    const m = await prisma.mark.create({
      data: {
        studentId,
        teacherId: req.user.id,
        subject: String(subject),
        examName: String(examName),
        marksObtained: Number(marksObtained),
        maxMarks: Number(maxMarks),
        term: term || '',
      },
    });
    res.status(201).json(withMongoId(m));
  });

  r.get('/marks', async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const raw = user?.teacherProfile;
    const assignments = raw && typeof raw === 'object' && Array.isArray(raw.assignments) ? raw.assignments : [];
    const subjects = [...new Set(assignments.map((a) => a.subject).filter(Boolean))];
    const where = {
      teacherId: req.user.id,
      ...(subjects.length ? { subject: { in: subjects } } : {}),
    };
    if (req.query.page || req.query.limit) {
      const pag = parsePagination(req.query, 50, 200);
      const [list, total] = await Promise.all([
        prisma.mark.findMany({ where, orderBy: { createdAt: 'desc' }, skip: pag.skip, take: pag.take }),
        prisma.mark.count({ where })
      ]);
      return res.json(paginatedResponse(list.map(withMongoId), total, pag));
    }
    const list = await prisma.mark.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    res.json(list.map(withMongoId));
  });

  r.post('/attendance', validate(markAttendanceSchema), async (req, res) => {
    const { subject, date, entries } = req.body;
    const teacher = await prisma.user.findUnique({ where: { id: req.user.id } });
    const raw = teacher?.teacherProfile;
    const assignments = raw && typeof raw === 'object' && Array.isArray(raw.assignments) ? raw.assignments : [];
    const subj = String(subject);
    if (!assignments.some((a) => a.subject === subj)) {
      return res.status(403).json({ error: 'Subject not in your teaching assignments' });
    }
    const day = new Date(date);
    // Attendance freeze: only allow edits within the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    if (day < sevenDaysAgo) {
      return res.status(403).json({ error: 'Cannot modify attendance older than 7 days' });
    }
    if (day > new Date()) {
      return res.status(400).json({ error: 'Cannot mark attendance for a future date' });
    }
    const studentIds = entries.map(e => e.studentId).filter(Boolean);
    const validStudents = await prisma.user.findMany({
      where: { id: { in: studentIds }, role: Role.student, isActive: true },
      select: { id: true, studentProfile: true },
    });
    const validStudentMap = new Map();
    validStudents.forEach(stu => {
      const sp = stu.studentProfile;
      const cls = sp && typeof sp === 'object' && 'className' in sp ? sp.className : null;
      if (cls && assignmentCovers(assignments, cls, subj)) {
        validStudentMap.set(stu.id, true);
      }
    });

    const txOps = [];
    for (const e of entries) {
      const { studentId, status } = e;
      if (!studentId || !['present', 'absent'].includes(status)) continue;
      if (!validStudentMap.has(studentId)) continue;

      txOps.push(
        prisma.attendance.upsert({
          where: {
            studentId_subject_date: { studentId, subject: subj, date: day },
          },
          create: {
            studentId,
            teacherId: req.user.id,
            subject: subj,
            date: day,
            status,
          },
          update: { teacherId: req.user.id, status },
        })
      );
    }

    if (txOps.length > 0) {
      await prisma.$transaction(txOps);
    }
    res.json({ saved: txOps.length });
  });

  r.get('/attendance', async (req, res) => {
    const { subject, from, to } = req.query;
    const where = { teacherId: req.user.id };
    if (subject) where.subject = String(subject);
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }
    const list = await prisma.attendance.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 500,
    });
    res.json(list.map(withMongoId));
  });

  r.post('/materials', uploadStudyMaterial.single('file'), verifyMagicBytes, async (req, res) => {
    const { title, subject, className } = req.body || {};
    if (!title || !subject || !className || !req.file) {
      return res.status(400).json({ error: 'title, subject, className, file required' });
    }
    const teacher = await prisma.user.findUnique({ where: { id: req.user.id } });
    const raw = teacher?.teacherProfile;
    const assignments = raw && typeof raw === 'object' && Array.isArray(raw.assignments) ? raw.assignments : [];
    if (!assignmentCovers(assignments, String(className), String(subject))) {
      return res.status(403).json({ error: 'You can only upload materials for your assigned class and subject' });
    }
    const m = await prisma.studyMaterial.create({
      data: {
        teacherId: req.user.id,
        title: String(title),
        subject: String(subject),
        className: String(className),
        file: {
          originalName: req.file.originalname,
          storedName: req.file.filename,
          mimeType: req.file.mimetype,
        },
      },
    });
    res.status(201).json(
      withMongoId({
        ...m,
        fileUrl: `/uploads/materials/${req.file.filename}`,
      })
    );
  });

  r.get('/materials', async (req, res) => {
    const list = await prisma.studyMaterial.findMany({
      where: { teacherId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(
      list.map((m) => {
        const f = m.file;
        const stored = f && typeof f === 'object' && f !== null && 'storedName' in f ? f.storedName : null;
        return withMongoId({
          ...m,
          fileUrl: stored ? `/uploads/materials/${stored}` : null,
        });
      })
    );
  });

  r.delete('/materials/:id', async (req, res) => {
    const m = await prisma.studyMaterial.findFirst({
      where: { id: req.params.id, teacherId: req.user.id },
    });
    if (!m) return res.status(404).json({ error: 'Not found' });
    const f = m.file;
    const stored = f && typeof f === 'object' && f !== null && 'storedName' in f ? f.storedName : null;
    if (stored) {
      const p = path.join(uploadsPath(), 'materials', stored);
      fs.promises.unlink(p).catch((err) => {
        if (err.code !== 'ENOENT') console.error('Failed to unlink study material:', err);
      });
    }
    await prisma.studyMaterial.delete({ where: { id: m.id } });
    res.json({ ok: true });
  });

  r.get('/notices', async (req, res) => {
    const items = await prisma.notice.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(filterNotices(items, { surface: 'portal', role: 'teacher', userId: req.user.id }).map(noticeDto));
  });

  r.patch('/profile', uploadAvatarImage.single('avatar'), verifyMagicBytes, async (req, res) => {
    const { name, phone, bio, qualifications } = req.body || {};
    const teacher = await prisma.user.findUnique({ where: { id: req.user.id } });
    
    const updateData = {};
    if (name !== undefined) updateData.name = String(name).trim();
    if (phone !== undefined) updateData.phone = String(phone).trim();
    if (bio !== undefined) updateData.bio = String(bio).trim();
    if (req.file) {
      updateData.avatarUrl = `/uploads/avatars/${req.file.filename}`;
    }
    
    if (qualifications !== undefined) {
      const cur = (teacher.teacherProfile && typeof teacher.teacherProfile === 'object' ? teacher.teacherProfile : {}) || {};
      updateData.teacherProfile = {
        ...cur,
        qualifications: String(qualifications).trim()
      };
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
        teacherProfile: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      }
    });
    res.json(withMongoId(updatedUser));
  });

  // Apply for leave request
  r.post('/leave', async (req, res) => {
    const { fromDate, toDate, reason, leaveType } = req.body || {};
    if (!fromDate || !toDate || !reason) {
      return res.status(400).json({ error: 'fromDate, toDate, and reason are required' });
    }
    const leave = await prisma.leaveRequest.create({
      data: {
        teacherId: req.user.id,
        fromDate: new Date(fromDate),
        toDate: new Date(toDate),
        reason,
        leaveType: leaveType || 'casual',
        status: 'pending'
      }
    });
    res.status(201).json(withMongoId(leave));
  });

  // Get teacher's own leave requests
  r.get('/leave', async (req, res) => {
    const leaves = await prisma.leaveRequest.findMany({
      where: { teacherId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(leaves.map(withMongoId));
  });

  // Haversine Distance helper (in meters)
  function getDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLon = (lon2 - lon1) * rad;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // College Campus Coordinates (SSCC Junnar Campus)
  const COLLEGE_LAT = 19.2085;
  const COLLEGE_LON = 73.8777;
  const MAX_ALLOWED_DISTANCE_METERS = 500; // 500 meters campus boundary

  // Teacher Self Attendance — Anti-Fraud Geolocation Verified
  r.post('/self-attendance', async (req, res) => {
    const { latitude, longitude } = req.body || {};
    const lat = Number(latitude);
    const lon = Number(longitude);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'GPS coordinates required. Please enable location services.' });
    }

    const distance = getDistanceMeters(lat, lon, COLLEGE_LAT, COLLEGE_LON);

    if (distance > MAX_ALLOWED_DISTANCE_METERS) {
      const kmAway = (distance / 1000).toFixed(2);
      return res.status(403).json({
        error: `Anti-Fraud Violation: You are ${kmAway} km away from college campus. Attendance cannot be marked from home or off-campus. Allowed boundary is within 500m.`
      });
    }

    // Check if already marked today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await prisma.teacherAttendance.findFirst({
      where: {
        teacherId: req.user.id,
        date: { gte: today }
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Your attendance for today is already logged.' });
    }

    const log = await prisma.teacherAttendance.create({
      data: {
        teacherId: req.user.id,
        date: new Date(),
        status: 'present',
        latitude: lat,
        longitude: lon,
        distance: Math.round(distance),
        address: 'SSCC Junnar Campus (Verified GPS)'
      }
    });

    res.status(201).json({
      ok: true,
      message: `Verified! Campus attendance marked. Distance from center: ${Math.round(distance)}m.`,
      attendance: withMongoId(log)
    });
  });

  // Get teacher's self-attendance logs
  r.get('/self-attendance', async (req, res) => {
    const logs = await prisma.teacherAttendance.findMany({
      where: { teacherId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 60
    });
    res.json(logs.map(withMongoId));
  });

  // POST /marks/bulk — Excel-like batch marks entry
  r.post('/marks/bulk', async (req, res) => {
    const { entries } = req.body || {};
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'At least one mark entry required in array' });
    }

    const teacher = await prisma.user.findUnique({ where: { id: req.user.id } });
    const raw = teacher?.teacherProfile;
    const assignments = raw && typeof raw === 'object' && Array.isArray(raw.assignments) ? raw.assignments : [];

    const results = await prisma.$transaction(async (tx) => {
      const created = [];
      for (const entry of entries) {
        const { studentId, subject, examName, marksObtained, maxMarks, term } = entry;
        if (!studentId || !subject || !examName || marksObtained == null || maxMarks == null) {
          throw new Error('Each entry must contain studentId, subject, examName, marksObtained, maxMarks');
        }
        if (!assignments.some((a) => a.subject === String(subject))) {
          throw new Error(`Subject "${subject}" is not in your teaching assignments`);
        }

        const mark = await tx.mark.create({
          data: {
            studentId,
            teacherId: req.user.id,
            subject: String(subject),
            examName: String(examName),
            marksObtained: Number(marksObtained),
            maxMarks: Number(maxMarks),
            term: term ? String(term) : '',
          }
        });
        created.push(mark);
      }

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          userRole: 'teacher',
          action: 'BULK_MARKS_ENTRY',
          target: `${created.length} mark entries`,
          entityType: 'Mark',
          entityId: req.user.id,
          details: JSON.stringify({ count: created.length, subject: entries[0]?.subject }),
          ipAddress: req.ip || '',
          userAgent: req.headers['user-agent'] || '',
        }
      });

      return created;
    });

    res.status(201).json({
      ok: true,
      message: `Successfully saved ${results.length} mark entries`,
      count: results.length,
      data: results.map(withMongoId)
    });
  });

  return r;
}
