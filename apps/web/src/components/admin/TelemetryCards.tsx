import type { AdminTelemetry } from '@/schemas/admin';

import { formatBytes } from '@/lib/utils';

import {
  UsersIcon,
  HardDriveIcon,
  FilesIcon,
  PulseIcon,
  DesktopIcon,
  GlobeIcon,
  DeviceMobileIcon,
} from '@phosphor-icons/react';

interface TelemetryCardsProps {
  telemetry: AdminTelemetry['telemetry'] | null;
}

export const TelemetryCards = (props: TelemetryCardsProps) => {
  const { telemetry } = props;

  if (!telemetry) return null;

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-[#0b0b0b] border border-[#1f1f1f] p-5 rounded-xl flex flex-col justify-between">
        <div className="flex items-center justify-between text-[#888888]">
          <span className="text-xs font-mono uppercase tracking-wider">Total Users</span>

          <UsersIcon size={18} className="text-white" />
        </div>

        <div className="mt-4">
          <p className="text-2xl font-bold font-mono text-white">
            <span>{telemetry.users.total}</span>
          </p>

          <p className="text-[11px] text-[#71717a] mt-1">
            <span>Client-side E2EE enrolled accounts</span>
          </p>
        </div>
      </div>

      <div className="bg-[#0b0b0b] border border-[#1f1f1f] p-5 rounded-xl flex flex-col justify-between">
        <div className="flex items-center justify-between text-[#888888]">
          <span className="text-xs font-mono uppercase tracking-wider">Encrypted Storage</span>

          <HardDriveIcon size={18} className="text-white" />
        </div>

        <div className="mt-4">
          <p className="text-2xl font-bold font-mono text-white">
            <span>{formatBytes(telemetry.storage.total_used_bytes)}</span>
          </p>

          <p className="text-[11px] text-emerald-400 font-mono mt-1">
            <span>{telemetry.storage.percentage_used}% of Cloud Allocation</span>
          </p>
        </div>
      </div>

      <div className="bg-[#0b0b0b] border border-[#1f1f1f] p-5 rounded-xl flex flex-col justify-between">
        <div className="flex items-center justify-between text-[#888888]">
          <span className="text-xs font-mono uppercase tracking-wider">Vault Block Chunks</span>

          <FilesIcon size={18} className="text-white" />
        </div>

        <div className="mt-4">
          <p className="text-2xl font-bold font-mono text-white">
            <span>{telemetry.nodes.total_chunks}</span>
          </p>

          <p className="text-[11px] text-[#71717a] mt-1">
            <span>{telemetry.nodes.files} files in 4 MB discrete blocks</span>
          </p>
        </div>
      </div>

      <div className="bg-[#0b0b0b] border border-[#1f1f1f] p-5 rounded-xl flex flex-col justify-between">
        <div className="flex items-center justify-between text-[#888888]">
          <span className="text-xs font-mono uppercase tracking-wider">Active Hardware</span>

          <PulseIcon size={18} className="text-emerald-400" />
        </div>

        <div className="mt-4">
          <p className="text-2xl font-bold font-mono text-white">
            <span>{telemetry.sessions.active}</span>
          </p>

          <div className="flex items-center gap-3 text-[11px] text-[#71717a] font-mono mt-1">
            <span className="flex items-center gap-1">
              <DesktopIcon size={12} /> {telemetry.sessions.mac} Mac
            </span>

            <span className="flex items-center gap-1">
              <GlobeIcon size={12} /> {telemetry.sessions.web} Web
            </span>

            <span className="flex items-center gap-1">
              <DeviceMobileIcon size={12} /> {telemetry.sessions.mobile} Mobile
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
