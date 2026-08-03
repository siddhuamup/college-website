import { Router } from 'express';
import { prisma, withMongoId } from '../db/client.js';
import { createAuthMiddleware, requireRole } from '../middleware/auth.js';

export function adminFeeRouter({ jwtSecret }) {
  const r = Router();
  const auth = createAuthMiddleware(jwtSecret);
  r.use(auth, requireRole('admin'));

  // ── Fee Structures ────────────────────────────────────────

  // GET all fee structures
  r.get('/structures', async (_req, res) => {
    const structures = await prisma.feeStructure.findMany({
      orderBy: [{ academicYear: 'desc' }, { courseName: 'asc' }],
      include: {
        _count: { select: { payments: true } }
      }
    });
    res.json(structures.map(withMongoId));
  });

  // POST create fee structure
  r.post('/structures', async (req, res) => {
    const { courseName, academicYear, tuitionFee, labFee, libraryFee, examFee, otherFee, description } = req.body || {};
    if (!courseName || !academicYear) {
      return res.status(400).json({ error: 'Course name and academic year are required' });
    }

    const t = Number(tuitionFee) || 0;
    const l = Number(labFee) || 0;
    const lib = Number(libraryFee) || 0;
    const ex = Number(examFee) || 0;
    const oth = Number(otherFee) || 0;
    const total = t + l + lib + ex + oth;

    try {
      const fs = await prisma.feeStructure.create({
        data: {
          courseName,
          academicYear: Number(academicYear),
          tuitionFee: t,
          labFee: l,
          libraryFee: lib,
          examFee: ex,
          otherFee: oth,
          totalFee: total,
          description: description || ''
        }
      });
      res.status(201).json(withMongoId(fs));
    } catch (err) {
      if (err.code === 'P2002') {
        return res.status(409).json({ error: `Fee structure already exists for ${courseName} (${academicYear})` });
      }
      throw err;
    }
  });

  // PATCH update fee structure
  r.patch('/structures/:id', async (req, res) => {
    const { courseName, academicYear, tuitionFee, labFee, libraryFee, examFee, otherFee, description } = req.body || {};
    const existing = await prisma.feeStructure.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Fee structure not found' });

    const t = tuitionFee !== undefined ? Number(tuitionFee) || 0 : existing.tuitionFee;
    const l = labFee !== undefined ? Number(labFee) || 0 : existing.labFee;
    const lib = libraryFee !== undefined ? Number(libraryFee) || 0 : existing.libraryFee;
    const ex = examFee !== undefined ? Number(examFee) || 0 : existing.examFee;
    const oth = otherFee !== undefined ? Number(otherFee) || 0 : existing.otherFee;
    const total = t + l + lib + ex + oth;

    const updated = await prisma.feeStructure.update({
      where: { id: req.params.id },
      data: {
        ...(courseName && { courseName }),
        ...(academicYear && { academicYear: Number(academicYear) }),
        tuitionFee: t,
        labFee: l,
        libraryFee: lib,
        examFee: ex,
        otherFee: oth,
        totalFee: total,
        ...(description !== undefined && { description })
      }
    });

    res.json(withMongoId(updated));
  });

  // DELETE fee structure
  r.delete('/structures/:id', async (req, res) => {
    const count = await prisma.feePayment.count({ where: { feeStructureId: req.params.id } });
    if (count > 0) {
      return res.status(400).json({ error: `Cannot delete fee structure with ${count} existing payment records` });
    }
    await prisma.feeStructure.delete({ where: { id: req.params.id } });
    res.json({ ok: true, message: 'Fee structure deleted successfully' });
  });

  // ── Fee Payments ──────────────────────────────────────────

  // GET all payments with optional filters
  r.get('/payments', async (req, res) => {
    const { studentId, feeStructureId, status, q } = req.query;
    const where = {};

    if (studentId) where.studentId = studentId;
    if (feeStructureId) where.feeStructureId = feeStructureId;
    if (status) where.status = status;

    if (q) {
      where.OR = [
        { receiptNumber: { contains: q } },
        { transactionRef: { contains: q } },
        { student: { name: { contains: q } } },
        { student: { email: { contains: q } } }
      ];
    }

    const payments = await prisma.feePayment.findMany({
      where,
      orderBy: { paymentDate: 'desc' },
      include: {
        student: { select: { id: true, name: true, email: true, studentProfile: true } },
        feeStructure: { select: { id: true, courseName: true, academicYear: true, totalFee: true } }
      }
    });

    res.json(payments.map(withMongoId));
  });

  // POST record a payment
  r.post('/payments', async (req, res) => {
    const { studentId, feeStructureId, amountPaid, paymentMode, transactionRef, semester, remarks } = req.body || {};

    if (!studentId || !feeStructureId || !amountPaid) {
      return res.status(400).json({ error: 'Student ID, Fee Structure ID, and Amount Paid are required' });
    }

    const student = await prisma.user.findUnique({ where: { id: studentId } });
    if (!student || student.role !== 'student') {
      return res.status(404).json({ error: 'Student not found' });
    }

    const feeStructure = await prisma.feeStructure.findUnique({ where: { id: feeStructureId } });
    if (!feeStructure) {
      return res.status(404).json({ error: 'Fee structure not found' });
    }

    const amt = Number(amountPaid);
    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ error: 'Amount paid must be a positive number' });
    }

    // Generate receipt number atomically e.g. REC-2026-00001
    const year = new Date().getFullYear();
    const payment = await prisma.$transaction(async (tx) => {
      const counter = await tx.counter.upsert({
        where: { name: `receipt_${year}` },
        update: { value: { increment: 1 } },
        create: { name: `receipt_${year}`, value: 1 }
      });
      const receiptNumber = `REC-${year}-${String(counter.value).padStart(5, '0')}`;

      return tx.feePayment.create({
        data: {
          studentId,
          feeStructureId,
          amountPaid: amt,
          paymentMode: paymentMode || 'cash',
          transactionRef: transactionRef || '',
          receiptNumber,
          semester: semester || 'Sem I',
          remarks: remarks || '',
          status: 'completed'
        },
        include: {
          student: { select: { id: true, name: true, email: true, studentProfile: true } },
          feeStructure: true
        }
      });
    });

    res.status(201).json(withMongoId(payment));
  });

  // GET single payment receipt detail
  r.get('/payments/:id/receipt', async (req, res) => {
    const payment = await prisma.feePayment.findUnique({
      where: { id: req.params.id },
      include: {
        student: { select: { id: true, name: true, email: true, phone: true, studentProfile: true } },
        feeStructure: true
      }
    });

    if (!payment) return res.status(404).json({ error: 'Receipt not found' });
    res.json(withMongoId(payment));
  });

  // GET fee dashboard analytics
  r.get('/stats', async (_req, res) => {
    const [totalStructures, allPayments, totalStudents] = await Promise.all([
      prisma.feeStructure.findMany(),
      prisma.feePayment.findMany({ where: { status: 'completed' } }),
      prisma.user.count({ where: { role: 'student', isDeleted: false } })
    ]);

    const totalCollected = allPayments.reduce((sum, p) => sum + p.amountPaid, 0);

    const modeCounts = {};
    allPayments.forEach(p => {
      modeCounts[p.paymentMode] = (modeCounts[p.paymentMode] || 0) + p.amountPaid;
    });

    res.json({
      totalCollected,
      totalPaymentsCount: allPayments.length,
      totalStructuresCount: totalStructures.length,
      totalStudents,
      modeDistribution: modeCounts
    });
  });

  // GET fee defaulters (students with pending payments)
  r.get('/defaulters', async (_req, res) => {
    const students = await prisma.user.findMany({
      where: { role: 'student', isDeleted: false },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        studentProfile: true,
        feePayments: {
          where: { status: 'completed' },
          include: { feeStructure: true }
        }
      }
    });

    const defaulters = [];

    for (const s of students) {
      const sp = s.studentProfile || {};
      const courseName = sp.courseName || sp.course || '';
      if (!courseName) continue;

      const fs = await prisma.feeStructure.findFirst({
        where: { courseName },
        orderBy: { academicYear: 'desc' }
      });

      if (!fs) continue;

      const paid = s.feePayments.reduce((sum, p) => sum + p.amountPaid, 0);
      const balance = fs.totalFee - paid;

      if (balance > 0) {
        defaulters.push({
          studentId: s.id,
          name: s.name,
          email: s.email,
          phone: s.phone,
          courseName,
          rollNumber: sp.rollNumber || '—',
          className: sp.className || '—',
          totalFee: fs.totalFee,
          amountPaid: paid,
          pendingBalance: balance
        });
      }
    }

    res.json(defaulters);
  });

  return r;
}

