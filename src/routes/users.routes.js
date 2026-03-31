import { Router } from 'express';

import * as usersController from '../controllers/users.controller.js';
import { auth } from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Users
 *     description: User endpoints
 */

/**
 * @swagger
 * /users/me:
 *   get:
 *     tags: [Users]
 *     summary: Get current user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Unauthorized
 */
router.get('/me', auth, usersController.me);

export default router;

