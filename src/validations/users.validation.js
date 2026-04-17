import { z } from 'zod';

export const UpdateMyProfileSchema = z
  .object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    phone: z.string().min(7).max(30).optional(),
    dateOfBirth: z.coerce.date().optional(),
    notes: z.string().max(2000).optional(),
    bio: z.string().max(2000).optional(),
    isAvailable: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export const AdminUpdateUserSchema = z
  .object({
    role: z.enum(['ADMIN', 'STAFF', 'CUSTOMER']).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export const AdminCreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['ADMIN', 'STAFF']),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().min(7).max(30).optional(),
  bio: z.string().max(2000).optional(),
  isAvailable: z.boolean().optional(),
});
