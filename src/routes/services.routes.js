import { Router } from 'express';

import * as servicesController from '../controllers/services.controller.js';
import { auth, optionalAuth, requireRole } from '../middlewares/auth.middleware.js';
import { validateBody } from '../validations/validate.js';
import {
  CreateServiceSchema,
  UpdateServiceSchema,
} from '../validations/services.validation.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Services
 *     description: Spa services catalog
 */

/**
 * @swagger
 * /services:
 *   get:
 *     tags: [Services]
 *     summary: List services
 *     description: |
 *       Public list of active services. Admins may send Bearer token and query includeInactive=true to list all.
 *       Supports filtering by categoryId, searching by name (q), and pagination.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number (1-indexed)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page (max 100)
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *         description: Filter by service category ID
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search services by name (case-insensitive substring match)
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Admin only — when true, includes inactive services
 *     responses:
 *       200:
 *         description: OK
 *       400:
 *         description: Invalid query parameters
 */
router.get('/', optionalAuth, servicesController.listServices);

/**
 * @swagger
 * /services:
 *   post:
 *     tags: [Services]
 *     summary: Create service (admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [categoryId, name, durationMin, price]
 *             properties:
 *               categoryId: 
 *                 type: string
 *                 description: Service category ID (must exist)
 *               name: 
 *                 type: string
 *                 description: Service name
 *               description: 
 *                 type: string
 *                 nullable: true
 *                 description: Service description
 *               durationMin: 
 *                 type: integer
 *                 description: Duration in minutes (positive integer)
 *               price: 
 *                 type: string
 *                 description: Price as string with up to 2 decimal places (e.g., "99.99")
 *               imageUrl: 
 *                 type: string
 *                 format: uri
 *                 nullable: true
 *                 description: Service image URL
 *               isActive: 
 *                 type: boolean
 *                 default: true
 *                 description: Whether service is active
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Category not found
 *       409:
 *         description: Duplicate service name
 */
router.post(
  '/',
  auth,
  requireRole(['ADMIN']),
  validateBody(CreateServiceSchema),
  servicesController.createService,
);

/**
 * @swagger
 * /services/{id}:
 *   get:
 *     tags: [Services]
 *     summary: Get service by ID
 *     description: Public; returns active service. Admin with includeInactive=true sees inactive services.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Service ID
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Admin only — when true, includes inactive services
 *     responses:
 *       200:
 *         description: OK
 *       404:
 *         description: Service not found
 */
router.get('/:id', optionalAuth, servicesController.getServiceById);

/**
 * @swagger
 * /services/{id}:
 *   patch:
 *     tags: [Services]
 *     summary: Update service (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Service ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               categoryId: 
 *                 type: string
 *                 description: Service category ID (must exist if provided)
 *               name: 
 *                 type: string
 *               description: 
 *                 type: string
 *                 nullable: true
 *               durationMin: 
 *                 type: integer
 *               price: 
 *                 type: string
 *               imageUrl: 
 *                 type: string
 *                 format: uri
 *                 nullable: true
 *               isActive: 
 *                 type: boolean
 *     responses:
 *       200:
 *         description: OK
 *       400:
 *         description: Validation error or no fields to update
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Service or category not found
 *       409:
 *         description: Duplicate service name
 */
router.patch(
  '/:id',
  auth,
  requireRole(['ADMIN']),
  validateBody(UpdateServiceSchema),
  servicesController.updateService,
);

/**
 * @swagger
 * /services/{id}:
 *   delete:
 *     tags: [Services]
 *     summary: Delete service (admin)
 *     description: Fails with 403 if service is referenced by existing appointments.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Service ID
 *     responses:
 *       204:
 *         description: Deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — service is referenced by appointments
 *       404:
 *         description: Service not found
 */
router.delete(
  '/:id',
  auth,
  requireRole(['ADMIN']),
  servicesController.deleteService,
);

export default router;
