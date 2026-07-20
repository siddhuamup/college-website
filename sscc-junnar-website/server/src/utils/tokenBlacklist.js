/**
 * Token Blacklist — In-memory store for invalidated JWT tokens.
 *
 * When a user logs out, their token is added here so it cannot be reused
 * even if it hasn't expired yet. Tokens are automatically pruned after expiry.
 *
 * For production at scale, replace with Redis or a database table.
 */

const blacklist = new Map(); // token → expiresAt (ms timestamp)

// Prune expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, expiresAt] of blacklist) {
    if (expiresAt <= now) blacklist.delete(token);
  }
}, 10 * 60 * 1000).unref();

/**
 * Add a token to the blacklist.
 * @param {string} token - The JWT string
 * @param {number} expiresAt - Unix timestamp (ms) when the token naturally expires
 */
export function blacklistToken(token, expiresAt) {
  if (!token) return;
  blacklist.set(token, expiresAt || Date.now() + 7 * 24 * 60 * 60 * 1000);
}

/**
 * Check if a token is blacklisted.
 * @param {string} token
 * @returns {boolean}
 */
export function isBlacklisted(token) {
  if (!token) return false;
  return blacklist.has(token);
}
