import { prisma } from '../config/db.js';
import bcrypt from 'bcryptjs';
import { HttpError } from '../utils/httpError.js';

export async function me(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        customer: true,
        staff: true,
      },
    });
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export async function updateMyProfile(req, res, next) {
  try {
    if (req.user.role === 'CUSTOMER') {
      const profile = await prisma.customer.update({
        where: { userId: req.user.id },
        data: {
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          phone: req.body.phone,
          dateOfBirth: req.body.dateOfBirth,
          notes: req.body.notes,
        },
      });
      return res.json({ profile });
    }

    if (req.user.role === 'STAFF') {
      const profile = await prisma.staff.update({
        where: { userId: req.user.id },
        data: {
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          phone: req.body.phone,
          bio: req.body.bio,
          isAvailable: req.body.isAvailable,
        },
      });
      return res.json({ profile });
    }

    throw new HttpError(
      403,
      'Profile update is not allowed for this role',
      'USER_PROFILE_ROLE_INVALID',
    );
  } catch (err) {
    next(err);
  }
}

export async function listUsers(req, res, next) {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        staff: {
          select: { id: true, firstName: true, lastName: true, phone: true, isAvailable: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ users });
  } catch (err) {
    next(err);
  }
}

export async function adminUpdateUser(req, res, next) {
  try {
    const { userId } = req.params;
    if (req.user.id === userId && req.body.isActive === false) {
      throw new HttpError(
        400,
        'You cannot deactivate your own account',
        'USER_SELF_DEACTIVATE_FORBIDDEN',
      );
    }

    const existing = await prisma.user.findUnique({
      where: { id: userId },
      include: { customer: true, staff: true },
    });
    if (!existing) throw new HttpError(404, 'User not found', 'USER_NOT_FOUND');

    if (req.body.role === 'STAFF' && !existing.staff) {
      throw new HttpError(
        400,
        'Cannot change role to STAFF without staff profile',
        'USER_ROLE_STAFF_PROFILE_REQUIRED',
      );
    }
    if (req.body.role === 'CUSTOMER' && !existing.customer) {
      throw new HttpError(
        400,
        'Cannot change role to CUSTOMER without customer profile',
        'USER_ROLE_CUSTOMER_PROFILE_REQUIRED',
      );
    }

    if (req.body.isActive === false) {
      await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'USER_DEACTIVATED' },
      });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        role: req.body.role,
        isActive: req.body.isActive,
      },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export async function adminCreateUser(req, res, next) {
  try {
    const { email, password, role, firstName, lastName, phone, bio, isAvailable } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new HttpError(409, 'Email already exists', 'USER_EMAIL_EXISTS');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role,
        ...(role === 'STAFF'
          ? {
              staff: {
                create: {
                  firstName: firstName || 'Staff',
                  lastName: lastName || 'User',
                  phone,
                  bio,
                  isAvailable: typeof isAvailable === 'boolean' ? isAvailable : true,
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
}

export async function getUserById(req, res, next) {
  try {
    const { userId } = req.params;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        staff: {
          select: { id: true, firstName: true, lastName: true, phone: true, isAvailable: true },
        },
      },
    });

    if (!user) throw new HttpError(404, 'User not found', 'USER_NOT_FOUND');
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export async function adminDeleteUser(req, res, next) {
  try {
    const { userId } = req.params;
    if (req.user.id === userId) {
      throw new HttpError(400, 'You cannot delete your own account', 'USER_SELF_DELETE_FORBIDDEN');
    }

    await prisma.user.delete({ where: { id: userId } });
    res.status(204).send();
  } catch (err) {
    if (err?.code === 'P2025') {
      return next(new HttpError(404, 'User not found', 'USER_NOT_FOUND'));
    }
    next(err);
  }
}
