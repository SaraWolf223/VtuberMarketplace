import { lightColors } from '@/theme/palettes';

export type { ColorPalette, ThemeMode } from '@/theme/palettes';
export { lightColors, darkColors } from '@/theme/palettes';

/** Static light palette — prefer `useThemeColors()` in components. */
export const colors = lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
} as const;
