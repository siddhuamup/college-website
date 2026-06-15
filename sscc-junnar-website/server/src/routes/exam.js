import { Router } from 'express';
import { prisma, withMongoId } from '../db/client.js';
import { createAuthMiddleware, requireRole } from '../middleware/auth.js';
import { Role } from '@prisma/client';

export function adminExamRouter({ jwtSecret }) {
  const r = Router();
  const auth = createAuthMiddleware(jwtSecret);
  r.use(auth, requireRole('admin'));

  // GET all exams
  r.get('/', async (_req, res) => {
    const exams = await prisma.exam.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(exams.map(withMongoId));
  });

  // POST create exam
  r.post('/', async (req, res) => {
    const { title, examType, className, subject, examDate, startTime, duration, venue, maxMarks } = req.body || {};
    if (!title || !className || !subject) {
      return res.status(400).json({ error: 'title, className, and subject are required' });
    }

    const exam = await prisma.exam.create({
      data: {
        title,
        examType: examType || 'internal',
        className,
        subject,
        examDate: examDate ? new Date(examDate) : null,
        startTime: startTime || '',
        duration: duration || '',
        venue: venue || '',
        maxMarks: maxMarks !== undefined ? Number(maxMarks) : 100,
        isPublished: false,
        resultsPublished: false
      }
    });
    res.status(201).json(withMongoId(exam));
  });

  // PATCH update exam
  r.patch('/:id', async (req, res) => {
    const { title, examType, className, subject, examDate, startTime, duration, venue, maxMarks, isPublished, resultsPublished } = req.body || {};
    const exists = await prisma.exam.findUnique({ where: { id: req.params.id } });
    if (!exists) return res.status(404).json({ error: 'Exam not found' });

    const data = {};
    if (title) data.title = title;
    if (examType) data.examType = examType;
    if (className) data.className = className;
    if (subject) data.subject = subject;
    if (examDate !== undefined) data.examDate = examDate ? new Date(examDate) : null;
    if (startTime !== undefined) data.startTime = startTime;
    if (duration !== undefined) data.duration = duration;
    if (venue !== undefined) data.venue = venue;
    if (maxMarks !== undefined) data.maxMarks = Number(maxMarks);
    if (isPublished !== undefined) data.isPublished = Boolean(isPublished);
    if (resultsPublished !== undefined) data.resultsPublished = Boolean(resultsPublished);

    const updated = await prisma.exam.update({
      where: { id: req.params.id },
      data
    });
    res.json(withMongoId(updated));
  });

  // DELETE exam
  r.delete('/:id', async (req, res) => {
    try {
      await prisma.exam.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    } catch {
      res.status(404).json({ error: 'Exam not found' });
    }
  });

  return r;
}

