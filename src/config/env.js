import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.string().optional().default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(20),
  JWT_REFRESH_SECRET: z.string().min(20),
  JWT_ACCESS_TTL: z.string().min(1).default('15m'),
  JWT_REFRESH_TTL: z.string().min(1).default('7d'),
  AUTH_COOKIE_NAME: z.string().min(1).default('refreshToken'),
  AUTH_COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  AUTH_COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  AUTH_COOKIE_DOMAIN: z.string().optional(),

  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_SUCCESS_URL: z.string().url().default('http://localhost:5173/payment/success'),
  STRIPE_CANCEL_URL: z.string().url().default('http://localhost:5173/payment/cancel'),
  STRIPE_CURRENCY: z.string().min(3).max(3).default('vnd'),

  LOYALTY_POINTS_PER_SPEND_UNIT: z.coerce.number().positive().default(10000),
  LOYALTY_SILVER_MIN_POINTS: z.coerce.number().int().nonnegative().default(500),
  LOYALTY_GOLD_MIN_POINTS: z.coerce.number().int().nonnegative().default(1500),
  LOYALTY_PLATINUM_MIN_POINTS: z.coerce.number().int().nonnegative().default(3000),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

if (
  parsed.data.LOYALTY_SILVER_MIN_POINTS > parsed.data.LOYALTY_GOLD_MIN_POINTS ||
  parsed.data.LOYALTY_GOLD_MIN_POINTS > parsed.data.LOYALTY_PLATINUM_MIN_POINTS
) {
  console.error(
    'Invalid loyalty tier thresholds: expected SILVER <= GOLD <= PLATINUM minimum points.',
  );
  process.exit(1);
}

export const env = parsed.data;
