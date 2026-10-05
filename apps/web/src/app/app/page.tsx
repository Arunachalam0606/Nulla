'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';

import type { DecryptedNode } from '@/schemas/node';

import { useCompanionLogic } from '@/hooks/useCompanionLogic';
import { useExplorerLogic } from '@/hooks/useExplorerLogic';

import { Header } from '@/components/common/Header';
import { AccountTab } from '@/components/companion/AccountTab';
import { PlanTab } from '@/components/companion/PlanTab';
import { SharedTab } from '@/components/companion/SharedTab';
import { SettingsTab } from '@/components/companion/SettingsTab';
import { DeletedTab } from '@/components/companion/DeletedTab';
import { Breadcrumbs } from '@/components/explorer/Breadcrumbs';
import { NodeList } from '@/components/explorer/NodeList';
import { UploadDrawer } from '@/components/explorer/UploadDrawer';
import { MediaPreviewModal } from '@/components/explorer/MediaPreviewModal';

import { createShareLink } from '@/lib/api';

import {
  UserCircleIcon,
  HardDrivesIcon,
  CrownIcon,
  ShareNetworkIcon,
  GearIcon,
  TrashIcon,
  ShieldCheckIcon,
  CircleNotchIcon,
  UploadSimpleIcon,
  FolderPlusIcon,
  SquaresFourIcon,
  ListDashesIcon,
  LinkSimpleIcon,
  CheckIcon,
  XIcon,
} from '@phosphor-icons/react';

