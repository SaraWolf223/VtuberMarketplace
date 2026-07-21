import { View, Text, StyleSheet, Pressable } from 'react-native';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

type Props = {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  showChevron?: boolean;
  badge?: string;
  badgeTone?: 'default' | 'success' | 'warning';
  isLast?: boolean;
  titleTone?: 'default' | 'premium' | 'danger';
  rightElement?: React.ReactNode;
};

export function SettingsRow({
  title,
  subtitle,
  onPress,
  showChevron = !!onPress,
  badge,
  badgeTone = 'default',
  isLast = false,
  titleTone = 'default',
  rightElement,
}: Props): React.JSX.Element {
  const styles = useStyles();
  const content = (
    <>
      <View style={styles.textCol}>
        <Text
          style={[
            styles.title,
            titleTone === 'premium' && styles.titlePremium,
            titleTone === 'danger' && styles.titleDanger,
          ]}
        >
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {badge ? (
        <View
          style={[
            styles.badge,
            badgeTone === 'success' && styles.badgeSuccess,
            badgeTone === 'warning' && styles.badgeWarning,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              badgeTone === 'success' && styles.badgeTextSuccess,
              badgeTone === 'warning' && styles.badgeTextWarning,
            ]}
          >
            {badge}
          </Text>
        </View>
      ) : null}
      {rightElement ?? null}
      {showChevron && onPress ? <Text style={styles.chevron}>›</Text> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        style={[styles.row, !isLast && styles.rowBorder]}
        onPress={onPress}
        accessibilityRole="button"
      >
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.row, !isLast && styles.rowBorder]}>{content}</View>;
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    minHeight: 52,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  titlePremium: {
    color: colors.premium,
  },
  titleDanger: {
    color: colors.error,
  },
  subtitle: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  badge: {
    backgroundColor: colors.billGreenMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  badgeSuccess: {
    backgroundColor: colors.successMuted,
  },
  badgeWarning: {
    backgroundColor: colors.warningMuted,
  },
  badgeText: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  badgeTextSuccess: {
    color: colors.successMutedText,
  },
  badgeTextWarning: {
    color: colors.warningMutedText,
  },
  chevron: {
    fontSize: 22,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold,
    marginTop: -2,
  },
}));
