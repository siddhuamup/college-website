import multer from 'multer';
import { Prisma } from '@prisma/client';

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Duplicate value — this record already exists' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Record not found' });
    }
    return res.status(400).json({ error: err.message || 'Database error' });
  }

  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE: 'File exceeds the allowed size limit',
      LIMIT_FILE_COUNT: 'Too many files uploaded',
      LIMIT_UNEXPECTED_FILE: 'Unexpected file field name',
    };
    return res.status(400).json({ error: messages[err.code] || err.message });
  }

  if (err?.name === 'ValidationError') {
    const first = Object.values(err.errors || {})[0];
    return res.status(400).json({ error: first?.message || 'Validation failed' });
  }

  if (err?.name === 'CastError' && err.path === '_id') {
    return res.status(400).json({ error: 'Invalid id' });
  }

  if (typeof err.message === 'string' && /^Only /i.test(err.message)) {
    return res.status(400).json({ error: err.message });
  }

  const status = Number(err.status) || 500;
  if (status >= 500) {
    console.error(err);
  }
  res.status(status).json({ error: err.message || 'Server error' });
}
