import { Router } from 'express';
import {
  cancelAppointment,
  countAppointmentsByStaff,
  createAppointment,
  getAppointmentById,
  listAppointments,
  updateAppointmentStatus,
} from '../controllers/appointments.controller.js';
import { generateInvoiceForAppointment } from '../controllers/invoices.controller.js';
import { auth, requireRole } from '../middlewares/auth.middleware.js';
import { validateBody } from '../validations/validate.js';
import {
  CancelAppointmentSchema,
  CreateAppointmentSchema,
  UpdateAppointmentStatusSchema,
} from '../validations/appointments.validation.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Appointments
 *     description: Appointment booking and lifecycle
 */

/**
 * @swagger
 * /appointments:
 *   post:
 *     tags: [Appointments]
 *     summary: Create appointment (customer)
 *     description: Creates a new appointment for the authenticated customer with selected staff and services.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [staffId, scheduledAt, serviceIds]
 *             properties:
 *               staffId:
 *                 type: string
 *                 description: Staff profile ID
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-04-20T10:00:00.000Z"
 *                 description: Appointment start time in UTC
 *               serviceIds:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: string
 *                 description: List of service IDs to include
 *               notes:
 *                 type: string
 *                 nullable: true
 *                 description: Optional customer note
 *     responses:
 *       201:
 *         description: Appointment created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Staff/service not found
 *       409:
 *         description: Conflict (overlap, out of working hours, or missing specialization)
 */
router.post(
  '/',
  auth,
  requireRole(['CUSTOMER']),
  validateBody(CreateAppointmentSchema),
  createAppointment,
);

/**
 * @swagger
 * /appointments:
 *   get:
 *     tags: [Appointments]
 *     summary: List appointments (role-filtered)
 *     description: |
 *       Returns appointments scoped by role:
 *       - CUSTOMER: own appointments
 *       - STAFF: assigned appointments
 *       - ADMIN: all appointments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW]
 *         description: Filter by appointment status
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         example: "2026-04-20"
 *         description: Filter appointments by scheduled date (UTC day)
 *       - in: query
 *         name: staffId
 *         schema:
 *           type: string
 *         description: Admin-only filter by staff ID
 *       - in: query
 *         name: customerId
 *         schema:
 *           type: string
 *         description: Admin-only filter by customer ID
 *     responses:
 *       200:
 *         description: Appointment list
 *       400:
 *         description: Invalid query parameters
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/', auth, requireRole(['ADMIN', 'STAFF', 'CUSTOMER']), listAppointments);

/**
 * @swagger
 * /appointments/{id}:
 *   get:
 *     tags: [Appointments]
 *     summary: Get appointment detail
 *     description: Returns appointment details if caller has permission (admin, assigned staff, or owner customer).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Appointment ID
 *     responses:
 *       200:
 *         description: Appointment detail
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Appointment not found
 */
/**
 * @swagger
 * /appointments/staff/{staffId}/count:
 *   get:
 *     tags: [Appointments]
 *     summary: Count total appointments for a staff
 *     description: |
 *       Returns the total number of appointments assigned to the given staff (no filters).
 *       Admins can query any staff; staff users can only query their own ID.
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
 *         description: Total appointment count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 staffId:
 *                   type: string
 *                 total:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Staff not found
 */
router.get(
  '/staff/:staffId/count',
  auth,
  requireRole(['ADMIN', 'STAFF']),
  countAppointmentsByStaff,
);

router.get('/:id', auth, requireRole(['ADMIN', 'STAFF', 'CUSTOMER']), getAppointmentById);

/**
 * @swagger
 * /appointments/{id}/status:
 *   patch:
 *     tags: [Appointments]
 *     summary: Update appointment status (staff/admin)
 *     description: Updates appointment workflow status with transition rules.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Appointment ID
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
 *                 description: Next status according to allowed transitions
 *     responses:
 *       200:
 *         description: Appointment status updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Appointment not found
 *       409:
 *         description: Invalid transition or terminal status lock
 */
router.patch(
  '/:id/status',
  auth,
  requireRole(['ADMIN', 'STAFF']),
  validateBody(UpdateAppointmentStatusSchema),
  updateAppointmentStatus,
);

/**
 * @swagger
 * /appointments/{id}/cancel:
 *   patch:
 *     tags: [Appointments]
 *     summary: Cancel appointment (customer owner, assigned staff, or admin)
 *     description: Cancels an appointment with optional reason, if cancellation policy allows.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Appointment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 nullable: true
 *                 description: Optional cancellation reason
 *     responses:
 *       200:
 *         description: Appointment cancelled
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Appointment not found
 *       409:
 *         description: Cancellation not allowed by status policy
 */
router.patch(
  '/:id/cancel',
  auth,
  requireRole(['ADMIN', 'STAFF', 'CUSTOMER']),
  validateBody(CancelAppointmentSchema),
  cancelAppointment,
);

/**
 * @swagger
 * /appointments/{id}/invoice:
 *   post:
 *     tags: [Appointments, Invoices]
 *     summary: Generate (or fetch existing) invoice for a completed appointment
 *     description: |
 *       Idempotent. If an invoice already exists for the appointment, returns it with status 200.
 *       Otherwise creates a new invoice (status UNPAID) and returns 201. Appointment must be in COMPLETED state.
 *       Staff can only generate for appointments assigned to them; admins can generate any.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Appointment ID
 *     responses:
 *       200: { description: Existing invoice returned }
 *       201: { description: Invoice created }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Appointment not found }
 *       409: { description: Appointment not yet completed }
 */
router.post(
  '/:id/invoice',
  auth,
  requireRole(['ADMIN', 'STAFF']),
  generateInvoiceForAppointment,
);
export default router;
