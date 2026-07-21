import { View, Text, StyleSheet } from 'react-native';
import { PREMIUM_FREE_BOOSTS_PER_MONTH } from '@/constants/premium';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

type Props = {
  remaining: number;
  total?: number;
  compact?: boolean;
  title?: string;
  subtitle?: string;
};

export function BoostCreditsBanner({
  remaining,
  total = PREMIUM_FREE_BOOSTS_PER_MONTH,
  compact,
  title = 'Premium boost credits',
  subtitle,
}: Props): React.JSX.Element {
  const styles = useStyles();
  const depleted = remaining <= 0;
  const hint =
    subtitle ??
    (depleted
      ? 'No free boosts left — use paid Boost or wait until next month.'
      : 'Tap Free boost on a listing below (or paid Boost to skip using a credit).');

  return (
    <View style={[styles.banner, depleted && styles.bannerDepleted]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.count}>
        {remaining} <Text style={styles.of}>of {total}</Text> free boosts left this month
      </Text>
      {!compact ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  banner: {
    backgroundColor: colors.billGreenMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.billGreen,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  bannerDepleted: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.bold,
    color: colors.billGreen,
    marginBottom: spacing.xs,
  },
  count: {
    fontSize: fontSize.h2,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  of: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.textSecondary },
  hint: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: spacing.xs },
}));
