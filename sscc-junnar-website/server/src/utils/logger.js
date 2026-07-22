/**
 * Production-ready Logger Utility for SSCC Junnar ERP API
 * Provides level-based logging with ISO timestamps and environment checks.
 */

const IS_PROD = process.env.NODE_ENV === 'production';
const IS_TEST = process.env.NODE_ENV === 'test';

function formatMessage(level, message, meta) {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
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
