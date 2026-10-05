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
    <section className="h-14 border-b border-black/5 dark:border-white/10 bg-[#fbfbfd]/80 dark:bg-[#161618]/80 backdrop-blur-md px-6 flex items-center justify-between z-20 sticky top-0 transition-colors">
      <div className="flex items-center gap-4">
        <Link href="/app" className="flex items-center gap-2">
          <span className="font-mono text-base font-semibold tracking-wider text-neutral-900 dark:text-white">
            NULLA
          </span>

          <span className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400 uppercase border border-black/10 dark:border-white/10 px-1.5 py-0.5 rounded-full font-mono">
            v1.0 E2EE
          </span>
        </Link>

        <div className="hidden sm:flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300 bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/10 px-3 py-1 rounded-full">
          <ShieldCheckIcon size={14} className="text-emerald-500" />

          <span>Zero-Knowledge Locked</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative w-64 md:w-80">
          <MagnifyingGlassIcon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />

          <input
            type="text"
            placeholder="Search encrypted files..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full bg-white dark:bg-[#1f1f23] border border-black/5 dark:border-white/10 rounded-full pl-9 pr-4 py-1.5 text-xs text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 shadow-sm focus:outline-none focus:ring-1 focus:ring-black/20 dark:focus:ring-white/20 transition-all"
          />
        </div>

        <Link
          href="/admin"
          className="hidden md:flex items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white border border-black/5 dark:border-white/10 bg-white dark:bg-[#1f1f23] px-3.5 py-1.5 rounded-full shadow-sm hover:shadow transition-all"
        >
          <CpuIcon size={14} />

          <span>Telemetry</span>
        </Link>

        <div className="flex items-center gap-3 border-l border-black/5 dark:border-white/10 pl-3">
          <span className="hidden lg:inline text-xs text-neutral-500 dark:text-neutral-400 font-mono">
            {user?.email || 'vault@nulla.app'}
          </span>

          <button
            onClick={handleLogoutClick}
            title="Lock Vault & Sign Out"
            className="text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <SignOutIcon size={16} />
          </button>
        </div>
      </div>
    </section>
  );
};
