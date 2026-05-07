import { prisma } from '../config/db.js';

function adminSeesUnavailable(req) {
  return req.user?.role === 'ADMIN' && req.query.includeUnavailable === 'true';
}

function formatStaff(staff, { isAdmin }) {
  const { user, specializations, ...rest } = staff;
  return {
    ...rest,
    ...(isAdmin && user ? { email: user.email } : {}),
    services: specializations.map((spec) => ({
      id: spec.service.id,
      name: spec.service.name,
    })),
  };
}

export async function listStaff(req, res, next) {
  try {
    const includeUnavailable = adminSeesUnavailable(req);
    const isAdmin = req.user?.role === 'ADMIN';

    const where = includeUnavailable ? {} : { isAvailable: true };

    const staff = await prisma.staff.findMany({
      where,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        bio: true,
        isAvailable: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { email: true } },
        specializations: {
          select: {
            service: { select: { id: true, name: true } },
          },
        },
      },
    });

    res.json({ staff: staff.map((s) => formatStaff(s, { isAdmin })) });
  } catch (err) {
    next(err);
  }
}
