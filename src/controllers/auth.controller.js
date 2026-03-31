import bcrypt from 'bcryptjs';

import { prisma } from '../config/db.js';
import { HttpError } from '../utils/httpError.js';
import { sha256 } from '../utils/crypto.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/token.util.js';

export async function register(req, res, next) {
  try {
    const { email, password } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new HttpError(409, 'Email already exists', 'AUTH_EMAIL_EXISTS');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, role: 'CUSTOMER' },
      select: { id: true, email: true, role: true, createdAt: true },
    });

    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

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
      data: { revokedAt: new Date() },
    });

    const decoded = verifyRefreshToken(refreshToken);
    const expiresAt = new Date(decoded.exp * 1000);

    await prisma.refreshToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    res.json({
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;

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
      data: { revokedAt: new Date() },
    });

    const newAccessToken = signAccessToken({ sub: userId, role });
    const newRefreshToken = signRefreshToken({ sub: userId, role });
    const newHash = sha256(newRefreshToken);
    const newDecoded = verifyRefreshToken(newRefreshToken);
    const expiresAt = new Date(newDecoded.exp * 1000);

    await prisma.refreshToken.create({
      data: { userId, tokenHash: newHash, expiresAt },
    });

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    const { refreshToken } = req.body;
    const tokenHash = sha256(refreshToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

