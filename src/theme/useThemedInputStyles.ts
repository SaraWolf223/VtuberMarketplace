import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize } from '@/theme/typography';

export type ThemedInputStyles = {
  input: ViewStyle & TextStyle;
  multiline: TextStyle;
};

const useInputStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.md,
      fontSize: fontSize.body,
      backgroundColor: colors.surface,
      color: colors.text,
    },
    multiline: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
  })
);

/** Shared TextInput styles — always sets text + surface colors for light/dark. */
export function useThemedInputStyles(): ThemedInputStyles {
  return useInputStyles();
}
