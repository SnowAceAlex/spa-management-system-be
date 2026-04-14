import { Router } from 'express';
import {
  getSpecializations,
  addSpecialization,
  removeSpecialization,
} from '../controllers/staff-specializations.controller.js';
import { addSpecializationSchema } from '../validations/staff-specializations.validation.js';
import { validateBody } from '../validations/validate.js';
import { auth, optionalAuth, requireRole } from '../middlewares/auth.middleware.js';

const router = Router({ mergeParams: true });

/**
 * @swagger
 * tags:
 *   - name: Staff Specializations
 *     description: Manage which services each staff member can perform
 */

/**
 * @swagger
 * /staff/{staffId}/specializations:
 *   get:
 *     tags: [Staff Specializations]
 *     summary: Get all specializations for a staff member
 *     parameters:
 *       - in: path
 *         name: staffId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of specializations
 *       404:
 *         description: Staff not found
 */
router.get('/', optionalAuth, getSpecializations);

/**
 * @swagger
 * /staff/{staffId}/specializations:
 *   post:
 *     tags: [Staff Specializations]
 *     summary: Add a specialization to a staff member (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: staffId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [serviceId]
 *             properties:
 *               serviceId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Specialization added
 *       404:
 *         description: Staff or service not found
 *       409:
 *         description: Staff already has this specialization
 */
router.post(
  '/',
  auth,
  requireRole(['ADMIN']),
  validateBody(addSpecializationSchema),
  addSpecialization
);

/**
 * @swagger
 * /staff/{staffId}/specializations/{serviceId}:
 *   delete:
 *     tags: [Staff Specializations]
 *     summary: Remove a specialization from a staff member (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: staffId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Specialization removed
 *       404:
 *         description: Specialization not found
 */
router.delete(
  '/:serviceId',
  auth,
  requireRole(['ADMIN']),
  removeSpecialization
);

export default router;