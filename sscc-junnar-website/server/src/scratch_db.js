import { prisma } from './db/client.js';

async function main() {
  const u = await prisma.user.findUnique({ where: { id: 'cmqidzxtf000ktw30ub49b1j6' } });
  if (u) {
    const sp = u.studentProfile || {};
    sp.studentId = 'SSC26BCA999';
    sp.collegeEmail = 'ssc26bca999@ssccjunnar.edu';
    sp.rollNumber = 'SSC26BCA999';
    
    await prisma.user.update({
      where: { id: u.id },
      data: {
        email: 'ssc26bca999@ssccjunnar.edu',
        studentProfile: sp
      }
    });
    console.log('User duplicate resolved successfully to 999!');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
