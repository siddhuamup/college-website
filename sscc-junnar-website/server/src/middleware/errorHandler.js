import multer from 'multer';
import { Prisma } from '@prisma/client';

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  // ── Prisma errors ───────────────────────────────────────────────────────
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Duplicate value — this record already exists' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Record not found' });
    }
    return res.status(400).json({ error: 'Database request error' });
  }

  // ── Multer (file upload) errors ─────────────────────────────────────────
  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE: 'File exceeds the allowed size limit',
      LIMIT_FILE_COUNT: 'Too many files uploaded',
      LIMIT_UNEXPECTED_FILE: 'Unexpected file field name',
    };
    return res.status(400).json({ error: messages[err.code] || 'File upload error' });
  }

  // ── Validation errors ──────────────────────────────────────────────────
  if (err?.name === 'ValidationError') {
    const first = Object.values(err.errors || {})[0];
    return res.status(400).json({ error: first?.message || 'Validation failed' });
  }

  // ── Upload MIME filter errors ──────────────────────────────────────────
  if (typeof err.message === 'string' && /^Only /i.test(err.message)) {
    return res.status(400).json({ error: err.message });
  }

  // ── Catch-all ──────────────────────────────────────────────────────────
  const status = Number(err.status) || 500;

  // SECURITY: Never leak raw error messages for 5xx errors to the client.
  // Full details are logged server-side for debugging.
  if (status >= 500) {
    console.error('[SERVER ERROR]', err);
    return res.status(status).json({ error: 'Internal server error' });
  }

  // 4xx errors: safe to return the message (it's from our own validation)
  res.status(status).json({ error: err.message || 'Request error' });
}
