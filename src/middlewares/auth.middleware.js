import { z } from 'zod';
import { HttpError } from '../utils/httpError.js';
import { verifyAccessToken } from '../utils/token.util.js';

const JwtPayloadSchema = z.object({
  sub: z.string().min(1),
  role: z.enum(['ADMIN', 'STAFF', 'CUSTOMER']),
});

export function auth(req, _res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new HttpError(401, 'Missing bearer token', 'AUTH_MISSING_TOKEN');
    }

    const token = header.slice('Bearer '.length);
    const decoded = verifyAccessToken(token);
    const parsed = JwtPayloadSchema.safeParse(decoded);
    if (!parsed.success) {
      throw new HttpError(401, 'Invalid token', 'AUTH_INVALID_TOKEN');
    }

    req.user = { id: parsed.data.sub, role: parsed.data.role };
    next();
  } catch {
    next(new HttpError(401, 'Unauthorized', 'AUTH_UNAUTHORIZED'));
  }
}

export function requireRole(roles) {
  const set = new Set(roles);
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'Unauthorized', 'AUTH_UNAUTHORIZED'));
    if (!set.has(req.user.role)) return next(new HttpError(403, 'Forbidden', 'AUTH_FORBIDDEN'));
    next();
  };
}

