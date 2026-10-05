import { create } from 'zustand';
import type { Device } from '@/schemas/device';

interface DeviceState {
  devices: Device[];
  isLoading: boolean;
  setDevices: (devices: Device[]) => void;
  removeDevice: (id: string) => void;
  setIsLoading: (isLoading: boolean) => void;
  reset: () => void;
}

const initialState: Omit<DeviceState, 'setDevices' | 'removeDevice' | 'setIsLoading' | 'reset'> = {
  devices: [],
  isLoading: false,
};

export const useDeviceStore = create<DeviceState>((set) => ({
  ...initialState,

  setDevices: (devices) => set({ devices }),

  removeDevice: (id) =>
    set((state) => ({
      devices: state.devices.map((d) =>
        d.id === id ? { ...d, revoked_at: new Date().toISOString() } : d
      ),
    })),

  setIsLoading: (isLoading) => set({ isLoading }),

  reset: () => set(initialState),
}));
