import { prisma } from './db/client.js';

async function runAudit() {
  console.log('--- STARTING DATABASE AUDIT ---');
  
  const users = await prisma.user.findMany();
  const admissions = await prisma.admissionApplication.findMany();
  const marks = await prisma.mark.findMany();
  const attendances = await prisma.attendance.findMany();
  const materials = await prisma.studyMaterial.findMany();
  const placementDrives = await prisma.placementDrive ? await prisma.placementDrive.findMany() : [];
  const placementApps = await prisma.placementApplication ? await prisma.placementApplication.findMany() : [];
  const libraryBooks = await prisma.libraryBook ? await prisma.libraryBook.findMany() : [];
  const libraryIssues = await prisma.libraryIssue ? await prisma.libraryIssue.findMany() : [];
  const leaves = await prisma.leaveRequest.findMany();
  const courses = await prisma.course.findMany();
  const departments = await prisma.department.findMany();

  const userMap = new Map(users.map(u => [u.id, u]));
  const driveMap = new Map(placementDrives.map(d => [d.id, d]));
  const bookMap = new Map(libraryBooks.map(b => [b.id, b]));
  const deptMap = new Map(departments.map(d => [d.id, d]));

  let duplicates = {
    studentIds: [],
    rollNumbers: [],
    emails: []
  };

  let orphans = {
    marksStudent: [],
    marksTeacher: [],
    attendanceStudent: [],
    attendanceTeacher: [],
    materialsTeacher: [],
    placementAppsStudent: [],
    placementAppsDrive: [],
    libraryIssuesStudent: [],
    libraryIssuesBook: [],
    leavesTeacher: [],
    coursesDept: []
  };

  const studentIds = new Map();
  const rollNumbers = new Map();
  const emails = new Map();

  // Audit Users
  for (const u of users) {
    // Check global unique email
    if (emails.has(u.email)) {
      duplicates.emails.push({ email: u.email, firstUser: emails.get(u.email), secondUser: u.id });
    } else {
      emails.set(u.email, u.id);
    }

    if (u.role === 'student' && u.studentProfile) {
      const sp = typeof u.studentProfile === 'string' ? JSON.parse(u.studentProfile) : u.studentProfile;
      
      // Check Student ID duplicate
      if (sp.studentId) {
        if (studentIds.has(sp.studentId)) {
          duplicates.studentIds.push({ studentId: sp.studentId, users: [studentIds.get(sp.studentId), u.id] });
        } else {
          studentIds.set(sp.studentId, u.id);
        }
      }

      // Check Roll Number duplicate
      if (sp.rollNumber) {
        if (rollNumbers.has(sp.rollNumber)) {
          duplicates.rollNumbers.push({ rollNumber: sp.rollNumber, users: [rollNumbers.get(sp.rollNumber), u.id] });
        } else {
          rollNumbers.set(sp.rollNumber, u.id);
        }
      }
    }
  }

  // Audit Marks
  for (const m of marks) {
    if (!userMap.has(m.studentId)) {
      orphans.marksStudent.push({ markId: m.id, studentId: m.studentId });
    } else if (userMap.get(m.studentId).role !== 'student') {
      orphans.marksStudent.push({ markId: m.id, studentId: m.studentId, note: 'User is not a student' });
    }
    if (!userMap.has(m.teacherId)) {
      orphans.marksTeacher.push({ markId: m.id, teacherId: m.teacherId });
    } else if (userMap.get(m.teacherId).role !== 'teacher') {
      orphans.marksTeacher.push({ markId: m.id, teacherId: m.teacherId, note: 'User is not a teacher' });
    }
  }

  // Audit Attendance
  for (const a of attendances) {
    if (!userMap.has(a.studentId)) {
      orphans.attendanceStudent.push({ attId: a.id, studentId: a.studentId });
    } else if (userMap.get(a.studentId).role !== 'student') {
      orphans.attendanceStudent.push({ attId: a.id, studentId: a.studentId, note: 'User is not a student' });
    }
    if (!userMap.has(a.teacherId)) {
      orphans.attendanceTeacher.push({ attId: a.id, teacherId: a.teacherId });
    } else if (userMap.get(a.teacherId).role !== 'teacher') {
      orphans.attendanceTeacher.push({ attId: a.id, teacherId: a.teacherId, note: 'User is not a teacher' });
    }
  }

  // Audit Study Materials
  for (const m of materials) {
    if (!userMap.has(m.teacherId)) {
      orphans.materialsTeacher.push({ materialId: m.id, teacherId: m.teacherId });
    } else if (userMap.get(m.teacherId).role !== 'teacher') {
      orphans.materialsTeacher.push({ materialId: m.id, teacherId: m.teacherId, note: 'User is not a teacher' });
    }
  }

  // Audit Placement Applications
  for (const pa of placementApps) {
    if (!userMap.has(pa.studentId)) {
      orphans.placementAppsStudent.push({ appId: pa.id, studentId: pa.studentId });
    } else if (userMap.get(pa.studentId).role !== 'student') {
      orphans.placementAppsStudent.push({ appId: pa.id, studentId: pa.studentId, note: 'User is not a student' });
    }
    if (!driveMap.has(pa.driveId)) {
      orphans.placementAppsDrive.push({ appId: pa.id, driveId: pa.driveId });
    }
  }

  // Audit Library Issues
  for (const li of libraryIssues) {
    if (!userMap.has(li.studentId)) {
      orphans.libraryIssuesStudent.push({ issueId: li.id, studentId: li.studentId });
    } else if (userMap.get(li.studentId).role !== 'student') {
      orphans.libraryIssuesStudent.push({ issueId: li.id, studentId: li.studentId, note: 'User is not a student' });
    }
    if (!bookMap.has(li.bookId)) {
      orphans.libraryIssuesBook.push({ issueId: li.id, bookId: li.bookId });
    }
  }

  // Audit Leaves
  for (const lv of leaves) {
    if (!userMap.has(lv.teacherId)) {
      orphans.leavesTeacher.push({ leaveId: lv.id, teacherId: lv.teacherId });
    } else if (userMap.get(lv.teacherId).role !== 'teacher') {
      orphans.leavesTeacher.push({ leaveId: lv.id, teacherId: lv.teacherId, note: 'User is not a teacher' });
    }
  }

  // Audit Courses
  for (const c of courses) {
    if (c.departmentId && !deptMap.has(c.departmentId)) {
      orphans.coursesDept.push({ courseId: c.id, departmentId: c.departmentId });
    }
  }

  console.log('\n=== AUDIT RESULTS ===');
  console.log('Total Users:', users.length);
  console.log('Total Admissions:', admissions.length);
  console.log('Total Marks:', marks.length);
  console.log('Total Attendances:', attendances.length);
  console.log('Total Placement Applications:', placementApps.length);
  console.log('Total Library Issues:', libraryIssues.length);
  console.log('Total Leave Requests:', leaves.length);
  console.log('Total Courses:', courses.length);
  console.log('Total Departments:', departments.length);

  console.log('\n--- DUPLICATES CHECK ---');
  console.log('Duplicate Emails (User Table):', duplicates.emails.length);
  duplicates.emails.forEach(d => console.log(`  - Duplicate Email: ${d.email} (User IDs: ${d.firstUser}, ${d.secondUser})`));
  console.log('Duplicate Student IDs:', duplicates.studentIds.length);
  duplicates.studentIds.forEach(d => console.log(`  - Duplicate Student ID: ${d.studentId} (User IDs: ${d.users.join(', ')})`));
  console.log('Duplicate Roll Numbers:', duplicates.rollNumbers.length);
  duplicates.rollNumbers.forEach(d => console.log(`  - Duplicate Roll Number: ${d.rollNumber} (User IDs: ${d.users.join(', ')})`));

  console.log('\n--- ORPHAN RECORDS / BROKEN RELATIONSHIPS CHECK ---');
  console.log('Orphan Marks (Student):', orphans.marksStudent.length);
  console.log('Orphan Marks (Teacher):', orphans.marksTeacher.length);
  console.log('Orphan Attendance (Student):', orphans.attendanceStudent.length);
  console.log('Orphan Attendance (Teacher):', orphans.attendanceTeacher.length);
  console.log('Orphan Study Materials (Teacher):', orphans.materialsTeacher.length);
  console.log('Orphan Placement Apps (Student):', orphans.placementAppsStudent.length);
  console.log('Orphan Placement Apps (Drive):', orphans.placementAppsDrive.length);
  console.log('Orphan Library Issues (Student):', orphans.libraryIssuesStudent.length);
  console.log('Orphan Library Issues (Book):', orphans.libraryIssuesBook.length);
  console.log('Orphan Leaves (Teacher):', orphans.leavesTeacher.length);
  console.log('Orphan Courses (Department):', orphans.coursesDept.length);

  console.log('\n--- DATABASE INTEGRITY STATUS ---');
  const hasIssues = 
    duplicates.emails.length > 0 ||
    duplicates.studentIds.length > 0 ||
    duplicates.rollNumbers.length > 0 ||
    Object.values(orphans).some(arr => arr.length > 0);

  if (hasIssues) {
    console.log('INTEGRITY STATUS: FAIL (Database contains duplicate credentials or orphan references)');
  } else {
    console.log('INTEGRITY STATUS: PASS (Database holds consistent and unique records)');
  }
  
  console.log('--- AUDIT FINISHED ---');
}

runAudit()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
