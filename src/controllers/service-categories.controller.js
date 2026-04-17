import { Prisma } from '@prisma/client';

import { prisma } from '../config/db.js';
import { HttpError } from '../utils/httpError.js';

function adminSeesInactive(req) {
  return req.user?.role === 'ADMIN' && req.query.includeInactive === 'true';
}

export async function listCategories(req, res, next) {
  try {
    const includeInactive = adminSeesInactive(req);
    const categories = await prisma.serviceCategory.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        sortOrder: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { services: true } },
      },
    });
    res.json({ categories });
  } catch (err) {
    next(err);
  }
}

export async function getCategoryById(req, res, next) {
  try {
    const { id } = req.params;
    const includeInactive = adminSeesInactive(req);

    const category = await prisma.serviceCategory.findFirst({
      where: {
        id,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        services: {
          where: includeInactive ? {} : { isActive: true },
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            description: true,
            durationMin: true,
            price: true,
            imageUrl: true,
            isActive: true,
            categoryId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!category) {
      throw new HttpError(404, 'Category not found', 'SERVICE_CATEGORY_NOT_FOUND');
    }

    const { services, ...rest } = category;
    res.json({
      category: {
        ...rest,
        services: services.map((s) => ({
          ...s,
          price: s.price.toString(),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function createCategory(req, res, next) {
  try {
    const data = {
      name: req.body.name,
      description: req.body.description ?? undefined,
      imageUrl: req.body.imageUrl ?? undefined,
      sortOrder: req.body.sortOrder ?? 0,
      isActive: req.body.isActive ?? true,
    };

    const category = await prisma.serviceCategory.create({
      data,
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        sortOrder: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.status(201).json({ category });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return next(
        new HttpError(409, 'Category name already exists', 'SERVICE_CATEGORY_DUPLICATE_NAME'),
      );
    }
    next(err);
  }
}

export async function updateCategory(req, res, next) {
  try {
    const { id } = req.params;

    const existing = await prisma.serviceCategory.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, 'Category not found', 'SERVICE_CATEGORY_NOT_FOUND');
    }

    const data = {};
    if (req.body.name !== undefined) data.name = req.body.name;
    if (req.body.description !== undefined) data.description = req.body.description;
    if (req.body.imageUrl !== undefined) data.imageUrl = req.body.imageUrl;
    if (req.body.sortOrder !== undefined) data.sortOrder = req.body.sortOrder;
    if (req.body.isActive !== undefined) data.isActive = req.body.isActive;

    if (Object.keys(data).length === 0) {
      throw new HttpError(400, 'No fields to update', 'VALIDATION_ERROR');
    }

    const category = await prisma.serviceCategory.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        sortOrder: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json({ category });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return next(
        new HttpError(409, 'Category name already exists', 'SERVICE_CATEGORY_DUPLICATE_NAME'),
      );
    }
    next(err);
  }
}

export async function deleteCategory(req, res, next) {
  try {
    const { id } = req.params;

    const existing = await prisma.serviceCategory.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, 'Category not found', 'SERVICE_CATEGORY_NOT_FOUND');
    }

    const svcCount = await prisma.service.count({ where: { categoryId: id } });
    if (svcCount > 0) {
      throw new HttpError(
        409,
        'Cannot delete category that still has services',
        'SERVICE_CATEGORY_HAS_SERVICES',
      );
    }

    await prisma.serviceCategory.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
