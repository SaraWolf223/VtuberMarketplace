import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSellerBenefits } from '@/hooks/useSellerBenefits';
import { useProfile } from '@/hooks/useProfile';
import { isProSellerOrLegacyPremium } from '@/features/monetization/pro-seller-service';
import { PRO_SELLER_FEATURED_CREDITS_PER_MONTH } from '@/constants/pro-seller';
import { FREE_LISTINGS_PER_MONTH } from '@/constants/listings';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

/** Visible account limits — Featured credits, listing quota, Pro Seller link. */
export function AccountStatusCard(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const router = useRouter();
  const { data: profile } = useProfile();
  const {
    proSellerActive,
    featuredCreditsRemaining,
    featuredCreditsTotal,
    listingsRemaining,
    listingsLimit,
    isLoading,
    isError,
    refetch,
  } = useSellerBenefits();

  if (isLoading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isError) {
    const fallbackPro = isProSellerOrLegacyPremium(profile as {
      is_pro_seller?: boolean;
      pro_seller_until?: string | null;
      is_premium?: boolean;
      premium_until?: string | null;
    });
    return (
      <Pressable style={styles.card} onPress={() => refetch()}>
        {fallbackPro ? (
          <Text style={styles.line}>
            <Text style={styles.bold}>Pro Seller</Text> · up to{' '}
            {PRO_SELLER_FEATURED_CREDITS_PER_MONTH} Featured credits / month
          </Text>
        ) : (
          <Text style={styles.line}>Free plan · upgrade for lower fees and Featured credits</Text>
        )}
        <Text style={styles.line}>Up to {FREE_LISTINGS_PER_MONTH} new listings per month</Text>
        <Text style={styles.error}>Could not refresh limits. Tap to retry.</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Your account</Text>
      {proSellerActive ? (
        <Text style={styles.line}>
          <Text style={styles.bold}>Pro Seller</Text> · {featuredCreditsRemaining} of{' '}
          {featuredCreditsTotal || PRO_SELLER_FEATURED_CREDITS_PER_MONTH} Featured credits left
        </Text>
      ) : (
        <Text style={styles.line}>Free plan · 10% commission · upgrade for 8% + Featured credits</Text>
      )}
      <Text style={styles.line}>
        {listingsRemaining} of {listingsLimit} new listings left this month
      </Text>
      <View style={styles.actions}>
        {proSellerActive ? (
          <Pressable style={styles.btn} onPress={() => router.push('/my-listings')}>
            <Text style={styles.btnText}>My listings · feature</Text>
          </Pressable>
        ) : null}
        <Pressable style={[styles.btn, styles.btnOutline]} onPress={() => router.push('/settings/premium')}>
          <Text style={[styles.btnText, styles.btnTextOutline]}>
            {proSellerActive ? 'Manage Pro Seller' : 'Get Pro Seller'}
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
