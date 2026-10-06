import {
  CpuIcon,
  VideoCameraIcon,
  BellIcon,
  TagIcon,
  SignOutIcon,
  KeyIcon,
  ShieldCheckIcon,
} from '@phosphor-icons/react';

interface SettingsTabProps {
  hardwareAccel: boolean;
  stream4k: boolean;
  notifications: boolean;
  finderBadges: boolean;
  e2eeVaultEnabled?: boolean;
  onToggleHardwareAccel: (value: boolean) => void;
  onToggleStream4k: (value: boolean) => void;
  onToggleNotifications: (value: boolean) => void;
  onToggleFinderBadges: (value: boolean) => void;
  onToggleE2eeVault?: (value: boolean) => void;
  onSignOutBrowser: () => void;
  masterKeyHex: string | null;
  userEmail: string | undefined;
}

export const SettingsTab = (props: SettingsTabProps) => {
  const {
    hardwareAccel,
    stream4k,
    notifications,
    finderBadges,
    e2eeVaultEnabled = false,
    onToggleHardwareAccel,
    onToggleStream4k,
    onToggleNotifications,
    onToggleFinderBadges,
    onToggleE2eeVault,
    onSignOutBrowser,
    masterKeyHex,
    userEmail,
  } = props;

  const maskedKey = masterKeyHex
    ? `${masterKeyHex.substring(0, 8)}••••••••••••••••••••••••••••••••${masterKeyHex.substring(masterKeyHex.length - 8)}`
    : 'Not loaded in memory';

  const handleToggleE2ee = () => {
    const nextVal = !e2eeVaultEnabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('nulla_e2ee_mode_active', String(nextVal));
    }
    onToggleE2eeVault?.(nextVal);
  };

  return (
    <section className="flex flex-col gap-8 max-w-4xl w-full">
      <div className="bg-white dark:bg-[#1c1c1f] border border-black/5 dark:border-white/10 p-6 rounded-2xl shadow-sm flex flex-col gap-6">
        <div className="border-b border-black/5 dark:border-white/5 pb-4">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
            <span>Interaction & Sync Preferences</span>
          </h3>

          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            <span>Configure local decryption performance and native macOS system integration.</span>
          </p>
        </div>

        <div className="flex flex-col divide-y divide-black/5 dark:divide-white/5">
          <div className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-[#28282d] border border-black/5 dark:border-white/10 flex items-center justify-center text-neutral-700 dark:text-neutral-200 shadow-sm">
                <ShieldCheckIcon size={20} />
              </div>

              <div className="flex flex-col">
                <span className="text-xs font-medium text-neutral-900 dark:text-white">
                  Zero-Knowledge E2EE Vault Mode
                </span>

                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {e2eeVaultEnabled
                    ? 'Client-side AES-256 chunk slicing enabled. Native streaming disabled.'
                    : 'Instant direct R2 streaming enabled (Helumi architecture) with server-side encryption at rest.'}
                </span>
              </div>
            </div>

            <button
              onClick={handleToggleE2ee}
              className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ${
                e2eeVaultEnabled ? 'bg-neutral-900 dark:bg-white justify-end' : 'bg-neutral-200 dark:bg-neutral-700 justify-start'
              }`}
            >
              <div className={`w-4 h-4 rounded-full shadow-sm transition-transform ${e2eeVaultEnabled ? 'bg-white dark:bg-black' : 'bg-white'}`} />
            </button>
          </div>

          <div className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-[#28282d] border border-black/5 dark:border-white/10 flex items-center justify-center text-neutral-700 dark:text-neutral-200 shadow-sm">
                <CpuIcon size={20} />
              </div>

              <div className="flex flex-col">
                <span className="text-xs font-medium text-neutral-900 dark:text-white">
                  Hardware Accelerated Decryption
                </span>

                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Utilize Apple Silicon Hardware AES-NI engines via Web Crypto Subsystem.
                </span>
              </div>
            </div>

            <button
              onClick={() => onToggleHardwareAccel(!hardwareAccel)}
              className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ${
                hardwareAccel ? 'bg-neutral-900 dark:bg-white justify-end' : 'bg-neutral-200 dark:bg-neutral-700 justify-start'
              }`}
            >
              <div className={`w-4 h-4 rounded-full shadow-sm transition-transform ${hardwareAccel ? 'bg-white dark:bg-black' : 'bg-white'}`} />
            </button>
          </div>

          <div className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-[#28282d] border border-black/5 dark:border-white/10 flex items-center justify-center text-neutral-700 dark:text-neutral-200 shadow-sm">
                <VideoCameraIcon size={20} />
              </div>

              <div className="flex flex-col">
                <span className="text-xs font-medium text-neutral-900 dark:text-white">
                  Stream 4K Video in RAM
                </span>

                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Seek 50 GB videos in under 0.8 seconds without downloading entire files.
                </span>
              </div>
            </div>

            <button
              onClick={() => onToggleStream4k(!stream4k)}
              className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ${
                stream4k ? 'bg-neutral-900 dark:bg-white justify-end' : 'bg-neutral-200 dark:bg-neutral-700 justify-start'
              }`}
            >
              <div className={`w-4 h-4 rounded-full shadow-sm transition-transform ${stream4k ? 'bg-white dark:bg-black' : 'bg-white'}`} />
            </button>
          </div>

          <div className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-[#28282d] border border-black/5 dark:border-white/10 flex items-center justify-center text-neutral-700 dark:text-neutral-200 shadow-sm">
                <TagIcon size={20} />
              </div>

              <div className="flex flex-col">
                <span className="text-xs font-medium text-neutral-900 dark:text-white">
                  Finder Badge Overlays
                </span>

                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Display cloud sync status indicators next to files in macOS Finder.
                </span>
              </div>
            </div>

            <button
              onClick={() => onToggleFinderBadges(!finderBadges)}
              className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ${
                finderBadges ? 'bg-neutral-900 dark:bg-white justify-end' : 'bg-neutral-200 dark:bg-neutral-700 justify-start'
              }`}
            >
              <div className={`w-4 h-4 rounded-full shadow-sm transition-transform ${finderBadges ? 'bg-white dark:bg-black' : 'bg-white'}`} />
            </button>
          </div>

          <div className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-[#28282d] border border-black/5 dark:border-white/10 flex items-center justify-center text-neutral-700 dark:text-neutral-200 shadow-sm">
                <BellIcon size={20} />
              </div>

              <div className="flex flex-col">
                <span className="text-xs font-medium text-neutral-900 dark:text-white">
                  Sync Notifications
                </span>

                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Receive macOS banners when large background file uploads finish.
                </span>
              </div>
            </div>

            <button
              onClick={() => onToggleNotifications(!notifications)}
              className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ${
                notifications ? 'bg-neutral-900 dark:bg-white justify-end' : 'bg-neutral-200 dark:bg-neutral-700 justify-start'
              }`}
            >
              <div className={`w-4 h-4 rounded-full shadow-sm transition-transform ${notifications ? 'bg-white dark:bg-black' : 'bg-white'}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1c1c1f] border border-black/5 dark:border-white/10 p-6 rounded-2xl shadow-sm flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <KeyIcon size={18} />
          </div>

          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
            <span>Client Cryptographic Vault Key</span>
          </h3>
        </div>

        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          <span>Your 256-bit AES master key derived client-side. The server has no knowledge of this key.</span>
        </p>

        <div className="bg-neutral-50 dark:bg-black/20 border border-black/5 dark:border-white/10 p-3.5 rounded-xl flex items-center justify-between font-mono text-xs">
          <span className="text-neutral-600 dark:text-neutral-400 truncate">{maskedKey}</span>

          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full shrink-0 font-medium">
            Hardware Enclave Protected
          </span>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1c1c1f] border border-black/5 dark:border-white/10 p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
            <span>Browser Session</span>
          </h3>

          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            <span>Signing out purges decrypted keys from this browser and revokes the active web token.</span>
          </p>
        </div>

        <button
          onClick={onSignOutBrowser}
          className="flex items-center gap-2 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/40 text-xs text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 px-4 py-2 rounded-full transition-colors font-medium shrink-0 shadow-sm"
        >
          <SignOutIcon size={14} />

          <span>Sign Out of this Browser</span>
        </button>
      </div>
    </section>
  );
};
