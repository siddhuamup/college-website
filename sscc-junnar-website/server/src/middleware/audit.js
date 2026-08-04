/**
 * Audit Logger Middleware — SSCC Junnar ERP
 *
 * Provides a standardized audit logger helper function to record all sensitive
 * system operations (mark entries/edits, fee payments, user changes, soft deletes, auth events).
 */

export function createAuditLogger(prisma) {
  return async function auditLog(req, action, entityType, entityId, previousState = null, newState = null) {
    try {
      const userId = req.user?.id || req.user?._id || 'SYSTEM';
      const userRole = req.user?.role || '';
      const ipAddress = req.ip || req.socket?.remoteAddress || 'unknown';
      const userAgent = req.headers?.['user-agent'] || '';

      const detailsObj = {};
      if (previousState) detailsObj.previous = previousState;
      if (newState) detailsObj.new = newState;

      await prisma.auditLog.create({
        data: {
          userId: String(userId),
          userRole: String(userRole),
          action: String(action),
          target: `${entityType}:${entityId}`,
          entityType: String(entityType),
          entityId: String(entityId),
          details: JSON.stringify(detailsObj),
          ipAddress: String(ipAddress),
          userAgent: String(userAgent),
        }
      });
    } catch (err) {
      console.warn('[AUDIT-LOG] Failed to record audit entry:', err.message);
    }
  };
}
