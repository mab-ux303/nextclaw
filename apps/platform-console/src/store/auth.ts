import { create } from 'zustand';
import type { UserView } from '@/api/types';

type AuthState = {
  token: string | null;
  user: UserView | null;
  setToken: (token: string | null) => void;
  setUser: (user: UserView | null) => void;
  logout: () => void;
};

const STORAGE_KEY = 'nextclaw.platform.token';

function readTokenFromStorage(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const token = window.localStorage.getItem(STORAGE_KEY);
  return token && token.trim().length > 0 ? token : null;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: readTokenFromStorage(),
  user: null,
  setToken: (token) => {
    if (typeof window !== 'undefined') {
      if (token) {
        window.localStorage.setItem(STORAGE_KEY, token);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    set({ token });
  },
  setUser: (user) => set({ user }),
  logout: () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    set({ token: null, user: null });
  }
}));
