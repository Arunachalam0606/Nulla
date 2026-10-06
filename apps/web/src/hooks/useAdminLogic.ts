import { useCallback, useEffect, useState } from 'react';

import type { AdminSystemSettings, AdminTelemetry, AdminUserItem } from '@/schemas/admin';

import { useAuthStore } from '@/stores/authStore';
import { useAdminStore } from '@/stores/adminStore';

import {
  fetchAdminSystemSettings,
  fetchAdminTelemetryData,
  fetchAdminUsers,
  toggleAdminUnlimitedMode,
  updateAdminUserQuota,
} from '@/lib/api';

export function useAdminLogic() {
  const token = useAuthStore((state) => state.token);

  const telemetry = useAdminStore((state) => state.telemetry);
  const systemSettings = useAdminStore((state) => state.systemSettings);
  const users = useAdminStore((state) => state.users);
  const isLoading = useAdminStore((state) => state.isLoading);
  const error = useAdminStore((state) => state.error);
  const setTelemetry = useAdminStore((state) => state.setTelemetry);
  const setSystemSettings = useAdminStore((state) => state.setSystemSettings);
  const setUsers = useAdminStore((state) => state.setUsers);
  const updateUserQuotaInStore = useAdminStore((state) => state.updateUserQuota);
  const setIsLoading = useAdminStore((state) => state.setIsLoading);
  const setError = useAdminStore((state) => state.setError);

  const defaultAdminKey = 'nulla-admin-master-secret-key-2026';
  const defaultIsConfirmModalOpen = false;
  const defaultActionMessage = '';
  const defaultCustomUserId = null;
  const defaultCustomQuotaGb = '';

  const [adminKey, setAdminKey] = useState<string>(defaultAdminKey);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(defaultIsConfirmModalOpen);
  const [actionMessage, setActionMessage] = useState<string>(defaultActionMessage);
  const [customUserId, setCustomUserId] = useState<string | null>(defaultCustomUserId);
  const [customQuotaGb, setCustomQuotaGb] = useState<string>(defaultCustomQuotaGb);

  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [telemetryRes, settingsRes, usersRes] = await Promise.all([
        fetchAdminTelemetryData(token || undefined, adminKey),
        fetchAdminSystemSettings(token || undefined, adminKey),
        fetchAdminUsers(token || undefined, adminKey),
      ]);

      setTelemetry(telemetryRes.telemetry);
      setSystemSettings(settingsRes);
      setUsers(usersRes);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to query admin control plane';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [token, adminKey, setTelemetry, setSystemSettings, setUsers, setIsLoading, setError]);

  const handleOpenConfirmModal = () => setIsConfirmModalOpen(true);
  const handleCloseConfirmModal = () => setIsConfirmModalOpen(false);

  const handleToggleUnlimited = async () => {
    setIsLoading(true);
    setError(null);
    setActionMessage('');

    try {
      const targetMode = systemSettings?.is_unlimited ? 'free_capped' : 'unlimited';
      await toggleAdminUnlimitedMode(token || undefined, adminKey, targetMode);
      setIsConfirmModalOpen(false);
      setActionMessage(
        targetMode === 'unlimited'
          ? 'Storage tier unlocked: Unlimited allocation mode is now active.'
          : 'Storage tier locked: 10 GB Free Tier ceiling is now active.'
      );
      await loadAllData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to toggle storage tier mode';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetUserQuota = async (userId: string, quotaBytes: number) => {
    setIsLoading(true);
    setError(null);
    setActionMessage('');

    try {
      await updateAdminUserQuota(userId, quotaBytes, token || undefined, adminKey);
      updateUserQuotaInStore(userId, quotaBytes);
      setActionMessage(`Quota updated successfully to ${(quotaBytes / (1024 * 1024 * 1024)).toFixed(1)} GB.`);
      setCustomUserId(null);
      setCustomQuotaGb('');
      await loadAllData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update user quota';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyCustomQuota = async (userId: string) => {
    const gbValue = parseFloat(customQuotaGb);
    if (isNaN(gbValue) || gbValue <= 0) {
      setError('Please enter a valid gigabyte amount greater than 0');
      return;
    }

    const quotaBytes = Math.round(gbValue * 1024 * 1024 * 1024);
    await handleSetUserQuota(userId, quotaBytes);
  };

  useEffect(() => {
    loadAllData();
    const interval = setInterval(loadAllData, 15000);
    return () => clearInterval(interval);
  }, [loadAllData]);

  return {
    telemetry,
    systemSettings,
    users,
    isLoading,
    error,
    actionMessage,
    adminKey,
    isConfirmModalOpen,
    customUserId,
    customQuotaGb,
    setAdminKey,
    setCustomUserId,
    setCustomQuotaGb,
    refreshData: loadAllData,
    handleOpenConfirmModal,
    handleCloseConfirmModal,
    handleToggleUnlimited,
    handleSetUserQuota,
    handleApplyCustomQuota,
  };
}
