import crypto from 'crypto';
import { prisma } from '../db/client.js';
import { initRedis } from './redis.js';

const blacklist = new Map(); // L1 cache: token_hash → expiresAt (ms timestamp)

// Hash tokens before storing to avoid keeping raw JWTs in memory/Redis
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Prune expired entries every 10 minutes
setInterval(async () => {
  const now = Date.now();
  for (const [hash, expiresAt] of blacklist) {
    if (expiresAt <= now) blacklist.delete(hash);
  }
  try {
    await prisma.tokenBlacklist.deleteMany({
      where: { expiresAt: { lte: new Date(now) } }
    });
  } catch { /* DB connection transient errors */ }
}, 10 * 60 * 1000).unref();

/**
 * Add a token to the blacklist.
 * Stores in: L1 in-memory Map → Redis (if available) → Database (fallback)
 * @param {string} token - The JWT string
 * @param {number} expiresAt - Unix timestamp (ms) when the token naturally expires
 */
export async function blacklistToken(token, expiresAt) {
  if (!token) return;
  const expMs = expiresAt || Date.now() + 7 * 24 * 60 * 60 * 1000;
  const hash = hashToken(token);

  // L1: in-memory cache
  blacklist.set(hash, expMs);

  // L2: Redis with TTL (preferred)
  try {
    const redis = await initRedis();
    if (redis) {
      const ttlSec = Math.max(1, Math.ceil((expMs - Date.now()) / 1000));
      await redis.set(`bl:${hash}`, '1', 'EX', ttlSec);
      return; // Redis succeeded — skip DB write for performance
    }
  } catch (err) {
    console.warn('[TOKEN-BLACKLIST] Redis write failed, falling back to DB:', err.message);
  }

  // L3: Database fallback (when Redis is not available)
  try {
    await prisma.tokenBlacklist.upsert({
      where: { token },
      update: { expiresAt: new Date(expMs) },
      create: { token, expiresAt: new Date(expMs) }
    });
  } catch (err) {
    console.warn('[TOKEN-BLACKLIST] DB write failed:', err.message);
  }
}

/**
 * Check if a token is blacklisted.
 * Check order: L1 in-memory → Redis → Database
 * @param {string} token
 * @returns {Promise<boolean>}
 */
export async function isBlacklisted(token) {
  if (!token) return false;
  const hash = hashToken(token);

  // L1: in-memory cache (fastest)
  if (blacklist.has(hash)) {
    if (blacklist.get(hash) > Date.now()) return true;
    blacklist.delete(hash); // expired
  }

  // L2: Redis check
  try {
    const redis = await initRedis();
    if (redis) {
      const exists = await redis.exists(`bl:${hash}`);
      if (exists) {
        // Promote to L1 cache
        blacklist.set(hash, Date.now() + 3600000); // 1h L1 TTL
        return true;
      }
      return false; // Redis is authoritative when available
    }
  } catch (err) {
    console.warn('[TOKEN-BLACKLIST] Redis read failed, checking DB:', err.message);
  }

  // L3: Database fallback
  try {
    const record = await prisma.tokenBlacklist.findUnique({
      where: { token }
    });
    if (record) {
      if (record.expiresAt > new Date()) {
        blacklist.set(hash, record.expiresAt.getTime());
        return true;
      }
    }
  } catch (err) {
    console.warn('[TOKEN-BLACKLIST] DB read failed:', err.message);
  }
  return false;
}
