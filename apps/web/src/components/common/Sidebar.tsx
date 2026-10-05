import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useAuthStore } from '@/stores/authStore';

import { formatBytes } from '@/lib/utils';

import {
  FolderSimpleIcon,
  DevicesIcon,
  TrashIcon,
  HardDriveIcon,
} from '@phosphor-icons/react';

export const Sidebar = () => {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);

  const usedBytes = user?.storage_used_bytes || 0;
  const quotaBytes = user?.storage_quota_bytes || 0;
  const percentUsed = quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : 0;

  const navItems = [
    { label: 'Files', href: '/app', icon: FolderSimpleIcon, active: pathname === '/app' },
    { label: 'Devices', href: '/app/devices', icon: DevicesIcon, active: pathname === '/app/devices' },
    { label: 'Trash', href: '/app/trash', icon: TrashIcon, active: pathname === '/app/trash' },
  ];

  return (
    <section className="w-64 border-r border-[#1a1a1a] bg-[#070707] flex flex-col justify-between p-4 h-[calc(100vh-3.5rem)] sticky top-14 select-none">
      <div className="flex flex-col gap-1">
        <div className="px-3 py-2 text-[11px] font-mono uppercase tracking-widest text-[#71717a]">
          <span>Storage Vault</span>
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const activeClass = item.active
            ? 'bg-[#181818] text-white border-l-2 border-white pl-2.5 font-medium'
            : 'text-[#888888] hover:text-white hover:bg-[#121212]';

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 text-xs rounded-md transition-all ${activeClass}`}
            >
              <Icon size={16} />

              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="flex flex-col gap-4 border-t border-[#1a1a1a] pt-4">
        <div className="bg-[#0f0f0f] border border-[#1e1e1e] p-3 rounded-lg flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-[#a1a1aa]">
            <div className="flex items-center gap-1.5 text-white">
              <HardDriveIcon size={14} />

              <span>Cloud Allocation</span>
            </div>

            <span className="font-mono text-[11px] text-[#71717a]">{percentUsed}%</span>
          </div>

          <div className="w-full bg-[#1c1c1c] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-white h-full transition-all duration-500 ease-out"
              style={{ width: `${percentUsed}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#71717a] font-mono">
            <span>{formatBytes(usedBytes)}</span>

            <span>{quotaBytes > 0 ? formatBytes(quotaBytes) : '—'}</span>
          </div>
        </div>

        <div className="bg-[#0d0d0d] border border-[#222222] p-2.5 rounded-lg flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />

          <p className="text-[11px] text-[#999999] leading-tight">
            <span className="text-white font-medium">0 bytes</span> on your local Mac SSD.
          </p>
        </div>
      </div>
    </section>
  );
};
