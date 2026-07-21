import { View, Text, StyleSheet, Pressable } from 'react-native';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

type Props = {
  message: string;
  onRetry: () => void;
  retryLabel?: string;
};

export function ErrorRetry({
  message,
  onRetry,
  retryLabel = 'Try again',
}: Props): React.JSX.Element {
  const styles = useStyles();
  return (
    <View style={styles.wrap}>
      <Text style={styles.message}>{message}</Text>
      <Pressable style={styles.button} onPress={onRetry} accessibilityRole="button">
        <Text style={styles.buttonText}>{retryLabel}</Text>
      </Pressable>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  wrap: {
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  message: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  button: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  buttonText: {
    color: colors.primary,
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.body,
  },
}));
