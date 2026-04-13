import { Router } from 'express';
import {
  getSpecializations,
  addSpecialization,
  removeSpecialization,
} from '../controllers/staff-specializations.controller.js';
import { addSpecializationSchema } from '../validations/staff-specializations.validation.js';
import { validateBody } from '../validations/validate.js';
import { auth, optionalAuth, requireRole } from '../middlewares/auth.middleware.js';

// Cần mergeParams để lấy được params :staffId từ router cha
const router = Router({ mergeParams: true });

/**
 * @swagger
 * /staff/{staffId}/specializations:
 * get:
 * summary: Get all service specializations for a staff member
 * tags: [Staff Specializations]
 * parameters:
 * - in: path
 * name: staffId
 * required: true
 * schema:
 * type: string
 * responses:
 * 200:
 * description: List of specializations
 */
router.get('/', optionalAuth, getSpecializations);

/**
 * @swagger
 * /staff/{staffId}/specializations:
 * post:
 * summary: Add a service specialization to a staff member
 * tags: [Staff Specializations]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: staffId
 * required: true
 * schema:
 * type: string
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * serviceId:
 * type: string
 * responses:
 * 201:
 * description: Specialization added
 * 409:
 * description: Staff already has this specialization
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
 * delete:
 * summary: Remove a service specialization from a staff member
 * tags: [Staff Specializations]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: staffId
 * required: true
 * schema:
 * type: string
 * - in: path
 * name: serviceId
 * required: true
 * schema:
 * type: string
 * responses:
 * 204:
 * description: Specialization successfully removed
 */
router.delete(
  '/:serviceId',
  auth,
  requireRole(['ADMIN']),
  removeSpecialization
);

export default router;