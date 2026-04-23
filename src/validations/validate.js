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

// Bổ sung thêm 2 hàm này để dùng cho Loyalty
export function validateQuery(schema) {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      return next(new HttpError(400, 'Invalid query parameters', 'VALIDATION_ERROR', {
        fields: parsed.error.flatten().fieldErrors,
      }));
    }
    req.query = parsed.data;
    next();
  };
}

export function validateParams(schema) {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.params);
    if (!parsed.success) {
      return next(new HttpError(400, 'Invalid path parameters', 'VALIDATION_ERROR', {
        fields: parsed.error.flatten().fieldErrors,
      }));
    }
    req.params = parsed.data;
    next();
  };
}