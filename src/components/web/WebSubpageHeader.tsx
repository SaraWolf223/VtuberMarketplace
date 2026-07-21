import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WEB_APP_MAX_WIDTH } from '@/constants/feed-layout';
import { spacing } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

type Props = {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
};

/** Website-style page title row below the global web top nav. */
export function WebSubpageHeader({
  title,
  showBack = false,
  onBack,
}: Props): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();

  return (
    <View style={styles.outer}>
      <View style={styles.inner}>
        {showBack ? (
          <Pressable
            style={styles.backBtn}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        ) : null}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    outer: {
      width: '100%',
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    inner: {
      width: '100%',
      maxWidth: WEB_APP_MAX_WIDTH,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      minHeight: 52,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingVertical: spacing.xs,
      paddingRight: spacing.sm,
    },
    backText: {
      fontSize: fontSize.body,
      color: colors.primary,
      fontWeight: fontWeight.semibold,
    },
    title: {
      flex: 1,
      fontSize: fontSize.h2,
      fontWeight: fontWeight.bold,
      color: colors.text,
    },
  })
);