export function teacherExamRouter({ jwtSecret }) {
  const r = Router();
  const auth = createAuthMiddleware(jwtSecret);
  r.use(auth, requireRole('teacher'));

  // GET exams matching teacher's class + subject assignments
  r.get('/', async (req, res) => {
    const teacher = await prisma.user.findUnique({ where: { id: req.user.id } });
    const tp = teacher?.teacherProfile;
    const assignments = tp && typeof tp === 'object' && Array.isArray(tp.assignments) ? tp.assignments : [];
    if (!assignments.length) return res.json([]);

    const conditions = assignments.map(a => ({ className: a.className, subject: a.subject }));
    const exams = await prisma.exam.findMany({
      where: { OR: conditions },
      orderBy: { createdAt: 'desc' }
    });
    res.json(exams.map(withMongoId));
  });

  // GET exam result sheet (all students in the class with their scores, grade, rank, etc.)
  r.get('/:id/result-sheet', async (req, res) => {
    const exam = await prisma.exam.findUnique({ where: { id: req.params.id } });
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    // Fetch all active students in the class
    const students = await prisma.user.findMany({
      where: { role: Role.student, isActive: true },
      select: { id: true, name: true, email: true, studentProfile: true }
    });
    const classStudents = students.filter(s => {
      const sp = s.studentProfile;
      return sp && typeof sp === 'object' && sp.className === exam.className;
    });

    // Fetch all marks entered for this subject and exam title (which represents examName)
    const marks = await prisma.mark.findMany({
      where: {
        subject: exam.subject,
        examName: exam.title
      }
    });

    const sheet = classStudents.map(student => {
      const m = marks.find(x => x.studentId === student.id);
      const marksObtained = m ? m.marksObtained : null;
      const maxMarks = exam.maxMarks;
      let pct = null;
      let grade = null;
      let passFail = null;

      if (marksObtained !== null) {
        pct = (marksObtained / maxMarks) * 100;
        grade = pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+' : pct >= 60 ? 'B' : pct >= 50 ? 'C' : 'F';
        passFail = pct >= 35 ? 'PASS' : 'FAIL';
      }

      const sp = student.studentProfile || {};
      return {
        studentId: student.id,
        name: student.name,
        rollNumber: sp.rollNumber || '',
        marksObtained,
        maxMarks,
        percentage: pct !== null ? pct.toFixed(1) : null,
        grade,
        passFail,
        rawScore: marksObtained !== null ? marksObtained : -1 // default low for ranking
      };
    });

    // Sort by rawScore descending to calculate ranks
    sheet.sort((a, b) => b.rawScore - a.rawScore);
    let currentRank = 1;
    sheet.forEach(s => {
      if (s.marksObtained !== null) {
        s.rank = currentRank++;
      } else {
        s.rank = null;
      }
      delete s.rawScore;
    });

    res.json({
      exam: withMongoId(exam),
      results: sheet
    });
  });

  return r;
}

export function studentExamRouter({ jwtSecret }) {
  const r = Router();
  const auth = createAuthMiddleware(jwtSecret);
  r.use(auth, requireRole('student'));

  // GET student's published exam schedule
  r.get('/schedule', async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const profile = user?.studentProfile;
    const className = profile && typeof profile === 'object' ? profile.className : null;
    if (!className) return res.json([]);

    const exams = await prisma.exam.findMany({
      where: { className, isPublished: true },
      orderBy: { examDate: 'asc' }
    });
    res.json(exams.map(withMongoId));
  });

  // GET student's published results with grade, rank, percentage, pass/fail
  r.get('/results', async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const profile = user?.studentProfile;
    const className = profile && typeof profile === 'object' ? profile.className : null;
    if (!className) return res.json([]);

    const exams = await prisma.exam.findMany({
      where: { className, resultsPublished: true }
    });
    if (!exams.length) return res.json([]);

    const resultsList = [];
    for (const exam of exams) {
      const mark = await prisma.mark.findFirst({
        where: {
          studentId: req.user.id,
          subject: exam.subject,
          examName: exam.title
        }
      });

      if (!mark) continue; // Skip if no mark entered yet for this student

      const pct = (mark.marksObtained / exam.maxMarks) * 100;
      const grade = pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+' : pct >= 60 ? 'B' : pct >= 50 ? 'C' : 'F';
      const passFail = pct >= 35 ? 'PASS' : 'FAIL';

      // Find all marks for this subject + exam to calculate class rank
      const allMarksInClass = await prisma.mark.findMany({
        where: {
          subject: exam.subject,
          examName: exam.title,
          student: { role: Role.student }
        },
        include: { student: true }
      });

      // Filter by the student's class
      const classMarksFiltered = allMarksInClass.filter(m => {
        const sp = m.student.studentProfile;
        return sp && typeof sp === 'object' && sp.className === className;
      });

      classMarksFiltered.sort((a, b) => b.marksObtained - a.marksObtained);
      const rankIndex = classMarksFiltered.findIndex(m => m.studentId === req.user.id);
      const rank = rankIndex !== -1 ? rankIndex + 1 : null;

      resultsList.push({
        examId: exam.id,
        title: exam.title,
        subject: exam.subject,
        examType: exam.examType,
        maxMarks: exam.maxMarks,
        marksObtained: mark.marksObtained,
        percentage: pct.toFixed(1),
        grade,
        passFail,
        rank,
        examDate: exam.examDate
      });
    }

    res.json(resultsList);
  });

  return r;
}
