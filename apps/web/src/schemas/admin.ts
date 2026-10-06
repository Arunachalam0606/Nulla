import { z } from 'zod';

export const adminTelemetrySchema = z.object({
  telemetry: z.object({
    users: z.object({
      total: z.number(),
    }),
    storage: z.object({
      total_used_bytes: z.number(),
      total_quota_bytes: z.number(),
      percentage_used: z.number(),
    }),
    nodes: z.object({
      total: z.number(),
      files: z.number(),
      folders: z.number(),
      in_trash: z.number(),
      total_chunks: z.number(),
    }),
    sessions: z.object({
      active: z.number(),
      mac: z.number(),
      web: z.number(),
      mobile: z.number(),
    }),
    health: z.object({
      status: z.string(),
      latency_ms: z.number(),
      r2_connected: z.boolean(),
      d1_connected: z.boolean(),
      timestamp: z.string(),
    }),
  }),
});

export type AdminTelemetry = z.infer<typeof adminTelemetrySchema>;

export const adminSystemSettingsSchema = z.object({
  storage_tier_mode: z.string(),
  global_cap_bytes: z.number(),
  total_used_bytes: z.number(),
  total_allocated_bytes: z.number(),
  is_unlimited: z.boolean(),
  percentage_used: z.number(),
  percentage_allocated: z.number(),
});

export type AdminSystemSettings = z.infer<typeof adminSystemSettingsSchema>;

export const adminUserItemSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.string(),
  storage_used_bytes: z.number(),
  storage_quota_bytes: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type AdminUserItem = z.infer<typeof adminUserItemSchema>;

export const adminUsersResponseSchema = z.object({
  users: z.array(adminUserItemSchema),
});

export type AdminUsersResponse = z.infer<typeof adminUsersResponseSchema>;

