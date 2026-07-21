import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getPersistStorage } from '@/lib/persist-storage';
import type { ThemeMode } from '@/theme/palettes';

type ThemeState = {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      themeMode: 'light',
      setThemeMode: (themeMode) => set({ themeMode }),
    }),
    {
      name: 'localmarketplace-theme',
      storage: createJSONStorage(() => getPersistStorage()),
    }
  )
);

/** Sync read for non-React modules (listing borders, static helpers). */
export function getThemeMode(): ThemeMode {
  return useThemeStore.getState().themeMode;
}
