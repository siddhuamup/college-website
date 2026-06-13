import { prisma } from '../db/client.js';

export async function nextApplicationNumber() {
  const year = new Date().getFullYear();
  const name = `admission_${year}`;
  const row = await prisma.counter.upsert({
    where: { name },
    create: { name, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `SSC${year}${String(row.value).padStart(5, '0')}`;
}
