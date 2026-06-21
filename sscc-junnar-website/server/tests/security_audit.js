/**
 * SECURITY AUDIT — Role-Based Access Control (RBAC) Verification
 * Tests that:
 *   1. Unauthenticated requests are blocked
 *   2. Student tokens cannot access Teacher/Admin endpoints
 *   3. Teacher tokens cannot access Admin endpoints
 *   4. Admin tokens cannot access Student/Teacher-only endpoints
 */
import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE = `http://localhost:${process.env.PORT || 3000}`;
const SECRET = process.env.JWT_SECRET;

function makeToken(role, sub) {
  return jwt.sign({ sub, role, email: `${role}@audit.test` }, SECRET, { expiresIn: '1h' });
}

let studentToken = null;
let teacherToken = null;
let adminToken = null;

async function req(method, path, token = null, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  return { status: res.status, path, method };
}

const results = { PASS: 0, FAIL: 0, details: [] };

function check(label, actual, expected) {
  const pass = expected.includes(actual);
  results[pass ? 'PASS' : 'FAIL']++;
  results.details.push({ label, actual, expected: expected.join('|'), result: pass ? '✅ PASS' : '❌ FAIL' });
  if (!pass) {
    console.log(`  ❌ FAIL: ${label} — got ${actual}, expected ${expected.join('|')}`);
  }
}

