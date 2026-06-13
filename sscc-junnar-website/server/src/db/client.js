import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/** Prisma uses `id`; expose `_id` for older frontend code. */
export function withMongoId(obj) {
  if (obj == null) return obj;
  if (Array.isArray(obj)) return obj.map(withMongoId);
  if (typeof obj !== 'object') return obj;
  const out = { ...obj };
  if (out.id != null && out._id == null) out._id = out.id;
  return out;
}
