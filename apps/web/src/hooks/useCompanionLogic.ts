import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { decryptMetadata } from '@nulla/crypto';

import type { Device } from '@/schemas/device';
import type { DecryptedNode, RawNode } from '@/schemas/node';

import { useAuthStore } from '@/stores/authStore';

import {
  fetchActiveDevices,
  revokeDeviceSession,
  deleteDeviceSession,
  fetchUserShareLinks,
  deleteShareLink,
  fetchDirectoryNodes,
  restoreNode,
  permanentDeleteNode,
  purgeBulkNodes,
  purgeAllTrashNodes,
} from '@/lib/api';

export type CompanionTab = 'account' | 'files' | 'plan' | 'shared' | 'settings' | 'deleted';

export interface ActiveShareLink {
  id: string;
  token: string;
  nodeName: string;
  permission: 'view' | 'download';
  createdAt: string;
  expiresAt: string;
  url: string;
}

const VALID_TABS: CompanionTab[] = ['account', 'files', 'plan', 'shared', 'settings', 'deleted'];

export const useCompanionLogic = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const masterKey = useAuthStore((state) => state.masterKey);
  const masterKeyHex = useAuthStore((state) => state.masterKeyHex);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isRehydrated = useAuthStore((state) => state.isRehydrated);
  const logout = useAuthStore((state) => state.logout);

  const tabQuery = searchParams.get('tab') as CompanionTab | null;
  const initialTab: CompanionTab = tabQuery && VALID_TABS.includes(tabQuery) ? tabQuery : 'files';

  const defaultActiveTab: CompanionTab = initialTab;
  const defaultDevices: Device[] = [];
  const defaultTrashNodes: DecryptedNode[] = [];
  const defaultShares: ActiveShareLink[] = [];
  const defaultSharedSubTab: 'links' | 'requests' = 'links';
  const defaultIsLoadingDevices = false;
  const defaultIsLoadingTrash = false;
  const defaultIsLoadingShares = false;
  const defaultHardwareAccel = true;
  const defaultStream4k = true;
  const defaultNotifications = true;
  const defaultFinderBadges = true;
  const defaultStatusMessage = '';
  const defaultErrorMessage = '';

  const [activeTab, setActiveTabState] = useState<CompanionTab>(defaultActiveTab);
  const [devices, setDevices] = useState<Device[]>(defaultDevices);
  const [trashNodes, setTrashNodes] = useState<DecryptedNode[]>(defaultTrashNodes);
  const [activeShares, setActiveShares] = useState<ActiveShareLink[]>(defaultShares);
  const [sharedSubTab, setSharedSubTab] = useState<'links' | 'requests'>(defaultSharedSubTab);
  const [isLoadingDevices, setIsLoadingDevices] = useState(defaultIsLoadingDevices);
  const [isLoadingTrash, setIsLoadingTrash] = useState(defaultIsLoadingTrash);
  const [isLoadingShares, setIsLoadingShares] = useState(defaultIsLoadingShares);
  const [hardwareAccel, setHardwareAccel] = useState(defaultHardwareAccel);
  const [stream4k, setStream4k] = useState(defaultStream4k);
  const [notifications, setNotifications] = useState(defaultNotifications);
  const [finderBadges, setFinderBadges] = useState(defaultFinderBadges);
  const [statusMessage, setStatusMessage] = useState(defaultStatusMessage);
  const [errorMessage, setErrorMessage] = useState(defaultErrorMessage);

  const macDevices = useMemo(() => {
    return devices.filter((device) => device.device_type === 'mac' || device.device_name.toLowerCase().includes('mac'));
  }, [devices]);

  const setActiveTab = useCallback(
    (tab: CompanionTab) => {
      setActiveTabState(tab);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', tab);
        router.replace(url.pathname + url.search, { scroll: false });
      }
    },
    [router]
  );

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') as CompanionTab | null;
    if (tabFromUrl && VALID_TABS.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTabState(tabFromUrl);
    }
  }, [searchParams, activeTab]);

  const loadDevices = useCallback(async () => {
    if (!token) return;
    setIsLoadingDevices(true);
    try {
      const liveDevices = await fetchActiveDevices(token);
      setDevices(liveDevices);
    } catch (error: unknown) {
      console.warn('Could not load devices:', error);
    } finally {
      setIsLoadingDevices(false);
    }
  }, [token]);

  const loadShares = useCallback(async () => {
    if (!token) return;
    setIsLoadingShares(true);
    try {
      const data = await fetchUserShareLinks(token);
      const rawShares = (data?.shares || []) as Array<{
        id: string;
        token: string;
        node_id: string;
        permission: 'view' | 'download';
        created_at: string;
        expires_at: string | null;
        name_encrypted?: string | null;
        name_iv?: string | null;
        size_bytes?: number;
      }>;

      const formatted: ActiveShareLink[] = await Promise.all(
        rawShares.map(async (raw) => {
          let nodeName = 'Shared File';
          if (raw.name_encrypted && raw.name_iv && masterKey) {
            try {
              nodeName = await decryptMetadata(
                { ciphertext: raw.name_encrypted, iv: raw.name_iv },
                masterKey
              );
            } catch {
              nodeName = `File_${raw.node_id.slice(0, 8)}`;
            }
          }
          const origin = typeof window !== 'undefined' ? window.location.origin : 'https://nulla.app';
          const fragment = masterKeyHex ? `#${masterKeyHex}` : '';
          return {
            id: raw.id,
            token: raw.token,
            nodeName,
            permission: raw.permission,
            createdAt: raw.created_at,
            expiresAt: raw.expires_at || 'Never',
            url: `${origin}/s/${raw.token}${fragment}`,
          };
        })
      );
      setActiveShares(formatted);
    } catch (error: unknown) {
      console.warn('Could not load user shares:', error);
    } finally {
      setIsLoadingShares(false);
    }
  }, [token, masterKey, masterKeyHex]);

  const loadTrash = useCallback(async () => {
    if (!token || !masterKey) return;
    setIsLoadingTrash(true);
    try {
      const rawNodes = await fetchDirectoryNodes(token, null, true);
      const deletedOnly = rawNodes.filter((n: RawNode) => n.status === 'deleted');
      const decrypted = await Promise.all(
        deletedOnly.map(async (raw: RawNode) => {
          try {
            let name = raw.name || '';
            if (!name && raw.name_encrypted && raw.name_iv) {
              name = await decryptMetadata(
                { ciphertext: raw.name_encrypted, iv: raw.name_iv },
                masterKey
              );
            }
            if (!name) {
              name = `File_${raw.id.slice(0, 8)}`;
            }
            return {
              id: raw.id,
              parentId: raw.parent_id,
              name,
              type: raw.type,
              sizeBytes: raw.size_bytes,
              chunkCount: raw.chunk_count,
              status: raw.status,
              deletedAt: raw.deleted_at,
              createdAt: raw.created_at,
              updatedAt: raw.updated_at,
            } satisfies DecryptedNode;
          } catch {
            return {
              id: raw.id,
              parentId: raw.parent_id,
              name: `[Encrypted: ${raw.id.substring(0, 8)}]`,
              type: raw.type,
              sizeBytes: raw.size_bytes,
              chunkCount: raw.chunk_count,
              status: raw.status,
              deletedAt: raw.deleted_at,
              createdAt: raw.created_at,
              updatedAt: raw.updated_at,
            } satisfies DecryptedNode;
          }
        })
      );
      setTrashNodes(decrypted);
    } catch (error: unknown) {
      console.warn('Could not load trash nodes:', error);
    } finally {
      setIsLoadingTrash(false);
    }
  }, [token, masterKey]);

  const handleRevokeDevice = async (deviceId: string) => {
    if (!token) return;
    try {
      await revokeDeviceSession(token, deviceId);
      setDevices((previous) =>
        previous.map((device) =>
          device.id === deviceId ? { ...device, revoked_at: new Date().toISOString() } : device
        )
      );
      setStatusMessage('Device session disconnected');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to revoke device';
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    if (!token) return;
    try {
      await deleteDeviceSession(token, deviceId);
      setDevices((previous) => previous.filter((device) => device.id !== deviceId));
      setStatusMessage('Device permanently removed');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete device';
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleDeleteShare = async (shareId: string) => {
    if (!token) return;
    try {
      await deleteShareLink(token, shareId);
      setActiveShares((previous) => previous.filter((share) => share.id !== shareId && share.token !== shareId));
      setStatusMessage('Share link revoked and deleted');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete share link';
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleRestoreTrash = async (nodeId: string) => {
    if (!token) return;
    try {
      await restoreNode(token, nodeId);
      setTrashNodes((previous) => previous.filter((node) => node.id !== nodeId));
      setStatusMessage('File restored to Nulla Finder volume');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to restore file';
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handlePurgeTrash = async (nodeId: string) => {
    if (!token) return;
    try {
      await permanentDeleteNode(token, nodeId);
      setTrashNodes((previous) => previous.filter((node) => node.id !== nodeId));
      setStatusMessage('File permanently purged from R2 storage');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to purge file';
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handlePurgeBulkTrash = async (nodeIds: string[]) => {
    if (!token || nodeIds.length === 0) return;
    try {
      await purgeBulkNodes(token, nodeIds);
      const idSet = new Set(nodeIds);
      setTrashNodes((previous) => previous.filter((node) => !idSet.has(node.id)));
      setStatusMessage(`${nodeIds.length} item(s) permanently purged from R2`);
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to purge selected files';
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handlePurgeAllTrash = async () => {
    if (!token) return;
    try {
      await purgeAllTrashNodes(token);
      setTrashNodes([]);
      setStatusMessage('Trash completely emptied from R2 storage');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to empty trash';
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleSignOutBrowser = () => {
    logout();
    router.push('/login');
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadDevices();
      loadTrash();
      loadShares();
    }
  }, [isAuthenticated, loadDevices, loadTrash, loadShares]);

  return {
    user,
    token,
    masterKeyHex,
    isAuthenticated,
    isRehydrated,
    activeTab,
    devices,
    macDevices,
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
    refreshDevices: loadDevices,
    refreshTrash: loadTrash,
    refreshShares: loadShares,
  };
};
