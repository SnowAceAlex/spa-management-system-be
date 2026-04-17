import { z } from 'zod';

export const CreateServiceCategorySchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  imageUrl: z.string().trim().url().max(2048).optional().nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const UpdateServiceCategorySchema = CreateServiceCategorySchema.partial();
