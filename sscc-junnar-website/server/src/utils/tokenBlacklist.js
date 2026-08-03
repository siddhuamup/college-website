import { prisma } from '../db/client.js';

const blacklist = new Map(); // token → expiresAt (ms timestamp)

// Prune expired entries every 10 minutes
setInterval(async () => {
  const now = Date.now();
  for (const [token, expiresAt] of blacklist) {
    if (expiresAt <= now) blacklist.delete(token);
  }
  try {
    await prisma.tokenBlacklist.deleteMany({
      where: { expiresAt: { lte: new Date(now) } }
    });
  } catch { /* DB connection transient errors */ }
}, 10 * 60 * 1000).unref();

/**
 * Add a token to the blacklist.
 * @param {string} token - The JWT string
 * @param {number} expiresAt - Unix timestamp (ms) when the token naturally expires
 */
export async function blacklistToken(token, expiresAt) {
  if (!token) return;
  const expMs = expiresAt || Date.now() + 7 * 24 * 60 * 60 * 1000;
  blacklist.set(token, expMs);
  try {
    await prisma.tokenBlacklist.upsert({
      where: { token },
      update: { expiresAt: new Date(expMs) },
      create: { token, expiresAt: new Date(expMs) }
    });
  } catch (err) {
    console.warn('Failed to persist token to blacklist DB:', err.message);
  }
}

/**
 * Check if a token is blacklisted.
 * @param {string} token
 * @returns {Promise<boolean>}
 */
export async function isBlacklisted(token) {
  if (!token) return false;
  if (blacklist.has(token)) return true;
  try {
    const record = await prisma.tokenBlacklist.findUnique({
      where: { token }
    });
    if (record) {
      if (record.expiresAt > new Date()) {
        blacklist.set(token, record.expiresAt.getTime());
        return true;
      }
    }
  } catch (err) {
    console.warn('Failed to query token blacklist DB:', err.message);
  }
  return false;
}

