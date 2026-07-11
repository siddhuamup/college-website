/**
 * Centralized Academic Year helper based on the June-May cycle.
 * Standard Indian academic year begins on June 1st.
 * @param {Date} [date]
 * @returns {number} Start year of the academic cycle (e.g. 2026 for 2026-27 cycle)
 */
export function getAcademicYear(date = new Date()) {
  const month = date.getMonth(); // 0-indexed: 0 = Jan, 5 = June
  const year = date.getFullYear();
  return month >= 5 ? year : year - 1;
}
