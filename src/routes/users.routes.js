import { Router } from 'express';

import * as usersController from '../controllers/users.controller.js';
import { auth, requireRole, requireSelfOrRole } from '../middlewares/auth.middleware.js';
import { validateBody } from '../validations/validate.js';
import {
  AdminCreateUserSchema,
  AdminUpdateUserSchema,
  UpdateMyProfileSchema,
} from '../validations/users.validation.js';

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

/**
 * @swagger
 * /users/me/profile:
 *   patch:
 *     tags: [Users]
 *     summary: Update current user profile by role
 *     description: Customer can update firstName, lastName, phone, dateOfBirth, notes. Staff can update firstName, lastName, phone, bio, isAvailable.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               phone: { type: string }
 *               dateOfBirth: { type: string, format: date-time }
 *               notes: { type: string }
 *               bio: { type: string }
 *               isAvailable: { type: boolean }
 *     responses:
 *       200:
 *         description: Profile updated
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.patch(
  '/me/profile',
  auth,
  validateBody(UpdateMyProfileSchema),
  usersController.updateMyProfile,
);

/**
 * @swagger
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: List users (admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Users list
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/', auth, requireRole(['ADMIN']), usersController.listUsers);

/**
 * @swagger
 * /users:
 *   post:
 *     tags: [Users]
 *     summary: Create staff/admin user (admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, role]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               role: { type: string, enum: [ADMIN, STAFF] }
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               phone: { type: string }
 *               bio: { type: string }
 *               isAvailable: { type: boolean }
 *     responses:
 *       201:
 *         description: User created
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       409:
 *         description: Email already exists
 */
router.post(
  '/',
  auth,
  requireRole(['ADMIN']),
  validateBody(AdminCreateUserSchema),
  usersController.adminCreateUser,
);

/**
 * @swagger
 * /users/{userId}:
 *   patch:
 *     tags: [Users]
 *     summary: Update user role or active status (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role: { type: string, enum: [ADMIN, STAFF, CUSTOMER] }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: User updated
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
router.patch(
  '/:userId',
  auth,
  requireRole(['ADMIN']),
  validateBody(AdminUpdateUserSchema),
  usersController.adminUpdateUser,
);

/**
 * @swagger
 * /users/{userId}:
 *   get:
 *     tags: [Users]
 *     summary: Get user by ID (self or admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User detail
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
router.get('/:userId', auth, requireSelfOrRole('userId', ['ADMIN']), usersController.getUserById);

/**
 * @swagger
 * /users/{userId}:
 *   delete:
 *     tags: [Users]
 *     summary: Delete user account (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: User deleted
 *       400:
 *         description: Cannot delete own account
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
router.delete('/:userId', auth, requireRole(['ADMIN']), usersController.adminDeleteUser);

export default router;
