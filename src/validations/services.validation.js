import { z } from 'zod';

export const CreateServiceSchema = z.object({
  categoryId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  durationMin: z.number().int().positive(),
  price: z.string().trim().regex(/^\d+(\.\d{1,2})?$/),
  imageUrl: z.string().trim().url().max(2048).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const UpdateServiceSchema = CreateServiceSchema.partial();

export const ListServicesQuerySchema = z.object({
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
  categoryId: z.string().trim().optional(),
  isActive: z.boolean().optional(),
  q: z.string().trim().optional(),
  includeInactive: z.string().optional(),
});
