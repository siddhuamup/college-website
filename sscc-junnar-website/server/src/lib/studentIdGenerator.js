/**
 * Atomic Student-ID and Roll-Number generator.
 *
 * Uses the existing Counter Prisma model (name: @unique) with atomic upsert
 * to prevent race-condition duplicates — same pattern as admissionNumber.js.
 *
 * This replaces the previous JS-loop-based counting which was proven to
 * produce duplicate IDs under concurrent approvals.
 */
import { prisma } from '../db/client.js';

/**
 * Generate next unique Student ID.
 * Format: SSC{YY}{COURSE}{SEQ} e.g. SSC26BCA001
 * @param {string} courseAbbr - Course abbreviation (BCA, BCOM, BA, etc.)
 * @returns {Promise<string>} Unique student ID
 */
export async function nextStudentId(courseAbbr) {
  const yearSuffix = new Date().getFullYear().toString().slice(-2);
  const sanitized = courseAbbr.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'GEN';
  const counterName = `studentId_${yearSuffix}_${sanitized}`;

  const row = await prisma.counter.upsert({
    where: { name: counterName },
    create: { name: counterName, value: 1 },
    update: { value: { increment: 1 } },
  });

  return `SSC${yearSuffix}${sanitized}${String(row.value).padStart(3, '0')}`;
}

/**
 * Generate next unique Roll Number.
 * Format: FY{COURSE}-{YEAR}-{SEQ} e.g. FYBCA-2026-001
 * @param {string} courseAbbr - Course abbreviation
 * @returns {Promise<string>} Unique roll number
 */
export async function nextRollNumber(courseAbbr) {
  const year = new Date().getFullYear();
  const sanitized = courseAbbr.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'GEN';
  const counterName = `roll_FY${sanitized}_${year}`;

  const row = await prisma.counter.upsert({
    where: { name: counterName },
    create: { name: counterName, value: 1 },
    update: { value: { increment: 1 } },
  });

  return `FY${sanitized}-${year}-${String(row.value).padStart(3, '0')}`;
}
