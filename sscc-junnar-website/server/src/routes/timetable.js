import { Router } from 'express';
import { prisma, withMongoId } from '../db/client.js';
import { createAuthMiddleware, requireRole } from '../middleware/auth.js';
import { Role } from '@prisma/client';

// Helper to safely parse slots JSON
function parseSlots(slotsField) {
  if (!slotsField) return [];
  if (Array.isArray(slotsField)) return slotsField;
  try {
    return typeof slotsField === 'string' ? JSON.parse(slotsField) : [];
  } catch {
    return [];
  }
}

export function adminTimetableRouter({ jwtSecret }) {
  const r = Router();
  const auth = createAuthMiddleware(jwtSecret);
  r.use(auth, requireRole('admin'));

  // Get all timetables
  r.get('/', async (_req, res) => {
    const all = await prisma.timetable.findMany({
      where: { weekLabel: 'current' }
    });
    res.json(all.map(t => ({
      ...withMongoId(t),
      slots: parseSlots(t.slots)
    })));
  });

  // Get list of unique classNames from student profiles
  r.get('/classes', async (_req, res) => {
    const students = await prisma.user.findMany({
      where: { role: Role.student },
      select: { studentProfile: true }
    });
    const classes = Array.from(new Set(students
      .map(s => {
        const profile = s.studentProfile;
        return profile && typeof profile === 'object' ? profile.className : null;
      })
      .filter(Boolean)
    )).sort();
    res.json(classes);
  });

  // Get list of active teachers for dropdowns
  r.get('/teachers', async (_req, res) => {
    const teachers = await prisma.user.findMany({
      where: { role: Role.teacher, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    });
    res.json(teachers);
  });

  // Get timetable for class
  r.get('/:className', async (req, res) => {
    const timetable = await prisma.timetable.findFirst({
      where: { className: req.params.className, weekLabel: 'current' }
    });
    if (timetable) {
      res.json({
        ...withMongoId(timetable),
        slots: parseSlots(timetable.slots)
      });
    } else {
      res.json({ className: req.params.className, weekLabel: 'current', slots: [] });
    }
  });

  // Save/Upsert timetable with Server validation for conflict detection
  r.post('/:className', async (req, res) => {
    const { slots } = req.body || {};
    const className = req.params.className;

    if (!Array.isArray(slots)) {
      return res.status(400).json({ error: 'slots must be an array' });
    }

    // Server-Side Conflict Detection
    // For each slot, verify that the teacher is not already assigned to another class's timetable at the same day + period
    const otherTimetables = await prisma.timetable.findMany({
      where: {
        className: { not: className },
        weekLabel: 'current',
        isActive: true
      }
    });

    for (const slot of slots) {
      const period = Number(slot.period);

      for (const other of otherTimetables) {
        const otherSlots = parseSlots(other.slots);
        
        // 1. Teacher conflict check
        if (slot.teacherId) {
          const teacherConflict = otherSlots.find(os => 
            os.day === slot.day && 
            Number(os.period) === period && 
            os.teacherId === slot.teacherId
          );
          if (teacherConflict) {
            return res.status(400).json({
              error: `Conflict: Teacher "${slot.teacherName || 'Selected teacher'}" is already assigned to class "${other.className}" on ${slot.day} during Period ${period}.`
            });
          }
        }

        // 2. Room conflict check
        const roomName = String(slot.room || '').trim();
        if (roomName) {
          const roomConflict = otherSlots.find(os => 
            os.day === slot.day && 
            Number(os.period) === period && 
            String(os.room || '').trim().toLowerCase() === roomName.toLowerCase()
          );
          if (roomConflict) {
            return res.status(400).json({
              error: `Conflict: Room "${roomName}" is already occupied by class "${other.className}" on ${slot.day} during Period ${period}.`
            });
          }
        }
      }
    }

    const updated = await prisma.timetable.upsert({
      where: {
        className_weekLabel: {
          className,
          weekLabel: 'current'
        }
      },
      update: { slots },
      create: {
        className,
        weekLabel: 'current',
        slots
      }
    });

    res.json({
      ...withMongoId(updated),
      slots: parseSlots(updated.slots)
    });
  });

  // Delete timetable
  r.delete('/:className', async (req, res) => {
    try {
      await prisma.timetable.delete({
        where: {
          className_weekLabel: {
            className: req.params.className,
            weekLabel: 'current'
          }
        }
      });
      res.json({ ok: true });
    } catch (err) {
      res.status(404).json({ error: 'Timetable not found' });
    }
  });

  return r;
}

export function teacherTimetableRouter({ jwtSecret }) {
  const r = Router();
  const auth = createAuthMiddleware(jwtSecret);
  r.use(auth, requireRole('teacher'));

  // View personal timetable - get all slots assigned to this teacher
  r.get('/', async (req, res) => {
    const allTimetables = await prisma.timetable.findMany({
      where: { weekLabel: 'current', isActive: true }
    });

    const teacherSlots = [];
    allTimetables.forEach(t => {
      const slots = parseSlots(t.slots);
      slots.forEach(s => {
        if (s.teacherId === req.user.id) {
          teacherSlots.push({
            ...s,
            className: t.className
          });
        }
      });
    });

    res.json(teacherSlots);
  });

  return r;
}

export function studentTimetableRouter({ jwtSecret }) {
  const r = Router();
  const auth = createAuthMiddleware(jwtSecret);
  r.use(auth, requireRole('student'));

  // View class timetable
  r.get('/', async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const profile = user?.studentProfile;
    const className = profile && typeof profile === 'object' ? profile.className : null;
    if (!className) {
      return res.json({ className: '', slots: [] });
    }

    const timetable = await prisma.timetable.findFirst({
      where: { className, weekLabel: 'current', isActive: true }
    });

    if (timetable) {
      res.json({
        ...withMongoId(timetable),
        slots: parseSlots(timetable.slots)
      });
    } else {
      res.json({ className, weekLabel: 'current', slots: [] });
    }
  });

  return r;
}
