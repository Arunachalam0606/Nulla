import type { UserProfile } from '@/schemas/auth';

import { formatBytes } from '@/lib/utils';

import {
  CheckIcon,
  CrownIcon,
  SparkleIcon,
  HardDriveIcon,
} from '@phosphor-icons/react';

interface PlanTabProps {
  user: UserProfile | null;
}

export const PlanTab = (props: PlanTabProps) => {
  const { user } = props;

  const usedBytes = user?.storage_used_bytes || 0;
  const quotaBytes = user?.storage_quota_bytes || 1099511627776;
  const percentUsed = quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : 0;

  return (
    <section className="flex flex-col gap-8 max-w-4xl w-full">
      <div className="bg-[#0a0a0a] border border-[#1e1e1e] p-6 rounded-2xl flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center font-bold">
              <CrownIcon size={20} />
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">
                  <span>Nulla Pro Vault</span>
                </h2>

                <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
                  Active Subscription
                </span>
              </div>

              <p className="text-xs text-[#71717a]">
                <span>1 TB High-Speed Zero-Knowledge Mac Storage</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-white font-semibold">{formatBytes(usedBytes)}</span>

            <span className="text-[#666666]">/</span>

            <span className="text-[#a1a1aa]">{formatBytes(quotaBytes)}</span>
          </div>
        </div>

        <div className="w-full bg-[#161616] h-2 rounded-full overflow-hidden">
          <div
            className="bg-white h-full transition-all duration-500 ease-out"
            style={{ width: `${percentUsed}%` }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-[#161616]">
          <div className="flex items-center gap-2 text-xs text-[#cccccc]">
            <CheckIcon size={14} className="text-emerald-400 shrink-0" />

            <span>0 Bytes physical SSD space</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#cccccc]">
            <CheckIcon size={14} className="text-emerald-400 shrink-0" />

            <span>4 MB Chunk Range Streaming</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#cccccc]">
            <CheckIcon size={14} className="text-emerald-400 shrink-0" />

            <span>Zero bandwidth egress fees</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-white">
          <span>Available Storage Tiers</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-5 rounded-xl flex flex-col justify-between">
            <div className="flex flex-col gap-3">
              <span className="text-xs font-mono uppercase text-[#71717a]">Free Starter</span>

              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-white">$0</span>

                <span className="text-xs text-[#71717a]">/ month</span>
              </div>

              <p className="text-xs text-[#888888]">100 GB encrypted storage for personal testing and lightweight files.</p>

              <div className="flex flex-col gap-2 mt-2 text-xs text-[#aaaaaa]">
                <div className="flex items-center gap-1.5">
                  <CheckIcon size={12} className="text-white" />
                  <span>100 GB Cloud Storage</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckIcon size={12} className="text-white" />
                  <span>Single Mac Sync</span>
                </div>
              </div>
            </div>

            <button
              disabled
              className="mt-6 w-full py-2 rounded-lg text-xs font-medium border border-[#222222] text-[#666666] cursor-not-allowed"
            >
              <span>Downgrade</span>
            </button>
          </div>

          <div className="bg-[#0d0d0d] border-2 border-white p-5 rounded-xl flex flex-col justify-between relative shadow-lg">
            <div className="absolute -top-2.5 right-4 bg-white text-black text-[10px] font-mono font-bold px-2 py-0.5 rounded">
              CURRENT
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-1.5">
                <SparkleIcon size={14} className="text-amber-400" />
                <span className="text-xs font-mono uppercase text-white font-semibold">Pro Vault</span>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-white">$12</span>

                <span className="text-xs text-[#71717a]">/ month</span>
              </div>

              <p className="text-xs text-[#aaaaaa]">1 TB native cloud drive with 0 bytes on your SSD and 0.8s 4K video seeking.</p>

              <div className="flex flex-col gap-2 mt-2 text-xs text-[#cccccc]">
                <div className="flex items-center gap-1.5">
                  <CheckIcon size={12} className="text-emerald-400" />
                  <span>1 TB High-Speed Storage</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckIcon size={12} className="text-emerald-400" />
                  <span>Unlimited Connected Macs</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckIcon size={12} className="text-emerald-400" />
                  <span>Finder Native FileProvider</span>
                </div>
              </div>
            </div>

            <div className="mt-6 w-full py-2 rounded-lg text-xs font-semibold bg-white text-black text-center">
              <span>Current Plan</span>
            </div>
          </div>

          <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-5 rounded-xl flex flex-col justify-between">
            <div className="flex flex-col gap-3">
              <span className="text-xs font-mono uppercase text-[#71717a]">Studio & Team</span>

              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-white">$45</span>

                <span className="text-xs text-[#71717a]">/ month</span>
              </div>

              <p className="text-xs text-[#888888]">10 TB for video editors, VFX production houses, and high-throughput studios.</p>

              <div className="flex flex-col gap-2 mt-2 text-xs text-[#aaaaaa]">
                <div className="flex items-center gap-1.5">
                  <CheckIcon size={12} className="text-white" />
                  <span>10 TB Dedicated Capacity</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckIcon size={12} className="text-white" />
                  <span>Team Workspaces & RBAC</span>
                </div>
              </div>
            </div>

            <button className="mt-6 w-full py-2 rounded-lg text-xs font-medium border border-[#2b2b2b] hover:bg-[#161616] text-white transition-colors">
              <span>Upgrade to Studio</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
