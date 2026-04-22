import { z } from 'zod';

export const GetTransactionsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

// SỬA CHỖ NÀY: Bọc nó lại trong object tương ứng với params
export const ClaimRewardParamsSchema = z.object({
  rewardId: z.string().trim().min(1),
});

export const CreateRewardSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1000).optional().nullable(),
  pointsCost: z.number().int().positive(),
  discountValue: z.number().positive(),
  discountType: z.enum(['PERCENTAGE']),
  validDays: z.number().int().positive().default(30),
  isActive: z.boolean().default(true),
});