import { Router } from 'express';

import * as serviceCategoriesController from '../controllers/service-categories.controller.js';
import { auth, optionalAuth, requireRole } from '../middlewares/auth.middleware.js';
import { validateBody } from '../validations/validate.js';
import {
  CreateServiceCategorySchema,
  UpdateServiceCategorySchema,
} from '../validations/service-categories.validation.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: ServiceCategories
 *     description: Service catalog categories
 */

/**
 * @swagger
 * /service-categories:
 *   get:
 *     tags: [ServiceCategories]
 *     summary: List service categories
 *     description: Public list of active categories. Admins may send Bearer token and query includeInactive=true to list all.
 *     parameters:
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Admin only — when true, includes inactive categories
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/', optionalAuth, serviceCategoriesController.listCategories);

/**
 * @swagger
 * /service-categories:
 *   post:
 *     tags: [ServiceCategories]
 *     summary: Create category (admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               description: { type: string, nullable: true }
 *               imageUrl: { type: string, format: uri, nullable: true }
 *               sortOrder: { type: integer }
 *               isActive: { type: boolean }
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       409:
 *         description: Duplicate name
 */
router.post(
  '/',
  auth,
  requireRole(['ADMIN']),
  validateBody(CreateServiceCategorySchema),
  serviceCategoriesController.createCategory,
);

/**
 * @swagger
 * /service-categories/{id}:
 *   get:
 *     tags: [ServiceCategories]
 *     summary: Get category by ID
 *     description: Public; returns active category and active services. Admin with includeInactive=true sees inactive records.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: string
 *           enum: [true, false]
 *     responses:
 *       200:
 *         description: OK
 *       404:
 *         description: Not found
 */
router.get('/:id', optionalAuth, serviceCategoriesController.getCategoryById);

/**
 * @swagger
 * /service-categories/{id}:
 *   patch:
 *     tags: [ServiceCategories]
 *     summary: Update category (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string, nullable: true }
 *               imageUrl: { type: string, format: uri, nullable: true }
 *               sortOrder: { type: integer }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *       409:
 *         description: Duplicate name
 */
router.patch(
  '/:id',
  auth,
  requireRole(['ADMIN']),
  validateBody(UpdateServiceCategorySchema),
  serviceCategoriesController.updateCategory,
);

/**
 * @swagger
 * /service-categories/{id}:
 *   delete:
 *     tags: [ServiceCategories]
 *     summary: Delete category (admin)
 *     description: Fails with 409 if any services still reference this category.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *       409:
 *         description: Category still has services
 */
router.delete(
  '/:id',
  auth,
  requireRole(['ADMIN']),
  serviceCategoriesController.deleteCategory,
);

export default router;
