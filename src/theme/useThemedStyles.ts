import { useMemo } from 'react';
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { ColorPalette } from '@/theme/palettes';

type NamedStyles<T> = {
  [P in keyof T]: ViewStyle | TextStyle | ImageStyle;
};

export function createThemedStyles<T extends NamedStyles<T>>(
  factory: (colors: ColorPalette) => T
): () => T {
  return function useStyles(): T {
    const colors = useThemeColors();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
