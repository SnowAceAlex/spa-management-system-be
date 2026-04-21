import express from 'express';
import { auth, requireRole } from '../middlewares/auth.middleware.js';
import { validateBody } from '../validations/validate.js';
import {
  createAppointment,
  listAppointments,
  getAppointmentById,
  updateAppointmentStatus,
  deleteAppointment,
} from '../controllers/appointments.controller.js';
import {
  CreateAppointmentSchema,
  UpdateAppointmentStatusSchema,
  ListAppointmentsQuerySchema,
} from '../validations/appointments.validation.js';

const router = express.Router();

/**
 * @swagger
 * /appointments:
 *   post:
 *     summary: Create new appointment (with auto-applied loyalty discount)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customerId, staffId, serviceIds, scheduledAt]
 *             properties:
 *               customerId:
 *                 type: string
 *                 description: Customer ID
 *               staffId:
 *                 type: string
 *                 description: Staff member ID
 *               serviceIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of service IDs to book
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *                 description: Appointment start time (ISO 8601)
 *               notes:
 *                 type: string
 *                 description: Optional appointment notes
 *     responses:
 *       201:
 *         description: Appointment created successfully
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Customer, staff, or service not found
 */
router.post(
  '/appointments',
  auth,
  validateBody(CreateAppointmentSchema),
  createAppointment
);

/**
 * @swagger
 * /appointments:
 *   get:
 *     summary: List appointments with pagination and filters
 *     tags: [Appointments]
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
 *           maximum: 100
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW]
 *       - in: query
 *         name: customerId
 *         schema:
 *           type: string
 *         description: Filter by customer (Admin/Staff only)
 *       - in: query
 *         name: staffId
 *         schema:
 *           type: string
 *         description: Filter by staff (Admin/Staff only)
 *     responses:
 *       200:
 *         description: List of appointments
 */
router.get(
  '/appointments',
  auth,
  listAppointments
);

/**
 * @swagger
 * /appointments/{id}:
 *   get:
 *     summary: Get appointment detail
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Appointment details
 *       404:
 *         description: Appointment not found
 *       403:
 *         description: Unauthorized access
 */
router.get('/appointments/:id', auth, getAppointmentById);

/**
 * @swagger
 * /appointments/{id}/status:
 *   patch:
 *     summary: Update appointment status (Earns loyalty points when COMPLETED)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW]
 *     responses:
 *       200:
 *         description: Status updated
 */
router.patch(
  '/appointments/:id/status',
  auth,
  requireRole(['ADMIN', 'STAFF']),
  validateBody(UpdateAppointmentStatusSchema),
  updateAppointmentStatus
);

/**
 * @swagger
 * /appointments/{id}:
 *   delete:
 *     summary: Cancel appointment (refunds loyalty points if earned)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Appointment cancelled
 *       404:
 *         description: Appointment not found
 */
router.delete(
  '/appointments/:id',
  auth,
  requireRole(['ADMIN']),
  deleteAppointment
);

export default router;
