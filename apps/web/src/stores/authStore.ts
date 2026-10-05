import { create } from 'zustand';

import type { UserProfile } from '@/schemas/auth';

import { importMasterKeyFromHex, hexToUint8Array } from '@nulla/crypto';

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  masterKey: CryptoKey | null;
  masterKeyRaw: Uint8Array | null;
  masterKeyHex: string | null;
  isAuthenticated: boolean;
  isRehydrated: boolean;
  setAuth: (parameters: {
    user: UserProfile;
    token: string;
    masterKey: CryptoKey;
    masterKeyRaw: Uint8Array;
    masterKeyHex: string;
  }) => void;
  updateUserUsage: (bytesUsed: number) => void;
  rehydrate: () => Promise<boolean>;
  logout: () => void;
  reset: () => void;
}

const initialState: Omit<AuthState, 'setAuth' | 'updateUserUsage' | 'rehydrate' | 'logout' | 'reset'> = {
  user: null,
  token: null,
  masterKey: null,
  masterKeyRaw: null,
  masterKeyHex: null,
  isAuthenticated: false,
  isRehydrated: false,
};

export const useAuthStore = create<AuthState>((set) => ({
  ...initialState,

  setAuth: ({ user, token, masterKey, masterKeyRaw, masterKeyHex }) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('nulla_token', token);
        localStorage.setItem('user_email', user.email);
        localStorage.setItem('nulla_user', JSON.stringify(user));
        if (masterKeyHex) {
          localStorage.setItem('nulla_master_key_hex', masterKeyHex);
        }
      } catch (storageError) {
        console.error('Failed to persist session to localStorage', storageError);
      }
    }

    set({
      user,
      token,
      masterKey,
      masterKeyRaw,
      masterKeyHex,
      isAuthenticated: true,
      isRehydrated: true,
    });
  },

  updateUserUsage: (bytesUsed) =>
    set((state) => {
      const updatedUser = state.user
        ? { ...state.user, storage_used_bytes: state.user.storage_used_bytes + bytesUsed }
        : null;

      if (updatedUser && typeof window !== 'undefined') {
        try {
          localStorage.setItem('nulla_user', JSON.stringify(updatedUser));
        } catch (storageError) {
          console.error('Failed to update persisted user in localStorage', storageError);
        }
      }

      return { user: updatedUser };
    }),

  rehydrate: async () => {
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      const storedToken = localStorage.getItem('nulla_token');
      const storedUserJson = localStorage.getItem('nulla_user');
      const storedKeyHex = localStorage.getItem('nulla_master_key_hex');

      if (!storedToken || !storedUserJson) {
        set({ isRehydrated: true });
        return false;
      }

      const parsedUser = JSON.parse(storedUserJson) as UserProfile;
      let reconstructedKey: CryptoKey | null = null;
      let reconstructedRaw: Uint8Array | null = null;

      if (storedKeyHex) {
        try {
          reconstructedKey = await importMasterKeyFromHex(storedKeyHex);
          reconstructedRaw = hexToUint8Array(storedKeyHex);
        } catch (keyError) {
          console.warn('Failed to reconstruct CryptoKey from stored hex', keyError);
        }
      }

      set({
        user: parsedUser,
        token: storedToken,
        masterKey: reconstructedKey,
        masterKeyRaw: reconstructedRaw,
        masterKeyHex: storedKeyHex || null,
        isAuthenticated: true,
        isRehydrated: true,
      });

      return true;
    } catch (rehydrateError) {
      console.error('Rehydration failed', rehydrateError);
      set({ isRehydrated: true });
      return false;
    }
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('nulla_token');
        localStorage.removeItem('user_email');
        localStorage.removeItem('nulla_user');
        localStorage.removeItem('nulla_master_key_hex');
      } catch (storageError) {
        console.error('Failed to clear localStorage on logout', storageError);
      }
    }

    set({ ...initialState, isRehydrated: true });
  },

  reset: () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('nulla_token');
        localStorage.removeItem('user_email');
        localStorage.removeItem('nulla_user');
        localStorage.removeItem('nulla_master_key_hex');
      } catch (storageError) {
        console.error('Failed to clear localStorage on reset', storageError);
      }
    }

    set({ ...initialState, isRehydrated: true });
  },
}));

if (typeof window !== 'undefined') {
  setTimeout(() => {
    useAuthStore.getState().rehydrate();
  }, 0);
}
