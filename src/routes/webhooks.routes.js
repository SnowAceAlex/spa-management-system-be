import { Router } from 'express';
import { stripeWebhook } from '../controllers/webhooks.controller.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Webhooks
 *     description: External webhooks (Stripe)
 */

/**
 * @swagger
 * /webhooks/stripe:
 *   post:
 *     tags: [Webhooks]
 *     summary: Stripe webhook endpoint
 *     description: |
 *       Receives Stripe events. Expects the raw request body and a `stripe-signature` header.
 *       Handles `checkout.session.completed` to mark the invoice as PAID and sync the appointment.
 *       Stripe calls this endpoint directly; no bearer token is required.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200: { description: Event received }
 *       400: { description: Signature verification failed }
 *       500: { description: Stripe not configured or handler error }
 */
router.post('/stripe', stripeWebhook);

export default router;
