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
 *   description: Quản lý điểm thưởng và đổi quà
 */

/**
 * @swagger
 * /loyalty/me:
 *   get:
 *     summary: Xem thông tin ví điểm của tôi
 *     tags: [Loyalty]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Trả về thông tin ví điểm và 10 giao dịch gần nhất
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
 *     summary: Xem lịch sử giao dịch điểm (Earn/Redeem)
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
 *         description: Danh sách giao dịch có phân trang
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
 *     summary: Lấy danh sách các phần thưởng có thể đổi
 *     tags: [Loyalty]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách các gói quà tặng đang hoạt động
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
 *     summary: Đổi phần thưởng bằng điểm tích lũy
 *     tags: [Loyalty]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rewardId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của phần thưởng từ bảng LoyaltyReward
 *     responses:
 *       201:
 *         description: Đổi quà thành công, điểm đã được trừ
 *       400:
 *         description: Không đủ điểm để đổi quà
 *       404:
 *         description: Không tìm thấy phần thưởng
 */
router.post(
  '/rewards/:rewardId/claim',
  auth,
  requireRole(['CUSTOMER']),
  validateParams(loyaltyValidation.ClaimRewardParamsSchema),
  loyaltyController.claimReward
);

export default router;