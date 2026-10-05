import { useState } from 'react';

import {
  LinkSimpleIcon,
  TrayIcon,
  CheckIcon,
  CopyIcon,
  ShieldCheckIcon,
  ClockIcon,
  PlusIcon,
} from '@phosphor-icons/react';

interface SharedTabProps {
  subTab: 'links' | 'requests';
  onTabChange: (tab: 'links' | 'requests') => void;
  token: string | null;
  masterKeyHex: string | null;
}

export const SharedTab = (props: SharedTabProps) => {
  const { subTab, onTabChange, token, masterKeyHex } = props;

  const defaultCopiedIndex = null;
  const [copiedIndex, setCopiedIndex] = useState<number | null>(defaultCopiedIndex);

  const mockSharedLinks = [
    {
      id: 'sh_live_1',
      name: 'DSC_0011.jpeg',
      permission: 'download',
      expires: 'In 6 days',
      clicks: 3,
      token: 'sh_7b9a2f11',
    },
    {
      id: 'sh_live_2',
      name: 'hangover2009.mp4',
      permission: 'view',
      expires: 'In 28 days',
      clicks: 14,
      token: 'sh_4e819ac2',
    },
  ];

  const mockFileRequests = [
    {
      id: 'req_1',
      title: 'VFX Raw Footage Drop',
      destination: '/Nulla/Footage',
      receivedCount: 4,
      status: 'Active',
      token: 'fr_90acb1',
    },
  ];

  const handleCopyLink = (index: number, linkToken: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://nulla.app';
    const fragment = masterKeyHex ? `#${masterKeyHex}` : '';
    const fullUrl = `${origin}/s/${linkToken}${fragment}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(defaultCopiedIndex), 2000);
  };

  return (
    <section className="flex flex-col gap-6 max-w-4xl w-full">
      <div className="flex items-center gap-2 border-b border-[#1b1b1b] pb-3">
        <button
          onClick={() => onTabChange('links')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            subTab === 'links'
              ? 'bg-[#1c1c1c] text-white'
              : 'text-[#777777] hover:text-white'
          }`}
        >
          <LinkSimpleIcon size={14} />

          <span>Share Links</span>
        </button>

        <button
          onClick={() => onTabChange('requests')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            subTab === 'requests'
              ? 'bg-[#1c1c1c] text-white'
              : 'text-[#777777] hover:text-white'
          }`}
        >
          <TrayIcon size={14} />

          <span>File Requests</span>
        </button>
      </div>

      {subTab === 'links' && (
        <div className="flex flex-col gap-6">
          <div className="bg-[#0e0e0e] border border-[#222222] p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheckIcon size={20} className="text-emerald-400 shrink-0" />

              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white">Zero-Knowledge Links</span>

                <span className="text-[11px] text-[#71717a]">
                  Decryption keys reside strictly in the URL fragment (<code className="text-emerald-400 font-mono">#key</code>) and are never disclosed to the cloud.
                </span>
              </div>
            </div>
          </div>

          <div className="border border-[#1e1e1e] rounded-2xl bg-[#0a0a0a] overflow-hidden">
            <div className="p-4 border-b border-[#181818] flex items-center justify-between">
              <h3 className="text-xs font-semibold text-white font-mono uppercase tracking-wider">
                <span>Active Share Links Created from Finder & Web</span>
              </h3>
            </div>

            <div className="divide-y divide-[#161616]">
              {mockSharedLinks.map((item, index) => (
                <div key={item.id} className="p-4 flex items-center justify-between hover:bg-[#0d0d0d] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#141414] border border-[#222222] flex items-center justify-center text-white">
                      <LinkSimpleIcon size={16} />
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium text-white">{item.name}</span>

                      <div className="flex items-center gap-2 text-[11px] text-[#71717a] font-mono">
                        <span className="capitalize">{item.permission}</span>

                        <span>•</span>

                        <span>{item.expires}</span>

                        <span>•</span>

                        <span>{item.clicks} downloads</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleCopyLink(index, item.token)}
                    className="flex items-center gap-1.5 bg-[#141414] hover:bg-[#1f1f1f] border border-[#262626] text-xs text-white px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {copiedIndex === index ? <CheckIcon size={12} className="text-emerald-400" /> : <CopyIcon size={12} />}

                    <span>{copiedIndex === index ? 'Copied' : 'Copy Link'}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {subTab === 'requests' && (
        <div className="flex flex-col gap-6">
          <div className="border border-[#1e1e1e] rounded-2xl bg-[#0a0a0a] overflow-hidden">
            <div className="p-4 border-b border-[#181818] flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-white font-mono uppercase tracking-wider">
                  <span>File Drop Requests</span>
                </h3>

                <p className="text-xs text-[#71717a] mt-0.5">
                  <span>Allow external contributors to upload files directly into your encrypted folder.</span>
                </p>
              </div>
            </div>

            <div className="divide-y divide-[#161616]">
              {mockFileRequests.map((req) => (
                <div key={req.id} className="p-4 flex items-center justify-between hover:bg-[#0d0d0d] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#141414] border border-[#222222] flex items-center justify-center text-white">
                      <TrayIcon size={16} />
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium text-white">{req.title}</span>

                      <div className="flex items-center gap-2 text-[11px] text-[#71717a] font-mono">
                        <span>Destination: {req.destination}</span>

                        <span>•</span>

                        <span>{req.receivedCount} files received</span>
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
                    Active Drop
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
