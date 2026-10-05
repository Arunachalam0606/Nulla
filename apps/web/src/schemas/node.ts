import { z } from 'zod';

export const nodeTypeSchema = z.enum(['file', 'folder']);
export const nodeStatusSchema = z.enum(['uploading', 'ready', 'deleted']);

export const rawNodeSchema = z.object({
  id: z.string().uuid(),
  parent_id: z.string().uuid().nullable().optional(),
  name: z.string().nullable().optional(),
  name_encrypted: z.string().nullable().optional(),
  name_iv: z.string().nullable().optional(),
  type: nodeTypeSchema,
  size_bytes: z.number(),
  mime_type: z.string().nullable().optional(),
  mime_type_encrypted: z.string().nullable().optional(),
  chunk_count: z.number(),
  status: nodeStatusSchema,
  deleted_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const decryptedNodeSchema = z.object({
  id: z.string().uuid(),
  parentId: z.string().uuid().nullable().optional(),
  name: z.string(),
  type: nodeTypeSchema,
  sizeBytes: z.number(),
  mimeType: z.string().optional(),
  chunkCount: z.number(),
  status: nodeStatusSchema,
  deletedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const chunkMetadataSchema = z.object({
  id: z.string().uuid(),
  chunk_index: z.number(),
  chunk_hash: z.string(),
  size_bytes: z.number(),
});

export const uploadQueueItemSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  fileSize: z.number(),
  progressPercentage: z.number(),
  currentChunk: z.number(),
  totalChunks: z.number(),
  status: z.enum(['pending', 'encrypting', 'uploading', 'completed', 'error']),
  errorMessage: z.string().optional(),
});

export type RawNode = z.infer<typeof rawNodeSchema>;
export type DecryptedNode = z.infer<typeof decryptedNodeSchema>;
export type ChunkMetadata = z.infer<typeof chunkMetadataSchema>;
export type UploadQueueItem = z.infer<typeof uploadQueueItemSchema>;
