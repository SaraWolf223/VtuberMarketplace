import { View, Text, StyleSheet } from 'react-native';
import { PRO_SELLER_FEATURED_CREDITS_PER_MONTH } from '@/constants/pro-seller';
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

export function FeaturedCreditsBanner({
  remaining,
  total = PRO_SELLER_FEATURED_CREDITS_PER_MONTH,
  compact,
  title = 'Pro Seller Featured credits',
  subtitle,
}: Props): React.JSX.Element {
  const styles = useStyles();
  const depleted = remaining <= 0;
  const hint =
    subtitle ??
    (depleted
      ? 'No Featured credits left — pay per placement or wait until next month.'
      : 'Tap Use Featured credit on a listing below (or pay per placement).');

  return (
    <View style={[styles.banner, depleted && styles.bannerDepleted]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.count}>
        {remaining} <Text style={styles.of}>of {total}</Text> Featured credits left this month
      </Text>
      {!compact ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

/** @deprecated use FeaturedCreditsBanner */
export const BoostCreditsBanner = FeaturedCreditsBanner;

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
