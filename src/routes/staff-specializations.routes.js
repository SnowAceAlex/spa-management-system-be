import { Router } from 'express';
import {
  getSpecializations,
  addSpecialization,
  removeSpecialization,
} from '../controllers/staff-specializations.controller.js';
import { addSpecializationSchema } from '../validations/staff-specializations.validation.js';
import { validateBody } from '../validations/validate.js';
import { auth, optionalAuth, requireRole } from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Staff Specializations
 *     description: Manage staff-service relationships
 */

/**
 * @swagger
 * /staff/{staffId}/specializations:
 *   get:
 *     summary: Get all service specializations for a staff member
 *     tags: [Staff Specializations]
 *     parameters:
 *       - in: path
 *         name: staffId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of specializations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   serviceId:
 *                     type: string
 *                   name:
 *                     type: string
 *                   price:
 *                     type: string
 */
router.get('/:staffId/specializations', optionalAuth, getSpecializations);

/**
 * @swagger
 * /staff/{staffId}/specializations:
 *   post:
 *     summary: Add a service specialization to a staff member
 *     tags: [Staff Specializations]
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
 *       400:
 *         description: Validation error
 *       404:
 *         description: Staff or service not found
 *       409:
 *         description: Staff already has this specialization
 */
router.post(
  '/:staffId/specializations',
  auth,
  requireRole(['ADMIN']),
  validateBody(addSpecializationSchema),
  addSpecialization
);

/**
 * @swagger
 * /staff/{staffId}/specializations/{serviceId}:
 *   delete:
 *     summary: Remove a service specialization from a staff member
 *     tags: [Staff Specializations]
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
 *         description: Specialization successfully removed
 *       404:
 *         description: Staff or specialization not found
 */
router.delete(
  '/:staffId/specializations/:serviceId',
  auth,
  requireRole(['ADMIN']),
  removeSpecialization
);

export default router;