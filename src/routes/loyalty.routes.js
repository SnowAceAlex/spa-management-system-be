import { Router } from 'express';
import { getCustomerLoyalty, getMyLoyalty } from '../controllers/loyalty.controller.js';
import { auth, requireRole } from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Loyalty
 *     description: Loyalty score and tier endpoints
 */

/**
 * @swagger
 * /loyalty/me:
 *   get:
 *     tags: [Loyalty]
 *     summary: Get current customer loyalty score
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Loyalty score
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/me', auth, requireRole(['CUSTOMER']), getMyLoyalty);

/**
 * @swagger
 * /loyalty/customers/{customerId}:
 *   get:
 *     tags: [Loyalty]
 *     summary: Get loyalty score by customer ID (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Loyalty score
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Customer not found
 */
router.get('/customers/:customerId', auth, requireRole(['ADMIN']), getCustomerLoyalty);

export default router;