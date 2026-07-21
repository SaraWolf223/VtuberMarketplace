import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getPersistStorage } from '@/lib/persist-storage';
import { DEFAULT_PUBLIC_APP_CONFIG, type PublicAppConfig } from '@/features/app-config/app-config-types';

type AppConfigState = {
  config: PublicAppConfig;
  hydratedFromNetwork: boolean;
  setConfig: (config: PublicAppConfig) => void;
};

/**
 * Persisted cache of the buyer's public app config (branding, radius, etc).
 * Persisted so the app renders the last-known branding instantly on launch
 * — before `AppConfigProvider`'s network fetch resolves — and still works
 * fully offline. Falls back to bundled defaults on a brand-new install.
 */
export const useAppConfigStore = create<AppConfigState>()(
  persist(
    (set) => ({
      config: DEFAULT_PUBLIC_APP_CONFIG,
      hydratedFromNetwork: false,
      setConfig: (config) => set({ config, hydratedFromNetwork: true }),
    }),
    {
      name: 'localmarketplace-app-config',
      storage: createJSONStorage(() => getPersistStorage()),
      partialize: (state) => ({ config: state.config }),
    }
  )
);

/** Sync read for non-React modules. */
export function getAppConfig(): PublicAppConfig {
  return useAppConfigStore.getState().config;
}
