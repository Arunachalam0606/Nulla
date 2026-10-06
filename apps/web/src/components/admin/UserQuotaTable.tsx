import { formatBytes } from '@/lib/utils';

import type { AdminUserItem } from '@/schemas/admin';

import {
  UsersIcon,
  CheckIcon,
  PencilSimpleIcon,
} from '@phosphor-icons/react';

interface UserQuotaTableProps {
  users: AdminUserItem[];
  isLoading: boolean;
  customUserId: string | null;
  customQuotaGb: string;
  onSetQuota: (userId: string, quotaBytes: number) => void;
  onSelectCustom: (userId: string) => void;
  onChangeCustomGb: (value: string) => void;
  onApplyCustom: (userId: string) => void;
  onCancelCustom: () => void;
}

export const UserQuotaTable = (props: UserQuotaTableProps) => {
  const {
    users,
    isLoading,
    customUserId,
    customQuotaGb,
    onSetQuota,
    onSelectCustom,
    onChangeCustomGb,
    onApplyCustom,
    onCancelCustom,
  } = props;

  const quotaPresets = [
    { label: '1 GB', bytes: 1 * 1024 * 1024 * 1024 },
    { label: '2.5 GB', bytes: 2.5 * 1024 * 1024 * 1024 },
    { label: '5 GB', bytes: 5 * 1024 * 1024 * 1024 },
  ];

  return (
    <section className="bg-[#0b0b0b] border border-[#1f1f1f] rounded-xl overflow-hidden flex flex-col">
      <div className="p-6 border-b border-[#1b1b1b] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#141414] border border-[#252525] flex items-center justify-center text-white">
            <UsersIcon size={22} />
          </div>

          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">
              <span>User Storage Quota Allocation</span>
            </h2>

            <p className="text-xs text-[#71717a] mt-0.5">
              <span>
                Assign dedicated storage ceilings per user. Enforces Finder mount limits and web upload gates.
              </span>
            </p>
          </div>
        </div>

        <span className="text-xs font-mono text-[#888888]">
          Total Users: {users.length}
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-full divide-y divide-[#181818] text-xs">
          <div className="grid grid-cols-12 px-6 py-3 bg-[#0e0e0e] text-[#71717a] font-mono text-[11px] uppercase tracking-wider">
            <div className="col-span-4">
              <span>User Account</span>
            </div>

            <div className="col-span-2">
              <span>Role</span>
            </div>

            <div className="col-span-2">
              <span>Used Storage</span>
            </div>

            <div className="col-span-4">
              <span>Assigned Quota Limit</span>
            </div>
          </div>

          {users.map((user) => {
            const isEditingCustom = customUserId === user.id;

            return (
              <div
                key={user.id}
                className="grid grid-cols-12 px-6 py-4 items-center hover:bg-[#111111] transition-colors"
              >
                <div className="col-span-4 flex flex-col">
                  <span className="font-medium text-white">{user.email}</span>

                  <span className="text-[10px] font-mono text-[#52525b] truncate max-w-[240px]">
                    {user.id}
                  </span>
                </div>

                <div className="col-span-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${user.role === 'admin' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-neutral-800 text-[#a1a1aa]'}`}>
                    {user.role}
                  </span>
                </div>

                <div className="col-span-2 font-mono text-[#ececec]">
                  <span>{formatBytes(user.storage_used_bytes)}</span>
                </div>

                <div className="col-span-4 flex items-center gap-1.5 flex-wrap">
                  {quotaPresets.map((preset) => {
                    const isSelected = user.storage_quota_bytes === preset.bytes;

                    return (
                      <button
                        key={preset.label}
                        onClick={() => onSetQuota(user.id, preset.bytes)}
                        disabled={isLoading}
                        className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all ${
                          isSelected
                            ? 'bg-white text-black font-semibold shadow-sm'
                            : 'bg-[#161616] hover:bg-[#202020] text-[#a1a1aa] border border-[#262626]'
                        }`}
                      >
                        <span>{preset.label}</span>
                      </button>
                    );
                  })}

                  {isEditingCustom ? (
                    <div className="flex items-center gap-1.5 bg-[#141414] border border-[#2b2b2b] rounded p-0.5">
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={customQuotaGb}
                        onChange={(e) => onChangeCustomGb(e.target.value)}
                        placeholder="GB..."
                        className="w-16 bg-transparent px-1.5 py-0.5 text-[11px] font-mono text-white focus:outline-none"
                      />

                      <button
                        onClick={() => onApplyCustom(user.id)}
                        disabled={isLoading}
                        className="bg-emerald-500 hover:bg-emerald-400 text-black px-1.5 py-0.5 rounded text-[10px] font-semibold"
                        title="Apply custom quota"
                      >
                        <CheckIcon size={12} />
                      </button>

                      <button
                        onClick={onCancelCustom}
                        disabled={isLoading}
                        className="text-[#71717a] hover:text-white px-1 text-[10px]"
                        title="Cancel"
                      >
                        <span>✕</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => onSelectCustom(user.id)}
                      disabled={isLoading}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono border transition-all ${
                        !quotaPresets.some((p) => p.bytes === user.storage_quota_bytes)
                          ? 'bg-purple-950/40 border-purple-800 text-purple-300 font-semibold'
                          : 'bg-[#161616] hover:bg-[#202020] text-[#71717a] border-[#262626]'
                      }`}
                    >
                      <PencilSimpleIcon size={12} />

                      <span>
                        {!quotaPresets.some((p) => p.bytes === user.storage_quota_bytes)
                          ? formatBytes(user.storage_quota_bytes)
                          : 'Custom'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
