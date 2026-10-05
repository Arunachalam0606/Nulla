import { useEffect, useState, useCallback } from 'react';

import { useAuthStore } from '@/stores/authStore';
import { useAdminStore } from '@/stores/adminStore';

import { fetchAdminTelemetryData } from '@/lib/api';

export function useAdminLogic() {
  const token = useAuthStore((state) => state.token);

  const telemetry = useAdminStore((state) => state.telemetry);
  const isLoading = useAdminStore((state) => state.isLoading);
  const error = useAdminStore((state) => state.error);
  const setTelemetry = useAdminStore((state) => state.setTelemetry);
  const setIsLoading = useAdminStore((state) => state.setIsLoading);
  const setError = useAdminStore((state) => state.setError);

  const defaultAdminKey = 'nulla-admin-master-secret-key-2026';
  const [adminKey, setAdminKey] = useState(defaultAdminKey);

  const loadMetrics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchAdminTelemetryData(token || undefined, adminKey);
      setTelemetry(data.telemetry);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch admin telemetry';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [token, adminKey, setTelemetry, setIsLoading, setError]);

  useEffect(() => {
    loadMetrics();
    const interval = setInterval(loadMetrics, 10000);
    return () => clearInterval(interval);
  }, [loadMetrics]);

  return {
    telemetry,
    isLoading,
    error,
    adminKey,
    setAdminKey,
    refreshMetrics: loadMetrics,
  };
}
