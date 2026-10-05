import type { Device } from '@/schemas/device';

import { formatRelativeDate } from '@/lib/utils';

import {
  DesktopIcon,
  GlobeIcon,
  DeviceMobileIcon,
  ProhibitIcon,
  CheckCircleIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react';

interface DeviceListProps {
  devices: Device[];
  isLoading: boolean;
  onRevoke: (deviceId: string) => void;
}

export const DeviceList = (props: DeviceListProps) => {
  const { devices, isLoading, onRevoke } = props;

  const getDeviceIcon = (type: string) => {
    if (type === 'mac') return DesktopIcon;
    if (type === 'mobile') return DeviceMobileIcon;
    return GlobeIcon;
  };

  return (
    <section className="w-full">
      <div className="border border-[#1f1f1f] rounded-xl overflow-hidden bg-[#0a0a0a]">
        <div className="p-4 border-b border-[#1b1b1b] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">
              <span>Connected Hardware & Sessions</span>
            </h2>

            <p className="text-xs text-[#71717a] mt-0.5">
              <span>
                Devices authenticated to your encrypted Nulla volume. Revoking immediately terminates remote access.
              </span>
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-xs text-[#71717a] font-mono">
            <span>Querying active hardware sessions...</span>
          </div>
        ) : (
          <div className="divide-y divide-[#161616]">
            {devices.map((device) => {
              const Icon = getDeviceIcon(device.device_type);
              const isRevoked = Boolean(device.revoked_at);

              return (
                <div
                  key={device.id}
                  className="p-4 flex items-center justify-between hover:bg-[#0f0f0f] transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-lg bg-[#141414] border border-[#242424] flex items-center justify-center text-white">
                      <Icon size={20} />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-white">{device.device_name}</span>

                        {device.is_current && (
                          <span className="text-[10px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20 px-1.5 py-0.2 rounded">
                            This Device
                          </span>
                        )}

                        {isRevoked ? (
                          <span className="text-[10px] font-mono bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.2 rounded flex items-center gap-1">
                            <WarningCircleIcon size={10} />
                            Revoked
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded flex items-center gap-1">
                            <CheckCircleIcon size={10} />
                            Active
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-[#71717a] font-mono mt-1">
                        <span>IP: {device.ip_address || '127.0.0.1'}</span>

                        <span>•</span>

                        <span>Active: {formatRelativeDate(device.last_active_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    {!isRevoked && !device.is_current && (
                      <button
                        onClick={() => onRevoke(device.id)}
                        className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 border border-red-950 hover:bg-red-950/30 px-3 py-1.5 rounded-md transition-colors"
                      >
                        <ProhibitIcon size={14} />

                        <span>Revoke Access</span>
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
