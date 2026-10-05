import type { UploadQueueItem } from '@/schemas/node';

import { formatBytes } from '@/lib/utils';

import {
  XIcon,
  CheckCircleIcon,
  WarningCircleIcon,
  LockKeyIcon,
  UploadSimpleIcon,
  CircleNotchIcon,
} from '@phosphor-icons/react';

interface UploadDrawerProps {
  isOpen: boolean;
  uploadQueue: UploadQueueItem[];
  onClose: () => void;
}

export const UploadDrawer = (props: UploadDrawerProps) => {
  const { isOpen, uploadQueue, onClose } = props;

  if (!isOpen || uploadQueue.length === 0) return null;

  return (
    <section className="fixed bottom-6 right-6 w-96 bg-white dark:bg-[#1f1f23] border border-black/5 dark:border-white/10 rounded-2xl shadow-2xl z-40 overflow-hidden flex flex-col max-h-96">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/5 dark:border-white/10 bg-neutral-50/50 dark:bg-black/20">
        <div className="flex items-center gap-2">
          <UploadSimpleIcon size={16} className="text-neutral-900 dark:text-white" />

          <span className="text-xs font-semibold text-neutral-900 dark:text-white tracking-wide">
            E2EE Upload Activity ({uploadQueue.length})
          </span>
        </div>

        <button
          onClick={onClose}
          className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors"
        >
          <XIcon size={14} />
        </button>
      </div>

      <div className="divide-y divide-black/5 dark:divide-white/5 overflow-y-auto max-h-80 p-2">
        {uploadQueue.map((item) => {
          return (
            <div key={item.id} className="p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-neutral-900 dark:text-white truncate max-w-[200px]">
                  {item.fileName}
                </span>

                <span className="text-[11px] font-mono text-neutral-400 dark:text-neutral-500">
                  {formatBytes(item.fileSize)}
                </span>
              </div>

              <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    item.status === 'error'
                      ? 'bg-red-500'
                      : item.status === 'completed'
                      ? 'bg-emerald-500'
                      : 'bg-neutral-900 dark:bg-white'
                  }`}
                  style={{ width: `${item.progressPercentage}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
                  {item.status === 'encrypting' && (
                    <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                      <LockKeyIcon size={12} />

                      <span>Encrypting AES-256...</span>
                    </div>
                  )}

                  {item.status === 'uploading' && (
                    <div className="flex items-center gap-1 text-sky-600 dark:text-sky-400 font-medium">
                      <CircleNotchIcon size={12} className="animate-spin" />

                      <span>
                        Block {item.currentChunk}/{item.totalChunks} (4 MB)
                      </span>
                    </div>
                  )}

                  {item.status === 'completed' && (
                    <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircleIcon size={12} />

                      <span>Vault Secured</span>
                    </div>
                  )}

                  {item.status === 'error' && (
                    <div className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                      <WarningCircleIcon size={12} />

                      <span>{item.errorMessage || 'Upload failed'}</span>
                    </div>
                  )}
                </div>

                <span className="font-mono text-neutral-400 dark:text-neutral-500">{item.progressPercentage}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
