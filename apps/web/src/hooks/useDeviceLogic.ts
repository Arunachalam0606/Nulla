import { useEffect, useState, useCallback } from 'react';

import { useAuthStore } from '@/stores/authStore';
import { useDeviceStore } from '@/stores/deviceStore';

import { fetchActiveDevices, revokeDeviceSession } from '@/lib/api';

export function useDeviceLogic() {
  const token = useAuthStore((state) => state.token);

  const devices = useDeviceStore((state) => state.devices);
  const isLoading = useDeviceStore((state) => state.isLoading);
  const setDevices = useDeviceStore((state) => state.setDevices);
  const removeDevice = useDeviceStore((state) => state.removeDevice);
  const setIsLoading = useDeviceStore((state) => state.setIsLoading);

  const defaultError = '';
  const [error, setError] = useState(defaultError);

  const loadDevices = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    setError(defaultError);

    try {
      const list = await fetchActiveDevices(token);
      setDevices(list);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load devices';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [token, setDevices, setIsLoading]);

  const handleRevoke = async (deviceId: string) => {
    if (!token) return;

    try {
      await revokeDeviceSession(token, deviceId);
      removeDevice(deviceId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to revoke device';
      setError(message);
    }
  };

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  return {
    devices,
    isLoading,
    error,
    handleRevoke,
    refreshDevices: loadDevices,
  };
}
