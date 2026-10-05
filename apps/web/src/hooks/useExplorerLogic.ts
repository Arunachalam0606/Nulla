import { useEffect, useState, useCallback, useRef } from 'react';

import {
  encryptMetadata,
  decryptMetadata,
} from '@nulla/crypto';

import type { RawNode, DecryptedNode } from '@/schemas/node';

import { useAuthStore } from '@/stores/authStore';
import { useExplorerStore } from '@/stores/explorerStore';
import type { BreadcrumbItem } from '@/stores/explorerStore';

import {
  fetchDirectoryNodes,
  createFolderNode,
  softDeleteNode,
  uploadDirectFile,
} from '@/lib/api';
import { generateThumbnail } from '@/lib/thumbnail';
import { scanFileList } from '@/lib/directoryTraversal';
import type { ScannedFile } from '@/lib/directoryTraversal';

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
  const isE2eeVaultEnabled = useExplorerStore((state) => state.isE2eeVaultEnabled);

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
  const setIsE2eeVaultEnabled = useExplorerStore((state) => state.setIsE2eeVaultEnabled);
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
          let name = raw.name || '';
          if (!name && raw.name_encrypted && raw.name_iv) {
            name = await decryptMetadata(
              { ciphertext: raw.name_encrypted, iv: raw.name_iv },
              masterKey
            );
          }
          if (!name) {
            name = `File_${raw.id.slice(0, 8)}`;
          }

          let mimeType: string | undefined = raw.mime_type || undefined;
          if (!mimeType && raw.mime_type_encrypted && raw.name_iv) {
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

  const handleUploadFiles = async (
    files: FileList | File[] | ScannedFile[]
  ) => {
    if (!token || !masterKey || !masterKeyRaw) return;
    if (isUploadingRef.current) return;
    isUploadingRef.current = true;
    setUploadDrawerOpen(true);

    let items: ScannedFile[];
    if (Array.isArray(files) && files.length > 0 && 'relativePath' in files[0]) {
      items = files as ScannedFile[];
    } else {
      items = scanFileList(files as FileList | File[]);
    }

    const folderMap = new Map<string, string>(); // relativeFolderPath -> folderNodeId

    for (const item of items) {
      const { file, relativePath } = item;
      const uploadId = crypto.randomUUID();

      addUploadQueueItem({
        id: uploadId,
        fileName: file.name,
        fileSize: file.size,
        progressPercentage: 0,
        currentChunk: 1,
        totalChunks: 1,
        status: 'uploading',
      });

      try {
        // Resolve nested folder hierarchy if relativePath contains subdirectories
        let targetParentId = currentParentId;
        const segments = relativePath.split('/').filter(Boolean);

        if (segments.length > 1) {
          const dirSegments = segments.slice(0, -1);
          let accumulatedPath = '';
          let parentForSegment = currentParentId;

          for (const segment of dirSegments) {
            accumulatedPath = accumulatedPath ? `${accumulatedPath}/${segment}` : segment;

            if (folderMap.has(accumulatedPath)) {
              parentForSegment = folderMap.get(accumulatedPath)!;
            } else {
              const encDir = await encryptMetadata(segment, masterKey);
              const createdDir = await createFolderNode(
                token,
                parentForSegment,
                encDir.ciphertext,
                encDir.iv
              );

              folderMap.set(accumulatedPath, createdDir.id);

              if (parentForSegment === currentParentId) {
                const decryptedFolder: DecryptedNode = {
                  id: createdDir.id,
                  parentId: createdDir.parent_id,
                  name: segment,
                  type: 'folder',
                  sizeBytes: 0,
                  chunkCount: 0,
                  status: 'ready',
                  createdAt: createdDir.created_at,
                  updatedAt: createdDir.updated_at,
                };
                addNode(decryptedFolder);
              }

              parentForSegment = createdDir.id;
            }
          }
          targetParentId = parentForSegment;
        }

        // Generate instant 256x256 WebP thumbnail for media
        const thumbBlob = await generateThumbnail(file);

        // Direct Cloudflare R2 native stream upload (Helumi architecture)
        updateUploadQueueItem(uploadId, { status: 'uploading', progressPercentage: 10 });

        const rawResult = await uploadDirectFile(
          token,
          file,
          targetParentId,
          thumbBlob,
          (progress) => {
            updateUploadQueueItem(uploadId, {
              status: 'uploading',
              progressPercentage: progress,
            });
          }
        );

        updateUserUsage(file.size);

        updateUploadQueueItem(uploadId, {
          status: 'completed',
          progressPercentage: 100,
        });

        if (targetParentId === currentParentId) {
          const decryptedDirectNode: DecryptedNode = {
            id: rawResult.id,
            parentId: rawResult.parent_id,
            name: rawResult.name || file.name,
            type: 'file',
            sizeBytes: file.size,
            mimeType: file.type || 'application/octet-stream',
            chunkCount: 1,
            status: 'ready',
            createdAt: rawResult.created_at,
            updatedAt: rawResult.updated_at,
          };
          addNode(decryptedDirectNode);
        }
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
    isE2eeVaultEnabled,
    isLoading,
    error,
    setSelectedNodeId,
    setViewMode,
    setSearchQuery,
    setUploadDrawerOpen,
    setIsE2eeVaultEnabled,
    setPreviewNode,
    handleCreateFolder,
    handleNavigateToFolder,
    handleNavigateBreadcrumb,
    handleDeleteNode,
    handleUploadFiles,
    refreshDirectory: loadDirectory,
  };
}
