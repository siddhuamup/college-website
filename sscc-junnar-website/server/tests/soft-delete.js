/**
 * SOFT-DELETE & RESTORE REGRESSION TESTS
 */
import 'dotenv/config';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();
const BASE = `http://localhost:${process.env.PORT || 3000}`;
const SECRET = process.env.JWT_SECRET;

function makeToken(role, sub, email) {
  return jwt.sign({ sub, role, email }, SECRET, { expiresIn: '1h' });
}

async function apiCall(token, method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(`${BASE}${path}`, opts);
    let data;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status: res.status, data };
  } catch (err) {
    console.error(`Fetch failed for ${method} ${path}:`, err.message);
    return { status: 0, data: null, error: err.message };
  }
}

const results = { PASS: 0, FAIL: 0, details: [] };

function check(label, actual, expected) {
  const pass = Array.isArray(expected) ? expected.includes(actual) : actual === expected;
  results[pass ? 'PASS' : 'FAIL']++;
  const resultStr = pass ? '✅ PASS' : '❌ FAIL';
  results.details.push({ label, actual, expected: Array.isArray(expected) ? expected.join('|') : expected, result: resultStr });
  console.log(`  ${resultStr}: ${label} (got: ${actual}, expected: ${expected})`);
}

async function run() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  SOFT-DELETE & RESTORE REGRESSION TESTS');
  console.log('═══════════════════════════════════════════════════\n');

  // Verify server is reachable
  const health = await apiCall(null, 'GET', '/api/feedback').catch(() => ({ status: 0 }));
  if (health.status === 0) {
    console.log('❌ Error: Local server is not running or not reachable on ' + BASE);
    console.log('Please start the server first (e.g. npm run dev) before running tests.');
    process.exit(1);
  }

  // Define test credentials
  const adminEmail = 'softdel.admin@test.com';
  const studentEmail = 'softdel.student@test.com';
  const teacherEmail = 'softdel.teacher@test.com';
  const emailConflict = 'softdel.conflict@test.com';
  const password = 'TestPassword@123';
  const passwordHash = await bcrypt.hash(password, 10);

  // Clean up any leftovers from previous failed test runs
  await prisma.auditLog.deleteMany({
    where: {
      action: { in: ['SOFT_DELETE_USER', 'RESTORE_USER', 'SOFT_DELETE_NOTICE', 'RESTORE_NOTICE', 'SOFT_DELETE_COURSE', 'RESTORE_COURSE'] }
    }
  });
  await prisma.notice.deleteMany({ where: { title: { startsWith: 'SoftDel Notice' } } });
  await prisma.course.deleteMany({ where: { name: { startsWith: 'SoftDel Course' } } });
  await prisma.department.deleteMany({ where: { name: { startsWith: 'SoftDel Dept' } } });
  await prisma.user.deleteMany({ where: { email: { in: [adminEmail, studentEmail, teacherEmail, emailConflict] } } });

  // 1. Create test records in database
  console.log('Creating test records in database...');
  const adminUser = await prisma.user.create({
    data: { name: 'SoftDel Admin', email: adminEmail, role: Role.admin, passwordHash }
  });
  const studentUser = await prisma.user.create({
    data: { name: 'SoftDel Student', email: studentEmail, role: Role.student, passwordHash }
  });
  const teacherUser = await prisma.user.create({
    data: { name: 'SoftDel Teacher', email: teacherEmail, role: Role.teacher, passwordHash }
  });
  const noticeItem = await prisma.notice.create({
    data: { title: 'SoftDel Notice', body: 'Body', createdById: adminUser.id }
  });

  let firstDept = await prisma.department.findFirst();
  let departmentId = firstDept ? firstDept.id : null;
  if (!departmentId) {
    const dept = await prisma.department.create({
      data: { name: 'SoftDel Dept', code: 'SD', description: 'Test' }
    });
    departmentId = dept.id;
  }

  const courseItem = await prisma.course.create({
    data: { name: 'SoftDel Course', departmentId, duration: '3 Years', level: 'UG' }
  });

  const adminToken = makeToken(Role.admin, adminUser.id, adminEmail);
  const studentToken = makeToken(Role.student, studentUser.id, studentEmail);

  // --- TEST 1: Soft delete student ---
  console.log('\n--- Test 1: Soft delete student ---');
  const delStudentRes = await apiCall(adminToken, 'DELETE', `/api/admin/students/${studentUser.id}`);
  check('Delete student endpoint status', delStudentRes.status, [200, 204]);

  const dbStudentDel = await prisma.user.findUnique({ where: { id: studentUser.id } });
  check('Student isDeleted in DB', dbStudentDel.isDeleted, true);
  check('Student deletedBy in DB', dbStudentDel.deletedBy, adminUser.id);
  check('Student deletedAt is set', dbStudentDel.deletedAt !== null, true);

  const logsDelStudent = await prisma.auditLog.findFirst({
    where: { action: 'DELETE_STUDENT', target: studentUser.id }
  });
  check('Audit log entry created', logsDelStudent !== null, true);
  if (logsDelStudent) {
    check('Audit log user ID', logsDelStudent.userId, adminUser.id);
  }

  // --- TEST 2: Soft deleted student login block ---
  console.log('\n--- Test 2: Soft deleted student login block ---');
  const loginRes = await apiCall(null, 'POST', '/api/auth/login', { email: studentEmail, password });
  check('Login status for soft-deleted student', loginRes.status, 401);
  check('Login error response message', loginRes.data?.error || loginRes.data?.message, 'Invalid credentials');

  // --- TEST 3: Soft-deleted items hidden from lists ---
  console.log('\n--- Test 3: Soft-deleted student hidden from list ---');
  const studentListRes = await apiCall(adminToken, 'GET', '/api/admin/students');
  const isStudentListed = Array.isArray(studentListRes.data) && studentListRes.data.some(s => s.id === studentUser.id);
  check('Student hidden from list API', isStudentListed, false);

  // --- TEST 4: Restore student ---
  console.log('\n--- Test 4: Restore student ---');
  const restoreRes = await apiCall(adminToken, 'POST', `/api/admin/students/${studentUser.id}/restore`);
  check('Restore student status', restoreRes.status, 200);

  const dbStudentRestored = await prisma.user.findUnique({ where: { id: studentUser.id } });
  check('Student isDeleted false after restore', dbStudentRestored.isDeleted, false);
  check('Student deletedBy null after restore', !dbStudentRestored.deletedBy, true);
  check('Student deletedAt null after restore', dbStudentRestored.deletedAt, null);

  const logsRestoreStudent = await prisma.auditLog.findFirst({
    where: { action: 'RESTORE_STUDENT', target: studentUser.id }
  });
  check('Restore Audit log entry created', logsRestoreStudent !== null, true);

  // Restore original so we can delete normally during recycle bin check
  await prisma.user.update({
    where: { id: studentUser.id },
    data: { isDeleted: false, deletedAt: null, deletedBy: '' }
  });

  // --- TEST 6: Recycle Bin checks ---
  console.log('\n--- Test 6: Recycle Bin items check ---');
  // Soft delete multiple items
  await apiCall(adminToken, 'DELETE', `/api/admin/students/${studentUser.id}`);
  await apiCall(adminToken, 'DELETE', `/api/admin/teachers/${teacherUser.id}`);
  await apiCall(adminToken, 'DELETE', `/api/admin/notices/${noticeItem.id}`);
  await apiCall(adminToken, 'DELETE', `/api/admin/courses/${courseItem.id}`);

  const binRes = await apiCall(adminToken, 'GET', '/api/admin/recycle-bin');
  check('Recycle Bin API status', binRes.status, 200);
  
  const binStudents = binRes.data?.students || [];
  const binTeachers = binRes.data?.teachers || [];
  const binNotices = binRes.data?.notices || [];
  const binCourses = binRes.data?.courses || [];

  check('Student found in Recycle Bin', binStudents.some(s => s.id === studentUser.id), true);
  check('Teacher found in Recycle Bin', binTeachers.some(t => t.id === teacherUser.id), true);
  check('Notice found in Recycle Bin', binNotices.some(n => n.id === noticeItem.id), true);
  check('Course found in Recycle Bin', binCourses.some(c => c.id === courseItem.id), true);

  // Cleanup database records
  console.log('\nCleaning up test records from database...');
  await prisma.auditLog.deleteMany({
    where: {
      action: { in: ['SOFT_DELETE_USER', 'RESTORE_USER', 'SOFT_DELETE_NOTICE', 'RESTORE_NOTICE', 'SOFT_DELETE_COURSE', 'RESTORE_COURSE'] }
    }
  });
  await prisma.notice.deleteMany({ where: { title: { startsWith: 'SoftDel Notice' } } });
  await prisma.course.deleteMany({ where: { name: { startsWith: 'SoftDel Course' } } });
  await prisma.department.deleteMany({ where: { name: { startsWith: 'SoftDel Dept' } } });
  await prisma.user.deleteMany({ where: { email: { in: [adminEmail, studentEmail, teacherEmail] } } });

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  TEST RESULTS: ${results.PASS} PASSED, ${results.FAIL} FAILED`);
  console.log('═══════════════════════════════════════════════════\n');

  if (results.FAIL > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