export function studentFeeRouter({ jwtSecret }) {
  const r = Router();
  const auth = createAuthMiddleware(jwtSecret);
  r.use(auth, requireRole('student'));

  // GET my fees summary & payments history
  r.get('/my-fees', async (req, res) => {
    const student = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        studentProfile: true,
        feePayments: {
          orderBy: { paymentDate: 'desc' },
          include: { feeStructure: true }
        }
      }
    });

    if (!student) return res.status(404).json({ error: 'Student profile not found' });

    const sp = student.studentProfile || {};
    const courseName = sp.courseName || sp.course || '';

    let feeStructure = null;
    if (courseName) {
      feeStructure = await prisma.feeStructure.findFirst({
        where: { courseName },
        orderBy: { academicYear: 'desc' }
      });
    }

    const totalFee = feeStructure ? feeStructure.totalFee : 0;
    const totalPaid = student.feePayments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.amountPaid, 0);
    const balance = Math.max(0, totalFee - totalPaid);

    res.json({
      studentName: student.name,
      courseName,
      feeStructure: feeStructure ? withMongoId(feeStructure) : null,
      totalFee,
      totalPaid,
      pendingBalance: balance,
      payments: student.feePayments.map(withMongoId)
    });
  });

  // GET receipt for a student's own payment
  r.get('/receipt/:id', async (req, res) => {
    const payment = await prisma.feePayment.findUnique({
      where: { id: req.params.id },
      include: {
        student: { select: { id: true, name: true, email: true, phone: true, studentProfile: true } },
        feeStructure: true
      }
    });

    if (!payment || payment.studentId !== req.user.id) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    res.json(withMongoId(payment));
  });

  return r;
}
