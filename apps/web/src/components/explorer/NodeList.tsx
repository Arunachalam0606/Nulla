import type { DecryptedNode } from '@/schemas/node';

import { NodeCard } from '@/components/explorer/NodeCard';

import { formatBytes } from '@/lib/utils';

import {
  FolderIcon,
  FileIcon,
  VideoCameraIcon,
  ImageIcon,
  FileTextIcon,
  MusicNotesIcon,
  TrashIcon,
  ShareNetworkIcon,
  EyeIcon,
  CloudCheckIcon,
} from '@phosphor-icons/react';

interface NodeListProps {
  nodes: DecryptedNode[];
  viewMode: 'grid' | 'list';
  searchQuery: string;
  onNavigateToFolder: (folder: DecryptedNode) => void;
  onPreviewFile: (file: DecryptedNode) => void;
  onDeleteNode: (nodeId: string) => void;
  onShareNode: (file: DecryptedNode) => void;
}

export const NodeList = (props: NodeListProps) => {
  const {
    nodes,
    viewMode,
    searchQuery,
    onNavigateToFolder,
    onPreviewFile,
    onDeleteNode,
    onShareNode,
  } = props;

  const filteredNodes = nodes.filter((node) => {
    if (!searchQuery) return true;
    return node.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getFileIcon = (node: DecryptedNode) => {
    if (node.type === 'folder') return FolderIcon;

    const mime = node.mimeType || '';
    const name = node.name.toLowerCase();

    if (mime.startsWith('video/') || name.endsWith('.mov') || name.endsWith('.mp4') || name.endsWith('.mkv')) {
      return VideoCameraIcon;
    }
    if (mime.startsWith('image/') || name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.webp')) {
      return ImageIcon;
    }
    if (mime.startsWith('audio/') || name.endsWith('.mp3') || name.endsWith('.wav')) {
      return MusicNotesIcon;
    }
    if (name.endsWith('.pdf') || name.endsWith('.txt') || name.endsWith('.md')) {
      return FileTextIcon;
    }
    return FileIcon;
  };

  if (filteredNodes.length === 0) {
    return (
      <section className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-12 h-12 rounded-full border border-black/5 dark:border-white/10 bg-neutral-100 dark:bg-[#1f1f23] flex items-center justify-center text-neutral-400 mb-3 shadow-inner">
          <FolderIcon size={22} />
        </div>

        <p className="text-sm text-neutral-700 dark:text-neutral-300 font-medium">
          <span>This folder is empty</span>
        </p>

        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 max-w-sm">
          <span>Drag and drop 4K media or archives to stream them with 0 bytes local disk footprint.</span>
        </p>
      </section>
    );
  }

  if (viewMode === 'list') {
    return (
      <section className="w-full bg-white dark:bg-[#1f1f23] border border-black/5 dark:border-white/10 rounded-2xl p-2 shadow-sm">
        <div className="grid grid-cols-12 text-[11px] font-mono uppercase tracking-wider text-neutral-400 dark:text-neutral-500 border-b border-black/5 dark:border-white/5 pb-2.5 px-3 pt-1">
          <div className="col-span-6">
            <span>Name</span>
          </div>

          <div className="col-span-2">
            <span>Cloud Size</span>
          </div>

          <div className="col-span-2">
            <span>Local SSD</span>
          </div>

          <div className="col-span-2 text-right">
            <span>Actions</span>
          </div>
        </div>

        <div className="divide-y divide-black/5 dark:divide-white/5">
          {filteredNodes.map((node) => {
            const Icon = getFileIcon(node);
            const isFolder = node.type === 'folder';

            return (
              <div
                key={node.id}
                className="grid grid-cols-12 items-center px-3 py-2.5 hover:bg-neutral-50 dark:hover:bg-white/[0.03] transition-colors rounded-xl group text-xs"
              >
                <div
                  onClick={() => (isFolder ? onNavigateToFolder(node) : onPreviewFile(node))}
                  className="col-span-6 flex items-center gap-3 cursor-pointer overflow-hidden pr-4"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isFolder ? 'bg-amber-500/10 text-amber-500' : 'bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-300'
                  }`}>
                    <Icon size={16} />
                  </div>

                  <span className="truncate text-neutral-900 dark:text-white font-medium hover:underline underline-offset-2">
                    {node.name}
                  </span>
                </div>

                <div className="col-span-2 text-neutral-500 dark:text-neutral-400 font-mono text-[11px]">
                  <span>{isFolder ? '—' : formatBytes(node.sizeBytes)}</span>
                </div>

                <div className="col-span-2 flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-mono text-[11px] font-medium">
                  <CloudCheckIcon size={14} />

                  <span>0 B</span>
                </div>

                <div className="col-span-2 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!isFolder && (
                    <button
                      onClick={() => onPreviewFile(node)}
                      title="Instant Decrypt Preview"
                      className="p-1.5 hover:bg-neutral-200 dark:hover:bg-white/10 rounded-full text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
                    >
                      <EyeIcon size={14} />
                    </button>
                  )}

                  {!isFolder && (
                    <button
                      onClick={() => onShareNode(node)}
                      title="Create E2EE Share Link"
                      className="p-1.5 hover:bg-neutral-200 dark:hover:bg-white/10 rounded-full text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
                    >
                      <ShareNetworkIcon size={14} />
                    </button>
                  )}

                  <button
                    onClick={() => onDeleteNode(node.id)}
                    title="Move to Trash"
                    className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full text-neutral-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  // Grid View
  return (
    <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
      {filteredNodes.map((node) => {
        return (
          <NodeCard
            key={node.id}
            node={node}
            onNavigateToFolder={onNavigateToFolder}
            onPreviewFile={onPreviewFile}
            onDeleteNode={onDeleteNode}
            onShareNode={onShareNode}
          />
        );
      })}
    </section>
  );
};
