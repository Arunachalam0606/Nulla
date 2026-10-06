'use client';

import { Suspense, useState, useRef } from 'react';
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
import { scanDataTransferItems, scanFileList } from '@/lib/directoryTraversal';

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
  FolderIcon,
  FolderPlusIcon,
  SquaresFourIcon,
  ListDashesIcon,
  LinkSimpleIcon,
  CheckIcon,
  XIcon,
} from '@phosphor-icons/react';

function CompanionAppContent() {
  const {
    user,
    token,
    masterKeyHex,
    isAuthenticated,
    isRehydrated,
    activeTab,
    devices,
    trashNodes,
    activeShares,
    sharedSubTab,
    isLoadingDevices,
    isLoadingTrash,
    isLoadingShares,
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
    handleDeleteDevice,
    handleDeleteShare,
    handleRestoreTrash,
    handlePurgeTrash,
    handlePurgeBulkTrash,
    handlePurgeAllTrash,
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
    isE2eeVaultEnabled,
    loadDuration,
    setViewMode,
    setUploadDrawerOpen,
    setIsE2eeVaultEnabled,
    setPreviewNode,
    handleCreateFolder,
    handleNavigateToFolder,
    handleNavigateBreadcrumb,
    handleDeleteNode,
    handleUploadFiles,
  } = useExplorerLogic();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

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

  const handleUploadFolderClick = () => {
    folderInputRef.current?.click();
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      handleUploadFiles(event.target.files);
      event.target.value = '';
    }
  };

  const handleFolderInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const scanned = scanFileList(event.target.files);
      handleUploadFiles(scanned);
      event.target.value = '';
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer.items && event.dataTransfer.items.length > 0) {
      const scanned = await scanDataTransferItems(event.dataTransfer.items);
      if (scanned.length > 0) {
        handleUploadFiles(scanned);
        return;
      }
    }
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      const scanned = scanFileList(event.dataTransfer.files);
      handleUploadFiles(scanned);
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
      <section className="min-h-screen bg-[#fbfbfd] dark:bg-[#161618] flex flex-col items-center justify-center p-6 transition-colors">
        <div className="flex flex-col items-center gap-3">
          <CircleNotchIcon size={32} className="text-neutral-900 dark:text-white animate-spin" />

          <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
            Loading Nulla Secure Session...
          </span>
        </div>
      </section>
    );
  }

  if (!isAuthenticated) {
    return (
      <section className="min-h-screen bg-[#fbfbfd] dark:bg-[#161618] flex flex-col items-center justify-center p-6 text-center transition-colors">
        <div className="w-14 h-14 rounded-2xl bg-white dark:bg-[#1f1f23] border border-black/5 dark:border-white/10 shadow-md flex items-center justify-center text-neutral-900 dark:text-white mb-4">
          <ShieldCheckIcon size={26} />
        </div>

        <h1 className="text-xl font-bold text-neutral-900 dark:text-white tracking-tight">
          <span>Vault Locked</span>
        </h1>

        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5 max-w-sm leading-relaxed">
          <span>Your encryption keys are not loaded in memory. Authenticate to unlock and decrypt your files.</span>
        </p>

        <Link
          href="/login"
          className="mt-6 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold px-5 py-2.5 rounded-full shadow-sm hover:opacity-90 transition-all"
        >
          <span>Unlock Nulla Vault</span>
        </Link>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-[#fbfbfd] dark:bg-[#161618] text-neutral-900 dark:text-neutral-100 flex flex-col pb-28 transition-colors">
      <Header />

      {statusMessage && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-6 py-2 text-xs text-emerald-600 dark:text-emerald-400 font-mono text-center">
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-2 text-xs text-red-600 dark:text-red-400 font-mono text-center">
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
            onDeleteDevice={handleDeleteDevice}
          />
        )}

        {activeTab === 'plan' && <PlanTab user={user} />}

        {activeTab === 'shared' && (
          <SharedTab
            subTab={sharedSubTab}
            onTabChange={setSharedSubTab}
            token={token}
            masterKeyHex={masterKeyHex}
            activeShares={activeShares}
            isLoading={isLoadingShares}
            onDeleteShare={handleDeleteShare}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            hardwareAccel={hardwareAccel}
            stream4k={stream4k}
            notifications={notifications}
            finderBadges={finderBadges}
            e2eeVaultEnabled={isE2eeVaultEnabled}
            onToggleHardwareAccel={setHardwareAccel}
            onToggleStream4k={setStream4k}
            onToggleNotifications={setNotifications}
            onToggleFinderBadges={setFinderBadges}
            onToggleE2eeVault={setIsE2eeVaultEnabled}
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
            onPurgeBulk={handlePurgeBulkTrash}
            onPurgeAll={handlePurgeAllTrash}
          />
        )}

        {activeTab === 'files' && (
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="flex flex-col flex-1"
          >
            <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-4 mb-6">
              <Breadcrumbs
                breadcrumbs={breadcrumbs}
                loadDuration={loadDuration}
                onNavigate={handleNavigateBreadcrumb}
              />

              <div className="flex items-center gap-3">
                <div className="flex items-center bg-white dark:bg-[#1f1f23] border border-black/5 dark:border-white/10 rounded-full p-1 shadow-sm">
                  <button
                    onClick={() => setViewMode('grid')}
                    title="Grid View"
                    className={`p-1.5 rounded-full text-xs transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm'
                        : 'text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    <SquaresFourIcon size={14} />
                  </button>

                  <button
                    onClick={() => setViewMode('list')}
                    title="List View"
                    className={`p-1.5 rounded-full text-xs transition-colors ${
                      viewMode === 'list'
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm'
                        : 'text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    <ListDashesIcon size={14} />
                  </button>
                </div>

                <button
                  onClick={handleOpenFolderModal}
                  className="flex items-center gap-1.5 bg-white dark:bg-[#1f1f23] hover:bg-neutral-100 dark:hover:bg-[#28282d] border border-black/5 dark:border-white/10 text-xs text-neutral-700 dark:text-neutral-200 px-3.5 py-1.5 rounded-full shadow-sm transition-all"
                >
                  <FolderPlusIcon size={14} />

                  <span>New Folder</span>
                </button>

                <button
                  onClick={handleUploadFolderClick}
                  className="flex items-center gap-1.5 bg-white dark:bg-[#1f1f23] hover:bg-neutral-100 dark:hover:bg-[#28282d] border border-black/5 dark:border-white/10 text-xs text-neutral-700 dark:text-neutral-200 px-3.5 py-1.5 rounded-full shadow-sm transition-all"
                >
                  <FolderIcon size={14} />

                  <span>Upload Folder</span>
                </button>

                <button
                  onClick={handleUploadClick}
                  className="flex items-center gap-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 text-xs font-semibold px-4 py-1.5 rounded-full shadow-sm transition-all"
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

                <input
                  ref={folderInputRef}
                  type="file"
                  // @ts-expect-error - webkitdirectory attribute is standard for folder picking
                  webkitdirectory=""
                  directory=""
                  multiple
                  onChange={handleFolderInputChange}
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

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <div className="flex items-center gap-1 p-1.5 bg-white/80 dark:bg-[#1f1f23]/80 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-full shadow-2xl shadow-neutral-900/10 dark:shadow-black/50">
          <button
            onClick={() => setActiveTab('account')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeTab === 'account'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            <UserCircleIcon size={16} />

            <span>Account</span>
          </button>

          <button
            onClick={() => setActiveTab('files')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeTab === 'files'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            <HardDrivesIcon size={16} />

            <span>Files</span>
          </button>

          <button
            onClick={() => setActiveTab('plan')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeTab === 'plan'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            <CrownIcon size={16} />

            <span>Plan</span>
          </button>

          <button
            onClick={() => setActiveTab('shared')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeTab === 'shared'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            <ShareNetworkIcon size={16} />

            <span>Shared</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeTab === 'settings'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            <GearIcon size={16} />

            <span>Settings</span>
          </button>

          <button
            onClick={() => setActiveTab('deleted')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeTab === 'deleted'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            <TrashIcon size={16} />

            <span>Deleted</span>
          </button>
        </div>
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
        <section className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1f1f23] border border-black/5 dark:border-white/10 p-6 rounded-2xl max-w-sm w-full shadow-2xl">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white mb-2">
              <span>New Encrypted Folder</span>
            </h2>

            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4 leading-relaxed">
              <span>Folder title is encrypted client-side with AES-256 before being committed to the database.</span>
            </p>

            <form onSubmit={handleFolderSubmit} className="flex flex-col gap-4">
              <input
                type="text"
                autoFocus
                required
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="Folder title..."
                className="bg-neutral-50 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white transition-all"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewFolderOpen(false)}
                  className="px-4 py-2 rounded-full text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
                >
                  <span>Cancel</span>
                </button>

                <button
                  type="submit"
                  className="bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold px-5 py-2 rounded-full text-xs shadow-sm hover:opacity-90 transition-all"
                >
                  <span>Create</span>
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      {shareModalNode && (
        <section className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1f1f23] border border-black/5 dark:border-white/10 p-6 rounded-2xl max-w-md w-full shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LinkSimpleIcon size={18} className="text-neutral-900 dark:text-white" />

                <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
                  <span>Zero-Knowledge Share Link</span>
                </h2>
              </div>

              <button
                onClick={() => setShareModalNode(null)}
                className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white p-1 rounded-full transition-colors"
              >
                <XIcon size={16} />
              </button>
            </div>

            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              <span>
                Anyone with this link can decrypt and download{' '}
                <span className="text-neutral-900 dark:text-white font-medium">{shareModalNode.name}</span>. The decryption key
                is embedded in the URL fragment (<code className="text-emerald-600 dark:text-emerald-400 font-mono font-medium">#key</code>) and is never sent to our servers.
              </span>
            </p>

            <div className="flex items-center gap-2 bg-neutral-50 dark:bg-black/20 border border-black/10 dark:border-white/10 p-2 rounded-xl">
              <input
                type="text"
                readOnly
                value={generatedShareUrl}
                className="bg-transparent text-xs text-neutral-700 dark:text-neutral-300 font-mono flex-1 outline-none truncate px-1"
              />

              <button
                onClick={handleCopyShareLink}
                className="flex items-center gap-1 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold px-3.5 py-1.5 rounded-full shadow-sm hover:opacity-90 shrink-0 transition-all"
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

export default function CompanionAppPage() {
  return (
    <Suspense
      fallback={
        <section className="min-h-screen bg-[#fbfbfd] dark:bg-[#161618] flex flex-col items-center justify-center p-6 transition-colors">
          <div className="flex flex-col items-center gap-3">
            <CircleNotchIcon size={32} className="text-neutral-900 dark:text-white animate-spin" />

            <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
              Loading Nulla Secure Session...
            </span>
          </div>
        </section>
      }
    >
      <CompanionAppContent />
    </Suspense>
  );
}
