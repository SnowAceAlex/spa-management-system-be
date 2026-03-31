import { prisma } from '../config/db.js';

export async function me(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, role: true, isActive: true, createdAt: true, updatedAt: true },
    });
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

