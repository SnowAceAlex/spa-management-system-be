import { Router } from 'express';
import * as loyaltyController from '../controllers/loyalty.controller.js';
import { auth, requireRole } from '../middlewares/auth.middleware.js';
import { validateQuery, validateParams } from '../validations/validate.js';
import * as loyaltyValidation from '../validations/loyalty.validation.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Loyalty
 *   description: Loyalty points and rewards management
 */

/**
 * @swagger
 * /loyalty/me:
 *   get:
 *     summary: Get my loyalty wallet information
 *     tags: [Loyalty]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Returns wallet info and last 10 transactions
 */
router.get(
  '/me',
  auth,
  requireRole(['CUSTOMER']),
  loyaltyController.getMyLoyaltyInfo
);

/**
 * @swagger
 * /loyalty/transactions:
 *   get:
 *     summary: Get loyalty transaction history (Earn/Redeem)
 *     tags: [Loyalty]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Paginated list of transactions
 */
router.get(
  '/transactions',
  auth,
  requireRole(['CUSTOMER']),
  validateQuery(loyaltyValidation.GetTransactionsSchema),
  loyaltyController.getMyTransactions
);

/**
 * @swagger
 * /loyalty/rewards:
 *   get:
 *     summary: Get list of available rewards
 *     tags: [Loyalty]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of active reward packages
 */
router.get(
  '/rewards',
  auth,
  loyaltyController.getAvailableRewards
);

/**
 * @swagger
 * /loyalty/rewards/{rewardId}/claim:
 *   post:
 *     summary: Redeem a reward using loyalty points
 *     tags: [Loyalty]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rewardId
 *         required: true
 *         schema:
 *           type: string
 *         description: Reward ID from LoyaltyReward table
 *     responses:
 *       201:
 *         description: Reward successfully redeemed, points deducted
 *       400:
 *         description: Not enough points to redeem reward
 *       404:
 *         description: Reward not found
 */
router.post(
  '/rewards/:rewardId/claim',
  auth,
  requireRole(['CUSTOMER']),
  validateParams(loyaltyValidation.ClaimRewardParamsSchema),
  loyaltyController.claimReward
);

export default router;