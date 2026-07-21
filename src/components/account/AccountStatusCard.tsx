import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSellerBenefits } from '@/hooks/useSellerBenefits';
import { useProfile } from '@/hooks/useProfile';
import { isPremiumActive } from '@/features/monetization/premium-service';
import { PREMIUM_FREE_BOOSTS_PER_MONTH } from '@/constants/premium';
import { FOUNDING_FREE_BOOSTS_PER_MONTH } from '@/constants/founding';
import { FREE_LISTINGS_PER_MONTH } from '@/constants/listings';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

/** Visible account limits — boost credits, listing quota, Premium link. */
export function AccountStatusCard(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const router = useRouter();
  const { data: profile } = useProfile();
  const {
    premiumActive,
    isFoundingSeller: benefitsFounding,
    boostCreditsRemaining,
    boostCreditsTotal,
    foundingBoostsRemaining,
    foundingBoostsTotal,
    listingsRemaining,
    listingsLimit,
    isLoading,
    isError,
    refetch,
  } = useSellerBenefits();

  const isFoundingSeller = benefitsFounding || !!profile?.is_founding_seller;
  const foundingRemaining =
    foundingBoostsRemaining ||
    (isFoundingSeller && !benefitsFounding ? FOUNDING_FREE_BOOSTS_PER_MONTH : 0);
  const foundingTotal =
    foundingBoostsTotal ||
    (isFoundingSeller ? FOUNDING_FREE_BOOSTS_PER_MONTH : 0);

  if (isLoading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isError) {
    const fallbackFounding = !!profile?.is_founding_seller;
    const fallbackPremium = isPremiumActive(!!profile?.is_premium, profile?.premium_until);
    return (
      <Pressable style={styles.card} onPress={() => refetch()}>
        {fallbackFounding ? (
          <Text style={styles.line}>
            <Text style={styles.boldFounding}>Founding Seller</Text> · up to{' '}
            {FOUNDING_FREE_BOOSTS_PER_MONTH} free boosts / month
          </Text>
        ) : null}
        {fallbackPremium ? (
          <Text style={styles.line}>
            <Text style={styles.bold}>Premium</Text> · up to {PREMIUM_FREE_BOOSTS_PER_MONTH} free
            boosts / month
          </Text>
        ) : !fallbackFounding ? (
          <Text style={styles.line}>Free plan · upgrade for 10 free boosts / month</Text>
        ) : null}
        <Text style={styles.line}>Up to {FREE_LISTINGS_PER_MONTH} new listings per month</Text>
        <Text style={styles.error}>Could not refresh limits. Tap to retry.</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Your account</Text>
      {isFoundingSeller ? (
        <Text style={styles.line}>
          <Text style={styles.boldFounding}>Founding Seller</Text> · {foundingRemaining} of{' '}
          {foundingTotal} free boosts left
        </Text>
      ) : null}
      {premiumActive ? (
        <Text style={styles.line}>
          <Text style={styles.bold}>Premium</Text> · {boostCreditsRemaining} of{' '}
          {boostCreditsTotal || PREMIUM_FREE_BOOSTS_PER_MONTH} free boosts left
        </Text>
      ) : !isFoundingSeller ? (
        <Text style={styles.line}>Free plan · upgrade for 10 free boosts / month</Text>
      ) : null}
      <Text style={styles.line}>
        {listingsRemaining} of {listingsLimit} new listings left this month
      </Text>
      <View style={styles.actions}>
        {premiumActive ? (
          <Pressable style={styles.btn} onPress={() => router.push('/my-listings')}>
            <Text style={styles.btnText}>My listings · boost</Text>
          </Pressable>
        ) : null}
        <Pressable style={[styles.btn, styles.btnOutline]} onPress={() => router.push('/settings/premium')}>
          <Text style={[styles.btnText, styles.btnTextOutline]}>
            {premiumActive ? 'Manage Premium' : 'Get Premium'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  title: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.bold,
    color: colors.billGreen,
    textTransform: 'uppercase',
  },
  line: { fontSize: fontSize.body, color: colors.text },
  bold: { fontWeight: fontWeight.bold, color: colors.premium },
  boldFounding: { fontWeight: fontWeight.bold, color: colors.warning },
  error: { fontSize: fontSize.caption, color: colors.error, textAlign: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  btn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  btnText: { color: colors.onPrimary, fontWeight: fontWeight.semibold, fontSize: fontSize.caption },
  btnTextOutline: { color: colors.primary },
}));
