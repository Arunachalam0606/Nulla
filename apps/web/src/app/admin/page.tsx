'use client';

import Link from 'next/link';

import { useAdminLogic } from '@/hooks/useAdminLogic';

import { TelemetryCards } from '@/components/admin/TelemetryCards';
import { StorageMeter } from '@/components/admin/StorageMeter';

import {
  CpuIcon,
  ArrowsClockwiseIcon,
  ActivityIcon,
  DatabaseIcon,
  CloudIcon,
  KeyIcon,
  CircleNotchIcon,
} from '@phosphor-icons/react';

export default function AdminPage() {
  const {
    telemetry,
    isLoading,
    error,
    adminKey,
    setAdminKey,
    refreshMetrics,
  } = useAdminLogic();

  return (
    <section className="min-h-screen bg-[#040404] text-[#ececec] flex flex-col p-8">
      <div className="max-w-7xl w-full mx-auto flex flex-col gap-8">
        <div className="flex items-center justify-between border-b border-[#1b1b1b] pb-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#111111] border border-[#242424] flex items-center justify-center text-white">
              <CpuIcon size={22} />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">
                  <span>Nulla Telemetry & Cloud Health</span>
                </h1>

                <span className="text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded">
                  LIVE TELEMETRY
                </span>
              </div>

              <p className="text-xs text-[#71717a] mt-0.5">
                <span>
                  Zero-Knowledge architecture guarantee: Server and database possess no encryption keys or plaintext metadata.
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={refreshMetrics}
              disabled={isLoading}
              className="flex items-center gap-1.5 bg-[#0f0f0f] hover:bg-[#181818] border border-[#222222] text-xs px-3 py-1.5 rounded-lg text-white transition-colors"
            >
              <ArrowsClockwiseIcon size={14} className={isLoading ? 'animate-spin' : ''} />

              <span>Refresh</span>
            </button>

            <Link
              href="/app"
              className="bg-white text-black text-xs font-semibold px-4 py-1.5 rounded-lg hover:bg-neutral-200 transition-colors"
            >
              <span>Back to Vault</span>
            </Link>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-xl text-xs text-red-400">
            <span>{error}</span>
          </div>
        )}

        {isLoading && !telemetry ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-center">
            <CircleNotchIcon size={32} className="animate-spin text-white" />

            <span className="text-xs font-mono text-[#71717a]">
              Querying live database telemetry...
            </span>
          </div>
        ) : (
          <>
            <TelemetryCards telemetry={telemetry} />

            {telemetry && (
              <StorageMeter
                totalUsedBytes={telemetry.storage.total_used_bytes}
                totalQuotaBytes={telemetry.storage.total_quota_bytes}
                percentageUsed={telemetry.storage.percentage_used}
              />
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-5 rounded-xl flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-[#141414] border border-[#222222] flex items-center justify-center text-emerald-400">
                  <CloudIcon size={20} />
                </div>

                <div>
                  <span className="text-xs font-semibold text-white">Cloudflare R2 Bucket</span>

                  <p className="text-[11px] text-[#71717a] mt-0.5">
                    <span>{telemetry?.health.r2_connected ? 'Connected (0 Egress Fees)' : 'Connecting...'}</span>
                  </p>
                </div>
              </div>

              <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-5 rounded-xl flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-[#141414] border border-[#222222] flex items-center justify-center text-sky-400">
                  <DatabaseIcon size={20} />
                </div>

                <div>
                  <span className="text-xs font-semibold text-white">Cloudflare D1 Database</span>

                  <p className="text-[11px] text-[#71717a] mt-0.5">
                    <span>{telemetry?.health.d1_connected ? 'Operational (SQLite Edge)' : 'Connecting...'}</span>
                  </p>
                </div>
              </div>

              <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-5 rounded-xl flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-[#141414] border border-[#222222] flex items-center justify-center text-amber-400">
                  <ActivityIcon size={20} />
                </div>

                <div>
                  <span className="text-xs font-semibold text-white">Edge Latency</span>

                  <p className="text-[11px] text-[#71717a] mt-0.5">
                    <span>
                      {telemetry?.health.latency_ms !== undefined
                        ? `${telemetry.health.latency_ms} ms roundtrip`
                        : 'Querying...'}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-6 rounded-xl flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <KeyIcon size={16} />

            <span>Admin Access Configuration</span>
          </div>

          <p className="text-xs text-[#71717a]">
            <span>
              Authorize live metrics queries from Cloudflare D1. File contents and cryptographic keys remain client-encrypted and unobservable.
            </span>
          </p>

          <div className="flex items-center gap-3 mt-2">
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="Admin API Key..."
              className="bg-[#121212] border border-[#242424] rounded-lg px-3 py-1.5 text-xs text-white font-mono max-w-md w-full focus:outline-none focus:border-[#444444]"
            />

            <button
              onClick={refreshMetrics}
              className="bg-[#181818] hover:bg-[#222222] text-white text-xs px-4 py-1.5 rounded-lg border border-[#2e2e2e] transition-colors"
            >
              <span>Authenticate</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
