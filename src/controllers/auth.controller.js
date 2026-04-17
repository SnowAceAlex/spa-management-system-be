import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';

import { env } from '../config/env.js';
import { prisma } from '../config/db.js';
import { HttpError } from '../utils/httpError.js';
import { sha256 } from '../utils/crypto.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/token.util.js';

function getRefreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.AUTH_COOKIE_SECURE,
    sameSite: env.AUTH_COOKIE_SAME_SITE,
    domain: env.AUTH_COOKIE_DOMAIN || undefined,
    path: '/auth',
  };
}

function getClientMetadata(req) {
  const userAgent = req.get('user-agent') || null;
  const ipAddress = req.ip || req.socket?.remoteAddress || null;
  return { userAgent, ipAddress };
}

function getRefreshTokenFromRequest(req) {
  return req.cookies?.[env.AUTH_COOKIE_NAME] || req.body?.refreshToken;
}

export async function register(req, res, next) {
  try {
    const { email, password, firstName, lastName, phone } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new HttpError(409, 'Email already exists', 'AUTH_EMAIL_EXISTS');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'CUSTOMER',
        customer: {
          create: {
            firstName,
            lastName,
            phone: phone || undefined,
          },
        },
      },
      select: { id: true, email: true, role: true, createdAt: true },
    });

    res.status(201).json({ user });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') {
        const field = err.meta?.target?.[0] || 'field';
        return next(
          new HttpError(409, `${field} already exists`, 'AUTH_DUPLICATE_FIELD'),
        );
      }
    }
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const metadata = getClientMetadata(req);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      throw new HttpError(401, 'Invalid credentials', 'AUTH_INVALID_CREDENTIALS');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new HttpError(401, 'Invalid credentials', 'AUTH_INVALID_CREDENTIALS');

    const accessToken = signAccessToken({ sub: user.id, role: user.role });
    const refreshToken = signRefreshToken({ sub: user.id, role: user.role });
    const tokenHash = sha256(refreshToken);

    await prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'ROTATED_ON_LOGIN' },
    });

    const decoded = verifyRefreshToken(refreshToken);
    const expiresAt = new Date(decoded.exp * 1000);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress,
        lastUsedAt: new Date(),
      },
    });

    res.cookie(env.AUTH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());
    res.json({
      accessToken,
      user: { id: user.id, email: user.email, role: user.role, isActive: user.isActive },
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req, res, next) {
  try {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (!refreshToken) throw new HttpError(401, 'Missing refresh token', 'AUTH_MISSING_REFRESH');

    const decoded = verifyRefreshToken(refreshToken);
    const userId = decoded.sub;
    const role = decoded.role;
    if (!userId || !role) throw new HttpError(401, 'Invalid refresh token', 'AUTH_INVALID_REFRESH');

    const tokenHash = sha256(refreshToken);
    const record = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!record || record.revokedAt) {
      throw new HttpError(401, 'Refresh token revoked', 'AUTH_REFRESH_REVOKED');
    }
    if (record.expiresAt.getTime() <= Date.now()) {
      throw new HttpError(401, 'Refresh token expired', 'AUTH_REFRESH_EXPIRED');
    }

    await prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date(), revokedReason: 'ROTATED_ON_REFRESH' },
    });

    const newAccessToken = signAccessToken({ sub: userId, role });
    const newRefreshToken = signRefreshToken({ sub: userId, role });
    const newHash = sha256(newRefreshToken);
    const newDecoded = verifyRefreshToken(newRefreshToken);
    const expiresAt = new Date(newDecoded.exp * 1000);
    const metadata = getClientMetadata(req);

    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: newHash,
        expiresAt,
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress,
        lastUsedAt: new Date(),
      },
    });

    res.cookie(env.AUTH_COOKIE_NAME, newRefreshToken, getRefreshCookieOptions());
    res.json({ accessToken: newAccessToken });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (!refreshToken) throw new HttpError(400, 'Missing refresh token', 'AUTH_MISSING_REFRESH');
    const tokenHash = sha256(refreshToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'LOGOUT_CURRENT' },
    });
    res.clearCookie(env.AUTH_COOKIE_NAME, getRefreshCookieOptions());
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function logoutAll(req, res, next) {
  try {
    await prisma.refreshToken.updateMany({
      where: { userId: req.user.id, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'LOGOUT_ALL' },
    });
    res.clearCookie(env.AUTH_COOKIE_NAME, getRefreshCookieOptions());
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
