import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  deviceName: z.string().min(1),
  deviceType: z.enum(['mac', 'web', 'mobile']),
});

export const userProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  storage_quota_bytes: z.number(),
  storage_used_bytes: z.number(),
  role: z.enum(['user', 'admin']),
});

export const authResponseSchema = z.object({
  token: z.string(),
  user: userProfileSchema,
  device: z.object({
    id: z.string().uuid(),
    device_name: z.string(),
    device_type: z.enum(['mac', 'web', 'mobile']),
  }),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
