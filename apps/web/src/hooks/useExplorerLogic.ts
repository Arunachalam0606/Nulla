import { useEffect, useState, useCallback, useRef } from 'react';

import {
  encryptMetadata,
  decryptMetadata,
  encryptChunk,
  calculateChunkCount,
  CHUNK_SIZE,
} from '@nulla/crypto';

import type { RawNode, DecryptedNode } from '@/schemas/node';

import { useAuthStore } from '@/stores/authStore';
import { useExplorerStore } from '@/stores/explorerStore';
import type { BreadcrumbItem } from '@/stores/explorerStore';

import {
  fetchDirectoryNodes,
  createFolderNode,
  softDeleteNode,
  initUploadSession,
  uploadChunkBinary,
  completeUploadSession,
} from '@/lib/api';

export function useExplorerLogic() {
  const token = useAuthStore((state) => state.token);
  const masterKey = useAuthStore((state) => state.masterKey);
  const masterKeyRaw = useAuthStore((state) => state.masterKeyRaw);
  const updateUserUsage = useAuthStore((state) => state.updateUserUsage);

  const currentParentId = useExplorerStore((state) => state.currentParentId);
  const breadcrumbs = useExplorerStore((state) => state.breadcrumbs);
  const nodes = useExplorerStore((state) => state.nodes);
  const selectedNodeId = useExplorerStore((state) => state.selectedNodeId);
  const viewMode = useExplorerStore((state) => state.viewMode);
  const searchQuery = useExplorerStore((state) => state.searchQuery);
  const isUploadDrawerOpen = useExplorerStore((state) => state.isUploadDrawerOpen);
  const uploadQueue = useExplorerStore((state) => state.uploadQueue);
  const previewNode = useExplorerStore((state) => state.previewNode);

  const setCurrentParentId = useExplorerStore((state) => state.setCurrentParentId);
  const setBreadcrumbs = useExplorerStore((state) => state.setBreadcrumbs);
  const pushBreadcrumb = useExplorerStore((state) => state.pushBreadcrumb);
  const setNodes = useExplorerStore((state) => state.setNodes);
  const addNode = useExplorerStore((state) => state.addNode);
  const removeNode = useExplorerStore((state) => state.removeNode);
  const setSelectedNodeId = useExplorerStore((state) => state.setSelectedNodeId);
  const setViewMode = useExplorerStore((state) => state.setViewMode);
  const setSearchQuery = useExplorerStore((state) => state.setSearchQuery);
  const setUploadDrawerOpen = useExplorerStore((state) => state.setUploadDrawerOpen);
  const addUploadQueueItem = useExplorerStore((state) => state.addUploadQueueItem);
  const updateUploadQueueItem = useExplorerStore((state) => state.updateUploadQueueItem);
  const setPreviewNode = useExplorerStore((state) => state.setPreviewNode);

  const isUploadingRef = useRef(false);

  const defaultIsLoading = false;
  const defaultError = '';
  const [isLoading, setIsLoading] = useState(defaultIsLoading);
  const [error, setError] = useState(defaultError);

  const decryptRawNodes = useCallback(
    async (rawNodes: RawNode[]): Promise<DecryptedNode[]> => {
      if (!masterKey) return [];

      const decryptedPromises = rawNodes.map(async (raw) => {
        try {
          const name = await decryptMetadata(
            { ciphertext: raw.name_encrypted, iv: raw.name_iv },
            masterKey
          );

          let mimeType: string | undefined = undefined;
          if (raw.mime_type_encrypted) {
            try {
              mimeType = await decryptMetadata(
                { ciphertext: raw.mime_type_encrypted, iv: raw.name_iv },
                masterKey
              );
            } catch {
              mimeType = 'application/octet-stream';
            }
          }

          return {
            id: raw.id,
            parentId: raw.parent_id,
            name,
            type: raw.type,
            sizeBytes: raw.size_bytes,
            mimeType,
            chunkCount: raw.chunk_count,
            status: raw.status,
            deletedAt: raw.deleted_at,
            createdAt: raw.created_at,
            updatedAt: raw.updated_at,
          } satisfies DecryptedNode;
        } catch {
          return {
            id: raw.id,
            parentId: raw.parent_id,
            name: `[Encrypted: ${raw.id.substring(0, 8)}]`,
            type: raw.type,
            sizeBytes: raw.size_bytes,
            chunkCount: raw.chunk_count,
            status: raw.status,
            deletedAt: raw.deleted_at,
            createdAt: raw.created_at,
            updatedAt: raw.updated_at,
          } satisfies DecryptedNode;
        }
      });

      return await Promise.all(decryptedPromises);
    },
    [masterKey]
  );

  const loadDirectory = useCallback(async () => {
    if (!token || !masterKey) return;

    setIsLoading(true);
    setError('');

    try {
      const rawNodes = await fetchDirectoryNodes(token, currentParentId);
      const decrypted = await decryptRawNodes(rawNodes);
      setNodes(decrypted);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load directory';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [token, masterKey, currentParentId, decryptRawNodes, setNodes]);

  const handleCreateFolder = async (folderName: string) => {
    if (!token || !masterKey || !folderName.trim()) return;

    try {
      const encrypted = await encryptMetadata(folderName.trim(), masterKey);
      const rawFolder = await createFolderNode(
        token,
        currentParentId,
        encrypted.ciphertext,
        encrypted.iv
      );

      const decrypted: DecryptedNode = {
        id: rawFolder.id,
        parentId: rawFolder.parent_id,
        name: folderName.trim(),
        type: 'folder',
        sizeBytes: 0,
        chunkCount: 0,
        status: 'ready',
        createdAt: rawFolder.created_at,
        updatedAt: rawFolder.updated_at,
      };

      addNode(decrypted);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create folder';
      setError(message);
    }
  };

  const handleNavigateToFolder = (folder: DecryptedNode) => {
    setCurrentParentId(folder.id);
    pushBreadcrumb({ id: folder.id, name: folder.name });
  };

  const handleNavigateBreadcrumb = (item: BreadcrumbItem, index: number) => {
    setCurrentParentId(item.id);
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
  };

  const handleDeleteNode = async (nodeId: string) => {
    if (!token) return;

    try {
      await softDeleteNode(token, nodeId);
      removeNode(nodeId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete node';
      setError(message);
    }
  };

  const handleUploadFiles = async (files: FileList | File[]) => {
    if (!token || !masterKey || !masterKeyRaw) return;
    if (isUploadingRef.current) return;
    isUploadingRef.current = true;
    setUploadDrawerOpen(true);

    const fileArray = Array.from(files);

    for (const file of fileArray) {
      const uploadId = crypto.randomUUID();
      const totalChunks = calculateChunkCount(file.size);

      addUploadQueueItem({
        id: uploadId,
        fileName: file.name,
        fileSize: file.size,
        progressPercentage: 0,
        currentChunk: 0,
        totalChunks,
        status: 'encrypting',
      });

      try {
        const encName = await encryptMetadata(file.name, masterKey);
        const encMime = file.type ? await encryptMetadata(file.type, masterKey) : undefined;

        const session = await initUploadSession(token, {
          parent_id: currentParentId,
          name_encrypted: encName.ciphertext,
          name_iv: encName.iv,
          size_bytes: file.size,
          mime_type_encrypted: encMime?.ciphertext,
          total_chunks: totalChunks,
        });

        updateUploadQueueItem(uploadId, { status: 'uploading' });

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
          const startByte = chunkIndex * CHUNK_SIZE;
          const endByte = Math.min(startByte + CHUNK_SIZE, file.size);
          const chunkBlob = file.slice(startByte, endByte);
          const arrayBuffer = await chunkBlob.arrayBuffer();
          const plaintextBytes = new Uint8Array(arrayBuffer);

          const encryptedChunk = await encryptChunk(
            masterKey,
            masterKeyRaw,
            chunkIndex,
            plaintextBytes
          );

          await uploadChunkBinary(
            token,
            session.session_id,
            chunkIndex,
            encryptedChunk.data
          );

          const progress = Math.round(((chunkIndex + 1) / totalChunks) * 100);
          updateUploadQueueItem(uploadId, {
            currentChunk: chunkIndex + 1,
            progressPercentage: progress,
          });
        }

        const committed = await completeUploadSession(token, session.session_id);
        updateUserUsage(file.size);

        updateUploadQueueItem(uploadId, {
          status: 'completed',
          progressPercentage: 100,
        });

        const decryptedCommitted: DecryptedNode = {
          id: committed.id,
          parentId: committed.parent_id,
          name: file.name,
          type: 'file',
          sizeBytes: file.size,
          mimeType: file.type || 'application/octet-stream',
          chunkCount: totalChunks,
          status: 'ready',
          createdAt: committed.created_at,
          updatedAt: committed.updated_at,
        };

        addNode(decryptedCommitted);
      } catch (uploadErr: unknown) {
        const errorMsg = uploadErr instanceof Error ? uploadErr.message : 'Upload failed';
        updateUploadQueueItem(uploadId, {
          status: 'error',
          errorMessage: errorMsg,
        });
      }
    }

    isUploadingRef.current = false;
  };

  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);

  return {
    nodes,
    breadcrumbs,
    currentParentId,
    selectedNodeId,
    viewMode,
    searchQuery,
    isUploadDrawerOpen,
    uploadQueue,
    previewNode,
    isLoading,
    error,
    setSelectedNodeId,
    setViewMode,
    setSearchQuery,
    setUploadDrawerOpen,
    setPreviewNode,
    handleCreateFolder,
    handleNavigateToFolder,
    handleNavigateBreadcrumb,
    handleDeleteNode,
    handleUploadFiles,
    refreshDirectory: loadDirectory,
  };
}
