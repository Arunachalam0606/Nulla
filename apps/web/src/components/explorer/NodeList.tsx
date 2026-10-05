import { useState } from 'react';

import type { DecryptedNode } from '@/schemas/node';

import { formatBytes, formatRelativeDate } from '@/lib/utils';

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
        <div className="w-12 h-12 rounded-full border border-[#222222] bg-[#0c0c0c] flex items-center justify-center text-[#555555] mb-3">
          <FolderIcon size={22} />
        </div>

        <p className="text-sm text-[#888888] font-medium">
          <span>This folder is empty</span>
        </p>

        <p className="text-xs text-[#555555] mt-1 max-w-sm">
          <span>Drag and drop 4K media or archives to stream them with 0 bytes local disk footprint.</span>
        </p>
      </section>
    );
  }

  if (viewMode === 'list') {
    return (
      <section className="w-full">
        <div className="grid grid-cols-12 text-[11px] font-mono uppercase tracking-wider text-[#666666] border-b border-[#1b1b1b] pb-2 px-3">
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

        <div className="divide-y divide-[#141414]">
          {filteredNodes.map((node) => {
            const Icon = getFileIcon(node);
            const isFolder = node.type === 'folder';

            return (
              <div
                key={node.id}
                className="grid grid-cols-12 items-center px-3 py-2.5 hover:bg-[#111111] transition-colors rounded-md group text-xs"
              >
                <div
                  onClick={() => (isFolder ? onNavigateToFolder(node) : onPreviewFile(node))}
                  className="col-span-6 flex items-center gap-3 cursor-pointer overflow-hidden pr-4"
                >
                  <Icon
                    size={18}
                    className={isFolder ? 'text-amber-400 shrink-0' : 'text-[#888888] shrink-0'}
                  />

                  <span className="truncate text-white hover:underline underline-offset-2">
                    {node.name}
                  </span>
                </div>

                <div className="col-span-2 text-[#888888] font-mono text-[11px]">
                  <span>{isFolder ? '—' : formatBytes(node.sizeBytes)}</span>
                </div>

                <div className="col-span-2 flex items-center gap-1.5 text-emerald-400 font-mono text-[11px]">
                  <CloudCheckIcon size={14} />

                  <span>0 B</span>
                </div>

                <div className="col-span-2 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!isFolder && (
                    <button
                      onClick={() => onPreviewFile(node)}
                      title="Instant Decrypt Preview"
                      className="p-1 hover:bg-[#222222] rounded text-[#888888] hover:text-white"
                    >
                      <EyeIcon size={14} />
                    </button>
                  )}

                  {!isFolder && (
                    <button
                      onClick={() => onShareNode(node)}
                      title="Create E2EE Share Link"
                      className="p-1 hover:bg-[#222222] rounded text-[#888888] hover:text-white"
                    >
                      <ShareNetworkIcon size={14} />
                    </button>
                  )}

                  <button
                    onClick={() => onDeleteNode(node.id)}
                    title="Move to Trash"
                    className="p-1 hover:bg-[#222222] rounded text-[#888888] hover:text-red-400"
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
    <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {filteredNodes.map((node) => {
        const Icon = getFileIcon(node);
        const isFolder = node.type === 'folder';

        return (
          <div
            key={node.id}
            className="group relative bg-[#0a0a0a] border border-[#1b1b1b] hover:border-[#333333] hover:bg-[#101010] p-3 rounded-lg transition-all flex flex-col justify-between h-36 cursor-pointer"
            onClick={() => (isFolder ? onNavigateToFolder(node) : onPreviewFile(node))}
          >
            <div className="flex items-start justify-between">
              <div
                className={`w-9 h-9 rounded-md flex items-center justify-center ${
                  isFolder ? 'bg-amber-500/10 text-amber-400' : 'bg-[#181818] text-[#cccccc]'
                }`}
              >
                <Icon size={20} />
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!isFolder && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onShareNode(node);
                    }}
                    title="Share E2EE Link"
                    className="p-1 hover:bg-[#242424] rounded text-[#777777] hover:text-white"
                  >
                    <ShareNetworkIcon size={13} />
                  </button>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteNode(node.id);
                  }}
                  title="Move to Trash"
                  className="p-1 hover:bg-[#242424] rounded text-[#777777] hover:text-red-400"
                >
                  <TrashIcon size={13} />
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-white truncate group-hover:text-emerald-300 transition-colors">
                <span>{node.name}</span>
              </p>

              <div className="flex items-center justify-between text-[10px] text-[#71717a] font-mono mt-1">
                <span>{isFolder ? 'Folder' : formatBytes(node.sizeBytes)}</span>

                <span className="text-emerald-400">0 B Local</span>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
};
