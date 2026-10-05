import { authResponseSchema } from '@/schemas/auth';
import {
  rawNodeSchema,
  chunkMetadataSchema,
} from '@/schemas/node';
import { deviceSchema } from '@/schemas/device';
import {
  shareSchema,
  publicShareResponseSchema,
  fileRequestSchema,
  publicFileRequestResponseSchema,
} from '@/schemas/share';
import { adminTelemetrySchema } from '@/schemas/admin';
import { z } from 'zod';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8787';

export async function fetchUserSalt(email: string): Promise<{ salt: string; registered: boolean }> {
  const response = await fetch(`${API_BASE_URL}/api/auth/salt?email=${encodeURIComponent(email)}`);
  if (!response.ok) {
    throw new Error('Failed to retrieve user salt');
  }
  return await response.json();
}

export async function registerAccount(payload: {
  email: string;
  salt: string;
  server_auth_key: string;
  device_name: string;
  device_type: 'mac' | 'web' | 'mobile';
}) {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  const parsed = authResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error((data as { error?: string }).error || 'Registration failed validation');
  }
  return parsed.data;
}

export async function loginAccount(payload: {
  email: string;
  server_auth_key: string;
  device_name: string;
  device_type: 'mac' | 'web' | 'mobile';
}) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  const parsed = authResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error((data as { error?: string }).error || 'Invalid credentials');
  }
  return parsed.data;
}

export async function fetchDirectoryNodes(
  token: string,
  parentId: string | null = null,
  includeDeleted = false
) {
  let url = `${API_BASE_URL}/api/nodes?`;
  if (parentId) url += `parent_id=${encodeURIComponent(parentId)}&`;
  if (includeDeleted) url += `include_deleted=true`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch directory nodes');
  }

  const data = (await response.json()) as { nodes: unknown[] };
  const parsed = z.array(rawNodeSchema).safeParse(data.nodes);
  if (!parsed.success) {
    throw new Error('Nodes list response failed schema validation');
  }
  return parsed.data;
}

export async function createFolderNode(
  token: string,
  parentId: string | null,
  nameEncrypted: string,
  nameIv: string
) {
  const response = await fetch(`${API_BASE_URL}/api/nodes/folder`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      parent_id: parentId,
      name_encrypted: nameEncrypted,
      name_iv: nameIv,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to create folder');
  }

  const data = (await response.json()) as { node: unknown };
  const parsed = rawNodeSchema.safeParse(data.node);
  if (!parsed.success) {
    throw new Error('Created folder failed schema validation');
  }
  return parsed.data;
}

