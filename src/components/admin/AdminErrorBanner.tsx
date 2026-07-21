import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

type Props = {
  message: string | null;
  onRetry: () => void;
  loading?: boolean;
};

export function AdminErrorBanner({
  message,
  onRetry,
  loading = false,
}: Props): React.JSX.Element | null {
  const styles = useStyles();
  const colors = useThemeColors();

  if (!message) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{message}</Text>
      <Pressable
        style={styles.button}
        onPress={onRetry}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Retry loading"
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : (
          <Text style={styles.buttonText}>Retry</Text>
        )}
      </Pressable>
    </View>
  );
}

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    banner: {
      backgroundColor: colors.errorMuted,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.error,
      padding: spacing.md,
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    text: {
      fontSize: fontSize.body,
      color: colors.errorMutedText,
      lineHeight: 22,
    },
    button: {
      alignSelf: 'flex-start',
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.error,
      minWidth: 72,
      alignItems: 'center',
    },
    buttonText: {
      color: colors.error,
      fontWeight: fontWeight.semibold,
      fontSize: fontSize.caption,
    },
  })
);
