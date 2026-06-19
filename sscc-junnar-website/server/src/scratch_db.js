import { prisma } from './db/client.js';

async function main() {
  const students = await prisma.user.findMany({
    where: { role: 'student' },
    select: { email: true, name: true, studentProfile: true },
    take: 5
  });
  console.log(JSON.stringify(students, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
