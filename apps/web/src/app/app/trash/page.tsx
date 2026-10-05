'use client';

import { useEffect, useState, useCallback } from 'react';

import { decryptMetadata } from '@nulla/crypto';

import type { DecryptedNode, RawNode } from '@/schemas/node';

import { useAuthStore } from '@/stores/authStore';

import { Header } from '@/components/common/Header';
import { Sidebar } from '@/components/common/Sidebar';

import {
  fetchDirectoryNodes,
  restoreNode,
  permanentDeleteNode,
} from '@/lib/api';
import { formatBytes, formatRelativeDate } from '@/lib/utils';

import {
  TrashIcon,
  ArrowCounterClockwiseIcon,
  XCircleIcon,
  CircleNotchIcon,
  InfoIcon,
} from '@phosphor-icons/react';

export default function TrashPage() {
  const token = useAuthStore((state) => state.token);
  const masterKey = useAuthStore((state) => state.masterKey);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const defaultNodes: DecryptedNode[] = [];
  const defaultIsLoading = false;
  const defaultError = '';

  const [trashNodes, setTrashNodes] = useState<DecryptedNode[]>(defaultNodes);
  const [isLoading, setIsLoading] = useState(defaultIsLoading);
  const [error, setError] = useState(defaultError);

  const loadTrash = useCallback(async () => {
    if (!token || !masterKey) return;
    setIsLoading(true);
    setError('');

    try {
      const rawNodes = await fetchDirectoryNodes(token, null, true);
      const decrypted = await Promise.all(
        rawNodes.map(async (raw: RawNode) => {
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
            return {
              id: raw.id,
              parentId: raw.parent_id,
              name,
              type: raw.type,
              sizeBytes: raw.size_bytes,
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
        })
      );

      setTrashNodes(decrypted);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load trash';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [token, masterKey]);

  const handleRestore = async (id: string) => {
    if (!token) return;
    try {
      await restoreNode(token, id);
      setTrashNodes(trashNodes.filter((n) => n.id !== id));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to restore file';
      setError(message);
    }
  };

  const handlePermanentDelete = async (id: string) => {
    if (!token) return;
    try {
      await permanentDeleteNode(token, id);
      setTrashNodes(trashNodes.filter((n) => n.id !== id));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to permanently delete';
      setError(message);
    }
  };

  useEffect(() => {
    loadTrash();
  }, [loadTrash]);

  if (!isAuthenticated) return null;

  return (
    <section className="min-h-screen bg-[#050505] flex flex-col">
      <Header />

      <div className="flex-1 flex">
        <Sidebar />

        <div className="flex-1 flex flex-col p-8 min-h-[calc(100vh-3.5rem)] overflow-y-auto max-w-5xl">
          <div className="border-b border-[#1b1b1b] pb-4 mb-6">
            <h1 className="text-xl font-bold tracking-tight text-white">
              <span>Trash (30-Day Recovery Retention)</span>
            </h1>

            <p className="text-xs text-[#71717a] mt-1">
              <span>
                Deleted files remain encrypted in the retention window. Permanently deleting purges R2 blocks from physical storage.
              </span>
            </p>
          </div>

          <div className="bg-[#0e0e0e] border border-[#222222] p-3.5 rounded-lg flex items-center gap-3 mb-6 text-xs text-[#888888]">
            <InfoIcon size={18} className="text-white shrink-0" />

            <span>
              Restoring a file immediately remounts it in your macOS Finder volume at 0 physical bytes.
            </span>
          </div>

          {error && (
            <div className="p-3 mb-4 bg-red-950/30 border border-red-900/50 rounded-lg text-xs text-red-400">
              <span>{error}</span>
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-[#666666]">
              <CircleNotchIcon size={24} className="animate-spin text-white mb-2" />

              <span className="text-xs font-mono">Loading deleted nodes...</span>
            </div>
          ) : trashNodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-12 h-12 rounded-full border border-[#222222] bg-[#0c0c0c] flex items-center justify-center text-[#555555] mb-3">
                <TrashIcon size={20} />
              </div>

              <p className="text-sm text-[#888888] font-medium">
                <span>Trash is empty</span>
              </p>

              <p className="text-xs text-[#555555] mt-1">
                <span>No soft-deleted files awaiting purging or recovery.</span>
              </p>
            </div>
          ) : (
            <div className="border border-[#1f1f1f] rounded-xl overflow-hidden bg-[#0a0a0a] divide-y divide-[#161616]">
              {trashNodes.map((node) => {
                return (
                  <div
                    key={node.id}
                    className="p-4 flex items-center justify-between hover:bg-[#0f0f0f] transition-colors"
                  >
                    <div>
                      <span className="text-xs font-medium text-white">{node.name}</span>

                      <div className="flex items-center gap-3 text-[11px] text-[#71717a] font-mono mt-1">
                        <span>{formatBytes(node.sizeBytes)}</span>

                        <span>•</span>

                        <span>Deleted: {node.deletedAt ? formatRelativeDate(node.deletedAt) : 'recently'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleRestore(node.id)}
                        className="flex items-center gap-1.5 bg-[#141414] hover:bg-[#1f1f1f] border border-[#262626] text-xs text-white px-3 py-1.5 rounded-md transition-colors"
                      >
                        <ArrowCounterClockwiseIcon size={14} />

                        <span>Restore</span>
                      </button>

                      <button
                        onClick={() => handlePermanentDelete(node.id)}
                        className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 border border-red-950 hover:bg-red-950/30 px-3 py-1.5 rounded-md transition-colors"
                      >
                        <XCircleIcon size={14} />

                        <span>Purge from R2</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
