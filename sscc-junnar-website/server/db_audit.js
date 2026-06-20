/**
 * DATABASE AUDIT — Data Integrity, Orphans, and Relationship Check
 */
import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  DATABASE AUDIT — DATA INTEGRITY CHECK');
  console.log('═══════════════════════════════════════════════════\n');

  const findings = [];
  let pass = 0, fail = 0;

  // 1. User table integrity
  const allUsers = await prisma.user.findMany();
  console.log(`▶ Users: ${allUsers.length} total`);
  const admins = allUsers.filter(u => u.role === 'admin');
  const teachers = allUsers.filter(u => u.role === 'teacher');
  const students = allUsers.filter(u => u.role === 'student');
  console.log(`  Admins: ${admins.length}, Teachers: ${teachers.length}, Students: ${students.length}`);

  // Check for duplicate emails
  const emails = allUsers.map(u => u.email);
  const dupEmails = emails.filter((e, i) => emails.indexOf(e) !== i);
  if (dupEmails.length) {
    fail++;
    findings.push(`❌ Duplicate emails found: ${dupEmails.join(', ')}`);
  } else {
    pass++;
    findings.push(`✅ No duplicate emails`);
  }

  // Check for empty/null password hashes
  const noHash = allUsers.filter(u => !u.passwordHash);
  if (noHash.length) {
    fail++;
    findings.push(`❌ ${noHash.length} users have no password hash`);
  } else {
    pass++;
    findings.push(`✅ All users have password hashes`);
  }

  // Check for duplicate student IDs
  const studentIds = students
    .map(s => s.studentProfile?.studentId)
    .filter(Boolean);
  const dupStudentIds = studentIds.filter((s, i) => studentIds.indexOf(s) !== i);
  if (dupStudentIds.length) {
    fail++;
    findings.push(`❌ Duplicate studentIds: ${dupStudentIds.join(', ')}`);
  } else {
    pass++;
    findings.push(`✅ No duplicate student IDs`);
  }

  // Check for duplicate roll numbers
  const rollNumbers = students
    .map(s => s.studentProfile?.rollNumber)
    .filter(Boolean);
  const dupRolls = rollNumbers.filter((r, i) => rollNumbers.indexOf(r) !== i);
  if (dupRolls.length) {
    fail++;
    findings.push(`❌ Duplicate roll numbers: ${dupRolls.join(', ')}`);
  } else {
    pass++;
    findings.push(`✅ No duplicate roll numbers`);
  }

  // 2. Attendance orphan check
  console.log('\n▶ Attendance records...');
  const allAttendance = await prisma.attendance.findMany();
  console.log(`  Total attendance records: ${allAttendance.length}`);
  const userIds = new Set(allUsers.map(u => u.id));
  const orphanAtt = allAttendance.filter(a => !userIds.has(a.studentId) || !userIds.has(a.teacherId));
  if (orphanAtt.length) {
    fail++;
    findings.push(`❌ ${orphanAtt.length} orphaned attendance records (missing student or teacher)`);
  } else {
    pass++;
    findings.push(`✅ No orphaned attendance records`);
  }

  // 3. Marks orphan check
  console.log('\n▶ Marks records...');
  const allMarks = await prisma.mark.findMany();
  console.log(`  Total marks records: ${allMarks.length}`);
  const orphanMarks = allMarks.filter(m => !userIds.has(m.studentId) || !userIds.has(m.teacherId));
  if (orphanMarks.length) {
    fail++;
    findings.push(`❌ ${orphanMarks.length} orphaned marks records`);
  } else {
    pass++;
    findings.push(`✅ No orphaned marks records`);
  }

  // 4. Study material orphan check
  console.log('\n▶ Study materials...');
  const allMaterials = await prisma.studyMaterial.findMany();
  console.log(`  Total materials: ${allMaterials.length}`);
  const orphanMat = allMaterials.filter(m => !userIds.has(m.teacherId));
  if (orphanMat.length) {
    fail++;
    findings.push(`❌ ${orphanMat.length} orphaned study materials`);
  } else {
    pass++;
    findings.push(`✅ No orphaned study materials`);
  }

  // 5. Admission applications — check for orphaned reviewedById / createdStudentUserId
  console.log('\n▶ Admission applications...');
  const allAdmissions = await prisma.admissionApplication.findMany();
  console.log(`  Total admissions: ${allAdmissions.length}`);
  const orphanAdmReview = allAdmissions.filter(a => a.reviewedById && !userIds.has(a.reviewedById));
  const orphanAdmStudent = allAdmissions.filter(a => a.createdStudentUserId && !userIds.has(a.createdStudentUserId));
  if (orphanAdmReview.length) {
    fail++;
    findings.push(`❌ ${orphanAdmReview.length} admissions reference deleted reviewer`);
  } else {
    pass++;
    findings.push(`✅ No orphaned admission reviewer references`);
  }
  if (orphanAdmStudent.length) {
    fail++;
    findings.push(`❌ ${orphanAdmStudent.length} admissions reference deleted student`);
  } else {
    pass++;
    findings.push(`✅ No orphaned admission student references`);
  }

  // 6. Library orphan check
  console.log('\n▶ Library...');
  const allBooks = await prisma.libraryBook.findMany();
  const allIssues = await prisma.libraryIssue.findMany();
  console.log(`  Books: ${allBooks.length}, Issues: ${allIssues.length}`);
  const bookIds = new Set(allBooks.map(b => b.id));
  const orphanIssues = allIssues.filter(i => !bookIds.has(i.bookId) || !userIds.has(i.studentId));
  if (orphanIssues.length) {
    fail++;
    findings.push(`❌ ${orphanIssues.length} orphaned library issues`);
  } else {
    pass++;
    findings.push(`✅ No orphaned library issues`);
  }
  // Check: availableQty consistency
  for (const book of allBooks) {
    const activeIssues = allIssues.filter(i => i.bookId === book.id && !i.returnedAt);
    const expectedAvail = book.totalQty - activeIssues.length;
    if (expectedAvail !== book.availableQty) {
      fail++;
      findings.push(`❌ Book "${book.title}" (${book.id}): availableQty=${book.availableQty} but expected ${expectedAvail}`);
    }
  }
  pass++;
  findings.push(`✅ Library book availability consistency checked`);

  // 7. Placement orphan check
  console.log('\n▶ Placement...');
  const allCompanies = await prisma.company.findMany();
  const allDrives = await prisma.placementDrive.findMany();
  const allPlacementApps = await prisma.placementApplication.findMany();
  console.log(`  Companies: ${allCompanies.length}, Drives: ${allDrives.length}, Applications: ${allPlacementApps.length}`);
  const companyIds = new Set(allCompanies.map(c => c.id));
  const driveIds = new Set(allDrives.map(d => d.id));
  const orphanDrives = allDrives.filter(d => !companyIds.has(d.companyId));
  const orphanPlacementApps = allPlacementApps.filter(a => !driveIds.has(a.driveId) || !userIds.has(a.studentId));
  if (orphanDrives.length) {
    fail++;
    findings.push(`❌ ${orphanDrives.length} orphaned placement drives`);
  } else {
    pass++;
    findings.push(`✅ No orphaned placement drives`);
  }
  if (orphanPlacementApps.length) {
    fail++;
    findings.push(`❌ ${orphanPlacementApps.length} orphaned placement applications`);
  } else {
    pass++;
    findings.push(`✅ No orphaned placement applications`);
  }

  // 8. Leave requests orphan check
  console.log('\n▶ Leave requests...');
  const allLeaves = await prisma.leaveRequest.findMany();
  console.log(`  Total leave requests: ${allLeaves.length}`);
  const orphanLeaves = allLeaves.filter(l => !userIds.has(l.teacherId));
  if (orphanLeaves.length) {
    fail++;
    findings.push(`❌ ${orphanLeaves.length} orphaned leave requests`);
  } else {
    pass++;
    findings.push(`✅ No orphaned leave requests`);
  }

  // 9. Timetable check
  console.log('\n▶ Timetable...');
  const allTimetables = await prisma.timetable.findMany();
  console.log(`  Total timetables: ${allTimetables.length}`);

  // 10. Exam check
  console.log('\n▶ Exams...');
  const allExams = await prisma.exam.findMany();
  console.log(`  Total exams: ${allExams.length}`);

  // 11. Notice check
  console.log('\n▶ Notices...');
  const allNotices = await prisma.notice.findMany();
  console.log(`  Total notices: ${allNotices.length}`);
  const orphanNotices = allNotices.filter(n => n.createdById && !userIds.has(n.createdById));
  if (orphanNotices.length) {
    fail++;
    findings.push(`❌ ${orphanNotices.length} notices reference deleted creator`);
  } else {
    pass++;
    findings.push(`✅ No orphaned notice creator references`);
  }

  // 12. Feedback check
  const allFeedback = await prisma.feedback.findMany();
  console.log(`\n▶ Feedback: ${allFeedback.length} records`);

  // 13. CollegeSettings check
  const allSettings = await prisma.collegeSettings.findMany();
  console.log(`\n▶ College settings: ${allSettings.length} keys`);
  const hasThreshold = allSettings.find(s => s.key === 'attendanceThreshold');
  if (hasThreshold) {
    pass++;
    findings.push(`✅ attendanceThreshold setting exists: ${JSON.stringify(hasThreshold.value)}`);
  } else {
    findings.push(`⚠️ attendanceThreshold setting not found (defaults to 75%)`);
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  DATABASE AUDIT: ${pass} PASS / ${fail} FAIL`);
  console.log('═══════════════════════════════════════════════════\n');
  findings.forEach(f => console.log(`  ${f}`));
  console.log();
  console.log(fail === 0 ? '🟢 DATABASE AUDIT: ALL CHECKS PASSED' : '🔴 DATABASE AUDIT: ISSUES FOUND');
  console.log();

  await prisma.$disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
