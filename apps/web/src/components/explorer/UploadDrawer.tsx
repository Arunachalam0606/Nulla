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
    <section className="fixed bottom-0 right-6 w-96 bg-[#0c0c0c] border border-[#222222] rounded-t-xl shadow-2xl z-40 overflow-hidden flex flex-col max-h-96">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1b1b1b] bg-[#111111]">
        <div className="flex items-center gap-2">
          <UploadSimpleIcon size={16} className="text-white" />

          <span className="text-xs font-semibold text-white tracking-wide">
            E2EE Upload Activity ({uploadQueue.length})
          </span>
        </div>

        <button
          onClick={onClose}
          className="text-[#777777] hover:text-white p-1 rounded hover:bg-[#1a1a1a] transition-colors"
        >
          <XIcon size={14} />
        </button>
      </div>

      <div className="divide-y divide-[#181818] overflow-y-auto max-h-80 p-2">
        {uploadQueue.map((item) => {
          return (
            <div key={item.id} className="p-2.5 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-white truncate max-w-[200px]">
                  {item.fileName}
                </span>

                <span className="text-[11px] font-mono text-[#777777]">
                  {formatBytes(item.fileSize)}
                </span>
              </div>

              <div className="w-full bg-[#1a1a1a] h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    item.status === 'error'
                      ? 'bg-red-500'
                      : item.status === 'completed'
                      ? 'bg-emerald-400'
                      : 'bg-white'
                  }`}
                  style={{ width: `${item.progressPercentage}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 text-[#888888]">
                  {item.status === 'encrypting' && (
                    <div className="flex items-center gap-1 text-amber-400">
                      <LockKeyIcon size={12} />

                      <span>Encrypting AES-256...</span>
                    </div>
                  )}

                  {item.status === 'uploading' && (
                    <div className="flex items-center gap-1 text-sky-400">
                      <CircleNotchIcon size={12} className="animate-spin" />

                      <span>
                        Block {item.currentChunk}/{item.totalChunks} (4 MB)
                      </span>
                    </div>
                  )}

                  {item.status === 'completed' && (
                    <div className="flex items-center gap-1 text-emerald-400">
                      <CheckCircleIcon size={12} />

                      <span>Vault Secured</span>
                    </div>
                  )}

                  {item.status === 'error' && (
                    <div className="flex items-center gap-1 text-red-400">
                      <WarningCircleIcon size={12} />

                      <span>{item.errorMessage || 'Upload failed'}</span>
                    </div>
                  )}
                </div>

                <span className="font-mono text-[#666666]">{item.progressPercentage}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
