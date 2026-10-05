import { create } from 'zustand';
import type { AdminTelemetry } from '@/schemas/admin';

interface AdminState {
  telemetry: AdminTelemetry['telemetry'] | null;
  isLoading: boolean;
  error: string | null;
  setTelemetry: (telemetry: AdminTelemetry['telemetry']) => void;
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState: Omit<
  AdminState,
  'setTelemetry' | 'setIsLoading' | 'setError' | 'reset'
> = {
  telemetry: null,
  isLoading: false,
  error: null,
};

export const useAdminStore = create<AdminState>((set) => ({
  ...initialState,

  setTelemetry: (telemetry) => set({ telemetry, error: null }),

  setIsLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),
}));
