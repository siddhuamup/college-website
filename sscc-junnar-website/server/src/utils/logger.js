/**
 * Production-ready Logger Utility for SSCC Junnar ERP API
 * Structured ISO logging with Correlation ID support and request logging middleware.
 */

const IS_PROD = process.env.NODE_ENV === 'production';
const IS_TEST = process.env.NODE_ENV === 'test';

function formatMessage(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const cid = meta.correlationId ? ` [CID:${meta.correlationId}]` : '';
  const { correlationId: _cid, ...cleanMeta } = meta;
  const metaStr = Object.keys(cleanMeta).length > 0 ? ` ${JSON.stringify(cleanMeta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}]${cid} ${message}${metaStr}`;
}

export const logger = {
  info(message, meta) {
    if (IS_TEST) return;
    console.log(formatMessage('info', message, meta));
  },
  warn(message, meta) {
    if (IS_TEST) return;
    console.warn(formatMessage('warn', message, meta));
  },
  error(message, meta) {
    if (IS_TEST) return;
    console.error(formatMessage('error', message, meta));
  },
  debug(message, meta) {
    if (IS_PROD || IS_TEST) return;
    console.debug(formatMessage('debug', message, meta));
  }
};

/**
 * Express Request Logger Middleware
 * Logs incoming HTTP requests and their completion status/duration with correlation IDs.
 */
export function requestLogger(req, res, next) {
  if (IS_TEST) return next();
  const start = Date.now();
  const cid = req.correlationId || req.headers['x-request-id'] || 'N/A';

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const meta = {
      correlationId: cid,
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs,
      ip: req.ip || req.socket?.remoteAddress || 'unknown'
    };

    if (res.statusCode >= 500) {
      logger.error(`HTTP ${req.method} ${req.originalUrl} ${res.statusCode} - ${durationMs}ms`, meta);
    } else if (res.statusCode >= 400) {
      logger.warn(`HTTP ${req.method} ${req.originalUrl} ${res.statusCode} - ${durationMs}ms`, meta);
    } else {
      logger.info(`HTTP ${req.method} ${req.originalUrl} ${res.statusCode} - ${durationMs}ms`, meta);
    }
  });

  next();
}
