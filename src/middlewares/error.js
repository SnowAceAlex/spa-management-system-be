export function notFound(_req, res) {
  res.status(404).json({ message: 'Not found' });
}

export function errorHandler(err, _req, res, _next) {
  const status = err.statusCode || err.status || 500;
  const message = status >= 500 ? 'Internal server error' : err.message || 'Request failed';

  // Always log errors to help debugging
  console.error('[ERROR]', {
    status,
    message: err.message,
    code: err.code,
    stack: err.stack,
  });

  res.status(status).json({
    message,
    ...(process.env.NODE_ENV !== 'production' && err.code ? { code: err.code } : {}),
    ...(err.details ? { details: err.details } : {}),
  });
}
