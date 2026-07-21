import { useThemeStore } from '@/stores/theme-store';
import { useAppConfigStore } from '@/stores/app-config-store';
import { resolveThemeColors, type ColorPalette } from '@/theme/palettes';

export function useThemeColors(): ColorPalette {
  const themeMode = useThemeStore((s) => s.themeMode);
  const brandOverrides = useAppConfigStore((s) => s.config.brandingColors);
  return resolveThemeColors(themeMode, brandOverrides);
}
