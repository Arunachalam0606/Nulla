import { useEffect, useState } from 'react';

import type { DecryptedNode } from '@/schemas/node';

import { useAuthStore } from '@/stores/authStore';

import { formatBytes } from '@/lib/utils';

import {
  XIcon,
  DownloadSimpleIcon,
  CircleNotchIcon,
  ShieldCheckIcon,
  LightningIcon,
  HardDrivesIcon,
  FileTextIcon,
  FilePdfIcon,
  FileZipIcon,
  FileCodeIcon,
} from '@phosphor-icons/react';

interface MediaPreviewModalProps {
  node: DecryptedNode | null;
  onClose: () => void;
}

export const MediaPreviewModal = (props: MediaPreviewModalProps) => {
  const { node, onClose } = props;

  const token = useAuthStore((state) => state.token);

  const defaultTextContent = '';
  const defaultIsTextLoading = false;
  const defaultTextError = '';
  const defaultIsCodecUnsupported = false;

  const [textContent, setTextContent] = useState(defaultTextContent);
  const [isTextLoading, setIsTextLoading] = useState(defaultIsTextLoading);
  const [textError, setTextError] = useState(defaultTextError);
  const [isCodecUnsupported, setIsCodecUnsupported] = useState(defaultIsCodecUnsupported);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://nulla-worker.nulla-vault.workers.dev';
  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
  const directStreamUrl = node ? `${apiBase}/api/nodes/${node.id}/stream${tokenParam}` : '';

  const lowerName = node?.name?.toLowerCase() || '';
  const mime = node?.mimeType?.toLowerCase() || '';

  const isVideo =
    mime.startsWith('video/') ||
    lowerName.endsWith('.mp4') ||
    lowerName.endsWith('.mov') ||
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
    lowerName.endsWith('.m4a') ||
    lowerName.endsWith('.ogg');

  const isPdf = mime.includes('pdf') || lowerName.endsWith('.pdf');

  const isText =
    mime.startsWith('text/') ||
    mime.includes('json') ||
    mime.includes('javascript') ||
    mime.includes('typescript') ||
    lowerName.endsWith('.txt') ||
    lowerName.endsWith('.md') ||
    lowerName.endsWith('.json') ||
    lowerName.endsWith('.js') ||
    lowerName.endsWith('.ts') ||
    lowerName.endsWith('.tsx') ||
    lowerName.endsWith('.jsx') ||
    lowerName.endsWith('.css') ||
    lowerName.endsWith('.html') ||
    lowerName.endsWith('.xml') ||
    lowerName.endsWith('.csv') ||
    lowerName.endsWith('.log') ||
    lowerName.endsWith('.yaml') ||
    lowerName.endsWith('.yml') ||
    lowerName.endsWith('.sh');

  const isArchive =
    lowerName.endsWith('.zip') ||
    lowerName.endsWith('.tar') ||
    lowerName.endsWith('.gz') ||
    lowerName.endsWith('.dmg') ||
    lowerName.endsWith('.iso') ||
    lowerName.endsWith('.7z') ||
    lowerName.endsWith('.rar');

  const handleVideoError = (event: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = event.currentTarget;
    setTimeout(() => {
      if (video && video.error && video.readyState === 0) {
        setIsCodecUnsupported(true);
      }
    }, 4000);
  };

  useEffect(() => {
    if (!node || !isText || !directStreamUrl) return;

    const controller = new AbortController();
    setIsTextLoading(true);
    setTextError(defaultTextError);

    fetch(directStreamUrl, {
      signal: controller.signal,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load file`);
        return res.text();
      })
      .then((text) => {
        setTextContent(text);
        setIsTextLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setTextError(err instanceof Error ? err.message : 'Failed to load text preview');
        setIsTextLoading(false);
      });

    return () => controller.abort();
  }, [node?.id, isText, directStreamUrl, token]);

  if (!node) return null;

  return (
    <section className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1f1f23] border border-black/5 dark:border-white/10 rounded-2xl max-w-4xl w-full flex flex-col overflow-hidden shadow-2xl max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/5 dark:border-white/10 bg-neutral-50/50 dark:bg-black/20">
          <div className="flex flex-col gap-1 overflow-hidden">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-neutral-900 dark:text-white truncate max-w-md">
                {node.name}
              </span>

              <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-medium">
                0 Bytes on Mac
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400 font-mono">
              <span>Cloud: {formatBytes(node.sizeBytes)}</span>

              <span>•</span>

              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <ShieldCheckIcon size={13} />
                <span>Cloudflare R2 Native</span>
              </span>

              {isVideo && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                    <LightningIcon size={13} />
                    <span>&lt;0.5s Range Seeking</span>
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={directStreamUrl}
              download={node.name}
              className="flex items-center gap-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 text-xs px-3.5 py-1.5 rounded-full transition-all font-medium shadow-sm"
            >
              <DownloadSimpleIcon size={14} />

              <span>Download File</span>
            </a>

            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors"
            >
              <XIcon size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 p-6 flex flex-col items-center justify-center min-h-[360px] bg-neutral-50 dark:bg-[#161618] overflow-auto">
          {isVideo && (
            <div className="w-full flex items-center justify-center">
              <video
                src={directStreamUrl}
                controls
                autoPlay
                playsInline
                preload="metadata"
                onError={handleVideoError}
                className="max-h-[70vh] max-w-full rounded-xl border border-black/5 dark:border-white/10 shadow-lg bg-black"
              />
            </div>
          )}

          {isImage && (
            <div className="w-full flex items-center justify-center">
              <img
                src={directStreamUrl}
                alt={node.name}
                className="max-h-[70vh] max-w-full object-contain rounded-xl border border-black/5 dark:border-white/10 shadow-md"
              />
            </div>
          )}

          {isAudio && (
            <div className="w-full max-w-md bg-white dark:bg-[#1f1f23] p-8 rounded-2xl border border-black/5 dark:border-white/10 flex flex-col items-center gap-4 shadow-sm">
              <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-black/20 flex items-center justify-center text-neutral-800 dark:text-white">
                <HardDrivesIcon size={32} />
              </div>

              <audio src={directStreamUrl} controls autoPlay className="w-full" />
            </div>
          )}

          {isPdf && (
            <div className="w-full h-full flex items-center justify-center">
              <iframe
                src={directStreamUrl}
                title={node.name}
                className="w-full h-[75vh] rounded-xl border border-black/5 dark:border-white/10 bg-white shadow-sm"
              />
            </div>
          )}

          {isText && (
            <div className="w-full h-full flex flex-col items-center justify-center">
              {isTextLoading && (
                <div className="flex flex-col items-center gap-3 py-12">
                  <CircleNotchIcon size={28} className="animate-spin text-neutral-400" />
                  <span className="text-xs text-neutral-500 font-mono">Loading preview...</span>
                </div>
              )}

              {textError && !isTextLoading && (
                <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl text-center max-w-md">
                  <p className="text-xs text-red-600 dark:text-red-400">
                    <span>{textError}</span>
                  </p>
                </div>
              )}

              {!isTextLoading && !textError && (
                <div className="w-full max-h-[75vh] overflow-auto bg-neutral-900 text-neutral-100 p-5 rounded-xl font-mono text-xs leading-relaxed border border-black/10 dark:border-white/10 shadow-inner">
                  <pre className="whitespace-pre-wrap font-mono">
                    <code>{textContent}</code>
                  </pre>
                </div>
              )}
            </div>
          )}

          {!isVideo && !isImage && !isAudio && !isPdf && !isText && (
            <div className="w-full max-w-md bg-white dark:bg-[#1f1f23] p-8 rounded-2xl border border-black/5 dark:border-white/10 flex flex-col items-center text-center gap-4 shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-[#28282d] border border-black/5 dark:border-white/10 flex items-center justify-center text-neutral-600 dark:text-neutral-300 shadow-sm">
                {isArchive ? <FileZipIcon size={32} /> : <HardDrivesIcon size={32} />}
              </div>

              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white truncate max-w-xs">
                  <span>{node.name}</span>
                </h3>

                <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                  <span>{formatBytes(node.sizeBytes)} • 0 Bytes on Mac</span>
                </p>
              </div>

              <div className="p-3 bg-neutral-50 dark:bg-black/20 rounded-xl border border-black/5 dark:border-white/5 w-full text-xs text-neutral-500 dark:text-neutral-400">
                <span>Stored securely in Cloudflare R2. Click below to download.</span>
              </div>

              <a
                href={directStreamUrl}
                download={node.name}
                className="flex items-center gap-2 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold px-5 py-2.5 rounded-full shadow-sm hover:opacity-90 transition-all"
              >
                <DownloadSimpleIcon size={16} />

                <span>Download File</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
