import { z } from 'zod';

export const addSpecializationSchema = z.object({
  serviceId: z.string().cuid({ message: 'serviceId must be a valid CUID' }),
});