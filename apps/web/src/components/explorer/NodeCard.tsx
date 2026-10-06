import { useState } from 'react';

import type { DecryptedNode } from '@/schemas/node';

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
  PlayCircleIcon,
} from '@phosphor-icons/react';

interface NodeCardProps {
  node: DecryptedNode;
  onNavigateToFolder: (folder: DecryptedNode) => void;
  onPreviewFile: (file: DecryptedNode) => void;
  onDeleteNode: (nodeId: string) => void;
  onShareNode: (file: DecryptedNode) => void;
}

export const NodeCard = (props: NodeCardProps) => {
  const {
    node,
    onNavigateToFolder,
    onPreviewFile,
    onDeleteNode,
    onShareNode,
  } = props;

  const defaultThumbnailFailed = false;
  const [thumbnailFailed, setThumbnailFailed] = useState(defaultThumbnailFailed);

  const isFolder = node.type === 'folder';
  const mime = node.mimeType?.toLowerCase() || '';
  const name = node.name.toLowerCase();

  const isVideo =
    mime.startsWith('video/') ||
    name.endsWith('.mov') ||
    name.endsWith('.mp4') ||
    name.endsWith('.webm') ||
    name.endsWith('.mkv');

  const isImage =
    mime.startsWith('image/') ||
    name.endsWith('.png') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.webp');

  const isMedia = isVideo || isImage;

  const getFileIcon = () => {
    if (isFolder) return FolderIcon;
    if (isVideo) return VideoCameraIcon;
    if (isImage) return ImageIcon;
    if (mime.startsWith('audio/') || name.endsWith('.mp3') || name.endsWith('.wav')) {
      return MusicNotesIcon;
    }
    if (name.endsWith('.pdf') || name.endsWith('.txt') || name.endsWith('.md')) {
      return FileTextIcon;
    }
    return FileIcon;
  };

  const Icon = getFileIcon();
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://nulla-worker.nulla-vault.workers.dev';
  const thumbnailUrl = `${apiBase}/api/thumbnails/${node.id}`;

  const handleClick = () => {
    if (isFolder) {
      onNavigateToFolder(node);
      return;
    }
    onPreviewFile(node);
  };

  const handleShareClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    onShareNode(node);
  };

  const handleDeleteClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    onDeleteNode(node.id);
  };

  const handleImageError = () => {
    setThumbnailFailed(true);
  };

  return (
    <div
      onClick={handleClick}
      className="group relative bg-white dark:bg-[#1c1c1f] border border-black/5 dark:border-white/10 hover:border-black/15 dark:hover:border-white/20 p-3 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer overflow-hidden min-h-[170px]"
    >
      <div className="flex items-start justify-between w-full mb-2">
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
            isFolder
              ? 'bg-amber-500/10 text-amber-500'
              : 'bg-neutral-100 dark:bg-white/5 text-neutral-700 dark:text-neutral-200'
          }`}
        >
          <Icon size={17} />
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 dark:bg-[#1c1c1f]/95 rounded-full p-0.5 border border-black/5 dark:border-white/10 shadow-sm">
          {!isFolder && (
            <button
              onClick={handleShareClick}
              title="Share E2EE Link"
              className="p-1 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
            >
              <ShareNetworkIcon size={13} />
            </button>
          )}

          <button
            onClick={handleDeleteClick}
            title="Move to Trash"
            className="p-1 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full text-neutral-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            <TrashIcon size={13} />
          </button>
        </div>
      </div>

      {isMedia && !thumbnailFailed ? (
        <div className="relative w-full h-24 mb-2.5 rounded-xl overflow-hidden bg-neutral-100 dark:bg-black/30 border border-black/5 dark:border-white/5">
          <img
            src={thumbnailUrl}
            alt={node.name}
            onError={handleImageError}
            className="w-full h-full object-cover rounded-xl transition-transform duration-300 group-hover:scale-105"
          />

          {isVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
              <PlayCircleIcon size={28} className="text-white drop-shadow-md" />
            </div>
          )}
        </div>
      ) : null}

      <div className="mt-auto">
        <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors">
          <span>{node.name}</span>
        </p>

        <div className="flex items-center justify-between text-[10px] text-neutral-500 dark:text-neutral-400 font-mono mt-1">
          <span>{isFolder ? 'Folder' : formatBytes(node.sizeBytes)}</span>

          <span className="text-emerald-600 dark:text-emerald-400 font-medium">0 B Local</span>
        </div>
      </div>
    </div>
  );
};
