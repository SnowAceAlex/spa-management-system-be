import { z } from 'zod';

export const CreateAppointmentSchema = z.object({
  staffId: z.string().trim().min(1),
  scheduledAt: z.coerce.date(),
  serviceIds: z.array(z.string().trim().min(1)).min(1),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const UpdateAppointmentStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW']),
});

export const CancelAppointmentSchema = z.object({
  reason: z.string().trim().max(500).optional().nullable(),
});
