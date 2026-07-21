import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getPersistStorage } from '@/lib/persist-storage';

type PrefsState = {
  homeZip: string;
  homeState: string;
  homeLat: number | null;
  homeLng: number | null;
  radiusMiles: number;
  setHomeZip: (zip: string) => void;
  setHomeState: (state: string) => void;
  setHomeLocation: (lat: number, lng: number) => void;
  setRadiusMiles: (radius: number) => void;
};

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      homeZip: '',
      homeState: '',
      homeLat: null,
      homeLng: null,
      radiusMiles: 10,
      setHomeZip: (homeZip) => set({ homeZip }),
      setHomeState: (homeState) => set({ homeState }),
      setHomeLocation: (homeLat, homeLng) => set({ homeLat, homeLng }),
      // Radius validity against the admin-configured list is enforced server-side
      // (RPC layer, migration 111) and client-side by callers using `useRadiusOptions()`;
      // this store just needs a sane numeric guard.
      setRadiusMiles: (radiusMiles) =>
        set({ radiusMiles: Number.isFinite(radiusMiles) && radiusMiles > 0 ? radiusMiles : 10 }),
    }),
    {
      name: 'localmarketplace-prefs',
      storage: createJSONStorage(() => getPersistStorage()),
    }
  )
);

/** Persist rehydrates async — await before reading homeZip on cold start. */
export function waitForPrefsStoreHydration(maxMs = 5000): Promise<void> {
  if (usePrefsStore.persist.hasHydrated()) {
    return Promise.resolve();
  }
  return Promise.race([
    new Promise<void>((resolve) => {
      const unsub = usePrefsStore.persist.onFinishHydration(() => {
        unsub();
        resolve();
      });
    }),
    new Promise<void>((resolve) => setTimeout(resolve, maxMs)),
  ]);
}

export function getCachedHomeZip(): string {
  return usePrefsStore.getState().homeZip.replace(/\D/g, '').slice(0, 5);
}

export function getCachedHomeState(): string {
  return usePrefsStore.getState().homeState.trim().toUpperCase();
}
