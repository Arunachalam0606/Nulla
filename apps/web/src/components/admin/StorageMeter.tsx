import { formatBytes } from '@/lib/utils';

import { CloudCheckIcon, ShieldCheckIcon } from '@phosphor-icons/react';

interface StorageMeterProps {
  totalUsedBytes: number;
  totalQuotaBytes: number;
  percentageUsed: number;
}

export const StorageMeter = (props: StorageMeterProps) => {
  const { totalUsedBytes, totalQuotaBytes, percentageUsed } = props;

  return (
    <section className="bg-[#0b0b0b] border border-[#1f1f1f] p-6 rounded-xl flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">
            <span>Encrypted Cloud Capacity</span>
          </h3>

          <p className="text-xs text-[#71717a] mt-0.5">
            <span>
              Real-time consumption across Cloudflare R2 object storage with zero egress fees.
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#121212] border border-[#222222] px-3 py-1.5 rounded-md text-xs text-[#10b981] font-mono">
          <ShieldCheckIcon size={14} />

          <span>Zero Plaintext Access</span>
        </div>
      </div>

      <div className="w-full bg-[#181818] h-3 rounded-full overflow-hidden p-0.5 border border-[#252525]">
        <div
          className="bg-white h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${Math.min(100, percentageUsed)}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs font-mono text-[#888888]">
        <div className="flex items-center gap-2">
          <CloudCheckIcon size={16} className="text-white" />

          <span>Used: {formatBytes(totalUsedBytes)}</span>
        </div>

        <span>Allocated: {formatBytes(totalQuotaBytes)}</span>
      </div>
    </section>
  );
};
