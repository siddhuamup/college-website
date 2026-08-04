/**
 * ANTIGRAVITY REAL-TIME NOTIFICATIONS ROUTER (Server-Sent Events)
 * Provides real-time notification streams without WebSocket overhead.
 *
 * Fixes:
 * - 30-second heartbeat ping to prevent proxy/LB idle timeouts
 * - try-catch on all writes to handle crashed/closed connections gracefully
 * - Automatic cleanup of stale connections
 */
import { Router } from 'express';
import { createAuthMiddleware } from '../middleware/auth.js';

// Map<userId, { res, heartbeat, lastActivity }>
const clients = new Map();

// Reap stale connections every 5 minutes (safety net for missed 'close' events)
setInterval(() => {
  const threshold = Date.now() - 5 * 60 * 1000; // 5 min inactivity
  for (const [userId, client] of clients) {
    if (client.lastActivity < threshold) {
      cleanupClient(userId);
    }
  }
}, 5 * 60 * 1000).unref();

function cleanupClient(userId) {
  const client = clients.get(userId);
  if (!client) return;
  if (client.heartbeat) clearInterval(client.heartbeat);
  try { client.res.end(); } catch { /* already closed */ }
  clients.delete(userId);
}

function safeSend(client, data) {
  try {
    client.res.write(`data: ${JSON.stringify(data)}\n\n`);
    client.lastActivity = Date.now();
    return true;
  } catch {
    return false;
  }
}

export function notificationsRouter({ jwtSecret }) {
  const r = Router();
  const auth = createAuthMiddleware(jwtSecret);

  r.get('/stream', auth, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering

    const clientId = req.user.id;

    // Cleanup any existing connection for this user (prevents dupes)
    if (clients.has(clientId)) {
      cleanupClient(clientId);
    }

    // 30-second heartbeat to keep connection alive through proxies/LBs
    const heartbeat = setInterval(() => {
      try {
        res.write(':ping\n\n');
      } catch {
        cleanupClient(clientId);
      }
    }, 30000);

    const client = {
      res,
      heartbeat,
      lastActivity: Date.now(),
    };
    clients.set(clientId, client);

    // Send connection established handshake message
    safeSend(client, { type: 'connected', message: 'SSE Stream Active' });

    req.on('close', () => {
      cleanupClient(clientId);
    });
  });

  return r;
}

export function broadcastNotification(userId, data) {
  const client = clients.get(userId);
  if (client) {
    if (!safeSend(client, data)) {
      cleanupClient(userId);
    }
  }
}

export function broadcastNotificationToAll(data) {
  for (const [userId, client] of clients) {
    if (!safeSend(client, data)) {
      cleanupClient(userId);
    }
  }
}
