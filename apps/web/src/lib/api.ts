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

export async function requestPasswordReset(email: string): Promise<{ success: boolean; message: string; reset_token?: string; reset_url?: string }> {
  const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || 'Failed to request password reset');
  }
  return data;
}

export async function completePasswordReset(payload: {
  token: string;
  new_server_auth_key: string;
  new_salt: string;
}): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || 'Failed to reset password');
  }
  return data;
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

export async function createNodeRecord(
  token: string,
  payload: {
    name: string;
    parent_id: string | null;
    mime_type?: string;
    size_bytes?: number;
    name_encrypted?: string;
    name_iv?: string;
  }
) {
  const response = await fetch(`${API_BASE_URL}/api/nodes`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Failed to create file record (HTTP ${response.status})`);
  }

  const data = await response.json();
  const parsed = rawNodeSchema.safeParse(data.node);
  if (!parsed.success) {
    throw new Error('Created node failed validation');
  }
  return parsed.data;
}

export function uploadNodeBinaryContent(
  token: string,
  nodeId: string,
  file: File | Blob,
  onProgress?: (percentage: number) => void
): Promise<{ success: boolean; size: number }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `${API_BASE_URL}/api/nodes/${nodeId}/content`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        // Map upload progress from 10% to 100%
        const percent = Math.round((event.loaded / event.total) * 90) + 10;
        onProgress(Math.min(99, percent));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (onProgress) onProgress(100);
          resolve(res);
        } catch {
          resolve({ success: true, size: file.size });
        }
      } else {
        try {
          const res = JSON.parse(xhr.responseText);
          reject(new Error(res.error || `Upload failed with HTTP ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed with HTTP ${xhr.status}: ${xhr.statusText}`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during R2 stream upload'));
    };

    xhr.ontimeout = () => {
      reject(new Error('R2 stream upload timed out'));
    };

    xhr.send(file);
  });
}

export async function initMultipartUpload(token: string, nodeId: string, mimeType?: string) {
  const response = await fetch(`${API_BASE_URL}/api/upload/multipart/init`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ node_id: nodeId, mime_type: mimeType }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to initialize multipart upload');
  }

  return (await response.json()) as { uploadId: string; key: string };
}

export function uploadMultipartPart(
  token: string,
  uploadId: string,
  key: string,
  partNumber: number,
  chunk: Blob,
  onProgress?: (loaded: number) => void
): Promise<{ etag: string; partNumber: number }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const query = new URLSearchParams({
      uploadId,
      key,
      partNumber: String(partNumber),
    });

    xhr.open('PUT', `${API_BASE_URL}/api/upload/multipart/part?${query.toString()}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(event.loaded);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          resolve(res);
        } catch {
          reject(new Error('Invalid JSON response from multipart part upload'));
        }
      } else {
        try {
          const res = JSON.parse(xhr.responseText);
          reject(new Error(res.error || `Part ${partNumber} failed with HTTP ${xhr.status}`));
        } catch {
          reject(new Error(`Part ${partNumber} failed with HTTP ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error(`Network error uploading part ${partNumber}`));
    xhr.ontimeout = () => reject(new Error(`Timeout uploading part ${partNumber}`));
    xhr.send(chunk);
  });
}

export async function completeMultipartUpload(
  token: string,
  uploadId: string,
  key: string,
  parts: Array<{ etag: string; partNumber: number }>,
  nodeId: string,
  sizeBytes: number
) {
  const response = await fetch(`${API_BASE_URL}/api/upload/multipart/complete`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      uploadId,
      key,
      parts,
      node_id: nodeId,
      size_bytes: sizeBytes,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to complete multipart upload');
  }

  return await response.json();
}

export async function uploadDirectFile(
  token: string,
  file: File,
  parentId: string | null = null,
  thumbnailBlob?: Blob | null,
  onProgress?: (percentage: number) => void
) {
  // 1. Create node in D1 (sets progress to 5%)
  if (onProgress) onProgress(5);
  const node = await createNodeRecord(token, {
    name: file.name,
    parent_id: parentId,
    mime_type: file.type || 'application/octet-stream',
    size_bytes: file.size,
  });

  // 2. Decide between single-request streaming (<= 50 MB) and R2 multipart (> 50 MB)
  const MULTIPART_THRESHOLD = 50 * 1024 * 1024; // 50 MB
  if (file.size <= MULTIPART_THRESHOLD) {
    await uploadNodeBinaryContent(token, node.id, file, onProgress);
  } else {
    // 3. R2 Multipart for Large Files (e.g. 459.9 MB movie)
    const PART_SIZE = 10 * 1024 * 1024; // 10 MB per part
    const totalParts = Math.ceil(file.size / PART_SIZE);

    if (onProgress) onProgress(8);
    const { uploadId, key } = await initMultipartUpload(token, node.id, file.type);

    const parts: Array<{ etag: string; partNumber: number }> = [];
    const partLoadedMap = new Map<number, number>();

    const updateOverallProgress = () => {
      if (!onProgress) return;
      let totalLoaded = 0;
      partLoadedMap.forEach((bytes) => {
        totalLoaded += bytes;
      });
      const percentage = Math.min(95, Math.round((totalLoaded / file.size) * 85) + 10);
      onProgress(percentage);
    };

    // Concurrency pool with 3 parallel workers
    const concurrency = 3;
    const partIndices: number[] = [];
    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      partIndices.push(partNumber);
    }

    let currentIndex = 0;
    const worker = async () => {
      while (currentIndex < partIndices.length) {
        const partNumber = partIndices[currentIndex++];
        const start = (partNumber - 1) * PART_SIZE;
        const end = Math.min(start + PART_SIZE, file.size);
        const chunkBlob = file.slice(start, end);

        const result = await uploadMultipartPart(
          token,
          uploadId,
          key,
          partNumber,
          chunkBlob,
          (loaded) => {
            partLoadedMap.set(partNumber, loaded);
            updateOverallProgress();
          }
        );

        partLoadedMap.set(partNumber, chunkBlob.size);
        updateOverallProgress();
        parts.push(result);
      }
    };

    const workers: Promise<void>[] = [];
    for (let i = 0; i < Math.min(concurrency, totalParts); i++) {
      workers.push(worker());
    }
    await Promise.all(workers);

    // Sort parts by partNumber ascending before completing
    parts.sort((a, b) => a.partNumber - b.partNumber);

    if (onProgress) onProgress(98);
    await completeMultipartUpload(token, uploadId, key, parts, node.id, file.size);
    if (onProgress) onProgress(100);
  }

  // Optional: Upload generated WebP thumbnail if available
  if (thumbnailBlob) {
    uploadNodeThumbnail(token, node.id, thumbnailBlob).catch(() => {});
  }

  return {
    ...node,
    size_bytes: file.size,
    status: 'ready' as const,
  };
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

export async function uploadNodeThumbnail(token: string, nodeId: string, thumbnail: Blob): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/nodes/${nodeId}/thumbnail`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'image/webp',
      },
      body: thumbnail,
    });
    return response.ok;
  } catch {
    return false;
  }
}
