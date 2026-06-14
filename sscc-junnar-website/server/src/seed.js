import 'dotenv/config';
import { prisma } from './db/client.js';
import { performSeed } from './seedLogic.js';
import { performDemoSeed } from './demoSeed.js';

function printDbHelp(err) {
  console.error('\n========== Database setup ==========\n');
  console.error('Error:', err.message, '\n');
  console.error('1) Ensure server/.env exists with DATABASE_URL, e.g.:');
  console.error('   DATABASE_URL="file:./dev.db"\n');
  console.error('2) Create tables:');
  console.error('   npx prisma db push\n');
  console.error('3) Then run: npm run seed\n');
  console.error('=====================================\n');
}

async function main() {
  try {
    await prisma.$connect();
  } catch (e) {
    printDbHelp(e);
    process.exit(1);
  }

  console.log('Connected. Seeding...');
  try {
    await performSeed();
    console.log('Base seed complete.');
    await performDemoSeed();
    console.log('All seeding complete.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
