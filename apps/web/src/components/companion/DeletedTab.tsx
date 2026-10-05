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
}

export const DeletedTab = (props: DeletedTabProps) => {
  const { trashNodes, isLoading, onRestore, onPurge } = props;

  return (
    <section className="flex flex-col gap-6 max-w-4xl w-full">
      <div className="bg-[#0e0e0e] border border-[#222222] p-4 rounded-xl flex items-center gap-3 text-xs text-[#888888]">
        <InfoIcon size={18} className="text-white shrink-0" />

        <span>
          Deleted files are protected by a 30-day retention window. Restoring immediately remounts the file in your macOS Finder volume at 0 physical bytes.
        </span>
      </div>

      <div className="border border-[#1e1e1e] rounded-2xl bg-[#0a0a0a] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-[#181818] flex items-center justify-between">
          <h3 className="text-xs font-semibold text-white font-mono uppercase tracking-wider">
            <span>Deleted Files (30-Day Recovery)</span>
          </h3>

          <span className="text-xs font-mono text-[#71717a]">
            {trashNodes.length} {trashNodes.length === 1 ? 'file' : 'files'}
          </span>
        </div>

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
          <div className="divide-y divide-[#161616]">
            {trashNodes.map((node) => (
              <div
                key={node.id}
                className="p-4 flex items-center justify-between hover:bg-[#0d0d0d] transition-colors"
              >
                <div>
                  <span className="text-xs font-medium text-white">{node.name}</span>

                  <div className="flex items-center gap-3 text-[11px] text-[#71717a] font-mono mt-1">
                    <span>{formatBytes(node.sizeBytes)}</span>

                    <span>•</span>

                    <span>Deleted: {node.deletedAt ? formatRelativeDate(node.deletedAt) : 'recently'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onRestore(node.id)}
                    className="flex items-center gap-1.5 bg-[#141414] hover:bg-[#1f1f1f] border border-[#262626] text-xs text-white px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <ArrowCounterClockwiseIcon size={14} />

                    <span>Restore</span>
                  </button>

                  <button
                    onClick={() => onPurge(node.id)}
                    className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 border border-red-950 hover:bg-red-950/30 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <XCircleIcon size={14} />

                    <span>Purge from R2</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
