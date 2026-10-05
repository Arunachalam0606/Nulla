import type { UserProfile } from '@/schemas/auth';
import type { Device } from '@/schemas/device';

import { formatBytes, formatRelativeDate } from '@/lib/utils';

import {
  DesktopIcon,
  ShieldCheckIcon,
  HardDriveIcon,
  ProhibitIcon,
  CheckCircleIcon,
  WarningCircleIcon,
  CircleNotchIcon,
} from '@phosphor-icons/react';

interface AccountTabProps {
  user: UserProfile | null;
  devices: Device[];
  isLoading: boolean;
  onRevoke: (deviceId: string) => void;
}

export const AccountTab = (props: AccountTabProps) => {
  const { user, devices, isLoading, onRevoke } = props;

  const usedBytes = user?.storage_used_bytes || 0;
  const quotaBytes = user?.storage_quota_bytes || 1099511627776; // 1 TB default quota
  const percentUsed = quotaBytes > 0 ? Math.min(100, Math.max(1, Math.round((usedBytes / quotaBytes) * 100))) : 0;

  const macs = devices.filter((d) => d.device_type === 'mac' || d.device_name.toLowerCase().includes('mac'));

  return (
    <section className="flex flex-col gap-6 max-w-4xl w-full">
      <div className="bg-[#0a0a0a] border border-[#1e1e1e] p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#141414] border border-[#2b2b2b] flex items-center justify-center text-white font-mono text-lg font-bold">
            <span>{user?.email?.charAt(0).toUpperCase() || 'U'}</span>
          </div>

          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-white">
              <span>{user?.email || 'Authenticated User'}</span>
            </h2>

            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                <ShieldCheckIcon size={12} />
                Client-Side E2EE
              </span>

              <span className="text-xs text-[#71717a] font-mono">
                <span>Argon2id + AES-256-GCM</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-[#111111] border border-[#222222] px-3.5 py-2 rounded-xl text-xs text-[#888888]">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />

          <span>Vault Mounted in Finder</span>
        </div>
      </div>

      <div className="bg-[#0a0a0a] border border-[#1e1e1e] p-6 rounded-2xl flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <HardDriveIcon size={16} />

            <h3 className="text-sm font-semibold">
              <span>Cloud Storage Allocation</span>
            </h3>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-white font-semibold">{formatBytes(usedBytes)}</span>

            <span className="text-[#666666]">of</span>

            <span className="text-[#a1a1aa]">{formatBytes(quotaBytes)} used</span>
          </div>
        </div>

        <div className="w-full bg-[#161616] h-2 rounded-full overflow-hidden">
          <div
            className="bg-white h-full transition-all duration-500 ease-out"
            style={{ width: `${percentUsed}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-[#71717a] font-mono">
          <span>0 Bytes Physical SSD Footprint</span>

          <span>{percentUsed}% capacity allocated</span>
        </div>
      </div>

      <div className="border border-[#1e1e1e] rounded-2xl bg-[#0a0a0a] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-[#181818] flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-white">
              <span>Macs</span>
            </h3>

            <p className="text-xs text-[#71717a]">
              <span>Hardware running the Nulla FileProvider extension synced to your vault.</span>
            </p>
          </div>

          <div className="text-xs font-mono text-[#888888]">
            <span>{macs.length} Connected {macs.length === 1 ? 'Mac' : 'Macs'}</span>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-xs text-[#71717a] font-mono flex items-center justify-center gap-2">
            <CircleNotchIcon size={16} className="animate-spin text-white" />

            <span>Discovering authorized Macs...</span>
          </div>
        ) : macs.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#71717a]">
            <span>No Mac clients registered. Open the Nulla desktop application to link your Mac.</span>
          </div>
        ) : (
          <div className="divide-y divide-[#161616]">
            {macs.map((device) => {
              const isRevoked = Boolean(device.revoked_at);

              return (
                <div
                  key={device.id}
                  className="p-5 flex items-center justify-between hover:bg-[#0d0d0d] transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#141414] border border-[#242424] flex items-center justify-center text-white">
                      <DesktopIcon size={20} />
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">{device.device_name}</span>

                        {device.is_current && (
                          <span className="text-[10px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20 px-1.5 py-0.2 rounded">
                            Current Machine
                          </span>
                        )}

                        {isRevoked ? (
                          <span className="text-[10px] font-mono bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.2 rounded flex items-center gap-1">
                            <WarningCircleIcon size={10} />
                            Disconnected
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded flex items-center gap-1">
                            <CheckCircleIcon size={10} />
                            Mounted
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-[#71717a] font-mono">
                        <span>IP: {device.ip_address || '127.0.0.1'}</span>

                        <span>•</span>

                        <span>Active: {formatRelativeDate(device.last_active_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    {!isRevoked && (
                      <button
                        onClick={() => onRevoke(device.id)}
                        className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 border border-red-950 hover:bg-red-950/30 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <ProhibitIcon size={14} />

                        <span>Sign Out</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
