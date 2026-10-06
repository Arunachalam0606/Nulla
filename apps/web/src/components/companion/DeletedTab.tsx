import { useState } from 'react';

import type { DecryptedNode } from '@/schemas/node';

import { formatBytes, formatRelativeDate } from '@/lib/utils';

import {
  TrashIcon,
  ArrowCounterClockwiseIcon,
  XCircleIcon,
  CircleNotchIcon,
  InfoIcon,
} from '@phosphor-icons/react';

interface DeletedTabProps {
  trashNodes: DecryptedNode[];
  isLoading: boolean;
  onRestore: (nodeId: string) => void;
  onPurge: (nodeId: string) => void;
  onPurgeBulk?: (nodeIds: string[]) => Promise<void> | void;
  onPurgeAll?: () => Promise<void> | void;
}

export const DeletedTab = (props: DeletedTabProps) => {
  const {
    trashNodes,
    isLoading,
    onRestore,
    onPurge,
    onPurgeBulk,
    onPurgeAll,
  } = props;

  const defaultSelectedNodeIds: string[] = [];
  const defaultIsPurging = false;

  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>(defaultSelectedNodeIds);
  const [isPurging, setIsPurging] = useState(defaultIsPurging);

  const isAllSelected = trashNodes.length > 0 && selectedNodeIds.length === trashNodes.length;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedNodeIds([]);
    } else {
      setSelectedNodeIds(trashNodes.map((n) => n.id));
    }
  };

  const handleToggleNode = (nodeId: string) => {
    setSelectedNodeIds((previous) =>
      previous.includes(nodeId)
        ? previous.filter((id) => id !== nodeId)
        : [...previous, nodeId]
    );
  };

  const handlePurgeSelectedClick = async () => {
    if (selectedNodeIds.length === 0 || !onPurgeBulk) return;
    setIsPurging(true);
    try {
      await onPurgeBulk(selectedNodeIds);
      setSelectedNodeIds([]);
    } finally {
      setIsPurging(false);
    }
  };

  const handleEmptyTrashClick = async () => {
    if (!onPurgeAll || trashNodes.length === 0) return;
    setIsPurging(true);
    try {
      await onPurgeAll();
      setSelectedNodeIds([]);
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <section className="flex flex-col gap-6 max-w-4xl w-full">
      <div className="bg-white dark:bg-[#1c1c1f] border border-black/5 dark:border-white/10 p-4 rounded-2xl shadow-sm flex items-center gap-3 text-xs text-neutral-600 dark:text-neutral-300">
        <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-[#28282d] flex items-center justify-center text-neutral-900 dark:text-white shrink-0">
          <InfoIcon size={16} />
        </div>

        <span>
          Deleted files are protected by a 30-day retention window. Restoring immediately remounts the file in your macOS Finder volume at 0 physical bytes.
        </span>
      </div>

      <div className="border border-black/5 dark:border-white/10 rounded-2xl bg-white dark:bg-[#1c1c1f] shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-black/5 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {trashNodes.length > 0 && (
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={handleToggleSelectAll}
                className="w-4 h-4 rounded border-black/20 dark:border-white/20 text-neutral-900 focus:ring-0 cursor-pointer"
                title="Select all deleted files"
              />
            )}

            <h3 className="text-xs font-semibold text-neutral-900 dark:text-white font-mono uppercase tracking-wider">
              <span>Deleted Files (30-Day Recovery)</span>
            </h3>

            <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-black/20 px-2.5 py-0.5 rounded-full border border-black/5 dark:border-white/10">
              {trashNodes.length} {trashNodes.length === 1 ? 'file' : 'files'}
            </span>
          </div>

          {trashNodes.length > 0 && (
            <div className="flex items-center gap-2">
              {onPurgeBulk && (
                <button
                  disabled={selectedNodeIds.length === 0 || isPurging}
                  onClick={handlePurgeSelectedClick}
                  className={`flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-full transition-all font-medium border ${
                    selectedNodeIds.length > 0 && !isPurging
                      ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 border-red-200 dark:border-red-900 shadow-sm hover:bg-red-100 cursor-pointer'
                      : 'opacity-40 border-black/5 dark:border-white/5 text-neutral-400 cursor-not-allowed'
                  }`}
                >
                  <TrashIcon size={13} />

                  <span>
                    Purge Selected {selectedNodeIds.length > 0 ? `(${selectedNodeIds.length})` : ''}
                  </span>
                </button>
              )}

              {onPurgeAll && (
                <button
                  disabled={isPurging}
                  onClick={handleEmptyTrashClick}
                  className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 border border-red-200 dark:border-red-950/60 hover:bg-red-50 dark:hover:bg-red-950/30 px-3.5 py-1.5 rounded-full transition-colors font-medium shadow-sm"
                >
                  <XCircleIcon size={14} />

                  <span>Empty Trash</span>
                </button>
              )}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
            <CircleNotchIcon size={24} className="animate-spin text-neutral-900 dark:text-white mb-2" />

            <span className="text-xs font-mono">Loading deleted nodes...</span>
          </div>
        ) : trashNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-12 h-12 rounded-full border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-800/50 flex items-center justify-center text-neutral-400 mb-3 shadow-inner">
              <TrashIcon size={20} />
            </div>

            <p className="text-sm text-neutral-700 dark:text-neutral-300 font-medium">
              <span>Trash is empty</span>
            </p>

            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
              <span>No soft-deleted files awaiting purging or recovery.</span>
            </p>
          </div>
        ) : (
          <div className="divide-y divide-black/5 dark:divide-white/5">
            {trashNodes.map((node) => {
              const isChecked = selectedNodeIds.includes(node.id);

              return (
                <div
                  key={node.id}
                  className={`p-4 sm:p-5 flex items-center justify-between transition-colors ${
                    isChecked
                      ? 'bg-neutral-50 dark:bg-white/[0.04]'
                      : 'hover:bg-neutral-50/50 dark:hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleNode(node.id)}
                      className="w-4 h-4 rounded border-black/20 dark:border-white/20 text-neutral-900 focus:ring-0 cursor-pointer"
                    />

                    <div>
                      <span className="text-xs font-medium text-neutral-900 dark:text-white">{node.name}</span>

                      <div className="flex items-center gap-3 text-[11px] text-neutral-500 dark:text-neutral-400 font-mono mt-1">
                        <span>{formatBytes(node.sizeBytes)}</span>

                        <span>•</span>

                        <span>Deleted: {node.deletedAt ? formatRelativeDate(node.deletedAt) : 'recently'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onRestore(node.id)}
                      className="flex items-center gap-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 text-xs px-3.5 py-1.5 rounded-full transition-all font-medium shadow-sm"
                    >
                      <ArrowCounterClockwiseIcon size={14} />

                      <span>Restore</span>
                    </button>

                    <button
                      onClick={() => onPurge(node.id)}
                      className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 border border-red-200 dark:border-red-950/60 hover:bg-red-50 dark:hover:bg-red-950/30 px-3.5 py-1.5 rounded-full transition-colors font-medium"
                    >
                      <XCircleIcon size={14} />

                      <span>Purge</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
