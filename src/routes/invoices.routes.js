import { Router } from 'express';
import {
  createCheckoutSession,
  getInvoiceById,
  listInvoices,
  markInvoicePaid,
} from '../controllers/invoices.controller.js';
import { auth, requireRole } from '../middlewares/auth.middleware.js';
import { validateBody } from '../validations/validate.js';
import {
  CreateCheckoutSessionSchema,
  MarkInvoicePaidSchema,
} from '../validations/invoices.validation.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Invoices
 *     description: Invoice + payment lifecycle (Stripe Checkout + cash)
 */

/**
 * @swagger
 * /invoices:
 *   get:
 *     tags: [Invoices]
 *     summary: List invoices (role-filtered)
 *     description: |
 *       Returns invoices scoped by role:
 *       - CUSTOMER: own invoices
 *       - STAFF: invoices for appointments assigned to them
 *       - ADMIN: all invoices
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [UNPAID, PARTIALLY_PAID, PAID, REFUNDED]
 *       - in: query
 *         name: appointmentId
 *         schema: { type: string }
 *     responses:
 *       200: { description: Invoice list }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.get('/', auth, requireRole(['ADMIN', 'STAFF', 'CUSTOMER']), listInvoices);

/**
 * @swagger
 * /invoices/{id}:
 *   get:
 *     tags: [Invoices]
 *     summary: Get invoice detail
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Invoice detail }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Invoice not found }
 */
router.get('/:id', auth, requireRole(['ADMIN', 'STAFF', 'CUSTOMER']), getInvoiceById);

/**
 * @swagger
 * /invoices/{id}/checkout-session:
 *   post:
 *     tags: [Invoices]
 *     summary: Create a Stripe Checkout Session for this invoice
 *     description: |
 *       Creates a Stripe Checkout Session (mode=payment, VND by default) and returns the hosted checkout URL.
 *       Allowed for invoice owner (customer), assigned staff, or admin. 409 if invoice already PAID/REFUNDED.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               successUrl:
 *                 type: string
 *                 format: uri
 *               cancelUrl:
 *                 type: string
 *                 format: uri
 *     responses:
 *       201:
 *         description: Checkout session created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url: { type: string }
 *                 sessionId: { type: string }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Invoice not found }
 *       409: { description: Invoice not payable }
 *       500: { description: Stripe not configured }
 */
router.post(
  '/:id/checkout-session',
  auth,
  requireRole(['ADMIN', 'STAFF', 'CUSTOMER']),
  validateBody(CreateCheckoutSessionSchema),
  createCheckoutSession,
);

/**
 * @swagger
 * /invoices/{id}/mark-paid:
 *   patch:
 *     tags: [Invoices]
 *     summary: Mark invoice as paid offline (cash / bank transfer)
 *     description: |
 *       Staff/admin-only endpoint for offline payments. Adds the amount to `paidAmt` and flips status to
 *       PAID (when paidAmt >= totalAmt) or PARTIALLY_PAID. Mirrors status to the related appointment.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Payment amount in VND (or the configured currency)
 *               paymentMethod:
 *                 type: string
 *                 enum: [CASH]
 *                 default: CASH
 *               note:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200: { description: Invoice updated }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Invoice not found }
 *       409: { description: Invoice not payable }
 */
router.patch(
  '/:id/mark-paid',
  auth,
  requireRole(['ADMIN', 'STAFF']),
  validateBody(MarkInvoicePaidSchema),
  markInvoicePaid,
);

export default router;
