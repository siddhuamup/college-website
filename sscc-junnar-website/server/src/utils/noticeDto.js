import { noticeAttachmentUrl } from './notices.js';

export function noticeDto(n) {
  const pdfUrl = noticeAttachmentUrl(n);
  return {
    ...n,
    pdfUrl,
    attachmentUrl: pdfUrl,
  };
}
