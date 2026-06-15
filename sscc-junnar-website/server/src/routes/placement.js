/**
 * placement.js — Placement Cell API routes
 *
 * Admin routes (all under /api/admin/placement/*):
 *   GET    /companies          — list all companies
 *   POST   /companies          — create company
 *   PATCH  /companies/:id      — update company
 *   DELETE /companies/:id      — delete company
 *   GET    /drives             — list all drives (with company info)
 *   POST   /drives             — create drive
 *   PATCH  /drives/:id         — update drive
 *   DELETE /drives/:id         — delete drive
 *   GET    /applications       — list all applications (with student + drive info)
 *   PATCH  /applications/:id/status — update application status
 *   GET    /analytics          — placement analytics
 *   GET    /export/csv         — CSV export of applications
 *
 * Student routes (all under /api/student/placement/*):
 *   GET    /companies          — list all companies
 *   GET    /drives             — list active drives (with company info)
 *   POST   /apply/:driveId     — apply for a drive
 *   GET    /applications       — student's own applications
 */

import { Router } from 'express';
import { prisma, withMongoId } from '../db/client.js';
import { createAuthMiddleware, requireRole } from '../middleware/auth.js';

// ─── ADMIN PLACEMENT ROUTER ──────────────────────────────────────────────────

export function adminPlacementRouter({ jwtSecret }) {
  const r = Router();
  const auth = createAuthMiddleware(jwtSecret);
  r.use(auth, requireRole('admin'));

  // ── Companies ──────────────────────────────────────────────────────────────

  r.get('/companies', async (_req, res) => {
    const list = await prisma.company.findMany({ orderBy: { companyName: 'asc' } });
    res.json(list.map(withMongoId));
  });

  r.post('/companies', async (req, res) => {
    const { companyName, industry, website, description, packageOffered, eligibilityCriteria, location } =
      req.body || {};
    if (!companyName) return res.status(400).json({ error: 'companyName required' });
    const c = await prisma.company.create({
      data: {
        companyName: String(companyName).trim(),
        industry: industry || '',
        website: website || '',
        description: description || '',
        packageOffered: packageOffered || '',
        eligibilityCriteria: eligibilityCriteria || '',
        location: location || '',
      },
    });
    res.status(201).json(withMongoId(c));
  });

  r.patch('/companies/:id', async (req, res) => {
    const c = await prisma.company.findUnique({ where: { id: req.params.id } });
    if (!c) return res.status(404).json({ error: 'Company not found' });
    const { companyName, industry, website, description, packageOffered, eligibilityCriteria, location } =
      req.body || {};
    const data = {};
    if (companyName) data.companyName = String(companyName).trim();
    if (industry !== undefined) data.industry = industry;
    if (website !== undefined) data.website = website;
    if (description !== undefined) data.description = description;
    if (packageOffered !== undefined) data.packageOffered = packageOffered;
    if (eligibilityCriteria !== undefined) data.eligibilityCriteria = eligibilityCriteria;
    if (location !== undefined) data.location = location;
    const updated = await prisma.company.update({ where: { id: c.id }, data });
    res.json(withMongoId(updated));
  });

  r.delete('/companies/:id', async (req, res) => {
    const c = await prisma.company.findUnique({ where: { id: req.params.id } });
    if (!c) return res.status(404).json({ error: 'Company not found' });
    await prisma.company.delete({ where: { id: c.id } });
    res.json({ ok: true });
  });

  // ── Drives ────────────────────────────────────────────────────────────────

  r.get('/drives', async (_req, res) => {
    const list = await prisma.placementDrive.findMany({
      include: {
        company: { select: { companyName: true, industry: true, packageOffered: true, location: true } },
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(
      list.map((d) => {
        const { _count, company, ...rest } = d;
        return withMongoId({ ...rest, company, applicationCount: _count.applications });
      })
    );
  });

  r.post('/drives', async (req, res) => {
    const { companyId, title, description, driveDate, applicationDeadline, status } = req.body || {};
    if (!companyId || !title) return res.status(400).json({ error: 'companyId and title required' });
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return res.status(404).json({ error: 'Company not found' });
    const d = await prisma.placementDrive.create({
      data: {
        companyId,
        title: String(title).trim(),
        description: description || '',
        driveDate: driveDate ? new Date(driveDate) : null,
        applicationDeadline: applicationDeadline ? new Date(applicationDeadline) : null,
        status: status || 'active',
      },
    });
    res.status(201).json(withMongoId(d));
  });

  r.patch('/drives/:id', async (req, res) => {
    const d = await prisma.placementDrive.findUnique({ where: { id: req.params.id } });
    if (!d) return res.status(404).json({ error: 'Drive not found' });
    const { title, description, driveDate, applicationDeadline, status } = req.body || {};
    const data = {};
    if (title) data.title = String(title).trim();
    if (description !== undefined) data.description = description;
    if (driveDate !== undefined) data.driveDate = driveDate ? new Date(driveDate) : null;
    if (applicationDeadline !== undefined) data.applicationDeadline = applicationDeadline ? new Date(applicationDeadline) : null;
    if (status) data.status = status;
    const updated = await prisma.placementDrive.update({ where: { id: d.id }, data });
    res.json(withMongoId(updated));
  });

  r.delete('/drives/:id', async (req, res) => {
    const d = await prisma.placementDrive.findUnique({ where: { id: req.params.id } });
    if (!d) return res.status(404).json({ error: 'Drive not found' });
    await prisma.placementDrive.delete({ where: { id: d.id } });
    res.json({ ok: true });
  });

  // ── Applications ──────────────────────────────────────────────────────────

  r.get('/applications', async (req, res) => {
    const { driveId, status, company } = req.query;
    const where = {};
    if (driveId) where.driveId = String(driveId);
    if (status) where.applicationStatus = String(status);

    const list = await prisma.placementApplication.findMany({
      where,
      include: {
        student: { select: { name: true, email: true, studentProfile: true } },
        drive: {
          include: {
            company: { select: { companyName: true, industry: true } },
          },
        },
      },
      orderBy: { appliedAt: 'desc' },
      take: 500,
    });

    const filtered = company
      ? list.filter((a) => a.drive.company.companyName.toLowerCase().includes(String(company).toLowerCase()))
      : list;

    res.json(
      filtered.map((a) => {
        const { student, drive, ...rest } = a;
        return withMongoId({
          ...rest,
          studentName: student.name,
          studentEmail: student.email,
          rollNumber: student.studentProfile?.rollNumber || '',
          className: student.studentProfile?.className || '',
          driveTitle: drive.title,
          companyName: drive.company.companyName,
          industry: drive.company.industry,
        });
      })
    );
  });

  r.patch('/applications/:id/status', async (req, res) => {
    const a = await prisma.placementApplication.findUnique({ where: { id: req.params.id } });
    if (!a) return res.status(404).json({ error: 'Application not found' });
    const { applicationStatus } = req.body || {};
    const valid = ['applied', 'shortlisted', 'interview_scheduled', 'selected', 'rejected'];
    if (!applicationStatus || !valid.includes(applicationStatus)) {
      return res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` });
    }
    const updated = await prisma.placementApplication.update({
      where: { id: a.id },
      data: { applicationStatus },
    });
    res.json(withMongoId(updated));
  });

  // ── Analytics ─────────────────────────────────────────────────────────────

  r.get('/analytics', async (_req, res) => {
    const [totalCompanies, totalDrives, activeDrives, totalApplications] = await Promise.all([
      prisma.company.count(),
      prisma.placementDrive.count(),
      prisma.placementDrive.count({ where: { status: 'active' } }),
      prisma.placementApplication.count(),
    ]);

    const selectedCount = await prisma.placementApplication.count({
      where: { applicationStatus: 'selected' },
    });

    // Company-wise selections
    const companies = await prisma.company.findMany({
      include: {
        placementDrives: {
          include: {
            _count: { select: { applications: true } },
            applications: { where: { applicationStatus: 'selected' }, select: { id: true } },
          },
        },
      },
      orderBy: { companyName: 'asc' },
    });

    const companyStats = companies.map((c) => {
      const totalApps = c.placementDrives.reduce((sum, d) => sum + d._count.applications, 0);
      const selected = c.placementDrives.reduce((sum, d) => sum + d.applications.length, 0);
      return {
        companyName: c.companyName,
        industry: c.industry,
        drives: c.placementDrives.length,
        totalApplications: totalApps,
        selected,
      };
    });

    // Status breakdown
    const statusBreakdown = await prisma.placementApplication.groupBy({
      by: ['applicationStatus'],
      _count: { applicationStatus: true },
    });

    const statusMap = {};
    statusBreakdown.forEach((s) => { statusMap[s.applicationStatus] = s._count.applicationStatus; });

    // Placement success rate
    const successRate = totalApplications > 0
      ? Math.round((selectedCount / totalApplications) * 100)
      : 0;

    res.json({
      totalCompanies,
      totalDrives,
      activeDrives,
      totalApplications,
      selectedStudents: selectedCount,
      successRate,
      statusBreakdown: statusMap,
      companyStats,
    });
  });

  // ── CSV Export ────────────────────────────────────────────────────────────

  r.get('/export/csv', async (_req, res) => {
    const list = await prisma.placementApplication.findMany({
      include: {
        student: { select: { name: true, email: true, studentProfile: true } },
        drive: { include: { company: { select: { companyName: true, packageOffered: true } } } },
      },
      orderBy: { appliedAt: 'desc' },
    });

    const rows = list.map((a) => ({
      name: a.student.name,
      email: a.student.email,
      roll: a.student.studentProfile?.rollNumber || '',
      class: a.student.studentProfile?.className || '',
      company: a.drive.company.companyName,
      drive: a.drive.title,
      package: a.drive.company.packageOffered,
      status: a.applicationStatus,
      appliedAt: new Date(a.appliedAt).toLocaleDateString('en-IN'),
    }));

    const header = 'Student Name,Email,Roll No,Class,Company,Drive,Package,Status,Applied On\n';
    const csv = header + rows.map((r) =>
      `"${r.name}","${r.email}","${r.roll}","${r.class}","${r.company}","${r.drive}","${r.package}","${r.status}","${r.appliedAt}"`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="placement_report.csv"');
    res.send(csv);
  });

  return r;
}

// ─── STUDENT PLACEMENT ROUTER ────────────────────────────────────────────────

export function studentPlacementRouter({ jwtSecret }) {
  const r = Router();
  const auth = createAuthMiddleware(jwtSecret);
  r.use(auth, requireRole('student'));

  // View all companies
  r.get('/companies', async (_req, res) => {
    const list = await prisma.company.findMany({
      orderBy: { companyName: 'asc' },
      include: {
        _count: { select: { placementDrives: true } },
      },
    });
    res.json(
      list.map((c) => {
        const { _count, ...rest } = c;
        return withMongoId({ ...rest, driveCount: _count.placementDrives });
      })
    );
  });

  // View active drives (with company info)
  r.get('/drives', async (req, res) => {
    const studentUser = await prisma.user.findUnique({ where: { id: req.user.id } });
    const myApplications = await prisma.placementApplication.findMany({
      where: { studentId: req.user.id },
      select: { driveId: true, applicationStatus: true },
    });
    const appliedMap = Object.fromEntries(myApplications.map((a) => [a.driveId, a.applicationStatus]));

    const drives = await prisma.placementDrive.findMany({
      where: { status: 'active' },
      include: {
        company: {
          select: {
            companyName: true, industry: true, website: true,
            packageOffered: true, eligibilityCriteria: true, location: true,
          },
        },
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(
      drives.map((d) => {
        const { _count, company, ...rest } = d;
        const hasApplied = appliedMap[d.id] !== undefined;
        return withMongoId({
          ...rest,
          company,
          applicationCount: _count.applications,
          hasApplied,
          myStatus: appliedMap[d.id] || null,
          deadlinePassed: d.applicationDeadline ? new Date(d.applicationDeadline) < new Date() : false,
        });
      })
    );
  });

  // Apply for a drive
  r.post('/apply/:driveId', async (req, res) => {
    const drive = await prisma.placementDrive.findUnique({
      where: { id: req.params.driveId },
      include: { company: { select: { companyName: true } } },
    });
    if (!drive) return res.status(404).json({ error: 'Drive not found' });
    if (drive.status !== 'active') return res.status(400).json({ error: 'This drive is not accepting applications' });
    if (drive.applicationDeadline && new Date(drive.applicationDeadline) < new Date()) {
      return res.status(400).json({ error: 'Application deadline has passed' });
    }

    const existing = await prisma.placementApplication.findUnique({
      where: { studentId_driveId: { studentId: req.user.id, driveId: drive.id } },
    });
    if (existing) return res.status(409).json({ error: 'You have already applied for this drive' });

    const app = await prisma.placementApplication.create({
      data: {
        studentId: req.user.id,
        driveId: drive.id,
        applicationStatus: 'applied',
      },
    });
    res.status(201).json(withMongoId({ ...app, companyName: drive.company.companyName, driveTitle: drive.title }));
  });

  // Student's own applications
  r.get('/applications', async (req, res) => {
    const list = await prisma.placementApplication.findMany({
      where: { studentId: req.user.id },
      include: {
        drive: {
          include: {
            company: {
              select: { companyName: true, industry: true, packageOffered: true, location: true, website: true },
            },
          },
        },
      },
      orderBy: { appliedAt: 'desc' },
    });

    res.json(
      list.map((a) => {
        const { drive, ...rest } = a;
        return withMongoId({
          ...rest,
          driveTitle: drive.title,
          driveDate: drive.driveDate,
          driveStatus: drive.status,
          companyName: drive.company.companyName,
          industry: drive.company.industry,
          packageOffered: drive.company.packageOffered,
          location: drive.company.location,
          website: drive.company.website,
        });
      })
    );
  });

  return r;
}
