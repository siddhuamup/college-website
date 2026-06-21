import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { prisma, withMongoId } from '../db/client.js';
import { createAuthMiddleware, requireRole } from '../middleware/auth.js';
import { hashPassword } from '../utils/auth.js';
import { sendEmail } from '../utils/email.js';
import { uploadNoticePdf, uploadGalleryImage, uploadAvatarImage, uploadsPath } from '../multer/configure.js';
import { Role } from '@prisma/client';
import { nextStudentId, nextRollNumber } from '../lib/studentIdGenerator.js';

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
    const { name, phone, isActive, studentProfile, password, email } = req.body || {};
    const data = {};
    if (email) {
      const emailLower = String(email).toLowerCase().trim();
      if (emailLower !== u.email) {
        const emailExists = await prisma.user.findUnique({ where: { email: emailLower } });
        if (emailExists) return res.status(409).json({ error: 'Email already registered' });
        data.email = emailLower;
      }
    }
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

  r.post('/students/:id/resend-credentials', async (req, res) => {
    const student = await prisma.user.findFirst({
      where: { id: req.params.id, role: Role.student }
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    const sp = student.studentProfile && typeof student.studentProfile === 'object' ? student.studentProfile : {};

    // Generate a new random password (same pattern as admission approval)
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const specials = '!@#$';
    const chars = lowercase + uppercase + numbers + specials;
    let pwd = '';
    pwd += lowercase[Math.floor(Math.random() * lowercase.length)];
    pwd += uppercase[Math.floor(Math.random() * uppercase.length)];
    pwd += numbers[Math.floor(Math.random() * numbers.length)];
    pwd += specials[Math.floor(Math.random() * specials.length)];
    for (let i = 0; i < 6; i++) {
      pwd += chars[Math.floor(Math.random() * chars.length)];
    }
    const newPassword = pwd.split('').sort(() => 0.5 - Math.random()).join('');

    // Update password hash and flag for mandatory change
    await prisma.user.update({
      where: { id: student.id },
      data: {
        passwordHash: await hashPassword(newPassword),
        mustChangePassword: true,
      },
    });

    try {
      await sendEmail({
        to: sp.personalEmail || student.email,
        subject: 'Your SSC College Junnar Credentials (Reset)',
        text: `Dear ${student.name},\n\nYour login credentials have been reset.\n\nCollege Email: ${student.email}\nNew Temporary Password: ${newPassword}\nStudent ID: ${sp.studentId || 'N/A'}\nRoll Number: ${sp.rollNumber || 'N/A'}\n\nPlease login and change your password immediately.\n\nBest regards,\nSSC College Junnar`,
        html: `<p>Dear <strong>${student.name}</strong>,</p>
               <p>Your login credentials have been reset.</p>
               <ul>
                 <li><strong>College Email:</strong> ${student.email}</li>
                 <li><strong>New Temporary Password:</strong> ${newPassword}</li>
                 <li><strong>Student ID:</strong> ${sp.studentId || 'N/A'}</li>
                 <li><strong>Roll Number:</strong> ${sp.rollNumber || 'N/A'}</li>
               </ul>
               <p><strong>Please login and change your password immediately.</strong></p>
               <p>Best regards,<br/>SSC College Junnar</p>`
      });
    } catch (emailErr) {
      console.error('Failed to send credentials email:', emailErr);
    }

    res.json({ ok: true, message: 'New credentials generated and sent' });
  });

  r.get('/teachers', async (_req, res) => {
    const list = await prisma.user.findMany({
      where: { role: Role.teacher },
      orderBy: { name: 'asc' },
    });
    res.json(list.map(stripHash));
  });

  function optionalTeacherAvatar(req, res, next) {
    if (String(req.headers['content-type'] || '').includes('multipart/form-data')) {
      return uploadAvatarImage.single('avatar')(req, res, next);
    }
    next();
  }

  r.post('/teachers', optionalTeacherAvatar, async (req, res) => {
    let { email, password, name, phone, employeeId, department, designation, qualifications, assignments, experience, specialization, bio } = req.body || {};
    if (!email || !password || !name) return res.status(400).json({ error: 'email, password, name required' });
    if (typeof assignments === 'string') {
      try {
        assignments = JSON.parse(assignments);
      } catch {
        assignments = [];
      }
    }
    const exists = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
    if (exists) return res.status(409).json({ error: 'Email already registered' });
    const avatarUrl = req.file ? `/uploads/avatars/${req.file.filename}` : '';
    const user = await prisma.user.create({
      data: {
        email: String(email).toLowerCase().trim(),
        passwordHash: await hashPassword(String(password)),
        role: Role.teacher,
        name: String(name).trim(),
        phone: phone || '',
        avatarUrl,
        bio: bio || '',
        teacherProfile: {
          employeeId: employeeId || '',
          department: department || '',
          designation: designation || 'Assistant Professor',
          qualifications: qualifications || '',
          experience: experience || '',
          specialization: specialization || '',
          assignments: Array.isArray(assignments) ? assignments : [],
        },
      },
    });
    res.status(201).json({ user: stripHash(user) });
  });

  r.patch('/teachers/:id', optionalTeacherAvatar, async (req, res) => {
    const u = await prisma.user.findFirst({ where: { id: req.params.id, role: Role.teacher } });
    if (!u) return res.status(404).json({ error: 'Not found' });
    let { name, phone, isActive, teacherProfile, password, bio, email, removeAvatar } = req.body || {};
    if (typeof teacherProfile === 'string') {
      try {
        teacherProfile = JSON.parse(teacherProfile);
      } catch {
        teacherProfile = {};
      }
    }
    const data = {};
    if (email) {
      const emailLower = String(email).toLowerCase().trim();
      if (emailLower !== u.email) {
        const emailExists = await prisma.user.findUnique({ where: { email: emailLower } });
        if (emailExists) return res.status(409).json({ error: 'Email already registered' });
        data.email = emailLower;
      }
    }
    if (name) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (bio !== undefined) data.bio = bio;
    if (isActive !== undefined) data.isActive = isActive;
    if (password) data.passwordHash = await hashPassword(String(password));
    if (removeAvatar === 'true' || removeAvatar === true) {
      if (u.avatarUrl) {
        const oldName = path.basename(u.avatarUrl);
        const oldPath = path.join(uploadsPath(), 'avatars', oldName);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      data.avatarUrl = '';
    } else if (req.file) {
      if (u.avatarUrl) {
        const oldName = path.basename(u.avatarUrl);
        const oldPath = path.join(uploadsPath(), 'avatars', oldName);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      data.avatarUrl = `/uploads/avatars/${req.file.filename}`;
    }
    const cur = (u.teacherProfile && typeof u.teacherProfile === 'object' ? u.teacherProfile : {}) || {};
    const mergedProfile = {
      ...cur,
      ...teacherProfile,
      assignments: teacherProfile?.assignments ?? cur.assignments ?? [],
    };
    data.teacherProfile = mergedProfile;
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
    let generatedStudentId = '';
    let collegeEmail = '';

    if (status === 'approved' && createAccount) {
      // Atomic Student-ID generation using Counter model (prevents race-condition duplicates)
      const courseAbbr = (courseName || doc.courseApplied || 'GEN').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'GEN';
      generatedStudentId = await nextStudentId(courseAbbr);
      collegeEmail = `${generatedStudentId.toLowerCase()}@ssccjunnar.edu`;

      const existing = await prisma.user.findUnique({ where: { email: collegeEmail } });
      if (existing) {
        return res.status(409).json({ error: `Student with generated email ${collegeEmail} already exists` });
      }

      // Generate random temporary password if not provided
      if (defaultPassword) {
        plainPassword = defaultPassword;
      } else {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$';
        let pwd = '';
        const lowercase = 'abcdefghijklmnopqrstuvwxyz';
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const numbers = '0123456789';
        const specials = '!@#$';
        pwd += lowercase[Math.floor(Math.random() * lowercase.length)];
        pwd += uppercase[Math.floor(Math.random() * uppercase.length)];
        pwd += numbers[Math.floor(Math.random() * numbers.length)];
        pwd += specials[Math.floor(Math.random() * specials.length)];
        for (let i = 0; i < 6; i++) {
          pwd += chars[Math.floor(Math.random() * chars.length)];
        }
        plainPassword = pwd.split('').sort(() => 0.5 - Math.random()).join('');
      }

      // Atomic Roll-Number generation using Counter model
      const generatedRollNumber = await nextRollNumber(courseAbbr);

      const generatedVerificationId = `SSC-VER-${String(generatedStudentId || generatedRollNumber || 'unknown').replace(/\s+/g, '')}`;

      createdUser = await prisma.user.create({
        data: {
          email: collegeEmail,
          passwordHash: await hashPassword(plainPassword),
          role: Role.student,
          name: doc.fullName,
          phone: doc.phone,
          studentProfile: {
            studentId: generatedStudentId,
            personalEmail: doc.email,
            collegeEmail: collegeEmail,
            mobile: doc.phone || '',
            course: doc.courseApplied,
            courseName: doc.courseApplied,
            className: className || '',
            year: '1',
            division: 'A',
            rollNumber: generatedRollNumber,
            admissionApplicationId: doc.id,
            address: doc.address || '',
            parentContact: doc.parentContact || '',
            emergencyContact: doc.parentContact || '',
            admissionYear: new Date().getFullYear(),
            verificationId: generatedVerificationId,
          },
        },
      });

      // Dispatch real email using sendEmail abstraction
      try {
        await sendEmail({
          to: doc.email,
          subject: 'Welcome to SSC College Junnar — Your Credentials',
          text: `Dear ${doc.fullName},\n\nYour application for ${doc.courseApplied} has been approved.\n\nYour login credentials are:\nCollege Email: ${collegeEmail}\nTemporary Password: ${plainPassword}\nStudent ID: ${generatedStudentId}\nRoll Number: ${generatedRollNumber}\n\nPlease login and change your password.\n\nBest regards,\nSSC College Junnar`,
          html: `<p>Dear <strong>${doc.fullName}</strong>,</p>
                 <p>Your application for <strong>${doc.courseApplied}</strong> has been approved.</p>
                 <p>Your login credentials are:</p>
                 <ul>
                   <li><strong>College Email:</strong> ${collegeEmail}</li>
                   <li><strong>Temporary Password:</strong> ${plainPassword}</li>
                   <li><strong>Student ID:</strong> ${generatedStudentId}</li>
                   <li><strong>Roll Number:</strong> ${generatedRollNumber}</li>
                 </ul>
                 <p>Please login and change your password.</p>
                 <p>Best regards,<br/>SSC College Junnar</p>`
        });
      } catch (emailErr) {
        console.error('Failed to send admission approval email:', emailErr);
      }
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
              tempPasswordHint: 'Credentials generated and logged to console',
            }
          : {}),
      },
    });

    res.json({
      application: withMongoId(application),
      studentAccount:
        createdUser && plainPassword
          ? {
              email: collegeEmail,
              temporaryPassword: plainPassword,
              studentId: generatedStudentId,
              userId: createdUser.id,
              rollNumber: generatedRollNumber
            }
          : null,
    });
  });

  r.get('/notices', async (_req, res) => {
    const items = await prisma.notice.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(items.map((n) => withMongoId({ ...n, pdfUrl: noticePdfUrl(n) })));
  });

  r.post('/notices', uploadNoticePdf.single('pdf'), async (req, res) => {
    const { title, body, isPublished, priority, audience, publishDate, expiryDate } = req.body || {};
    if (!title) return res.status(400).json({ error: 'title required' });
    const pdfFile = req.file
      ? { originalName: req.file.originalname, storedName: req.file.filename }
      : undefined;
    const n = await prisma.notice.create({
      data: {
        title: String(title),
        body: body || '',
        priority: priority || 'NORMAL',
        audience: audience || 'ALL',
        publishDate: publishDate ? new Date(publishDate) : new Date(),
        expiryDate: expiryDate ? new Date(expiryDate) : null,
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
    if (req.body.priority) data.priority = req.body.priority;
    if (req.body.audience) data.audience = req.body.audience;
    if (req.body.publishDate) data.publishDate = new Date(req.body.publishDate);
    if (req.body.expiryDate !== undefined) data.expiryDate = req.body.expiryDate ? new Date(req.body.expiryDate) : null;
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

  r.get('/attendance/analytics', async (_req, res) => {
    // Load configurable attendance threshold
    const thresholdRow = await prisma.collegeSettings.findUnique({ where: { key: 'attendanceThreshold' } });
    let threshold = 75;
    if (thresholdRow && thresholdRow.value !== undefined && thresholdRow.value !== null) {
      threshold = Number(thresholdRow.value);
      if (isNaN(threshold)) threshold = 75;
    }

    const students = await prisma.user.findMany({
      where: { role: Role.student, isActive: true },
      select: { id: true, name: true, email: true, studentProfile: true },
    });

    const logs = await prisma.attendance.findMany();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const presentToday = await prisma.attendance.count({
      where: {
        date: { gte: todayStart, lte: todayEnd },
        status: 'present',
      },
    });

    const absentToday = await prisma.attendance.count({
      where: {
        date: { gte: todayStart, lte: todayEnd },
        status: 'absent',
      },
    });

    // Compute student logs breakdown
    const lowAttendanceList = [];
    const riskList = [];
    const fullReportList = [];

    students.forEach((student) => {
      const studentLogs = logs.filter(l => l.studentId === student.id);
      const total = studentLogs.length;
      const present = studentLogs.filter(l => l.status === 'present').length;
      const absent = total - present;
      const pct = total ? Math.round((present / total) * 100) : 100;

      const sp = student.studentProfile || {};
      const studentIdStr = sp.studentId || student.id;
      const rollNumber = sp.rollNumber || '';
      const className = sp.className || 'Unassigned';

      if (total > 0) {
        if (pct < threshold) {
          lowAttendanceList.push({
            id: student.id,
            name: student.name,
            email: student.email,
            rollNumber,
            className,
            percentage: pct,
            attended: present,
            totalClasses: total,
          });
        } else if (pct < threshold + 5) {
          riskList.push({
            id: student.id,
            name: student.name,
            email: student.email,
            rollNumber,
            className,
            percentage: pct,
            attended: present,
            totalClasses: total,
          });
        }
      }

      // Group by subject for full report
      const subjectsGroup = {};
      studentLogs.forEach(log => {
        const sub = log.subject || 'Other';
        if (!subjectsGroup[sub]) {
          subjectsGroup[sub] = { present: 0, absent: 0, total: 0 };
        }
        subjectsGroup[sub].total += 1;
        if (log.status === 'present') {
          subjectsGroup[sub].present += 1;
        } else {
          subjectsGroup[sub].absent += 1;
        }
      });

      Object.entries(subjectsGroup).forEach(([subject, counts]) => {
        const subPct = counts.total ? Math.round((counts.present / counts.total) * 100) : 100;
        fullReportList.push({
          studentId: studentIdStr,
          rollNumber,
          name: student.name,
          className,
          subject,
          percentage: subPct,
          present: counts.present,
          absent: counts.absent,
          total: counts.total
        });
      });
    });

    // Compute class-wise breakdown & trends (This Month vs Last Month)
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const classStats = {};
    const classTrendStats = {};

    logs.forEach((log) => {
      const student = students.find((s) => s.id === log.studentId);
      if (!student) return;
      const cls = student.studentProfile?.className || 'Unassigned';
      
      // General summary
      if (!classStats[cls]) {
        classStats[cls] = { present: 0, total: 0 };
      }
      classStats[cls].total += 1;
      if (log.status === 'present') {
        classStats[cls].present += 1;
      }

      // Trend summary
      const logDate = new Date(log.date);
      let period = null;
      if (logDate >= startOfThisMonth) {
        period = 'thisMonth';
      } else if (logDate >= startOfLastMonth && logDate < startOfThisMonth) {
        period = 'lastMonth';
      }

      if (period) {
        if (!classTrendStats[cls]) {
          classTrendStats[cls] = {
            thisMonth: { present: 0, total: 0 },
            lastMonth: { present: 0, total: 0 }
          };
        }
        classTrendStats[cls][period].total += 1;
        if (log.status === 'present') {
          classTrendStats[cls][period].present += 1;
        }
      }
    });

    const classSummary = Object.entries(classStats).map(([className, stat]) => ({
      className,
      percentage: stat.total ? Math.round((stat.present / stat.total) * 100) : 0,
      totalLogs: stat.total,
    })).sort((a, b) => a.className.localeCompare(b.className));

    const classTrends = Object.entries(classTrendStats).map(([className, stats]) => {
      const thisPct = stats.thisMonth.total ? Math.round((stats.thisMonth.present / stats.thisMonth.total) * 100) : null;
      const lastPct = stats.lastMonth.total ? Math.round((stats.lastMonth.present / stats.lastMonth.total) * 100) : null;
      let change = null;
      let direction = 'stable';
      if (thisPct !== null && lastPct !== null) {
        change = thisPct - lastPct;
        direction = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';
      }
      return { className, thisMonthPct: thisPct, lastMonthPct: lastPct, change, direction };
    }).sort((a, b) => a.className.localeCompare(b.className));

    // Compute subject-wise breakdown & trends
    const subjectStats = {};
    const subjectTrendStats = {};

    logs.forEach((log) => {
      const subj = log.subject || 'Other';
      if (!subjectStats[subj]) {
        subjectStats[subj] = { present: 0, total: 0 };
      }
      subjectStats[subj].total += 1;
      if (log.status === 'present') {
        subjectStats[subj].present += 1;
      }

      // Trend summary
      const logDate = new Date(log.date);
      let period = null;
      if (logDate >= startOfThisMonth) {
        period = 'thisMonth';
      } else if (logDate >= startOfLastMonth && logDate < startOfThisMonth) {
        period = 'lastMonth';
      }

      if (period) {
        if (!subjectTrendStats[subj]) {
          subjectTrendStats[subj] = {
            thisMonth: { present: 0, total: 0 },
            lastMonth: { present: 0, total: 0 }
          };
        }
        subjectTrendStats[subj][period].total += 1;
        if (log.status === 'present') {
          subjectTrendStats[subj][period].present += 1;
        }
      }
    });

    const subjectSummary = Object.entries(subjectStats).map(([subject, stat]) => ({
      subject,
      percentage: stat.total ? Math.round((stat.present / stat.total) * 100) : 0,
      totalLogs: stat.total,
    })).sort((a, b) => a.subject.localeCompare(b.subject));

    const subjectTrends = Object.entries(subjectTrendStats).map(([subject, stats]) => {
      const thisPct = stats.thisMonth.total ? Math.round((stats.thisMonth.present / stats.thisMonth.total) * 100) : null;
      const lastPct = stats.lastMonth.total ? Math.round((stats.lastMonth.present / stats.lastMonth.total) * 100) : null;
      let change = null;
      let direction = 'stable';
      if (thisPct !== null && lastPct !== null) {
        change = thisPct - lastPct;
        direction = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';
      }
      return { subject, thisMonthPct: thisPct, lastMonthPct: lastPct, change, direction };
    }).sort((a, b) => a.subject.localeCompare(b.subject));

    const totalLogsCount = logs.length;
    const totalPresentCount = logs.filter(l => l.status === 'present').length;
    const globalPercentage = totalLogsCount ? Math.round((totalPresentCount / totalLogsCount) * 100) : 100;

    // Compute monthly breakdown (last 6 months)
    const monthlyStats = {};
    logs.forEach((log) => {
      const d = new Date(log.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyStats[key]) monthlyStats[key] = { present: 0, absent: 0 };
      if (log.status === 'present') monthlyStats[key].present += 1;
      else monthlyStats[key].absent += 1;
    });
    const monthlySummary = Object.entries(monthlyStats)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, stat]) => {
        const total = stat.present + stat.absent;
        return {
          month,
          present: stat.present,
          absent: stat.absent,
          percentage: total ? Math.round((stat.present / total) * 100) : 0,
        };
      });

    res.json({
      totalStudents: students.length,
      presentToday,
      absentToday,
      globalPercentage,
      lowAttendanceCount: lowAttendanceList.length,
      lowAttendanceList,
      riskList,
      classSummary,
      subjectSummary,
      monthlySummary,
      classTrends,
      subjectTrends,
      fullReportList,
      threshold
    });
  });

  // Get all leave requests
  r.get('/leave', async (_req, res) => {
    const leaves = await prisma.leaveRequest.findMany({
      include: {
        teacher: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(leaves.map(withMongoId));
  });

  // Review a leave request
  r.patch('/leave/:id', async (req, res) => {
    const { status, adminNote } = req.body || {};
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be either approved or rejected' });
    }
    const exists = await prisma.leaveRequest.findUnique({ where: { id: req.params.id } });
    if (!exists) return res.status(404).json({ error: 'Leave request not found' });

    const updated = await prisma.leaveRequest.update({
      where: { id: req.params.id },
      data: {
        status,
        adminNote: adminNote || ''
      },
      include: {
        teacher: { select: { id: true, name: true, email: true } }
      }
    });
    res.json(withMongoId(updated));
  });
  
  r.get('/notifications/read', async (_req, res) => {
    const row = await prisma.collegeSettings.findUnique({ where: { key: 'read_notifications' } });
    res.json(row && Array.isArray(row.value) ? row.value : []);
  });

  r.post('/notifications/read', async (req, res) => {
    const { id, ids } = req.body || {};
    const row = await prisma.collegeSettings.findUnique({ where: { key: 'read_notifications' } });
    let readList = row && Array.isArray(row.value) ? row.value : [];
    
    let added = false;
    if (Array.isArray(ids)) {
      ids.forEach(x => {
        if (!readList.includes(x)) {
          readList.push(x);
          added = true;
        }
      });
    } else if (id) {
      if (!readList.includes(id)) {
        readList.push(id);
        added = true;
      }
    }
    
    if (added) {
      await prisma.collegeSettings.upsert({
        where: { key: 'read_notifications' },
        create: { key: 'read_notifications', value: readList },
        update: { value: readList }
      });
    }
    res.json(readList);
  });

  return r;
}
