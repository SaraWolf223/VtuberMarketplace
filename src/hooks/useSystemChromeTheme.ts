import { requireOptionalNativeModule } from 'expo';
import { useEffect } from 'react';
import { Platform, processColor } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useThemeStore } from '@/stores/theme-store';

type ExpoSystemUIModule = {
  setBackgroundColorAsync?: (color: number | null) => Promise<void>;
};

type ExpoNavigationBarModule = {
  setBackgroundColorAsync?: (color: number | null) => Promise<void>;
  setButtonStyleAsync?: (style: 'light' | 'dark') => Promise<void>;
};

/** Resolved once at load — never import expo-system-ui / expo-navigation-bar JS (they throw if native is missing). */
const systemUi = requireOptionalNativeModule<ExpoSystemUIModule>('ExpoSystemUI');
const navigationBar =
  Platform.OS === 'android'
    ? requireOptionalNativeModule<ExpoNavigationBarModule>('ExpoNavigationBar')
    : null;

function toNativeColor(color: string): number | null {
  const processed = processColor(color);
  return typeof processed === 'number' ? processed : null;
}

/** Sync Android navigation bar and root background with app theme when native modules exist. */
export function useSystemChromeTheme(): void {
  const colors = useThemeColors();
  const themeMode = useThemeStore((s) => s.themeMode);

  useEffect(() => {
    if (typeof systemUi?.setBackgroundColorAsync === 'function') {
      void systemUi.setBackgroundColorAsync(toNativeColor(colors.background)).catch(() => {});
    }

    if (!navigationBar) {
      return;
    }

    const updates: Promise<void>[] = [];
    if (typeof navigationBar.setBackgroundColorAsync === 'function') {
      updates.push(navigationBar.setBackgroundColorAsync(toNativeColor(colors.tabBar)));
    }
    if (typeof navigationBar.setButtonStyleAsync === 'function') {
      updates.push(
        navigationBar.setButtonStyleAsync(themeMode === 'dark' ? 'light' : 'dark')
      );
    }
    void Promise.all(updates).catch(() => {});
  }, [colors.background, colors.tabBar, themeMode]);
}
