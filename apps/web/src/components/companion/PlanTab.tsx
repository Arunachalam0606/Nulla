import type { UserProfile } from '@/schemas/auth';

import { formatBytes } from '@/lib/utils';

import {
  CheckIcon,
  CrownIcon,
  SparkleIcon,
} from '@phosphor-icons/react';

interface PlanTabProps {
  user: UserProfile | null;
}

export const PlanTab = (props: PlanTabProps) => {
  const { user } = props;

  const usedBytes = user?.storage_used_bytes || 0;
  const quotaBytes = user?.storage_quota_bytes || 107374182400;
  const percentUsed = quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : 0;

  return (
    <section className="flex flex-col gap-8 max-w-4xl w-full">
      <div className="bg-white dark:bg-[#1c1c1f] border border-black/5 dark:border-white/10 p-6 rounded-2xl shadow-sm flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 flex items-center justify-center font-bold shadow-md">
              <CrownIcon size={20} />
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
                  <span>Nulla Pro Vault</span>
                </h2>

                <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                  Active Subscription
                </span>
              </div>

              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                <span>{formatBytes(quotaBytes)} High-Speed Zero-Knowledge Mac Storage</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-neutral-900 dark:text-white font-semibold">{formatBytes(usedBytes)}</span>

            <span className="text-neutral-400">/</span>

            <span className="text-neutral-600 dark:text-neutral-400">{formatBytes(quotaBytes)} used</span>
          </div>
        </div>

        <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-2.5 rounded-full overflow-hidden p-0.5">
          <div
            className="bg-neutral-900 dark:bg-white h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${percentUsed}%` }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-black/5 dark:border-white/5">
          <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
            <CheckIcon size={14} className="text-emerald-500 shrink-0" />

            <span>0 Bytes physical SSD space</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
            <CheckIcon size={14} className="text-emerald-500 shrink-0" />

            <span>4 MB Chunk Range Streaming</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
            <CheckIcon size={14} className="text-emerald-500 shrink-0" />

            <span>Zero bandwidth egress fees</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
          <span>Available Storage Tiers</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white dark:bg-[#1c1c1f] border border-black/5 dark:border-white/10 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
            <div className="flex flex-col gap-3">
              <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 dark:text-neutral-500 font-semibold">
                Free Starter
              </span>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">$0</span>

                <span className="text-xs text-neutral-400 dark:text-neutral-500">/ month</span>
              </div>

              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                <span>100 GB encrypted storage for personal testing and lightweight files.</span>
              </p>

              <div className="flex flex-col gap-2.5 mt-2 text-xs text-neutral-600 dark:text-neutral-300">
                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-neutral-900 dark:text-white shrink-0" />
                  <span>100 GB Cloud Storage</span>
                </div>

                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-neutral-900 dark:text-white shrink-0" />
                  <span>Single Mac Sync</span>
                </div>
              </div>
            </div>

            <button
              disabled
              className="mt-6 w-full py-2.5 rounded-full text-xs font-medium border border-black/5 dark:border-white/10 text-neutral-400 cursor-not-allowed bg-neutral-50 dark:bg-black/20"
            >
              <span>Downgrade</span>
            </button>
          </div>

          <div className="bg-white dark:bg-[#1c1c1f] border-2 border-neutral-900 dark:border-white p-6 rounded-2xl shadow-lg flex flex-col justify-between relative">
            <div className="absolute -top-3 right-6 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full shadow-sm">
              CURRENT
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-1.5">
                <SparkleIcon size={14} className="text-amber-500" />
                <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-900 dark:text-white font-bold">
                  Pro Vault
                </span>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">$12</span>

                <span className="text-xs text-neutral-400 dark:text-neutral-500">/ month</span>
              </div>

              <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                <span>{formatBytes(quotaBytes)} native cloud drive with 0 bytes on your SSD and 0.8s 4K video seeking.</span>
              </p>

              <div className="flex flex-col gap-2.5 mt-2 text-xs text-neutral-700 dark:text-neutral-200">
                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-emerald-500 shrink-0" />
                  <span>{formatBytes(quotaBytes)} High-Speed Storage</span>
                </div>

                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-emerald-500 shrink-0" />
                  <span>Unlimited Connected Macs</span>
                </div>

                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-emerald-500 shrink-0" />
                  <span>Finder Native FileProvider</span>
                </div>
              </div>
            </div>

            <button
              disabled
              className="mt-6 w-full py-2.5 rounded-full text-xs font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 opacity-90 cursor-default"
            >
              <span>Current Tier Active</span>
            </button>
          </div>

          <div className="bg-white dark:bg-[#1c1c1f] border border-black/5 dark:border-white/10 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
            <div className="flex flex-col gap-3">
              <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 dark:text-neutral-500 font-semibold">
                Team Enterprise
              </span>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">$49</span>

                <span className="text-xs text-neutral-400 dark:text-neutral-500">/ month</span>
              </div>

              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                <span>10 TB shared organization vault with custom KMS key derivation and audit trails.</span>
              </p>

              <div className="flex flex-col gap-2.5 mt-2 text-xs text-neutral-600 dark:text-neutral-300">
                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-neutral-900 dark:text-white shrink-0" />
                  <span>10 TB Organization Pool</span>
                </div>

                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-neutral-900 dark:text-white shrink-0" />
                  <span>Dedicated Audit Logs</span>
                </div>

                <div className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-neutral-900 dark:text-white shrink-0" />
                  <span>Hardware Key (YubiKey) MFA</span>
                </div>
              </div>
            </div>

            <button
              className="mt-6 w-full py-2.5 rounded-full text-xs font-semibold border border-black/10 dark:border-white/10 text-neutral-900 dark:text-white hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors"
            >
              <span>Contact Sales</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
