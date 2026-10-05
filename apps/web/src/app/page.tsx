'use client';

import { useState } from 'react';
import Link from 'next/link';

import {
  ShieldCheckIcon,
  HardDriveIcon,
  LightningIcon,
  PlayIcon,
  DesktopIcon,
  ArrowRightIcon,
  CheckIcon,
  LockKeyIcon,
  CloudCheckIcon,
} from '@phosphor-icons/react';

export default function HomePage() {
  const defaultIsSeeking = false;
  const defaultSeekPosition = 0.35;
  const defaultSeekLatency = 14;

  const [isSeeking, setIsSeeking] = useState(defaultIsSeeking);
  const [seekPosition, setSeekPosition] = useState(defaultSeekPosition);
  const [seekLatency, setSeekLatency] = useState(defaultSeekLatency);

  const handleSimulateSeek = (newPosition: number) => {
    setIsSeeking(true);
    setSeekPosition(newPosition);

    const randomLatency = Math.floor(Math.random() * 12) + 8; // 8-20ms
    setTimeout(() => {
      setSeekLatency(randomLatency);
      setIsSeeking(false);
    }, 150);
  };

  return (
    <section className="min-h-screen bg-[#030303] text-[#ededed] flex flex-col justify-between selection:bg-white selection:text-black">
      <header className="border-b border-[#141414] px-8 h-16 flex items-center justify-between sticky top-0 bg-[#030303]/90 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <span className="font-mono text-lg font-bold tracking-widest text-white">NULLA</span>

          <span className="text-[10px] font-mono text-[#71717a] border border-[#222222] px-2 py-0.5 rounded uppercase tracking-wider">
            Native macOS Cloud Drive
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <Link
            href="/admin"
            className="text-[#71717a] hover:text-white transition-colors"
          >
            <span>Telemetry</span>
          </Link>

          <Link
            href="/login"
            className="text-[#71717a] hover:text-white transition-colors"
          >
            <span>Sign In</span>
          </Link>

          <Link
            href="/app"
            className="bg-white text-black font-semibold px-4 py-2 rounded-lg hover:bg-neutral-200 transition-colors"
          >
            <span>Launch Web Vault</span>
          </Link>
        </div>
      </header>

      <div className="flex-1 max-w-6xl w-full mx-auto px-6 py-20 flex flex-col items-center text-center">
        <div className="flex items-center gap-2 bg-[#0c0c0c] border border-[#222222] px-3.5 py-1.5 rounded-full text-xs text-[#888888] mb-8 font-mono">
          <ShieldCheckIcon size={14} className="text-[#10b981]" />

          <span>Zero-Knowledge E2EE • Deterministic 4 MB Chunk Range Streaming</span>
        </div>

        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tighter text-white max-w-4xl leading-[1.05]">
          <span>0 bytes on your Mac.</span>

          <br />

          <span className="text-[#888888]">Terabytes in the cloud.</span>
        </h1>

        <p className="mt-6 text-sm sm:text-base text-[#888888] max-w-2xl leading-relaxed">
          <span>
            Nulla mounts directly alongside Macintosh HD in Finder. Files show their full logical size
            (e.g., 48.2 GB ProRes video) but occupy zero physical SSD blocks until read.
            Instant sub-0.8s media seeking powered by client-side AES-256-GCM.
          </span>
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/app"
            className="flex items-center gap-2 bg-white text-black font-semibold text-xs px-6 py-3.5 rounded-xl hover:bg-neutral-200 transition-colors shadow-lg"
          >
            <span>Open Encrypted Vault</span>

            <ArrowRightIcon size={14} />
          </Link>

          <a
            href="#architecture"
            className="flex items-center gap-2 bg-[#0d0d0d] hover:bg-[#141414] text-white border border-[#222222] font-semibold text-xs px-6 py-3.5 rounded-xl transition-colors"
          >
            <DesktopIcon size={14} />

            <span>macOS FileProvider Architecture</span>
          </a>
        </div>

        {/* Interactive Finder Inspector Simulator */}
        <div className="w-full max-w-3xl mt-20 bg-[#090909] border border-[#1c1c1c] rounded-2xl p-6 shadow-2xl text-left">
          <div className="flex items-center justify-between border-b border-[#181818] pb-4 mb-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
              <div className="w-3 h-3 rounded-full bg-[#27c93f]" />

              <span className="text-xs font-mono text-[#777777] ml-2">
                Finder Inspector — Feature_Film_4K_Cut.mov
              </span>
            </div>

            <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              <CloudCheckIcon size={12} />

              <span>Mounted in /Volumes/Nulla</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="flex flex-col gap-3 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-[#141414] pb-2">
                <span className="text-[#666666]">Logical File Size:</span>

                <span className="text-white font-semibold">48,239,184,896 bytes (48.2 GB)</span>
              </div>

              <div className="flex items-center justify-between border-b border-[#141414] pb-2">
                <span className="text-[#666666]">Physical Space on SSD:</span>

                <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                  0 bytes
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-[#141414] pb-2">
                <span className="text-[#666666]">Chunk Size:</span>

                <span className="text-white">4,194,304 bytes (4 MB)</span>
              </div>

              <div className="flex items-center justify-between border-b border-[#141414] pb-2">
                <span className="text-[#666666]">Deterministic IV:</span>

                <span className="text-[#aaaaaa] truncate max-w-[180px]">
                  HMAC-SHA256(Key, Index)[0..12]
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#666666]">Random Seek Latency:</span>

                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <LightningIcon size={12} />
                  {seekLatency} ms
                </span>
              </div>
            </div>

            {/* Interactive Random-Access Timeline Seeking */}
            <div className="bg-[#050505] border border-[#1b1b1b] p-4 rounded-xl flex flex-col gap-3">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-[#888888]">HTTP 206 Partial Seek Simulator</span>

                <span className="text-white">
                  Chunk #{Math.floor(seekPosition * 11500)} / 11,500
                </span>
              </div>

              <div className="relative w-full h-8 bg-[#111111] rounded-lg border border-[#222222] flex items-center px-2 cursor-pointer">
                <div
                  className="absolute left-0 top-0 bottom-0 bg-white/10 rounded-lg pointer-events-none"
                  style={{ width: `${seekPosition * 100}%` }}
                />

                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={seekPosition}
                  onChange={(e) => handleSimulateSeek(parseFloat(e.target.value))}
                  className="w-full accent-white cursor-pointer z-10"
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-[#666666] font-mono">
                <span>00:00:00</span>

                <span className="text-emerald-400">
                  {isSeeking ? 'Streaming 4 MB Block...' : `Instant Ready (${seekLatency}ms)`}
                </span>

                <span>02:14:38</span>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Specs */}
        <div id="architecture" className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 text-left w-full">
          <div className="bg-[#080808] border border-[#181818] p-6 rounded-xl flex flex-col gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#141414] border border-[#222222] flex items-center justify-center text-white">
              <LockKeyIcon size={20} />
            </div>

            <h3 className="text-sm font-bold text-white">
              <span>Absolute Zero-Knowledge</span>
            </h3>

            <p className="text-xs text-[#71717a] leading-relaxed">
              <span>
                Passwords are spun through 100,000 PBKDF2 rounds. Your Master Encryption Key resides solely in Apple Keychain and RAM. The server stores only blinded ciphertext tokens.
              </span>
            </p>
          </div>

          <div className="bg-[#080808] border border-[#181818] p-6 rounded-xl flex flex-col gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#141414] border border-[#222222] flex items-center justify-center text-white">
              <DesktopIcon size={20} />
            </div>

            <h3 className="text-sm font-bold text-white">
              <span>Apple FileProvider Extension</span>
            </h3>

            <p className="text-xs text-[#71717a] leading-relaxed">
              <span>
                Native integration with NSFileProviderReplicatedExtension. QuickTime, Final Cut Pro, and Adobe Premiere read and scrub files directly from the Finder mount.
              </span>
            </p>
          </div>

          <div className="bg-[#080808] border border-[#181818] p-6 rounded-xl flex flex-col gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#141414] border border-[#222222] flex items-center justify-center text-white">
              <LightningIcon size={20} />
            </div>

            <h3 className="text-sm font-bold text-white">
              <span>Deterministic Seeking</span>
            </h3>

            <p className="text-xs text-[#71717a] leading-relaxed">
              <span>
                IVs are derived mathematically from HMAC-SHA256(MasterKey, chunkIndex). The player computes the exact 4 MB block needed and fetches only 4 MB over HTTP 206 Partial Content.
              </span>
            </p>
          </div>
        </div>
      </div>

      <footer className="border-t border-[#141414] px-8 py-8 flex flex-col sm:flex-row items-center justify-between text-xs text-[#555555] font-mono gap-4">
        <div>
          <span>Nulla Cloud Drive • 0 bytes on your Mac. Terabytes in the cloud.</span>
        </div>

        <div className="flex items-center gap-6 text-[#71717a]">
          <Link href="/app" className="hover:text-white transition-colors">
            <span>Client Vault</span>
          </Link>

          <Link href="/admin" className="hover:text-white transition-colors">
            <span>Admin Metrics</span>
          </Link>

          <Link href="/login" className="hover:text-white transition-colors">
            <span>Sign In</span>
          </Link>
        </div>
      </footer>
    </section>
  );
}
