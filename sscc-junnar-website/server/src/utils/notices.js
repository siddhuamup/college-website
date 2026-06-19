/**
 * ERP notice filtering — audience targeting, publish/expiry windows.
 * Audience values:
 *   PUBLIC | ALL_PORTAL | STUDENTS | TEACHERS | STAFF | STUDENTS_TEACHERS
 *   COURSE:{name} | YEAR:{n} | CLASS:{name} | STUDENT:{userId}
 * Legacy "ALL" maps to ALL_PORTAL.
 */

export function normalizeAudience(audience) {
  const a = String(audience || 'ALL').trim().toUpperCase();
  if (a === 'ALL' || a === 'ALL PORTAL USERS') return 'ALL_PORTAL';
  if (a === 'PUBLIC WEBSITE VISITORS' || a === 'PUBLIC_WEBSITE') return 'PUBLIC';
  return a;
}

export function isNoticeActive(notice, now = new Date()) {
  if (!notice?.isPublished) return false;
  if (notice.publishDate) {
    const pub = new Date(notice.publishDate);
    if (!Number.isNaN(pub.getTime()) && pub > now) return false;
  }
  if (notice.expiryDate) {
    const exp = new Date(notice.expiryDate);
    if (!Number.isNaN(exp.getTime()) && exp < now) return false;
  }
  return true;
}

export function noticeMatchesContext(notice, ctx = {}) {
  const aud = normalizeAudience(notice.audience);
  const { role, course, year, className, userId, surface } = ctx;

  if (surface === 'public') {
    return aud === 'PUBLIC' || aud === 'ALL_PORTAL';
  }

  if (aud === 'PUBLIC') return true;

  switch (aud) {
    case 'ALL_PORTAL':
      return Boolean(role);
    case 'STUDENTS':
      return role === 'student';
    case 'TEACHERS':
      return role === 'teacher';
    case 'STAFF':
      return role === 'admin';
    case 'STUDENTS_TEACHERS':
      return role === 'student' || role === 'teacher';
    default:
      if (aud.startsWith('COURSE:')) {
        const target = aud.slice(7).trim().toLowerCase();
        return course && String(course).toLowerCase().includes(target);
      }
      if (aud.startsWith('YEAR:')) {
        return year != null && String(year) === aud.slice(5).trim();
      }
      if (aud.startsWith('CLASS:')) {
        const target = aud.slice(6).trim().toLowerCase();
        return className && String(className).toLowerCase() === target;
      }
      if (aud.startsWith('STUDENT:')) {
        return userId && userId === aud.slice(8).trim();
      }
      return true;
  }
}

export function filterNotices(notices, ctx) {
  const now = new Date();
  return notices.filter((n) => isNoticeActive(n, now) && noticeMatchesContext(n, ctx));
}

export function noticeAttachmentUrl(notice) {
  const att = notice.attachment || notice.pdfFile;
  if (!att || typeof att !== 'object' || att === null || !('storedName' in att)) return null;
  const folder = notice.attachment ? 'notices' : 'notices';
  return `/uploads/${folder}/${att.storedName}`;
}

export const NOTICE_PRIORITIES = ['URGENT', 'IMPORTANT', 'NORMAL', 'INFORMATION'];
export const NOTICE_AUDIENCES = [
  { value: 'PUBLIC', label: 'Public Website Visitors' },
  { value: 'ALL_PORTAL', label: 'All Portal Users' },
  { value: 'STUDENTS', label: 'Students Only' },
  { value: 'TEACHERS', label: 'Teachers Only' },
  { value: 'STAFF', label: 'Staff Only' },
  { value: 'STUDENTS_TEACHERS', label: 'Students + Teachers' },
];
