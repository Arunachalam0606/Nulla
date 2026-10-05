import { useEffect, useState, useRef, useCallback } from 'react';

import { decryptChunk } from '@nulla/crypto';

import type { DecryptedNode, ChunkMetadata } from '@/schemas/node';

import { useAuthStore } from '@/stores/authStore';

import { fetchNodeChunks, streamChunkBytes } from '@/lib/api';

function resolveMimeType(fileName: string, serverMime?: string): string {
  if (serverMime && serverMime !== 'application/octet-stream' && serverMime.length > 0) {
    return serverMime;
  }

  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    case 'mp4':
      return 'video/mp4';
    case 'mov':
      return 'video/quicktime';
    case 'webm':
      return 'video/webm';
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'pdf':
      return 'application/pdf';
    case 'txt':
    case 'md':
      return 'text/plain';
    case 'json':
      return 'application/json';
    default:
      return 'application/octet-stream';
  }
}

function hasMovieFragmentAtom(bytes: Uint8Array): boolean {
  const limit = Math.min(bytes.length - 4, 65536);
  for (let index = 0; index < limit; index++) {
    if (
      bytes[index] === 0x6d && // 'm'
      bytes[index + 1] === 0x6f && // 'o'
      bytes[index + 2] === 0x6f && // 'o'
      bytes[index + 3] === 0x66 // 'f'
    ) {
      return true;
    }
  }
  return false;
}

