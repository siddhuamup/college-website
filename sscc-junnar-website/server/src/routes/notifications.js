/**
 * ANTIGRAVITY REAL-TIME NOTIFICATIONS ROUTER (Server-Sent Events)
 * Provides real-time notification streams without WebSocket overhead.
 */
import { Router } from 'express';
import { createAuthMiddleware } from '../middleware/auth.js';

const clients = new Map();

export function notificationsRouter({ jwtSecret }) {
  const r = Router();
  const auth = createAuthMiddleware(jwtSecret);

  r.get('/stream', auth, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering

    const clientId = req.user.id;
    clients.set(clientId, res);

    // Send connection established handshake message
    res.write(`data: ${JSON.stringify({ type: 'connected', message: 'SSE Stream Active' })}\n\n`);

    req.on('close', () => {
      clients.delete(clientId);
    });
  });

  return r;
}

export function broadcastNotification(userId, data) {
  const client = clients.get(userId);
  if (client) {
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

export function broadcastNotificationToAll(data) {
  for (const client of clients.values()) {
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}
