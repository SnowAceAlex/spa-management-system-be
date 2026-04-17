import { Router } from 'express';

import * as authController from '../controllers/auth.controller.js';
import { auth } from '../middlewares/auth.middleware.js';
import { authLimiter } from '../middlewares/rateLimit.middleware.js';
import { validateBody } from '../validations/validate.js';
import {
  LoginSchema,
  LogoutSchema,
  RefreshSchema,
  RegisterSchema,
} from '../validations/auth.validation.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Authentication endpoints
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a customer user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, firstName, lastName]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               phone: { type: string }
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/register', authLimiter, validateBody(RegisterSchema), authController.register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login and get access token with refresh cookie
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: OK
 *         headers:
 *           Set-Cookie:
 *             schema:
 *               type: string
 *             description: HttpOnly refresh token cookie
 */
router.post('/login', authLimiter, validateBody(LoginSchema), authController.login);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Rotate refresh cookie and issue new access token
 *     description: Uses refresh token from HttpOnly cookie. Body refreshToken is optional fallback.
 *     responses:
 *       200:
 *         description: OK
 *         headers:
 *           Set-Cookie:
 *             schema:
 *               type: string
 *             description: Rotated HttpOnly refresh token cookie
 */
router.post('/refresh', authLimiter, validateBody(RefreshSchema), authController.refresh);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Revoke current refresh token and clear cookie
 *     description: Uses refresh token from HttpOnly cookie. Body refreshToken is optional fallback.
 *     responses:
 *       204:
 *         description: No Content
 */
router.post('/logout', validateBody(LogoutSchema), authController.logout);

/**
 * @swagger
 * /auth/logout-all:
 *   post:
 *     tags: [Auth]
 *     summary: Revoke all active sessions for current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: No Content
 *       401:
 *         description: Unauthorized
 */
router.post('/logout-all', auth, authController.logoutAll);

export default router;
