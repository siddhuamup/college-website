/**
 * Server-Side Pagination Utility — SSCC Junnar ERP
 *
 * Standardizes query parameters: ?page=1&limit=25
 * Default page: 1, default limit: 25, max limit: 100
 */

export function parsePagination(query = {}, defaultLimit = 25, maxLimit = 100) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const requestedLimit = parseInt(query.limit, 10) || defaultLimit;
  const limit = Math.min(maxLimit, Math.max(1, requestedLimit));
  const skip = (page - 1) * limit;

  return { page, limit, skip, take: limit };
}

export function paginatedResponse(data, total, { page, limit }) {
  const totalPages = Math.ceil(total / limit) || 1;
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}
