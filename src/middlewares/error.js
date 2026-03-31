export function notFound(_req, res) {
  res.status(404).json({ message: 'Not found' });
}

export function errorHandler(err, _req, res, _next) {
  const status = err.statusCode || err.status || 500;
  const message = status >= 500 ? 'Internal server error' : err.message || 'Request failed';

  if (process.env.NODE_ENV !== 'production') {
    console.error(err);
  }

  res.status(status).json({
    message,
    ...(process.env.NODE_ENV !== 'production' && err.code ? { code: err.code } : {}),
  });
}
