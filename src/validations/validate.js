import { HttpError } from '../utils/httpError.js';

function normalizeJsonBody(body) {
  if (body != null && typeof body === 'object' && !Array.isArray(body)) {
    return body;
  }
  return {};
}

export function validateBody(schema) {
  return (req, _res, next) => {
    const parsed = schema.safeParse(normalizeJsonBody(req.body));
    if (!parsed.success) {
      return next(
        new HttpError(400, 'Invalid request body', 'VALIDATION_ERROR', {
          fields: parsed.error.flatten().fieldErrors,
        }),
      );
    }
    req.body = parsed.data;
    next();
  };
}
