import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const SECURE_PREFIX = 'localmarketplace.auth.';

type SecureStoreModule = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};

/** Lazy load — top-level import crashes when native module is not in the current build. */
let secureStoreModule: SecureStoreModule | null | undefined;
let warnedMissingNative = false;

function isWebRuntime(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined';
}

function getSecureStore(): SecureStoreModule | null {
  if (Platform.OS === 'web') return null;
  if (secureStoreModule !== undefined) return secureStoreModule;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    secureStoreModule = require('expo-secure-store') as SecureStoreModule;
  } catch {
    secureStoreModule = null;
    if (__DEV__ && !warnedMissingNative) {
      warnedMissingNative = true;
      console.warn(
        '[Local Marketplace] expo-secure-store native module missing — using AsyncStorage for auth. ' +
          'Rebuild the dev client after adding expo-secure-store (npx expo run:android / run:ios).'
      );
    }
  }

  return secureStoreModule;
}

/** Supabase auth storage: SecureStore on native when linked, else AsyncStorage. */
export const supabaseAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    if (isWebRuntime()) {
      return window.localStorage.getItem(key);
    }
    if (Platform.OS === 'web') {
      return null;
    }

    const secure = getSecureStore();
    if (!secure) {
      if (!__DEV__) {
        console.error('[Local Marketplace] SecureStore required for auth in production builds');
        return null;
      }
      return AsyncStorage.getItem(key);
    }
    try {
      return await secure.getItemAsync(`${SECURE_PREFIX}${key}`);
    } catch {
      if (!__DEV__) {
        console.error('[Local Marketplace] SecureStore read failed in production');
        return null;
      }
      return AsyncStorage.getItem(key);
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (isWebRuntime()) {
      window.localStorage.setItem(key, value);
      return;
    }
    if (Platform.OS === 'web') {
      return;
    }

    const secure = getSecureStore();
    if (!secure) {
      if (!__DEV__) {
        throw new Error('Secure storage is unavailable. Reinstall the app from a current build.');
      }
      await AsyncStorage.setItem(key, value);
      return;
    }
    try {
      await secure.setItemAsync(`${SECURE_PREFIX}${key}`, value);
    } catch {
      if (!__DEV__) {
        throw new Error('Secure storage is unavailable. Reinstall the app from a current build.');
      }
      await AsyncStorage.setItem(key, value);
    }
  },

  async removeItem(key: string): Promise<void> {
    if (isWebRuntime()) {
      window.localStorage.removeItem(key);
      return;
    }
    if (Platform.OS === 'web') {
      return;
    }

    const secure = getSecureStore();
    if (!secure) {
      if (!__DEV__) {
        return;
      }
      await AsyncStorage.removeItem(key);
      return;
    }
    try {
      await secure.deleteItemAsync(`${SECURE_PREFIX}${key}`);
    } catch {
      if (!__DEV__) {
        return;
      }
      await AsyncStorage.removeItem(key);
    }
  },
};
