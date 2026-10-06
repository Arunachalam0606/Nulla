import { create } from 'zustand';
import type { AdminTelemetry, AdminSystemSettings, AdminUserItem } from '@/schemas/admin';

interface AdminState {
  telemetry: AdminTelemetry['telemetry'] | null;
  systemSettings: AdminSystemSettings | null;
  users: AdminUserItem[];
  isLoading: boolean;
  error: string | null;
  setTelemetry: (telemetry: AdminTelemetry['telemetry']) => void;
  setSystemSettings: (systemSettings: AdminSystemSettings) => void;
  setUsers: (users: AdminUserItem[]) => void;
  updateUserQuota: (userId: string, quotaBytes: number) => void;
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState: Omit<
  AdminState,
  | 'setTelemetry'
  | 'setSystemSettings'
  | 'setUsers'
  | 'updateUserQuota'
  | 'setIsLoading'
  | 'setError'
  | 'reset'
> = {
  telemetry: null,
  systemSettings: null,
  users: [],
  isLoading: false,
  error: null,
};

export const useAdminStore = create<AdminState>((set) => ({
  ...initialState,

  setTelemetry: (telemetry) => set({ telemetry, error: null }),

  setSystemSettings: (systemSettings) => set({ systemSettings, error: null }),

  setUsers: (users) => set({ users, error: null }),

  updateUserQuota: (userId, quotaBytes) =>
    set((state) => ({
      users: state.users.map((u) =>
        u.id === userId ? { ...u, storage_quota_bytes: quotaBytes } : u
      ),
      systemSettings: state.systemSettings
        ? {
            ...state.systemSettings,
            total_allocated_bytes:
              state.users.reduce(
                (sum, u) => sum + (u.id === userId ? quotaBytes : u.storage_quota_bytes),
                0
              ),
          }
        : null,
    })),

  setIsLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),
}));
