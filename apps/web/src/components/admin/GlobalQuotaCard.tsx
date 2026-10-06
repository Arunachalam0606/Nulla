import { formatBytes } from '@/lib/utils';

import type { AdminSystemSettings } from '@/schemas/admin';

import {
  HardDrivesIcon,
  LockKeyOpenIcon,
  LockSimpleIcon,
  ShieldCheckIcon,
} from '@phosphor-icons/react';

interface GlobalQuotaCardProps {
  systemSettings: AdminSystemSettings | null;
  isLoading: boolean;
  onOpenUnlockModal: () => void;
}

export const GlobalQuotaCard = (props: GlobalQuotaCardProps) => {
  const { systemSettings, isLoading, onOpenUnlockModal } = props;

  const totalCap = systemSettings?.global_cap_bytes || 10737418240;
  const totalUsed = systemSettings?.total_used_bytes || 0;
  const totalAllocated = systemSettings?.total_allocated_bytes || 0;
  const isUnlimited = Boolean(systemSettings?.is_unlimited);

  const allocatedPercentage = isUnlimited
    ? 100
    : Math.min(100, Math.round((totalAllocated / totalCap) * 100));

  const usedPercentage = isUnlimited
    ? Math.min(100, Math.round((totalUsed / (totalAllocated || 1)) * 100))
    : Math.min(100, Math.round((totalUsed / totalCap) * 100));

  const tierBadgeText = isUnlimited ? 'UNLIMITED STORAGE ACTIVE' : 'FREE TIER: 10 GB GLOBAL CEILING';

  return (
    <section className="bg-[#0b0b0b] border border-[#1f1f1f] p-6 rounded-xl flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#141414] border border-[#252525] flex items-center justify-center text-white">
            <HardDrivesIcon size={22} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">
                <span>Global Storage Tier Allocation</span>
              </h2>

              <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded border ${isUnlimited ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                {tierBadgeText}
              </span>
            </div>

            <p className="text-xs text-[#71717a] mt-0.5">
              <span>
                Enforced by Cloudflare D1. Prevents runaway cloud egress and caps aggregate user allotments.
              </span>
            </p>
          </div>
        </div>

        <button
          onClick={onOpenUnlockModal}
          disabled={isLoading}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border transition-all ${
            isUnlimited
              ? 'bg-[#181818] hover:bg-[#202020] text-amber-400 border-amber-500/30'
              : 'bg-white hover:bg-neutral-200 text-black border-white'
          }`}
        >
          {isUnlimited ? (
            <>
              <LockSimpleIcon size={14} />

              <span>Lock to 10 GB Cap</span>
            </>
          ) : (
            <>
              <LockKeyOpenIcon size={14} />

              <span>Unlock Unlimited Storage</span>
            </>
          )}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-mono text-[#a1a1aa]">
          <span>
            Allocated: {formatBytes(totalAllocated)} / {isUnlimited ? '∞ Unlimited' : formatBytes(totalCap)} ({allocatedPercentage}%)
          </span>

          <span>
            Actual Used: {formatBytes(totalUsed)} ({usedPercentage}%)
          </span>
        </div>

        <div className="w-full bg-[#161616] h-3.5 rounded-full overflow-hidden p-0.5 border border-[#242424] relative">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              isUnlimited
                ? 'bg-amber-400'
                : allocatedPercentage > 90
                ? 'bg-red-400'
                : 'bg-emerald-400'
            }`}
            style={{ width: `${allocatedPercentage}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-[#181818] text-xs">
        <div className="flex flex-col gap-1">
          <span className="text-[#71717a]">Storage Tier Mode</span>

          <span className="font-semibold text-white uppercase font-mono">
            {isUnlimited ? 'Unrestricted / Pay-As-You-Go' : '10 GB Free Tier (Capped)'}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[#71717a]">Available Headroom</span>

          <span className="font-semibold text-white font-mono">
            {isUnlimited ? 'Unlimited Capacity' : formatBytes(Math.max(0, totalCap - totalAllocated))}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[#71717a]">Security Protocol</span>

          <div className="flex items-center gap-1.5 text-emerald-400 font-mono">
            <ShieldCheckIcon size={14} />

            <span>AES-256-GCM Zero Knowledge</span>
          </div>
        </div>
      </div>
    </section>
  );
};
