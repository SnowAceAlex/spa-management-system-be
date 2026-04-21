import { z } from 'zod';

export const CreateAppointmentSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  staffId: z.string().min(1, 'Staff ID is required'),
  serviceIds: z
    .array(z.string().min(1))
    .min(1, 'At least one service is required'),
  scheduledAt: z
    .string()
    .datetime('Invalid date format')
    .refine(
      (date) => new Date(date) > new Date(),
      'Appointment must be scheduled for the future'
    ),
  notes: z.string().optional(),
});

export const UpdateAppointmentStatusSchema = z.object({
  status: z.enum([
    'PENDING',
    'CONFIRMED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'NO_SHOW',
  ]),
});

export const ListAppointmentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z
    .enum([
      'PENDING',
      'CONFIRMED',
      'IN_PROGRESS',
      'COMPLETED',
      'CANCELLED',
      'NO_SHOW',
    ])
    .optional(),
  customerId: z.string().optional(),
  staffId: z.string().optional(),
});
