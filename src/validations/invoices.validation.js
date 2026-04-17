import { z } from 'zod';

export const MarkInvoicePaidSchema = z.object({
  amount: z.coerce.number().positive(),
  paymentMethod: z.enum(['CASH']).default('CASH'),
  note: z.string().trim().max(500).optional().nullable(),
});

export const CreateCheckoutSessionSchema = z.object({
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});
