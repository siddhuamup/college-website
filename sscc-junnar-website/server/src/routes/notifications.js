import { Router } from 'express';
import { createAuthMiddleware } from '../middleware/auth.js';

const clients = new Map();
const HEARTBEAT_INTERVAL = 30000;

export function notificationsRouter({ jwtSecret }) {
  const r = Router();
  const auth = createAuthMiddleware(jwtSecret);

  r.get('/stream', auth, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const userId = req.user.id;

    if (clients.has(userId)) {
      try { clients.get(userId).end(); } catch (e) {}
      clients.delete(userId);
    }

    clients.set(userId, res);
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    const heartbeat = setInterval(() => {
      try {
        res.write(':\n\n');
      } catch (e) {
        clearInterval(heartbeat);
        clients.delete(userId);
      }
    }, HEARTBEAT_INTERVAL);

    req.on('close', () => {
      clearInterval(heartbeat);
      clients.delete(userId);
    });

    req.on('error', () => {
      clearInterval(heartbeat);
      clients.delete(userId);
    });
  });

  return r;
}

export function broadcastNotification(userId, data) {
  const client = clients.get(userId);
  if (!client) return;
  try {
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch (e) {
    clients.delete(userId);
  }
}

export function broadcastNotificationToAll(data) {
  for (const [userId, client] of clients) {
    try {
      client.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (e) {
      clients.delete(userId);
    }
  }
}
