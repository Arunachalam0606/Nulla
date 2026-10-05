'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';

import {
  importMasterKeyFromHex,
  decryptMetadata,
  decryptChunk,
} from '@nulla/crypto';

import type { PublicShareResponse } from '@/schemas/share';

import { fetchPublicShareDetails, streamChunkBytes } from '@/lib/api';
import { formatBytes } from '@/lib/utils';

import {
  ShieldCheckIcon,
  DownloadSimpleIcon,
  CircleNotchIcon,
  LockKeyIcon,
  FileIcon,
  CheckCircleIcon,
} from '@phosphor-icons/react';

interface SharePageProps {
  params: Promise<{ token: string }>;
}

export default function SharePage(props: SharePageProps) {
  const { params } = props;
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const defaultKeyInput = '';
  const defaultIsLoading = true;
  const defaultIsDecrypting = false;
  const defaultDownloadProgress = 0;
  const defaultError = '';
  const defaultDecryptedName = '';
  const defaultDecryptedUrl = '';

  const [keyInput, setKeyInput] = useState(defaultKeyInput);
  const [shareData, setShareData] = useState<PublicShareResponse | null>(null);
  const [isLoading, setIsLoading] = useState(defaultIsLoading);
  const [isDecrypting, setIsDecrypting] = useState(defaultIsDecrypting);
  const [downloadProgress, setDownloadProgress] = useState(defaultDownloadProgress);
  const [error, setError] = useState(defaultError);
  const [decryptedName, setDecryptedName] = useState(defaultDecryptedName);
  const [decryptedUrl, setDecryptedUrl] = useState(defaultDecryptedUrl);

  const attemptDecryptionWithKey = async (hexKey: string, data: PublicShareResponse) => {
    try {
      const masterKey = await importMasterKeyFromHex(hexKey.trim());
      const name = await decryptMetadata(
        { ciphertext: data.node.name_encrypted, iv: data.node.name_iv },
        masterKey
      );
      setDecryptedName(name);
      setError('');
    } catch {
      setError('Decryption key invalid or corrupted');
    }
  };

  const handleDownloadAndDecrypt = async () => {
    if (!shareData) return;
    const hashKey = window.location.hash.replace(/^#/, '') || keyInput;
    if (!hashKey) {
      setError('Master decryption key is required');
      return;
    }

    setIsDecrypting(true);
    setDownloadProgress(0);
    setError('');

    try {
      const masterKey = await importMasterKeyFromHex(hashKey.trim());
      const masterKeyRaw = new Uint8Array(
        hashKey.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
      );

      const decryptedBuffers: Uint8Array[] = [];
      const chunks = shareData.node.chunks;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const encryptedBytes = new Uint8Array(await streamChunkBytes(chunk.id));

        const decryptedChunk = await decryptChunk(
          masterKey,
          masterKeyRaw,
          chunk.chunk_index,
          encryptedBytes
        );

        decryptedBuffers.push(decryptedChunk);
        setDownloadProgress(Math.round(((i + 1) / chunks.length) * 100));
      }

      let mime = 'application/octet-stream';
      if (shareData.node.mime_type_encrypted) {
        try {
          mime = await decryptMetadata(
            { ciphertext: shareData.node.mime_type_encrypted, iv: shareData.node.name_iv },
            masterKey
          );
        } catch {
          mime = 'application/octet-stream';
        }
      }

      const blob = new Blob(decryptedBuffers as BlobPart[], { type: mime });
      const objectUrl = URL.createObjectURL(blob);
      setDecryptedUrl(objectUrl);

      // Trigger instant download
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = decryptedName || 'decrypted-file';
      a.click();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Decryption download failed';
      setError(message);
    } finally {
      setIsDecrypting(false);
    }
  };

  useEffect(() => {
    async function loadShare() {
      setIsLoading(true);
      setError('');
      try {
        const data = await fetchPublicShareDetails(token);
        setShareData(data);

        // Check if hash key is present in fragment
        const hashKey = window.location.hash.replace(/^#/, '');
        if (hashKey) {
          setKeyInput(hashKey);
          await attemptDecryptionWithKey(hashKey, data);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Share link not found';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }

    loadShare();
  }, [token]);

  return (
    <section className="min-h-screen bg-[#050505] flex flex-col justify-between p-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="font-mono text-base font-bold text-white tracking-widest">
          <span>NULLA</span>
        </Link>

        <div className="flex items-center gap-2 text-xs text-[#71717a] font-mono border border-[#1f1f1f] bg-[#0b0b0b] px-3 py-1.5 rounded-md">
          <ShieldCheckIcon size={14} className="text-[#10b981]" />

          <span>Zero-Knowledge Decrypted Client-Side</span>
        </div>
      </div>

      <div className="max-w-lg w-full mx-auto bg-[#0a0a0a] border border-[#1f1f1f] p-8 rounded-2xl shadow-2xl my-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <CircleNotchIcon size={28} className="animate-spin text-white" />

            <span className="text-xs text-[#71717a] font-mono">Fetching encrypted storage chunks...</span>
          </div>
        ) : error && !shareData ? (
          <div className="text-center py-8">
            <p className="text-sm text-red-400">
              <span>{error}</span>
            </p>
          </div>
        ) : shareData ? (
          <div className="flex flex-col gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#141414] border border-[#222222] flex items-center justify-center text-white shrink-0">
                <FileIcon size={24} />
              </div>

              <div className="overflow-hidden">
                <h1 className="text-base font-semibold text-white truncate">
                  <span>{decryptedName || 'Encrypted File'}</span>
                </h1>

                <div className="flex items-center gap-3 text-xs text-[#71717a] font-mono mt-1">
                  <span>Size: {formatBytes(shareData.node.size_bytes)}</span>

                  <span>•</span>

                  <span>{shareData.node.chunk_count} discrete 4 MB blocks</span>
                </div>
              </div>
            </div>

            {!decryptedName && (
              <div className="flex flex-col gap-2 bg-[#101010] p-4 rounded-xl border border-[#222222]">
                <div className="flex items-center gap-2 text-xs text-amber-400">
                  <LockKeyIcon size={14} />

                  <span>Decryption Key Required</span>
                </div>

                <p className="text-[11px] text-[#71717a]">
                  <span>
                    The share link did not include the cryptographic hash fragment. Paste your master key hex below:
                  </span>
                </p>

                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="password"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder="Enter 64-character hex master key..."
                    className="bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-xs text-white font-mono flex-1 focus:outline-none focus:border-[#444444]"
                  />

                  <button
                    onClick={() => attemptDecryptionWithKey(keyInput, shareData)}
                    className="bg-white text-black font-semibold text-xs px-3 py-1.5 rounded-lg hover:bg-neutral-200"
                  >
                    <span>Unlock</span>
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-950/30 border border-red-900/50 rounded-lg text-xs text-red-400">
                <span>{error}</span>
              </div>
            )}

            {isDecrypting && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs text-[#888888] font-mono">
                  <span>Streaming & Decrypting 4 MB blocks in RAM...</span>

                  <span>{downloadProgress}%</span>
                </div>

                <div className="w-full bg-[#181818] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-white h-full transition-all duration-200"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {decryptedUrl ? (
              <div className="flex items-center justify-center gap-2 bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl text-emerald-400 text-xs font-medium">
                <CheckCircleIcon size={16} />

                <span>File successfully decrypted in memory and saved to disk.</span>
              </div>
            ) : (
              <button
                onClick={handleDownloadAndDecrypt}
                disabled={isDecrypting || !decryptedName}
                className="w-full flex items-center justify-center gap-2 bg-white text-black font-semibold text-xs py-3 rounded-xl hover:bg-neutral-200 transition-colors disabled:opacity-50"
              >
                {isDecrypting ? (
                  <CircleNotchIcon size={16} className="animate-spin" />
                ) : (
                  <>
                    <DownloadSimpleIcon size={16} />

                    <span>Decrypt & Download ({formatBytes(shareData.node.size_bytes)})</span>
                  </>
                )}
              </button>
            )}
          </div>
        ) : null}
      </div>

      <div className="text-center text-[11px] text-[#555555] font-mono">
        <span>Zero-Knowledge Architecture • Nulla Cloud Drive</span>
      </div>
    </section>
  );
}