export async function softDeleteNode(token: string, nodeId: string) {
  const response = await fetch(`${API_BASE_URL}/api/nodes/${nodeId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Failed to delete node');
  return await response.json();
}

export async function restoreNode(token: string, nodeId: string) {
  const response = await fetch(`${API_BASE_URL}/api/nodes/${nodeId}/restore`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Failed to restore node');
  return await response.json();
}

export async function permanentDeleteNode(token: string, nodeId: string) {
  const response = await fetch(`${API_BASE_URL}/api/nodes/${nodeId}/permanent`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Failed to permanently delete node');
  return await response.json();
}

export async function initUploadSession(
  token: string,
  spec: {
    parent_id: string | null;
    name_encrypted: string;
    name_iv: string;
    size_bytes: number;
    mime_type_encrypted?: string;
    total_chunks: number;
  }
) {
  const response = await fetch(`${API_BASE_URL}/api/upload/chunk/init`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(spec),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error((err as { error?: string }).error || 'Failed to initialize upload session');
  }

  return (await response.json()) as {
    session_id: string;
    node_id: string;
    chunk_size_bytes: number;
    total_chunks: number;
  };
}

export async function uploadChunkBinary(
  token: string,
  sessionId: string,
  chunkIndex: number,
  chunkData: Uint8Array
) {
  const response = await fetch(
    `${API_BASE_URL}/api/upload/chunk/${sessionId}/${chunkIndex}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
      },
      body: chunkData as BodyInit,
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to upload chunk ${chunkIndex}`);
  }

  return await response.json();
}

export async function completeUploadSession(token: string, sessionId: string) {
  const response = await fetch(`${API_BASE_URL}/api/upload/chunk/complete`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ session_id: sessionId }),
  });

  if (!response.ok) {
    throw new Error('Failed to commit uploaded node');
  }

  const data = (await response.json()) as { node: unknown };
  const parsed = rawNodeSchema.safeParse(data.node);
  if (!parsed.success) {
    throw new Error('Committed node failed validation');
  }
  return parsed.data;
}

export async function fetchNodeChunks(token: string, nodeId: string) {
  const response = await fetch(`${API_BASE_URL}/api/nodes/${nodeId}/chunks`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw new Error('Failed to fetch node chunks');
  const data = (await response.json()) as { chunks: unknown[] };
  const parsed = z.array(chunkMetadataSchema).safeParse(data.chunks);
  if (!parsed.success) throw new Error('Chunks failed schema validation');
  return parsed.data;
}

export async function streamChunkBytes(chunkId: string, rangeHeader?: string): Promise<ArrayBuffer> {
  const headers: HeadersInit = {};
  if (rangeHeader) {
    headers['Range'] = rangeHeader;
  }

  const response = await fetch(`${API_BASE_URL}/api/stream/${chunkId}`, { headers });
  if (!response.ok && response.status !== 206) {
    throw new Error(`Failed to stream chunk: HTTP ${response.status}`);
  }

  return await response.arrayBuffer();
}

export async function fetchActiveDevices(token: string) {
  const response = await fetch(`${API_BASE_URL}/api/devices`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw new Error('Failed to fetch devices');
  const data = (await response.json()) as { devices: unknown[] };
  const parsed = z.array(deviceSchema).safeParse(data.devices);
  if (!parsed.success) throw new Error('Devices response failed schema validation');
  return parsed.data;
}

export async function revokeDeviceSession(token: string, deviceId: string) {
  const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/revoke`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Failed to revoke device session');
  return await response.json();
}

export async function createShareLink(
  token: string,
  nodeId: string,
  permission: 'view' | 'download',
  expiresInDays?: number
) {
  const response = await fetch(`${API_BASE_URL}/api/shares`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      node_id: nodeId,
      permission,
      expires_in_days: expiresInDays,
    }),
  });

  if (!response.ok) throw new Error('Failed to create share link');
  const data = await response.json();
  const parsed = shareSchema.safeParse(data);
  if (!parsed.success) throw new Error('Share link failed validation');
  return parsed.data;
}

export async function fetchPublicShareDetails(shareToken: string) {
  const response = await fetch(`${API_BASE_URL}/api/shares/${shareToken}`);
  if (!response.ok) throw new Error('Share link invalid or expired');
  const data = await response.json();
  const parsed = publicShareResponseSchema.safeParse(data);
  if (!parsed.success) throw new Error('Public share failed validation');
  return parsed.data;
}

export async function createFileRequestTarget(
  token: string,
  targetFolderId: string | null,
  titleEncrypted: string,
  titleIv: string
) {
  const response = await fetch(`${API_BASE_URL}/api/requests`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      target_folder_id: targetFolderId,
      title_encrypted: titleEncrypted,
      title_iv: titleIv,
    }),
  });

  if (!response.ok) throw new Error('Failed to create file request drop');
  const data = await response.json();
  const parsed = fileRequestSchema.safeParse(data);
  if (!parsed.success) throw new Error('File request failed validation');
  return parsed.data;
}

export async function fetchPublicFileRequest(requestToken: string) {
  const response = await fetch(`${API_BASE_URL}/api/requests/${requestToken}`);
  if (!response.ok) throw new Error('File request not found or expired');
  const data = await response.json();
  const parsed = publicFileRequestResponseSchema.safeParse(data);
  if (!parsed.success) throw new Error('Public file request failed validation');
  return parsed.data;
}

export async function fetchAdminTelemetryData(token?: string, adminKey?: string) {
  const headers: HeadersInit = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (adminKey) headers['X-Admin-Key'] = adminKey;

  const response = await fetch(`${API_BASE_URL}/api/admin/metrics`, { headers });
  if (!response.ok) throw new Error('Failed to fetch admin telemetry');

  const data = await response.json();
  const parsed = adminTelemetrySchema.safeParse(data);
  if (!parsed.success) throw new Error('Admin telemetry response failed validation');
  return parsed.data;
}
