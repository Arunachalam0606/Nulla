import Link from 'next/link';

import { useAuthStore } from '@/stores/authStore';
import { useExplorerStore } from '@/stores/explorerStore';

import {
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  SignOutIcon,
  CpuIcon,
} from '@phosphor-icons/react';

export const Header = () => {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const searchQuery = useExplorerStore((state) => state.searchQuery);
  const setSearchQuery = useExplorerStore((state) => state.setSearchQuery);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const handleLogoutClick = () => {
    logout();
  };

  return (
    <section className="h-14 border-b border-[#1f1f1f] bg-[#080808]/90 backdrop-blur-md px-6 flex items-center justify-between z-20 sticky top-0">
      <div className="flex items-center gap-6">
        <Link href="/app" className="flex items-center gap-2">
          <span className="font-mono text-base font-semibold tracking-wider text-white">NULLA</span>

          <span className="text-[10px] tracking-widest text-[#71717a] uppercase border border-[#27272a] px-1.5 py-0.5 rounded">
            v1.0 E2EE
          </span>
        </Link>

        <div className="flex items-center gap-2 text-xs text-[#a1a1aa] bg-[#121212] border border-[#222222] px-3 py-1.5 rounded-md">
          <ShieldCheckIcon size={14} className="text-[#10b981]" />

          <span>Zero-Knowledge Locked</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative w-72">
          <MagnifyingGlassIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a]" />

          <input
            type="text"
            placeholder="Search encrypted index..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full bg-[#111111] border border-[#222222] rounded-md pl-9 pr-3 py-1.5 text-xs text-white placeholder-[#71717a] focus:outline-none focus:border-[#444444] transition-colors"
          />
        </div>

        <Link
          href="/admin"
          className="flex items-center gap-1.5 text-xs text-[#a1a1aa] hover:text-white border border-[#222222] px-3 py-1.5 rounded-md hover:bg-[#141414] transition-colors"
        >
          <CpuIcon size={14} />

          <span>Admin Telemetry</span>
        </Link>

        <div className="flex items-center gap-3 border-l border-[#1f1f1f] pl-4">
          <span className="text-xs text-[#71717a] font-mono">{user?.email || 'vault@nulla.app'}</span>

          <button
            onClick={handleLogoutClick}
            title="Lock Vault & Sign Out"
            className="text-[#71717a] hover:text-white p-1 hover:bg-[#181818] rounded transition-colors"
          >
            <SignOutIcon size={16} />
          </button>
        </div>
      </div>
    </section>
  );
};
