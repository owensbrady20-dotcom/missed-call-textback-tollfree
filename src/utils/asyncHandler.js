/**
 * Express 4 does not catch rejected promises from async route handlers —
 * an uncaught rejection here would otherwise crash the whole process,
 * taking down every tenant's phone line. Wrap every async handler with this.
 */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = asyncHandler;
