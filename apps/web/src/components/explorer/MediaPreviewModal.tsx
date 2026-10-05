import type { DecryptedNode } from '@/schemas/node';

import { useStreamPlayerLogic } from '@/hooks/useStreamPlayerLogic';

import { formatBytes } from '@/lib/utils';

import {
  XIcon,
  DownloadSimpleIcon,
  CircleNotchIcon,
  LightningIcon,
  ShieldCheckIcon,
  HardDrivesIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react';

interface MediaPreviewModalProps {
  node: DecryptedNode | null;
  onClose: () => void;
}

export const MediaPreviewModal = (props: MediaPreviewModalProps) => {
  const { node, onClose } = props;

  const {
    mediaUrl,
    isLoading,
    progress,
    decryptionLatencyMs,
    totalChunks,
    decryptedChunksCount,
    error,
    isCodecUnsupported,
    handleCodecError,
  } = useStreamPlayerLogic(node);

  if (!node) return null;

  const lowerName = node.name.toLowerCase();
  const mime = node.mimeType?.toLowerCase() || '';

  const isVideo =
    mime.startsWith('video/') ||
    lowerName.endsWith('.mov') ||
    lowerName.endsWith('.mp4') ||
    lowerName.endsWith('.webm') ||
    lowerName.endsWith('.mkv');

  const isImage =
    mime.startsWith('image/') ||
    lowerName.endsWith('.png') ||
    lowerName.endsWith('.jpg') ||
    lowerName.endsWith('.jpeg') ||
    lowerName.endsWith('.webp') ||
    lowerName.endsWith('.gif') ||
    lowerName.endsWith('.svg');

  const isAudio =
    mime.startsWith('audio/') ||
    lowerName.endsWith('.mp3') ||
    lowerName.endsWith('.wav') ||
    lowerName.endsWith('.aac') ||
    lowerName.endsWith('.m4a');

  return (
    <section className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#0a0a0a] border border-[#222222] rounded-xl max-w-4xl w-full flex flex-col overflow-hidden shadow-2xl max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1b1b1b] bg-[#0e0e0e]">
          <div className="flex flex-col gap-1 overflow-hidden">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white truncate max-w-md">
                {node.name}
              </span>

              <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
                0 Bytes on Mac
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-[#71717a] font-mono">
              <span>Cloud: {formatBytes(node.sizeBytes)}</span>

              <span>•</span>

              <span className="flex items-center gap-1 text-[#10b981]">
                <ShieldCheckIcon size={13} />
                Client-Side AES-GCM
              </span>

              {decryptionLatencyMs > 0 && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-amber-400">
                    <LightningIcon size={13} />
                    Decrypted in {decryptionLatencyMs}ms
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {mediaUrl && (
              <a
                href={mediaUrl}
                download={node.name}
                className="flex items-center gap-1.5 bg-[#181818] hover:bg-[#222222] border border-[#2e2e2e] text-xs text-white px-3 py-1.5 rounded-md transition-colors"
              >
                <DownloadSimpleIcon size={14} />

                <span>Download Decrypted</span>
              </a>
            )}

            <button
              onClick={onClose}
              className="text-[#888888] hover:text-white p-1.5 rounded-md hover:bg-[#1a1a1a] transition-colors"
            >
              <XIcon size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 p-6 flex flex-col items-center justify-center min-h-[350px] bg-[#050505] overflow-auto">
          {isLoading && (
            <div className="flex flex-col items-center gap-3 text-center">
              <CircleNotchIcon size={32} className="text-white animate-spin" />

              <p className="text-xs font-mono text-[#888888]">
                <span>
                  Decrypting block {decryptedChunksCount}/{Math.max(1, totalChunks)}...
                </span>
              </p>

              <div className="w-48 bg-[#181818] h-1 rounded-full overflow-hidden">
                <div
                  className="bg-white h-full transition-all duration-200"
                  style={{ width: `${Math.max(10, progress)}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-lg text-center max-w-md">
              <p className="text-xs text-red-400">
                <span>{error}</span>
              </p>
            </div>
          )}

          {isCodecUnsupported && (
            <div className="flex flex-col items-center gap-3 p-6 bg-[#0f0f0f] border border-[#222222] rounded-xl text-center max-w-md">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <WarningCircleIcon size={24} />
              </div>

              <h3 className="text-sm font-semibold text-white">
                <span>Browser Playback Codec Not Supported</span>
              </h3>

              <p className="text-xs text-[#888888]">
                <span>
                  This video uses a high-bitrate codec (such as HEVC or ProRes) not decodable natively in your browser. Download the decrypted file below to view in QuickTime or VLC.
                </span>
              </p>

              {mediaUrl && (
                <a
                  href={mediaUrl}
                  download={node.name}
                  className="mt-2 flex items-center gap-1.5 bg-white text-black text-xs font-semibold px-4 py-2 rounded-lg hover:bg-neutral-200 transition-colors"
                >
                  <DownloadSimpleIcon size={14} />

                  <span>Download Decrypted Video</span>
                </a>
              )}
            </div>
          )}

          {!isLoading && !error && !isCodecUnsupported && mediaUrl && (
            <div className="w-full flex items-center justify-center">
              {isVideo && (
                <video
                  src={mediaUrl}
                  controls
                  autoPlay
                  playsInline
                  onError={handleCodecError}
                  className="max-h-[60vh] max-w-full rounded-lg border border-[#222222] shadow-lg"
                />
              )}

              {isImage && (
                <img
                  src={mediaUrl}
                  alt={node.name}
                  className="max-h-[60vh] max-w-full object-contain rounded-lg border border-[#222222]"
                />
              )}

              {isAudio && (
                <div className="w-full max-w-md bg-[#111111] p-6 rounded-xl border border-[#222222] flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-[#181818] flex items-center justify-center text-white">
                    <HardDrivesIcon size={32} />
                  </div>

                  <audio src={mediaUrl} controls className="w-full" />
                </div>
              )}

              {!isVideo && !isImage && !isAudio && (
                <div className="text-center flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-xl bg-[#121212] border border-[#222222] flex items-center justify-center text-[#888888]">
                    <HardDrivesIcon size={32} />
                  </div>

                  <p className="text-xs text-[#888888] font-mono">
                    <span>File decrypted in RAM. Click below to save locally.</span>
                  </p>

                  <a
                    href={mediaUrl}
                    download={node.name}
                    className="flex items-center gap-2 bg-white text-black text-xs font-semibold px-4 py-2 rounded-md hover:bg-neutral-200 transition-colors"
                  >
                    <DownloadSimpleIcon size={14} />

                    <span>Save Decrypted File</span>
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