export function useStreamPlayerLogic(node: DecryptedNode | null, enabled: boolean = true) {
  const token = useAuthStore((state) => state.token);
  const masterKey = useAuthStore((state) => state.masterKey);
  const masterKeyRaw = useAuthStore((state) => state.masterKeyRaw);

  const defaultMediaUrl = '';
  const defaultIsLoading = false;
  const defaultProgress = 0;
  const defaultLatency = 0;
  const defaultError = '';
  const defaultTotalChunks = 0;
  const defaultDecryptedCount = 0;
  const defaultIsCodecUnsupported = false;

  const [mediaUrl, setMediaUrl] = useState(defaultMediaUrl);
  const [isLoading, setIsLoading] = useState(defaultIsLoading);
  const [progress, setProgress] = useState(defaultProgress);
  const [decryptionLatencyMs, setDecryptionLatencyMs] = useState(defaultLatency);
  const [totalChunks, setTotalChunks] = useState(defaultTotalChunks);
  const [decryptedChunksCount, setDecryptedChunksCount] = useState(defaultDecryptedCount);
  const [error, setError] = useState(defaultError);
  const [isCodecUnsupported, setIsCodecUnsupported] = useState(defaultIsCodecUnsupported);

  const activeUrlRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const cleanupActiveUrl = useCallback(() => {
    if (activeUrlRef.current) {
      URL.revokeObjectURL(activeUrlRef.current);
      activeUrlRef.current = '';
    }
  }, []);

  const fallbackBufferedDecryption = useCallback(
    async (
      chunks: ChunkMetadata[],
      mimeType: string,
      abortController: AbortController,
      preDecryptedChunks: Map<number, Uint8Array> = new Map()
    ) => {
      if (!masterKey || !masterKeyRaw) {
        setIsLoading(false);
        setError('Encryption keys are unavailable in memory');
        return;
      }

      const decryptedBuffers: Uint8Array[] = new Array(chunks.length);
      const startTime = performance.now();
      let completedCount = preDecryptedChunks.size;

      // Populate pre-decrypted chunks (e.g. chunk 0 and final chunk)
      preDecryptedChunks.forEach((buf, index) => {
        decryptedBuffers[index] = buf;
      });

      // Decrypt remaining chunks with batching (concurrency of 3 for fast throughput)
      const pendingIndices: number[] = [];
      for (let i = 0; i < chunks.length; i++) {
        if (!decryptedBuffers[i]) {
          pendingIndices.push(i);
        }
      }

      const concurrency = 3;
      for (let batchIndex = 0; batchIndex < pendingIndices.length; batchIndex += concurrency) {
        if (abortController.signal.aborted) return;

        const slice = pendingIndices.slice(batchIndex, batchIndex + concurrency);
        await Promise.all(
          slice.map(async (chunkIndex) => {
            const chunk = chunks[chunkIndex];
            const encryptedArrayBuffer = await streamChunkBytes(chunk.id);
            const encryptedBytes = new Uint8Array(encryptedArrayBuffer);

            const chunkStartTime = performance.now();
            const decryptedChunk = await decryptChunk(
              masterKey,
              masterKeyRaw,
              chunk.chunk_index,
              encryptedBytes
            );
            const chunkLatency = Math.round(performance.now() - chunkStartTime);
            setDecryptionLatencyMs(chunkLatency);

            decryptedBuffers[chunkIndex] = decryptedChunk;
            completedCount++;
            setDecryptedChunksCount(completedCount);
            setProgress(Math.round((completedCount / chunks.length) * 100));
          })
        );
      }

      if (abortController.signal.aborted) return;

      const totalLatency = Math.round(performance.now() - startTime);
      setDecryptionLatencyMs(totalLatency);

      const blob = new Blob(decryptedBuffers as BlobPart[], { type: mimeType });
      const objectUrl = URL.createObjectURL(blob);

      activeUrlRef.current = objectUrl;
      setMediaUrl(objectUrl);
      setIsLoading(false);
      setProgress(100);
    },
    [masterKey, masterKeyRaw]
  );

  const loadAndDecryptStream = useCallback(async () => {
    if (!node) {
      cleanupActiveUrl();
      setMediaUrl('');
      setIsLoading(false);
      return;
    }

    if (!token || !masterKey || !masterKeyRaw) {
      setError('Decryption keys are not available in memory');
      setIsLoading(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    cleanupActiveUrl();
    setMediaUrl('');
    setIsLoading(true);
    setError('');
    setIsCodecUnsupported(false);
    setProgress(0);
    setDecryptedChunksCount(0);

    try {
      const chunks: ChunkMetadata[] = await fetchNodeChunks(token, node.id);
      if (abortController.signal.aborted) return;

      if (!chunks || chunks.length === 0) {
        setIsLoading(false);
        setError('No blocks found for this file');
        return;
      }

      setTotalChunks(chunks.length);
      const finalMime = resolveMimeType(node.name, node.mimeType);
      const isVideo =
        finalMime.startsWith('video/') ||
        node.name.toLowerCase().endsWith('.mp4') ||
        node.name.toLowerCase().endsWith('.mov') ||
        node.name.toLowerCase().endsWith('.webm');

      // Fast-Path 1: Single Chunk File (< 4 MB) -> Instant Blob in RAM
      if (chunks.length === 1) {
        const startTime = performance.now();
        const encBuffer = await streamChunkBytes(chunks[0].id);
        const decChunk = await decryptChunk(
          masterKey,
          masterKeyRaw,
          chunks[0].chunk_index,
          new Uint8Array(encBuffer)
        );
        const latency = Math.round(performance.now() - startTime);
        setDecryptionLatencyMs(latency);

        const blob = new Blob([decChunk as BlobPart], { type: finalMime });
        const objectUrl = URL.createObjectURL(blob);
        activeUrlRef.current = objectUrl;
        setMediaUrl(objectUrl);
        setDecryptedChunksCount(1);
        setProgress(100);
        setIsLoading(false);
        return;
      }

      // Fast-Path 2: Multi-Chunk Video Range Inspection
      // Fetch Chunk 0 and final chunk (which contains moov atom in standard non-fragmented MP4s)
      if (isVideo) {
        const preDecryptedMap = new Map<number, Uint8Array>();

        // Fetch & decrypt Chunk 0
        const enc0 = await streamChunkBytes(chunks[0].id);
        const dec0 = await decryptChunk(
          masterKey,
          masterKeyRaw,
          chunks[0].chunk_index,
          new Uint8Array(enc0)
        );
        preDecryptedMap.set(0, dec0);
        setDecryptedChunksCount(1);
        setProgress(Math.round((1 / chunks.length) * 100));

        // Fetch & decrypt Final Chunk (to read moov atom at tail)
        const finalChunkIndex = chunks.length - 1;
        const encFinal = await streamChunkBytes(chunks[finalChunkIndex].id);
        const decFinal = await decryptChunk(
          masterKey,
          masterKeyRaw,
          chunks[finalChunkIndex].chunk_index,
          new Uint8Array(encFinal)
        );
        preDecryptedMap.set(finalChunkIndex, decFinal);
        setDecryptedChunksCount(2);
        setProgress(Math.round((2 / chunks.length) * 100));

        const isFragmented = hasMovieFragmentAtom(dec0);

        // If fragmented MP4 and MediaSource is supported, stream sequentially via MSE
        if (isFragmented && typeof window !== 'undefined' && 'MediaSource' in window) {
          const candidateCodecs = [
            'video/mp4; codecs="avc1.640028, mp4a.40.2"',
            'video/mp4; codecs="avc1.4d401f, mp4a.40.2"',
            'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
            'video/mp4',
            finalMime,
          ];
          const supportedType = candidateCodecs.find((c) => MediaSource.isTypeSupported(c));

          if (supportedType) {
            let mediaSourceHandled = false;
            const mediaSource = new MediaSource();
            const msUrl = URL.createObjectURL(mediaSource);
            activeUrlRef.current = msUrl;
            setMediaUrl(msUrl);

            // Watchdog timer: If MSE doesn't play within 2.5 seconds, automatically fall back to buffered decryption
            const watchdogTimer = setTimeout(() => {
              if (!mediaSourceHandled && !abortController.signal.aborted) {
                console.warn('[Nulla Stream] MediaSource watchdog timeout, falling back to buffered decryption');
                cleanupActiveUrl();
                fallbackBufferedDecryption(chunks, finalMime, abortController, preDecryptedMap);
              }
            }, 2500);

            mediaSource.addEventListener(
              'sourceopen',
              async () => {
                try {
                  if (abortController.signal.aborted) return;
                  const sourceBuffer = mediaSource.addSourceBuffer(supportedType);

                  const buf0 = dec0.buffer.slice(dec0.byteOffset, dec0.byteOffset + dec0.byteLength) as ArrayBuffer;
                  sourceBuffer.appendBuffer(buf0);

                  mediaSourceHandled = true;
                  clearTimeout(watchdogTimer);
                  setIsLoading(false);

                  let nextIndex = 1;
                  const streamNext = async () => {
                    if (nextIndex >= chunks.length) {
                      if (mediaSource.readyState === 'open') mediaSource.endOfStream();
                      return;
                    }
                    if (abortController.signal.aborted) return;

                    try {
                      let nextBytes = preDecryptedMap.get(nextIndex);
                      if (!nextBytes) {
                        const enc = await streamChunkBytes(chunks[nextIndex].id);
                        nextBytes = await decryptChunk(
                          masterKey,
                          masterKeyRaw,
                          chunks[nextIndex].chunk_index,
                          new Uint8Array(enc)
                        );
                      }

                      if (sourceBuffer.updating) {
                        await new Promise<void>((resolve) => {
                          sourceBuffer.addEventListener('updateend', () => resolve(), { once: true });
                        });
                      }

                      if (mediaSource.readyState === 'open') {
                        const nextBuf = nextBytes.buffer.slice(
                          nextBytes.byteOffset,
                          nextBytes.byteOffset + nextBytes.byteLength
                        ) as ArrayBuffer;
                        sourceBuffer.appendBuffer(nextBuf);
                        nextIndex++;
                        setDecryptedChunksCount(nextIndex);
                        setProgress(Math.round((nextIndex / chunks.length) * 100));
                      }
                    } catch (err) {
                      console.warn('[Nulla Stream] MSE append failed, falling back:', err);
                    }
                  };

                  sourceBuffer.addEventListener('updateend', () => {
                    if (nextIndex < chunks.length && !sourceBuffer.updating) {
                      streamNext();
                    }
                  });
                } catch (sourceBufferError) {
                  clearTimeout(watchdogTimer);
                  cleanupActiveUrl();
                  fallbackBufferedDecryption(chunks, finalMime, abortController, preDecryptedMap);
                }
              },
              { once: true }
            );
            return;
          }
        }

        // Standard unfragmented MP4: decrypt remaining chunks into Blob directly
        await fallbackBufferedDecryption(chunks, finalMime, abortController, preDecryptedMap);
        return;
      }

      // Non-video files
      await fallbackBufferedDecryption(chunks, finalMime, abortController);
    } catch (err: unknown) {
      if (abortController.signal.aborted) return;
      const message = err instanceof Error ? err.message : 'Decryption error';
      setError(message);
      setIsLoading(false);
    }
  }, [node, token, masterKey, masterKeyRaw, cleanupActiveUrl, fallbackBufferedDecryption]);

  const handleCodecError = useCallback(() => {
    setIsCodecUnsupported(true);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (enabled) {
      loadAndDecryptStream();
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      cleanupActiveUrl();
    };
  }, [node?.id, enabled, loadAndDecryptStream, cleanupActiveUrl]);

  return {
    mediaUrl,
    isLoading,
    progress,
    decryptionLatencyMs,
    totalChunks,
    decryptedChunksCount,
    error,
    isCodecUnsupported,
    handleCodecError,
    retry: loadAndDecryptStream,
  };
}
