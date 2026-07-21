import { getThemeMode } from '@/stores/theme-store';
import { getAppConfig } from '@/stores/app-config-store';
import { resolveThemeColors, type ColorPalette } from '@/theme/palettes';

/** Sync palette for modules that cannot use hooks. */
export function getThemeColors(): ColorPalette {
  return resolveThemeColors(getThemeMode(), getAppConfig().brandingColors);
}
