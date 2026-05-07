import { Router } from 'express';

import * as staffController from '../controllers/staff.controller.js';
import { optionalAuth } from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Staff
 *     description: Staff directory
 */

/**
 * @swagger
 * /staff:
 *   get:
 *     tags: [Staff]
 *     summary: List staff
 *     description: |
 *       Public list of staff members for the FE Staff List page. By default returns
 *       only available staff (isAvailable=true). Admins may send a Bearer token
 *       and pass includeUnavailable=true to also include unavailable staff.
 *       Each staff entry includes a flat `services` array of the specializations
 *       they perform. The `email` field is only included when the caller is
 *       authenticated as ADMIN.
 *     parameters:
 *       - in: query
 *         name: includeUnavailable
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Admin only — when true, includes unavailable staff
 *     responses:
 *       200:
 *         description: List of staff
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 staff:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       firstName:
 *                         type: string
 *                       lastName:
 *                         type: string
 *                       phone:
 *                         type: string
 *                         nullable: true
 *                       bio:
 *                         type: string
 *                         nullable: true
 *                       isAvailable:
 *                         type: boolean
 *                       email:
 *                         type: string
 *                         format: email
 *                         description: Only included when caller is authenticated as ADMIN
 *                       services:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                             name:
 *                               type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 */
router.get('/', optionalAuth, staffController.listStaff);

export default router;