export default function CompanionAppPage() {
  const {
    user,
    token,
    masterKeyHex,
    isAuthenticated,
    isRehydrated,
    activeTab,
    devices,
    trashNodes,
    sharedSubTab,
    isLoadingDevices,
    isLoadingTrash,
    hardwareAccel,
    stream4k,
    notifications,
    finderBadges,
    statusMessage,
    errorMessage,
    setActiveTab,
    setSharedSubTab,
    setHardwareAccel,
    setStream4k,
    setNotifications,
    setFinderBadges,
    handleRevokeDevice,
    handleRestoreTrash,
    handlePurgeTrash,
    handleSignOutBrowser,
  } = useCompanionLogic();

  const {
    nodes,
    breadcrumbs,
    viewMode,
    searchQuery,
    isUploadDrawerOpen,
    uploadQueue,
    previewNode,
    setViewMode,
    setUploadDrawerOpen,
    setPreviewNode,
    handleCreateFolder,
    handleNavigateToFolder,
    handleNavigateBreadcrumb,
    handleDeleteNode,
    handleUploadFiles,
  } = useExplorerLogic();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultIsNewFolderOpen = false;
  const defaultFolderName = '';
  const defaultShareModalNode = null;
  const defaultGeneratedShareUrl = '';
  const defaultIsCopied = false;

  const [isNewFolderOpen, setIsNewFolderOpen] = useState(defaultIsNewFolderOpen);
  const [folderName, setFolderName] = useState(defaultFolderName);
  const [shareModalNode, setShareModalNode] = useState<DecryptedNode | null>(defaultShareModalNode);
  const [generatedShareUrl, setGeneratedShareUrl] = useState(defaultGeneratedShareUrl);
  const [isCopied, setIsCopied] = useState(defaultIsCopied);

  const handleOpenFolderModal = () => {
    setFolderName('');
    setIsNewFolderOpen(true);
  };

  const handleFolderSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!folderName.trim()) return;
    handleCreateFolder(folderName.trim());
    setIsNewFolderOpen(false);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      handleUploadFiles(event.target.files);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      handleUploadFiles(event.dataTransfer.files);
    }
  };

  const handleShareNode = async (file: DecryptedNode) => {
    if (!token || !masterKeyHex) return;
    setShareModalNode(file);
    try {
      const share = await createShareLink(token, file.id, 'download', 7);
      const fullUrl = `${window.location.origin}${share.share_url}#${masterKeyHex}`;
      setGeneratedShareUrl(fullUrl);
    } catch {
      setGeneratedShareUrl('');
    }
  };

  const handleCopyShareLink = () => {
    if (!generatedShareUrl) return;
    navigator.clipboard.writeText(generatedShareUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (!isRehydrated) {
    return (
      <section className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <CircleNotchIcon size={32} className="text-white animate-spin" />

          <span className="text-xs font-mono text-[#71717a]">
            Loading Nulla Secure Session...
          </span>
        </div>
      </section>
    );
  }

  if (!isAuthenticated) {
    return (
      <section className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-[#111111] border border-[#222222] flex items-center justify-center text-white mb-4">
          <ShieldCheckIcon size={24} />
        </div>

        <h1 className="text-lg font-bold text-white tracking-tight">
          <span>Vault Locked</span>
        </h1>

        <p className="text-xs text-[#71717a] mt-1 max-w-sm">
          <span>Your encryption keys are not loaded in memory. Authenticate to unlock and decrypt your files.</span>
        </p>

        <Link
          href="/login"
          className="mt-6 bg-white text-black text-xs font-semibold px-4 py-2 rounded-lg hover:bg-neutral-200 transition-colors"
        >
          <span>Unlock Nulla Vault</span>
        </Link>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-[#050505] flex flex-col">
      <Header />

      <div className="border-b border-[#1a1a1a] bg-[#070707] px-6 sticky top-14 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-1 overflow-x-auto py-2">
            <button
              onClick={() => setActiveTab('account')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'account'
                  ? 'bg-[#181818] text-white font-semibold shadow-sm'
                  : 'text-[#777777] hover:text-white'
              }`}
            >
              <UserCircleIcon size={16} />

              <span>Account</span>
            </button>

            <button
              onClick={() => setActiveTab('files')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'files'
                  ? 'bg-[#181818] text-white font-semibold shadow-sm'
                  : 'text-[#777777] hover:text-white'
              }`}
            >
              <HardDrivesIcon size={16} />

              <span>Files</span>
            </button>

            <button
              onClick={() => setActiveTab('plan')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'plan'
                  ? 'bg-[#181818] text-white font-semibold shadow-sm'
                  : 'text-[#777777] hover:text-white'
              }`}
            >
              <CrownIcon size={16} />

              <span>Plan</span>
            </button>

            <button
              onClick={() => setActiveTab('shared')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'shared'
                  ? 'bg-[#181818] text-white font-semibold shadow-sm'
                  : 'text-[#777777] hover:text-white'
              }`}
            >
              <ShareNetworkIcon size={16} />

              <span>Shared</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'settings'
                  ? 'bg-[#181818] text-white font-semibold shadow-sm'
                  : 'text-[#777777] hover:text-white'
              }`}
            >
              <GearIcon size={16} />

              <span>Settings</span>
            </button>

            <button
              onClick={() => setActiveTab('deleted')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'deleted'
                  ? 'bg-[#181818] text-white font-semibold shadow-sm'
                  : 'text-[#777777] hover:text-white'
              }`}
            >
              <TrashIcon size={16} />

              <span>Deleted</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-[#71717a]">
            <span>Mac Native Drive:</span>

            <span className="text-emerald-400 font-semibold">Mounted</span>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="bg-emerald-950/40 border-b border-emerald-900/50 px-6 py-2 text-xs text-emerald-400 font-mono text-center">
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-950/40 border-b border-red-900/50 px-6 py-2 text-xs text-red-400 font-mono text-center">
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="flex-1 flex flex-col p-6 sm:p-10 max-w-6xl w-full mx-auto">
        {activeTab === 'account' && (
          <AccountTab
            user={user}
            devices={devices}
            isLoading={isLoadingDevices}
            onRevoke={handleRevokeDevice}
          />
        )}

        {activeTab === 'plan' && <PlanTab user={user} />}

        {activeTab === 'shared' && (
          <SharedTab
            subTab={sharedSubTab}
            onTabChange={setSharedSubTab}
            token={token}
            masterKeyHex={masterKeyHex}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            hardwareAccel={hardwareAccel}
            stream4k={stream4k}
            notifications={notifications}
            finderBadges={finderBadges}
            onToggleHardwareAccel={setHardwareAccel}
            onToggleStream4k={setStream4k}
            onToggleNotifications={setNotifications}
            onToggleFinderBadges={setFinderBadges}
            onSignOutBrowser={handleSignOutBrowser}
            masterKeyHex={masterKeyHex}
            userEmail={user?.email}
          />
        )}

        {activeTab === 'deleted' && (
          <DeletedTab
            trashNodes={trashNodes}
            isLoading={isLoadingTrash}
            onRestore={handleRestoreTrash}
            onPurge={handlePurgeTrash}
          />
        )}

        {activeTab === 'files' && (
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="flex flex-col flex-1"
          >
            <div className="flex items-center justify-between border-b border-[#181818] pb-4 mb-6">
              <Breadcrumbs breadcrumbs={breadcrumbs} onNavigate={handleNavigateBreadcrumb} />

              <div className="flex items-center gap-3">
                <div className="flex items-center bg-[#0d0d0d] border border-[#222222] rounded-lg p-0.5">
                  <button
                    onClick={() => setViewMode('grid')}
                    title="Grid View"
                    className={`p-1.5 rounded text-xs transition-colors ${
                      viewMode === 'grid' ? 'bg-[#222222] text-white' : 'text-[#777777] hover:text-white'
                    }`}
                  >
                    <SquaresFourIcon size={14} />
                  </button>

                  <button
                    onClick={() => setViewMode('list')}
                    title="List View"
                    className={`p-1.5 rounded text-xs transition-colors ${
                      viewMode === 'list' ? 'bg-[#222222] text-white' : 'text-[#777777] hover:text-white'
                    }`}
                  >
                    <ListDashesIcon size={14} />
                  </button>
                </div>

                <button
                  onClick={handleOpenFolderModal}
                  className="flex items-center gap-1.5 bg-[#0e0e0e] hover:bg-[#181818] border border-[#222222] text-xs text-[#cccccc] hover:text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  <FolderPlusIcon size={14} />

                  <span>New Folder</span>
                </button>

                <button
                  onClick={handleUploadClick}
                  className="flex items-center gap-1.5 bg-white hover:bg-neutral-200 text-black text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                >
                  <UploadSimpleIcon size={14} />

                  <span>Upload to Cloud</span>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>
            </div>

            <div className="flex-1">
              <NodeList
                nodes={nodes}
                viewMode={viewMode}
                searchQuery={searchQuery}
                onNavigateToFolder={handleNavigateToFolder}
                onPreviewFile={(file) => setPreviewNode(file)}
                onDeleteNode={handleDeleteNode}
                onShareNode={handleShareNode}
              />
            </div>
          </div>
        )}
      </div>

      <UploadDrawer
        isOpen={isUploadDrawerOpen}
        uploadQueue={uploadQueue}
        onClose={() => setUploadDrawerOpen(false)}
      />

      <MediaPreviewModal
        node={previewNode}
        onClose={() => setPreviewNode(null)}
      />

      {isNewFolderOpen && (
        <section className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0c0c0c] border border-[#222222] p-6 rounded-xl max-w-sm w-full shadow-2xl">
            <h2 className="text-sm font-semibold text-white mb-2">
              <span>New Encrypted Folder</span>
            </h2>

            <p className="text-xs text-[#71717a] mb-4">
              <span>Folder title is encrypted with AES-256 before being committed to the database.</span>
            </p>

            <form onSubmit={handleFolderSubmit} className="flex flex-col gap-4">
              <input
                type="text"
                autoFocus
                required
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="Folder title..."
                className="bg-[#141414] border border-[#282828] rounded-lg px-3 py-2 text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#444444]"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewFolderOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-[#888888] hover:text-white"
                >
                  <span>Cancel</span>
                </button>

                <button
                  type="submit"
                  className="bg-white text-black font-semibold px-4 py-1.5 rounded-lg text-xs hover:bg-neutral-200"
                >
                  <span>Create</span>
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      {shareModalNode && (
        <section className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0c0c0c] border border-[#222222] p-6 rounded-xl max-w-md w-full shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LinkSimpleIcon size={18} className="text-white" />

                <h2 className="text-sm font-semibold text-white">
                  <span>Zero-Knowledge Share Link</span>
                </h2>
              </div>

              <button
                onClick={() => setShareModalNode(null)}
                className="text-[#777777] hover:text-white"
              >
                <XIcon size={16} />
              </button>
            </div>

            <p className="text-xs text-[#888888]">
              <span>
                Anyone with this link can decrypt and download{' '}
                <span className="text-white font-medium">{shareModalNode.name}</span>. The decryption key
                is embedded in the URL fragment (<code className="text-emerald-400 font-mono">#key</code>) and is never sent to our servers.
              </span>
            </p>

            <div className="flex items-center gap-2 bg-[#141414] border border-[#282828] p-2 rounded-lg">
              <input
                type="text"
                readOnly
                value={generatedShareUrl}
                className="bg-transparent text-xs text-[#cccccc] font-mono flex-1 outline-none truncate"
              />

              <button
                onClick={handleCopyShareLink}
                className="flex items-center gap-1 bg-white text-black text-xs font-semibold px-3 py-1.5 rounded-md hover:bg-neutral-200 shrink-0"
              >
                {isCopied ? <CheckIcon size={12} /> : <LinkSimpleIcon size={12} />}

                <span>{isCopied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </section>
      )}
    </section>
  );
}
