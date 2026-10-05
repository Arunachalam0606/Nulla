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

  return (
    <div
      onClick={handleClick}
      className="group relative bg-white dark:bg-[#1f1f23] border border-black/5 dark:border-white/10 hover:border-black/15 dark:hover:border-white/20 p-3.5 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-44 cursor-pointer overflow-hidden"
    >
      <div className="flex items-start justify-between w-full relative z-10">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${
            isFolder
              ? 'bg-amber-500/10 text-amber-500'
              : 'bg-neutral-100 dark:bg-white/5 text-neutral-700 dark:text-neutral-200'
          }`}
        >
          <Icon size={18} />
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 dark:bg-[#1f1f23]/80 backdrop-blur-sm rounded-full p-0.5 border border-black/5 dark:border-white/10 shadow-sm">
          {!isFolder && (
            <button
              onClick={(event) => {
                event.stopPropagation();
                onShareNode(node);
              }}
              title="Share E2EE Link"
              className="p-1 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
            >
              <ShareNetworkIcon size={13} />
            </button>
          )}

          <button
            onClick={(event) => {
              event.stopPropagation();
              onDeleteNode(node.id);
            }}
            title="Move to Trash"
            className="p-1 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full text-neutral-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            <TrashIcon size={13} />
          </button>
        </div>
      </div>

      {isMedia && !thumbnailFailed && (
        <div className="absolute inset-0 z-0 overflow-hidden rounded-2xl">
          <img
            src={thumbnailUrl}
            alt={node.name}
            onError={() => setThumbnailFailed(true)}
            className="w-full h-full object-cover opacity-20 group-hover:opacity-30 group-hover:scale-105 transition-all duration-300 filter blur-[0.5px]"
          />

          {isVideo && (
            <div className="absolute inset-0 flex items-center justify-center text-white/50 group-hover:text-white/80 transition-colors">
              <PlayCircleIcon size={32} weight="light" />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/70 to-transparent dark:from-[#1f1f23] dark:via-[#1f1f23]/70 dark:to-transparent" />
        </div>
      )}

      <div className="relative z-10 mt-auto">
        <p className="text-xs font-semibold text-neutral-900 dark:text-white truncate group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors">
          <span>{node.name}</span>
        </p>

        <div className="flex items-center justify-between text-[10px] text-neutral-500 dark:text-neutral-400 font-mono mt-1.5">
          <span>{isFolder ? 'Folder' : formatBytes(node.sizeBytes)}</span>

          <span className="text-emerald-600 dark:text-emerald-400 font-medium">0 B Local</span>
        </div>
      </div>
    </div>
  );
};
