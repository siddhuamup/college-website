import { prisma } from './db/client.js';
import { hashPassword } from './utils/auth.js';
import { Role } from '@prisma/client';

const departmentsSeed = [
  { name: 'English', stream: 'Arts', hodName: 'Dr. Ashok S. Kakade', subjects: ['Literature', 'Communication'] },
  { name: 'Commerce (General)', stream: 'Commerce', hodName: 'Dr. Meera P. Kulkarni', subjects: ['Accountancy', 'Taxation'] },
  { name: 'Chemistry', stream: 'Science', hodName: 'Dr. Rajesh R. Joshi', subjects: ['Organic', 'Physical'] },
];

const coursesSeed = [
  { name: 'B.A. (History, Geography, English, Marathi, Hindi, Psychology)', level: 'UG', duration: '3 years', eligibility: '12th pass (Maharashtra Board, CBSE, ISC)', seatsApprox: 924, description: 'Undergraduate Arts programme.' },
  { name: 'B.Sc. (Chemistry, Physics, Botany, Mathematics)', level: 'UG', duration: '3 years', eligibility: '12th Science', seatsApprox: 264, description: 'Undergraduate Science programme.' },
  { name: 'B.Com', level: 'UG', duration: '3 years', eligibility: '12th pass', seatsApprox: 876, description: 'Undergraduate Commerce.' },
  { name: 'BBA & BBA (Computer Applications)', level: 'UG', duration: '3 years', eligibility: '12th pass', seatsApprox: 240, description: 'Business Administration programmes.' },
  { name: 'M.A. (English, Geography, History)', level: 'PG', duration: '2 years', eligibility: "Bachelor's degree", seatsApprox: 480, description: 'Postgraduate Arts.' },
  { name: 'M.Sc. (Various specializations)', level: 'PG', duration: '2 years', eligibility: 'Relevant B.Sc.', seatsApprox: 120, description: 'Postgraduate Science.' },
  { name: 'M.Com (Advanced Accounting & Taxation, Banking & Finance)', level: 'PG', duration: '2 years', eligibility: 'B.Com or equivalent', seatsApprox: 120, description: 'Postgraduate Commerce.' },
  { name: 'Ph.D. — Commerce & Zoology', level: 'PhD', duration: 'As per SPPU norms', eligibility: 'PG + entrance / interview', seatsApprox: 0, description: 'Doctoral research at recognised centres.' },
];

/** Assumes Prisma is connected. Creates admin + catalog only — no demo students/teachers/notices. */
export async function performSeed() {
  const adminEmail = 'principal@ssccjunnar.edu';

  if (!(await prisma.user.findUnique({ where: { email: adminEmail } }))) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await hashPassword('Admin@123'),
        role: Role.admin,
        name: 'Principal (Admin)',
        phone: '02132222094',
      },
    });
    console.log('Created admin:', adminEmail, '/ Admin@123');
  }

  // Correct any existing "image gallery" teacher account database inconsistency
  const badTeacher = await prisma.user.findFirst({
    where: { email: 'amupsiddhu@gmail.com', name: 'image gallery' }
  });
  if (badTeacher) {
    await prisma.user.update({
      where: { id: badTeacher.id },
      data: {
        name: 'Prof. Suresh Patil',
        bio: 'M.C.A., Assistant Professor with 8+ years of expertise in Computer Applications.',
        teacherProfile: {
          employeeId: badTeacher.teacherProfile?.employeeId || 'SSC-T004',
          department: 'Computer Science',
          designation: 'Assistant Professor',
          qualifications: 'M.C.A.',
          assignments: badTeacher.teacherProfile?.assignments || []
        }
      }
    });
    console.log('Corrected bad teacher record named "image gallery"');
  }

  await prisma.department.deleteMany({});
  const deps = [];
  for (const d of departmentsSeed) {
    deps.push(await prisma.department.create({ data: { ...d, subjects: d.subjects } }));
  }

  await prisma.course.deleteMany({});
  for (let i = 0; i < coursesSeed.length; i++) {
    const c = coursesSeed[i];
    await prisma.course.create({
      data: {
        ...c,
        departmentId: deps[i % deps.length].id,
      },
    });
  }

  await prisma.collegeSettings.upsert({
    where: { key: 'mapEmbedUrl' },
    create: {
      key: 'mapEmbedUrl',
      value: 'https://www.google.com/maps?q=Shri+Shiv+Chhatrapati+College+Junnar&output=embed',
    },
    update: {
      value: 'https://www.google.com/maps?q=Shri+Shiv+Chhatrapati+College+Junnar&output=embed',
    },
  });

  await prisma.collegeSettings.upsert({
    where: { key: 'siteTagline' },
    create: { key: 'siteTagline', value: 'Education • Discipline • Character' },
    update: { value: 'Education • Discipline • Character' },
  });

  for (const row of [
    { key: 'syllabusPdfUrl', value: '' },
    { key: 'prospectusPdfUrl', value: '' },
    { key: 'attendanceThreshold', value: 75 }
  ]) {
    const ex = await prisma.collegeSettings.findUnique({ where: { key: row.key } });
    if (!ex) {
      await prisma.collegeSettings.create({ data: row });
    }
  }
}
