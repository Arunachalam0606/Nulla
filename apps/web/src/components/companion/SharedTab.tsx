import { useState } from 'react';

import type { ActiveShareLink } from '@/hooks/useCompanionLogic';

import {
  LinkSimpleIcon,
  TrayIcon,
  CheckIcon,
  CopyIcon,
  ShieldCheckIcon,
  TrashIcon,
  CircleNotchIcon,
} from '@phosphor-icons/react';

interface SharedTabProps {
  subTab: 'links' | 'requests';
  onTabChange: (tab: 'links' | 'requests') => void;
  token: string | null;
  masterKeyHex: string | null;
  activeShares?: ActiveShareLink[];
  isLoading?: boolean;
  onDeleteShare?: (shareId: string) => void;
}

export const SharedTab = (props: SharedTabProps) => {
  const {
    subTab,
    onTabChange,
    token,
    masterKeyHex,
    activeShares = [],
    isLoading = false,
    onDeleteShare,
  } = props;

  const defaultCopiedIndex = null;
  const [copiedIndex, setCopiedIndex] = useState<number | null>(defaultCopiedIndex);

  const fallbackShares: ActiveShareLink[] = [
    {
      id: 'sh_live_1',
      nodeName: 'DSC_0011.jpeg',
      permission: 'download',
      expiresAt: 'In 6 days',
      token: 'sh_7b9a2f11',
      createdAt: new Date().toISOString(),
      url: `https://nulla.app/s/sh_7b9a2f11#${masterKeyHex || ''}`,
    },
    {
      id: 'sh_live_2',
      nodeName: 'hangover2009.mp4',
      permission: 'view',
      expiresAt: 'In 28 days',
      token: 'sh_4e819ac2',
      createdAt: new Date().toISOString(),
      url: `https://nulla.app/s/sh_4e819ac2#${masterKeyHex || ''}`,
    },
  ];

  const displayShares = activeShares.length > 0 ? activeShares : fallbackShares;

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

  const handleCopyLink = (index: number, linkToken: string, existingUrl?: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://nulla.app';
    const fragment = masterKeyHex ? `#${masterKeyHex}` : '';
    const fullUrl = existingUrl || `${origin}/s/${linkToken}${fragment}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(defaultCopiedIndex), 2000);
  };

  return (
    <section className="flex flex-col gap-6 max-w-4xl w-full">
      <div className="flex items-center gap-1.5 p-1 bg-neutral-100 dark:bg-black/20 border border-black/5 dark:border-white/10 rounded-full w-fit">
        <button
          onClick={() => onTabChange('links')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
            subTab === 'links'
              ? 'bg-white dark:bg-[#1c1c1f] text-neutral-900 dark:text-white shadow-sm font-semibold'
              : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
          }`}
        >
          <LinkSimpleIcon size={14} />

          <span>Share Links</span>
        </button>

        <button
          onClick={() => onTabChange('requests')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
            subTab === 'requests'
              ? 'bg-white dark:bg-[#1c1c1f] text-neutral-900 dark:text-white shadow-sm font-semibold'
              : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
          }`}
        >
          <TrayIcon size={14} />

          <span>File Requests</span>
        </button>
      </div>

      {subTab === 'links' && (
        <div className="flex flex-col gap-6">
          <div className="bg-white dark:bg-[#1c1c1f] border border-black/5 dark:border-white/10 p-5 rounded-2xl shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheckIcon size={20} />
              </div>

              <div className="flex flex-col">
                <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                  Zero-Knowledge Public Links
                </span>

                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Decryption keys reside strictly in the URL fragment (<code className="text-emerald-600 dark:text-emerald-400 font-mono font-medium">#key</code>) and are never disclosed to the cloud.
                </span>
              </div>
            </div>
          </div>

          <div className="border border-black/5 dark:border-white/10 rounded-2xl bg-white dark:bg-[#1c1c1f] shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-black/5 dark:border-white/10 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-neutral-900 dark:text-white font-mono uppercase tracking-wider">
                <span>Active Share Links Created from Finder & Web</span>
              </h3>

              <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-black/20 px-2.5 py-1 rounded-full border border-black/5 dark:border-white/10">
                {displayShares.length} Active {displayShares.length === 1 ? 'Link' : 'Links'}
              </span>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-xs text-neutral-500 dark:text-neutral-400 font-mono flex items-center justify-center gap-2">
                <CircleNotchIcon size={16} className="animate-spin text-neutral-900 dark:text-white" />

                <span>Loading share links...</span>
              </div>
            ) : (
              <div className="divide-y divide-black/5 dark:divide-white/5">
                {displayShares.map((item, index) => (
                  <div key={item.id} className="p-4 sm:p-5 flex items-center justify-between hover:bg-neutral-50/50 dark:hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-[#28282d] border border-black/5 dark:border-white/10 flex items-center justify-center text-neutral-700 dark:text-neutral-200 shadow-sm">
                        <LinkSimpleIcon size={18} />
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium text-neutral-900 dark:text-white">{item.nodeName}</span>

                        <div className="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">
                          <span className="capitalize">{item.permission}</span>

                          <span>•</span>

                          <span>Expires: {item.expiresAt}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyLink(index, item.token, item.url)}
                        className="flex items-center gap-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 text-xs px-3.5 py-1.5 rounded-full transition-all font-medium shadow-sm"
                      >
                        {copiedIndex === index ? <CheckIcon size={12} className="text-emerald-400" /> : <CopyIcon size={12} />}

                        <span>{copiedIndex === index ? 'Copied' : 'Copy Link'}</span>
                      </button>

                      {onDeleteShare && (
                        <button
                          onClick={() => onDeleteShare(item.id)}
                          title="Revoke and delete share link"
                          className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 border border-red-200 dark:border-red-950/60 hover:bg-red-50 dark:hover:bg-red-950/30 px-3 py-1.5 rounded-full transition-colors font-medium"
                        >
                          <TrashIcon size={13} />

                          <span>Revoke</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === 'requests' && (
        <div className="flex flex-col gap-6">
          <div className="border border-black/5 dark:border-white/10 rounded-2xl bg-white dark:bg-[#1c1c1f] shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-black/5 dark:border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-neutral-900 dark:text-white font-mono uppercase tracking-wider">
                  <span>File Drop Requests</span>
                </h3>

                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  <span>Allow external contributors to upload files directly into your encrypted folder.</span>
                </p>
              </div>
            </div>

            <div className="divide-y divide-black/5 dark:divide-white/5">
              {mockFileRequests.map((req) => (
                <div key={req.id} className="p-4 sm:p-5 flex items-center justify-between hover:bg-neutral-50/50 dark:hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-[#28282d] border border-black/5 dark:border-white/10 flex items-center justify-center text-neutral-700 dark:text-neutral-200 shadow-sm">
                      <TrayIcon size={18} />
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium text-neutral-900 dark:text-white">{req.title}</span>

                      <div className="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">
                        <span>Destination: {req.destination}</span>

                        <span>•</span>

                        <span>{req.receivedCount} files received</span>
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-medium">
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
