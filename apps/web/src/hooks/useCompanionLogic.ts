import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { decryptMetadata } from '@nulla/crypto';

import type { Device } from '@/schemas/device';
import type { DecryptedNode, RawNode } from '@/schemas/node';

import { useAuthStore } from '@/stores/authStore';

import {
  fetchActiveDevices,
  revokeDeviceSession,
  fetchDirectoryNodes,
  restoreNode,
  permanentDeleteNode,
  createShareLink,
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

export const useCompanionLogic = () => {
  const router = useRouter();

  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const masterKey = useAuthStore((state) => state.masterKey);
  const masterKeyHex = useAuthStore((state) => state.masterKeyHex);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isRehydrated = useAuthStore((state) => state.isRehydrated);
  const logout = useAuthStore((state) => state.logout);

  const defaultActiveTab: CompanionTab = 'account';
  const defaultDevices: Device[] = [];
  const defaultTrashNodes: DecryptedNode[] = [];
  const defaultShares: ActiveShareLink[] = [];
  const defaultSharedSubTab: 'links' | 'requests' = 'links';
  const defaultIsLoadingDevices = false;
  const defaultIsLoadingTrash = false;
  const defaultHardwareAccel = true;
  const defaultStream4k = true;
  const defaultNotifications = true;
  const defaultFinderBadges = true;
  const defaultStatusMessage = '';
  const defaultErrorMessage = '';

  const [activeTab, setActiveTab] = useState<CompanionTab>(defaultActiveTab);
  const [devices, setDevices] = useState<Device[]>(defaultDevices);
  const [trashNodes, setTrashNodes] = useState<DecryptedNode[]>(defaultTrashNodes);
  const [activeShares, setActiveShares] = useState<ActiveShareLink[]>(defaultShares);
  const [sharedSubTab, setSharedSubTab] = useState<'links' | 'requests'>(defaultSharedSubTab);
  const [isLoadingDevices, setIsLoadingDevices] = useState(defaultIsLoadingDevices);
  const [isLoadingTrash, setIsLoadingTrash] = useState(defaultIsLoadingTrash);
  const [hardwareAccel, setHardwareAccel] = useState(defaultHardwareAccel);
  const [stream4k, setStream4k] = useState(defaultStream4k);
  const [notifications, setNotifications] = useState(defaultNotifications);
  const [finderBadges, setFinderBadges] = useState(defaultFinderBadges);
  const [statusMessage, setStatusMessage] = useState(defaultStatusMessage);
  const [errorMessage, setErrorMessage] = useState(defaultErrorMessage);

  const macDevices = useMemo(() => {
    return devices.filter((device) => device.device_type === 'mac' || device.device_name.toLowerCase().includes('mac'));
  }, [devices]);

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

  const loadTrash = useCallback(async () => {
    if (!token || !masterKey) return;
    setIsLoadingTrash(true);
    try {
      const rawNodes = await fetchDirectoryNodes(token, null, true);
      const decrypted = await Promise.all(
        rawNodes.map(async (raw: RawNode) => {
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
      setStatusMessage('Device session revoked');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to revoke device';
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

  const handleSignOutBrowser = () => {
    logout();
    router.push('/login');
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadDevices();
      loadTrash();
    }
  }, [isAuthenticated, loadDevices, loadTrash]);

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
    refreshDevices: loadDevices,
    refreshTrash: loadTrash,
  };
};
