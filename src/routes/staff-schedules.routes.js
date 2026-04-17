import { Router } from 'express';
import {
  createStaffSchedule,
  deleteStaffSchedule,
  getStaffAvailability,
  listStaffSchedules,
  updateStaffSchedule,
} from '../controllers/staff-schedules.controller.js';
import { auth, requireRole } from '../middlewares/auth.middleware.js';
import { validateBody } from '../validations/validate.js';
import {
  CreateStaffScheduleSchema,
  UpdateStaffScheduleSchema,
} from '../validations/staff-schedules.validation.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Staff Schedules
 *     description: Staff weekly schedule and availability
 */

/**
 * @swagger
 * /staff/{staffId}/schedules:
 *   get:
 *     tags: [Staff Schedules]
 *     summary: List weekly schedules for a staff member
 *     description: Admin can view any staff schedules. Staff can view only their own schedules.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: staffId
 *         required: true
 *         schema:
 *           type: string
 *         description: Staff profile ID
 *     responses:
 *       200:
 *         description: Schedule list
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Staff not found
 */
router.get('/:staffId/schedules', auth, requireRole(['ADMIN', 'STAFF']), listStaffSchedules);

/**
 * @swagger
 * /staff/{staffId}/schedules:
 *   post:
 *     tags: [Staff Schedules]
 *     summary: Create a staff schedule entry
 *     description: Admin can create schedules for any staff. Staff can create schedules only for themselves.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: staffId
 *         required: true
 *         schema:
 *           type: string
 *         description: Staff profile ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [dayOfWeek, startTime, endTime]
 *             properties:
 *               dayOfWeek:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 6
 *                 description: Day of week in UTC (0=Sunday, 6=Saturday)
 *               startTime:
 *                 type: string
 *                 example: "09:00"
 *                 description: Start time in HH:mm or HH:mm:ss
 *               endTime:
 *                 type: string
 *                 example: "18:00"
 *                 description: End time in HH:mm or HH:mm:ss
 *               isWorkingDay:
 *                 type: boolean
 *                 default: true
 *                 description: Marks this day as working/non-working
 *     responses:
 *       201:
 *         description: Schedule created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Staff not found
 *       409:
 *         description: Duplicate schedule for same day
 */
router.post(
  '/:staffId/schedules',
  auth,
  requireRole(['ADMIN', 'STAFF']),
  validateBody(CreateStaffScheduleSchema),
  createStaffSchedule,
);

/**
 * @swagger
 * /staff/{staffId}/schedules/{scheduleId}:
 *   patch:
 *     tags: [Staff Schedules]
 *     summary: Update a schedule entry
 *     description: Admin can update any staff schedule. Staff can update only their own schedule.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: staffId
 *         required: true
 *         schema:
 *           type: string
 *         description: Staff profile ID
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema:
 *           type: string
 *         description: Staff schedule ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               dayOfWeek:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 6
 *               startTime:
 *                 type: string
 *                 example: "10:00"
 *               endTime:
 *                 type: string
 *                 example: "19:00"
 *               isWorkingDay:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Schedule updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Schedule not found
 *       409:
 *         description: Duplicate schedule day
 */
router.patch(
  '/:staffId/schedules/:scheduleId',
  auth,
  requireRole(['ADMIN', 'STAFF']),
  validateBody(UpdateStaffScheduleSchema),
  updateStaffSchedule,
);

/**
 * @swagger
 * /staff/{staffId}/schedules/{scheduleId}:
 *   delete:
 *     tags: [Staff Schedules]
 *     summary: Delete a schedule entry
 *     description: Admin can delete any schedule. Staff can delete only their own schedule.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: staffId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Schedule deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Schedule not found
 */
router.delete(
  '/:staffId/schedules/:scheduleId',
  auth,
  requireRole(['ADMIN', 'STAFF']),
  deleteStaffSchedule,
);

/**
 * @swagger
 * /staff/{staffId}/availability:
 *   get:
 *     tags: [Staff Schedules]
 *     summary: Get staff availability for a date
 *     description: Returns whether staff works on that date and booked slots for the day.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: staffId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         example: "2026-04-20"
 *         description: Target date in YYYY-MM-DD
 *     responses:
 *       200:
 *         description: Availability result
 *       400:
 *         description: Invalid date query
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Staff not found
 */
router.get(
  '/:staffId/availability',
  auth,
  requireRole(['ADMIN', 'STAFF', 'CUSTOMER']),
  getStaffAvailability,
);

export default router;
