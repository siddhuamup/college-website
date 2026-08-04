import crypto from 'crypto';

/**
 * Middleware that assigns a unique Correlation ID (UUID v4) to each incoming request.
 * Header: X-Request-Id
 * Attaches ID to req.correlationId and res.setHeader('X-Request-Id', correlationId).
 */
export function correlationId(req, res, next) {
  const incomingId = req.headers['x-request-id'];
  const id = incomingId && typeof incomingId === 'string' && incomingId.length <= 128
    ? incomingId
    : crypto.randomUUID();

  req.correlationId = id;
  res.setHeader('X-Request-Id', id);
  next();
}
