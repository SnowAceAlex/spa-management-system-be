import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { HttpError } from '../utils/httpError.js';

export async function getSpecializations(req, res, next) {
  try {
    const { staffId } = req.params;

    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) {
      throw new HttpError(404, 'Staff not found', 'STAFF_NOT_FOUND');
    }

    const specializations = await prisma.staffSpecialization.findMany({
      where: { staffId },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            price: true,
            isActive: true,
          },
        },
      },
    });

    // Ép kiểu price của service sang string theo convention Dev 1
    const formatted = specializations.map((spec) => ({
      id: spec.id,
      staffId: spec.staffId,
      serviceId: spec.service.id,
      service: {
        ...spec.service,
        price: spec.service.price.toString(),
      },
    }));

    res.json({ specializations: formatted });
  } catch (err) {
    next(err);
  }
}

export async function addSpecialization(req, res, next) {
  try {
    const { staffId } = req.params;
    const { serviceId } = req.body;

    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) {
      throw new HttpError(404, 'Staff not found', 'STAFF_NOT_FOUND');
    }

    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) {
      throw new HttpError(404, 'Service not found', 'SERVICE_NOT_FOUND');
    }

    const specialization = await prisma.staffSpecialization.create({
      data: {
        staffId,
        serviceId,
      },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            price: true,
            isActive: true,
          },
        },
      },
    });

    const formatted = {
      ...specialization,
      service: {
        ...specialization.service,
        price: specialization.service.price.toString(),
      },
    };

    res.status(201).json({ specialization: formatted });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return next(
        new HttpError(409, 'Staff already has this specialization', 'STAFF_SPECIALIZATION_DUPLICATE')
      );
    }
    next(err);
  }
}

export async function removeSpecialization(req, res, next) {
  try {
    const { staffId, serviceId } = req.params;

    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) {
      throw new HttpError(404, 'Staff not found', 'STAFF_NOT_FOUND');
    }

    await prisma.staffSpecialization.delete({
      where: {
        staffId_serviceId: {
          staffId,
          serviceId,
        },
      },
    });

    res.status(204).send();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return next(
        new HttpError(404, 'Specialization not found', 'STAFF_SPECIALIZATION_NOT_FOUND')
      );
    }
    next(err);
  }
}