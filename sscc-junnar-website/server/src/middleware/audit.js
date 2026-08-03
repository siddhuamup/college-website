/**
 * ANTIGRAVITY AUDIT LOGGING MIDDLEWARE
 * Logs administrative actions to the AuditLog SQLite table.
 */

export function createAuditLogger(prisma) {
  return async (req, action, entity, entityId, oldData = null, newData = null) => {
    try {
      const userId = req.user?.id || 'system';
      const userRole = req.user?.role || 'admin';
      const target = entityId ? `${entity}:${entityId}` : entity;
      const detailsObj = {
        entity,
        entityId,
        oldData: oldData ? (typeof oldData === 'object' ? oldData : { data: oldData }) : null,
        newData: newData ? (typeof newData === 'object' ? newData : { data: newData }) : null,
      };

      await prisma.auditLog.create({
        data: {
          userId,
          userRole,
          action,
          target,
          details: JSON.stringify(detailsObj),
          ipAddress: req.ip || req.socket?.remoteAddress || '',
          userAgent: (req.headers['user-agent'] || '').substring(0, 255),
        }
      });
    } catch (err) {
      console.error('[AUDIT-LOG-ERROR]', err.message);
    }
  };
}
