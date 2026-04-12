import { Prisma } from '@prisma/client';

import { prisma } from '../config/db.js';
import { HttpError } from '../utils/httpError.js';

function adminSeesInactive(req) {
  return req.user?.role === 'ADMIN' && req.query.includeInactive === 'true';
}

function formatService(service) {
  return {
    ...service,
    price: service.price.toString(),
  };
}

export async function listServices(req, res, next) {
  try {
    const includeInactive = adminSeesInactive(req);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const where = {
      ...(includeInactive ? {} : { isActive: true }),
      ...(req.query.categoryId ? { categoryId: req.query.categoryId } : {}),
      ...(req.query.q
        ? { name: { contains: req.query.q, mode: 'insensitive' } }
        : {}),
    };

    const [services, total] = await Promise.all([
      prisma.service.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          categoryId: true,
          name: true,
          description: true,
          durationMin: true,
          price: true,
          imageUrl: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.service.count({ where }),
    ]);

    const pages = Math.ceil(total / limit);
    res.json({
      services: services.map(formatService),
      pagination: {
        page,
        limit,
        total,
        pages,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getServiceById(req, res, next) {
  try {
    const { id } = req.params;
    const includeInactive = adminSeesInactive(req);

    const service = await prisma.service.findFirst({
      where: {
        id,
        ...(includeInactive ? {} : { isActive: true }),
      },
      select: {
        id: true,
        categoryId: true,
        name: true,
        description: true,
        durationMin: true,
        price: true,
        imageUrl: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!service) {
      throw new HttpError(404, 'Service not found', 'SERVICE_NOT_FOUND');
    }

    res.json({ service: formatService(service) });
  } catch (err) {
    next(err);
  }
}

export async function createService(req, res, next) {
  try {
    const { categoryId, name, description, durationMin, price, imageUrl, isActive } = req.body;

    // Validate categoryId exists
    const category = await prisma.serviceCategory.findUnique({ where: { id: categoryId } });
    if (!category) {
      throw new HttpError(
        404,
        'Category not found',
        'SERVICE_CATEGORY_NOT_FOUND',
      );
    }

    const data = {
      categoryId,
      name,
      description: description ?? undefined,
      durationMin,
      price: new Prisma.Decimal(price),
      imageUrl: imageUrl ?? undefined,
      isActive: isActive ?? true,
    };

    const service = await prisma.service.create({
      data,
      select: {
        id: true,
        categoryId: true,
        name: true,
        description: true,
        durationMin: true,
        price: true,
        imageUrl: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(201).json({ service: formatService(service) });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') {
        return next(
          new HttpError(409, 'Service name already exists', 'SERVICE_DUPLICATE_NAME'),
        );
      }
      if (err.code === 'P2025') {
        return next(
          new HttpError(404, 'Category not found', 'SERVICE_CATEGORY_NOT_FOUND'),
        );
      }
    }
    next(err);
  }
}

export async function updateService(req, res, next) {
  try {
    const { id } = req.params;

    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, 'Service not found', 'SERVICE_NOT_FOUND');
    }

    const data = {};
    if (req.body.categoryId !== undefined) {
      const category = await prisma.serviceCategory.findUnique({
        where: { id: req.body.categoryId },
      });
      if (!category) {
        throw new HttpError(404, 'Category not found', 'SERVICE_CATEGORY_NOT_FOUND');
      }
      data.categoryId = req.body.categoryId;
    }
    if (req.body.name !== undefined) data.name = req.body.name;
    if (req.body.description !== undefined) data.description = req.body.description;
    if (req.body.durationMin !== undefined) data.durationMin = req.body.durationMin;
    if (req.body.price !== undefined) data.price = new Prisma.Decimal(req.body.price);
    if (req.body.imageUrl !== undefined) data.imageUrl = req.body.imageUrl;
    if (req.body.isActive !== undefined) data.isActive = req.body.isActive;

    if (Object.keys(data).length === 0) {
      throw new HttpError(400, 'No fields to update', 'VALIDATION_ERROR');
    }

    const service = await prisma.service.update({
      where: { id },
      data,
      select: {
        id: true,
        categoryId: true,
        name: true,
        description: true,
        durationMin: true,
        price: true,
        imageUrl: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ service: formatService(service) });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') {
        return next(
          new HttpError(409, 'Service name already exists', 'SERVICE_DUPLICATE_NAME'),
        );
      }
      if (err.code === 'P2025') {
        return next(
          new HttpError(404, 'Category not found', 'SERVICE_CATEGORY_NOT_FOUND'),
        );
      }
    }
    next(err);
  }
}

export async function deleteService(req, res, next) {
  try {
    const { id } = req.params;

    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, 'Service not found', 'SERVICE_NOT_FOUND');
    }

    const refCount = await prisma.appointmentService.count({ where: { serviceId: id } });
    if (refCount > 0) {
      throw new HttpError(
        403,
        'Cannot delete service that is referenced by appointments',
        'SERVICE_IN_USE',
        { referencedCount: refCount },
      );
    }

    await prisma.service.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
