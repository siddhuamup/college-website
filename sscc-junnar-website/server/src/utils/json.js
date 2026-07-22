/**
 * Safe JSON Parse Utility
 * Safely parses a JSON string with fallback default value on syntax errors.
 * 
 * @param {string} input - JSON string to parse
 * @param {any} [fallback=null] - Fallback value if parsing fails
 * @returns {any} Parsed object or fallback
 */
export function safeJsonParse(input, fallback = null) {
  if (typeof input !== 'string' || !input.trim()) {
    return fallback;
  }
  try {
    return JSON.parse(input);
  } catch (err) {
    return fallback;
  }
}
