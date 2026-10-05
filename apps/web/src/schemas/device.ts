import { z } from 'zod';

export const deviceSchema = z.object({
  id: z.string().uuid(),
  device_name: z.string(),
  device_type: z.enum(['mac', 'web', 'mobile']),
  ip_address: z.string().nullable().optional(),
  user_agent: z.string().nullable().optional(),
  last_active_at: z.string(),
  revoked_at: z.string().nullable().optional(),
  created_at: z.string(),
  is_current: z.boolean().optional(),
});

export type Device = z.infer<typeof deviceSchema>;
