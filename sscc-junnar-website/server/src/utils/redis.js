/**
 * Redis Client Factory — SSCC Junnar ERP
 *
 * Lazy connection: only connects when REDIS_URL is set in .env.
 * Exports getRedis() returning an ioredis instance or null.
 * Graceful reconnection with exponential backoff.
 */

let redisClient = null;
let connectionAttempted = false;
let _initPromise = null;

/**
 * Initialize Redis connection asynchronously.
 * Safe to call multiple times — only connects once.
 * @returns {Promise<import('ioredis').Redis | null>}
 */
export async function initRedis() {
  if (redisClient) return redisClient;
  if (connectionAttempted && !redisClient) return null;
  if (_initPromise) return _initPromise;

  const url = process.env.REDIS_URL;
  if (!url) {
    connectionAttempted = true;
    return null;
  }

  _initPromise = (async () => {
    try {
      const { default: Redis } = await import('ioredis');

      redisClient = new Redis(url, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          if (times > 5) return null;
          return Math.min(times * 200, 5000);
        },
        lazyConnect: false,
        enableOfflineQueue: true,
      });

      redisClient.on('error', (err) => {
        console.warn('[REDIS] Connection error:', err.message);
      });

      redisClient.on('connect', () => {
        console.log('[REDIS] Connected successfully');
      });

      connectionAttempted = true;
      return redisClient;
    } catch {
      connectionAttempted = true;
      console.warn('[REDIS] ioredis not installed. Using in-memory fallback.');
      return null;
    }
  })();

  return _initPromise;
}

/**
 * Get the synchronous Redis client reference (must call initRedis first or let it connect).
 * @returns {import('ioredis').Redis | null}
 */
export function getRedis() {
  return redisClient;
}

/**
 * Disconnect Redis gracefully.
 */
export const disconnectRedis = async () => {
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log('[REDIS] Disconnected gracefully');
    } catch {
      redisClient.disconnect();
    }
    redisClient = null;
  }
}
