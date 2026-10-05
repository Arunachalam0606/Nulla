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
  onToggleHardwareAccel: (value: boolean) => void;
  onToggleStream4k: (value: boolean) => void;
  onToggleNotifications: (value: boolean) => void;
  onToggleFinderBadges: (value: boolean) => void;
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
    onToggleHardwareAccel,
    onToggleStream4k,
    onToggleNotifications,
    onToggleFinderBadges,
    onSignOutBrowser,
    masterKeyHex,
    userEmail,
  } = props;

  const maskedKey = masterKeyHex
    ? `${masterKeyHex.substring(0, 8)}••••••••••••••••••••••••••••••••${masterKeyHex.substring(masterKeyHex.length - 8)}`
    : 'Not loaded in memory';

  return (
    <section className="flex flex-col gap-8 max-w-4xl w-full">
      <div className="bg-[#0a0a0a] border border-[#1e1e1e] p-6 rounded-2xl flex flex-col gap-6">
        <div className="border-b border-[#181818] pb-4">
          <h3 className="text-sm font-semibold text-white">
            <span>Interaction & Sync Preferences</span>
          </h3>

          <p className="text-xs text-[#71717a] mt-1">
            <span>Configure local decryption performance and native macOS system integration.</span>
          </p>
        </div>

        <div className="flex flex-col divide-y divide-[#161616]">
          <div className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CpuIcon size={20} className="text-white" />

              <div className="flex flex-col">
                <span className="text-xs font-medium text-white">Hardware Accelerated Decryption</span>

                <span className="text-[11px] text-[#71717a]">
                  Utilize Apple Silicon Hardware AES-NI engines via Web Crypto Subsystem.
                </span>
              </div>
            </div>

            <button
              onClick={() => onToggleHardwareAccel(!hardwareAccel)}
              className={`w-10 h-5 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                hardwareAccel ? 'bg-white justify-end' : 'bg-[#222222] justify-start'
              }`}
            >
              <div className={`w-3.5 h-3.5 rounded-full ${hardwareAccel ? 'bg-black' : 'bg-white'}`} />
            </button>
          </div>

          <div className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <VideoCameraIcon size={20} className="text-white" />

              <div className="flex flex-col">
                <span className="text-xs font-medium text-white">Stream 4K Video in RAM</span>

                <span className="text-[11px] text-[#71717a]">
                  Seek 50 GB videos in under 0.8 seconds without downloading entire files.
                </span>
              </div>
            </div>

            <button
              onClick={() => onToggleStream4k(!stream4k)}
              className={`w-10 h-5 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                stream4k ? 'bg-white justify-end' : 'bg-[#222222] justify-start'
              }`}
            >
              <div className={`w-3.5 h-3.5 rounded-full ${stream4k ? 'bg-black' : 'bg-white'}`} />
            </button>
          </div>

          <div className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TagIcon size={20} className="text-white" />

              <div className="flex flex-col">
                <span className="text-xs font-medium text-white">Finder Badge Overlays</span>

                <span className="text-[11px] text-[#71717a]">
                  Display cloud sync status indicators next to files in macOS Finder.
                </span>
              </div>
            </div>

            <button
              onClick={() => onToggleFinderBadges(!finderBadges)}
              className={`w-10 h-5 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                finderBadges ? 'bg-white justify-end' : 'bg-[#222222] justify-start'
              }`}
            >
              <div className={`w-3.5 h-3.5 rounded-full ${finderBadges ? 'bg-black' : 'bg-white'}`} />
            </button>
          </div>

          <div className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BellIcon size={20} className="text-white" />

              <div className="flex flex-col">
                <span className="text-xs font-medium text-white">Sync Notifications</span>

                <span className="text-[11px] text-[#71717a]">
                  Receive macOS banners when large background file uploads finish.
                </span>
              </div>
            </div>

            <button
              onClick={() => onToggleNotifications(!notifications)}
              className={`w-10 h-5 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                notifications ? 'bg-white justify-end' : 'bg-[#222222] justify-start'
              }`}
            >
              <div className={`w-3.5 h-3.5 rounded-full ${notifications ? 'bg-black' : 'bg-white'}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-[#0a0a0a] border border-[#1e1e1e] p-6 rounded-2xl flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <KeyIcon size={18} className="text-amber-400" />

          <h3 className="text-sm font-semibold text-white">
            <span>Client Cryptographic Vault Key</span>
          </h3>
        </div>

        <p className="text-xs text-[#71717a]">
          <span>Your 256-bit AES master key derived client-side. The server has no knowledge of this key.</span>
        </p>

        <div className="bg-[#121212] border border-[#222222] p-3 rounded-lg flex items-center justify-between font-mono text-xs">
          <span className="text-[#a1a1aa] truncate">{maskedKey}</span>

          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded shrink-0">
            Hardware Enclave Protected
          </span>
        </div>
      </div>

      <div className="bg-[#0a0a0a] border border-[#1e1e1e] p-6 rounded-2xl flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-white">
            <span>Browser Session</span>
          </h3>

          <p className="text-xs text-[#71717a]">
            <span>Signing out purges decrypted keys from this browser and revokes the active web token.</span>
          </p>
        </div>

        <button
          onClick={onSignOutBrowser}
          className="flex items-center gap-2 bg-[#141414] hover:bg-red-950/30 text-xs text-red-400 border border-red-950 px-4 py-2 rounded-xl transition-colors font-medium"
        >
          <SignOutIcon size={14} />

          <span>Sign Out of this Browser</span>
        </button>
      </div>
    </section>
  );
};
