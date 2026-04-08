function resolvePagination(query = {}, options = {}) {
  const defaultLimit = options.defaultLimit ?? 25;
  const maxLimit = options.maxLimit ?? 100;
  const page = Math.max(1, Number(query.page) || 1);
  const requestedLimit = Number(query.limit) || defaultLimit;
  const limit = Math.max(1, Math.min(requestedLimit, maxLimit));

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
  };
}

function applyPaginationHeaders(res, { page, limit, total }) {
  res.setHeader("X-Page", String(page));
  res.setHeader("X-Page-Size", String(limit));
  res.setHeader("X-Total-Count", String(total));
}

module.exports = {
  applyPaginationHeaders,
  resolvePagination,
};
