import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useThemeStore } from '@/stores/theme-store';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { ThemeMode } from '@/theme/palettes';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

const OPTIONS: { mode: ThemeMode; label: string }[] = [
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
];

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      gap: spacing.md,
    },
    label: {
      flex: 1,
      fontSize: fontSize.body,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
    segment: {
      flexDirection: 'row',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      padding: 3,
      gap: 2,
    },
    segmentBtn: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.sm,
      minWidth: 56,
      alignItems: 'center',
    },
    segmentText: {
      fontSize: fontSize.caption,
      fontWeight: fontWeight.semibold,
    },
  })
);

export function ThemePicker(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const themeMode = useThemeStore((s) => s.themeMode);
  const setThemeMode = useThemeStore((s) => s.setThemeMode);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Theme</Text>
      <View style={styles.segment}>
        {OPTIONS.map(({ mode, label }) => {
          const active = themeMode === mode;
          return (
            <Pressable
              key={mode}
              style={[styles.segmentBtn, active && { backgroundColor: colors.primary }]}
              onPress={() => setThemeMode(mode)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: active ? colors.onPrimary : colors.textSecondary },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
