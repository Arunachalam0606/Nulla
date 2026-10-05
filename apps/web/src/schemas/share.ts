import { z } from 'zod';
import { chunkMetadataSchema } from './node';

export const shareSchema = z.object({
  token: z.string(),
  share_url: z.string(),
  expires_at: z.string().nullable().optional(),
});

export const publicShareResponseSchema = z.object({
  share: z.object({
    token: z.string(),
    permission: z.enum(['view', 'download']),
    expires_at: z.string().nullable().optional(),
  }),
  node: z.object({
    id: z.string().uuid(),
    name_encrypted: z.string(),
    name_iv: z.string(),
    size_bytes: z.number(),
    mime_type_encrypted: z.string().nullable().optional(),
    chunk_count: z.number(),
    type: z.enum(['file', 'folder']),
    chunks: z.array(chunkMetadataSchema),
  }),
});

export const fileRequestSchema = z.object({
  token: z.string(),
  request_url: z.string(),
});

export const publicFileRequestResponseSchema = z.object({
  request: z.object({
    id: z.string().uuid(),
    token: z.string(),
    title_encrypted: z.string(),
    title_iv: z.string(),
    is_active: z.number(),
    created_at: z.string(),
  }),
});

export type ShareInfo = z.infer<typeof shareSchema>;
export type PublicShareResponse = z.infer<typeof publicShareResponseSchema>;
export type FileRequestInfo = z.infer<typeof fileRequestSchema>;
export type PublicFileRequestResponse = z.infer<typeof publicFileRequestResponseSchema>;