async function run() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  SECURITY AUDIT — RBAC VERIFICATION');
  console.log('═══════════════════════════════════════════════════\n');

  // Create temporary audit users in DB so the isActive check passes
  const auditUsers = [
    { id: 'audit-student-001', email: 'student@audit.test', passwordHash: 'hash', role: 'student', name: 'Audit Student', isActive: true },
    { id: 'audit-teacher-001', email: 'teacher@audit.test', passwordHash: 'hash', role: 'teacher', name: 'Audit Teacher', isActive: true },
    { id: 'audit-admin-001', email: 'admin@audit.test', passwordHash: 'hash', role: 'admin', name: 'Audit Admin', isActive: true },
  ];

  for (const user of auditUsers) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: { isActive: true, role: user.role },
      create: user,
    });
  }

  studentToken = makeToken('student', 'audit-student-001');
  teacherToken = makeToken('teacher', 'audit-teacher-001');
  adminToken = makeToken('admin', 'audit-admin-001');

  // ── Phase 1: Unauthenticated Access ────────────────────────────────
  console.log('▶ Phase 1: Unauthenticated Access (should be 401)');
  const unauth = [
    ['GET', '/api/admin/dashboard/stats'],
    ['GET', '/api/admin/students'],
    ['GET', '/api/teacher/subjects'],
    ['GET', '/api/student/profile'],
    ['GET', '/api/admin/placement/companies'],
    ['GET', '/api/admin/timetable'],
    ['GET', '/api/admin/library/books'],
    ['GET', '/api/admin/exams'],
    ['GET', '/api/teacher/timetable'],
    ['GET', '/api/student/timetable'],
    ['GET', '/api/student/placement/drives'],
    ['GET', '/api/student/library/my-books'],
    ['GET', '/api/student/exams/schedule'],
    ['GET', '/api/teacher/exams'],
  ];
  for (const [method, path] of unauth) {
    const r = await req(method, path);
    check(`No-Auth → ${method} ${path}`, r.status, [401]);
  }

  // ── Phase 2: Student → Admin Endpoints (should be 403) ────────────
  console.log('\n▶ Phase 2: Student Token → Admin Endpoints (should be 403)');
  const studentToAdmin = [
    ['GET', '/api/admin/dashboard/stats'],
    ['GET', '/api/admin/students'],
    ['POST', '/api/admin/students'],
    ['GET', '/api/admin/teachers'],
    ['POST', '/api/admin/teachers'],
    ['GET', '/api/admin/admissions'],
    ['GET', '/api/admin/notices'],
    ['POST', '/api/admin/notices'],
    ['GET', '/api/admin/departments'],
    ['GET', '/api/admin/courses'],
    ['GET', '/api/admin/gallery'],
    ['GET', '/api/admin/feedback'],
    ['GET', '/api/admin/settings'],
    ['PUT', '/api/admin/settings'],
    ['GET', '/api/admin/attendance/analytics'],
    ['GET', '/api/admin/leave'],
    ['GET', '/api/admin/placement/companies'],
    ['GET', '/api/admin/placement/drives'],
    ['GET', '/api/admin/placement/applications'],
    ['GET', '/api/admin/placement/analytics'],
    ['GET', '/api/admin/timetable'],
    ['GET', '/api/admin/library/books'],
    ['GET', '/api/admin/library/issues'],
    ['GET', '/api/admin/exams'],
  ];
  for (const [method, path] of studentToAdmin) {
    const r = await req(method, path, studentToken);
    check(`Student → ${method} ${path}`, r.status, [403]);
  }

  // ── Phase 3: Student → Teacher Endpoints (should be 403) ──────────
  console.log('\n▶ Phase 3: Student Token → Teacher Endpoints (should be 403)');
  const studentToTeacher = [
    ['GET', '/api/teacher/subjects'],
    ['GET', '/api/teacher/students'],
    ['POST', '/api/teacher/marks'],
    ['GET', '/api/teacher/marks'],
    ['POST', '/api/teacher/attendance'],
    ['GET', '/api/teacher/attendance'],
    ['GET', '/api/teacher/materials'],
    ['GET', '/api/teacher/notices'],
    ['GET', '/api/teacher/timetable'],
    ['GET', '/api/teacher/exams'],
  ];
  for (const [method, path] of studentToTeacher) {
    const r = await req(method, path, studentToken);
    check(`Student → ${method} ${path}`, r.status, [403]);
  }

  // ── Phase 4: Teacher → Admin Endpoints (should be 403) ────────────
  console.log('\n▶ Phase 4: Teacher Token → Admin Endpoints (should be 403)');
  const teacherToAdmin = [
    ['GET', '/api/admin/dashboard/stats'],
    ['GET', '/api/admin/students'],
    ['GET', '/api/admin/teachers'],
    ['GET', '/api/admin/admissions'],
    ['GET', '/api/admin/settings'],
    ['PUT', '/api/admin/settings'],
    ['GET', '/api/admin/attendance/analytics'],
    ['GET', '/api/admin/placement/companies'],
    ['GET', '/api/admin/timetable'],
    ['GET', '/api/admin/library/books'],
    ['GET', '/api/admin/exams'],
  ];
  for (const [method, path] of teacherToAdmin) {
    const r = await req(method, path, teacherToken);
    check(`Teacher → ${method} ${path}`, r.status, [403]);
  }

  // ── Phase 5: Teacher → Student-Only Endpoints (should be 403) ─────
  console.log('\n▶ Phase 5: Teacher Token → Student-Only Endpoints (should be 403)');
  const teacherToStudent = [
    ['GET', '/api/student/profile'],
    ['GET', '/api/student/marks'],
    ['GET', '/api/student/attendance'],
    ['GET', '/api/student/materials'],
    ['GET', '/api/student/notices'],
    ['GET', '/api/student/placement/drives'],
    ['GET', '/api/student/placement/applications'],
    ['GET', '/api/student/timetable'],
    ['GET', '/api/student/library/my-books'],
    ['GET', '/api/student/exams/schedule'],
    ['GET', '/api/student/exams/results'],
  ];
  for (const [method, path] of teacherToStudent) {
    const r = await req(method, path, teacherToken);
    check(`Teacher → ${method} ${path}`, r.status, [403]);
  }

  // ── Phase 6: Admin → Student/Teacher-Only Endpoints (should be 403) ─
  console.log('\n▶ Phase 6: Admin Token → Student/Teacher-Only Endpoints (should be 403)');
  const adminToStudentTeacher = [
    ['GET', '/api/student/profile'],
    ['GET', '/api/student/marks'],
    ['GET', '/api/student/attendance'],
    ['GET', '/api/student/placement/drives'],
    ['GET', '/api/student/timetable'],
    ['GET', '/api/student/library/my-books'],
    ['GET', '/api/student/exams/schedule'],
    ['GET', '/api/teacher/subjects'],
    ['GET', '/api/teacher/students'],
    ['GET', '/api/teacher/marks'],
    ['GET', '/api/teacher/attendance'],
    ['GET', '/api/teacher/timetable'],
    ['GET', '/api/teacher/exams'],
  ];
  for (const [method, path] of adminToStudentTeacher) {
    const r = await req(method, path, adminToken);
    check(`Admin → ${method} ${path}`, r.status, [403]);
  }

  // ── Phase 7: Public endpoints should be accessible without auth ───
  console.log('\n▶ Phase 7: Public Endpoints (should be 200)');
  const pub = [
    ['GET', '/api/public/notices'],
    ['GET', '/api/public/gallery'],
    ['GET', '/api/public/courses'],
    ['GET', '/api/public/departments'],
    ['GET', '/api/public/faculty'],
    ['GET', '/api/public/student-directory'],
    ['GET', '/api/public/settings'],
    ['GET', '/api/public/facilities'],
    ['GET', '/api/health'],
  ];
  for (const [method, path] of pub) {
    const r = await req(method, path);
    check(`Public → ${method} ${path}`, r.status, [200]);
  }

  // ── Phase 8: Invalid Token ────────────────────────────────────────
  console.log('\n▶ Phase 8: Invalid/Expired Token (should be 401)');
  const fakeToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4IiwiZXhwIjoxfQ.FAKE';
  const invalidTokenEndpoints = [
    ['GET', '/api/admin/dashboard/stats'],
    ['GET', '/api/teacher/subjects'],
    ['GET', '/api/student/profile'],
  ];
  for (const [method, path] of invalidTokenEndpoints) {
    const r = await req(method, path, fakeToken);
    check(`Invalid Token → ${method} ${path}`, r.status, [401]);
  }

  // ── Summary ───────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  RESULTS: ${results.PASS} PASS / ${results.FAIL} FAIL`);
  console.log('═══════════════════════════════════════════════════\n');

  if (results.FAIL > 0) {
    console.log('FAILED TESTS:');
    results.details.filter(d => d.result.includes('FAIL')).forEach(d => {
      console.log(`  • ${d.label}: got ${d.actual}, expected ${d.expected}`);
    });
  }

  console.log(results.FAIL === 0 ? '\n🟢 SECURITY AUDIT: ALL TESTS PASSED\n' : '\n🔴 SECURITY AUDIT: FAILURES DETECTED\n');

  // Print full table
  console.log('\nFull Results Table:');
  console.log('─'.repeat(90));
  console.log(`${'Test'.padEnd(60)} | ${'Status'.padEnd(6)} | ${'Got'.padEnd(4)} | Expected`);
  console.log('─'.repeat(90));
  results.details.forEach(d => {
    const icon = d.result.includes('PASS') ? '✅' : '❌';
    console.log(`${d.label.padEnd(60)} | ${icon.padEnd(6)} | ${String(d.actual).padEnd(4)} | ${d.expected}`);
  });
  console.log('─'.repeat(90));
}

run()
  .catch(e => {
    console.error('Audit script failed:', e);
  })
  .finally(async () => {
    const auditUserIds = ['audit-student-001', 'audit-teacher-001', 'audit-admin-001'];
    for (const id of auditUserIds) {
      await prisma.user.delete({ where: { id } }).catch(() => {});
    }
    await prisma.$disconnect();
    if (results.FAIL > 0) {
      process.exit(1);
    }
  });
