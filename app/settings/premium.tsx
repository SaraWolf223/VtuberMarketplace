import { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useProfile } from '@/hooks/useProfile';
import { useSellerBenefits } from '@/hooks/useSellerBenefits';
import { usePremiumSubscription } from '@/hooks/usePremiumSubscription';
import { usePremiumBilling } from '@/hooks/usePremiumBilling';
import { isPremiumActive } from '@/features/monetization/premium-service';
import { canUseStripePaidMonetization } from '@/features/monetization/platform-payments';
import { PremiumBadge } from '@/components/profile/PremiumBadge';
import { BoostCreditsBanner } from '@/components/monetization/BoostCreditsBanner';
import { PREMIUM_FREE_BOOSTS_PER_MONTH } from '@/constants/premium';
import { BOOST_CHECKOUT, PREMIUM_CHECKOUT, formatUsdFromCents } from '@/constants/stripe-fees';
import { FREE_LISTINGS_PER_MONTH, PREMIUM_LISTINGS_PER_MONTH } from '@/constants/listings';
import { LEGAL_URLS } from '@/constants/legal-urls';
import { ErrorRetry } from '@/components/ui/ErrorRetry';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

const BENEFITS = [
  'Premium badge on your profile and listings',
  `${PREMIUM_FREE_BOOSTS_PER_MONTH} free listing boosts every month ($${PREMIUM_FREE_BOOSTS_PER_MONTH} value)`,
  `Post up to ${PREMIUM_LISTINGS_PER_MONTH} listings per month (free accounts: ${FREE_LISTINGS_PER_MONTH})`,
  `After free boosts: pay ${formatUsdFromCents(BOOST_CHECKOUT.totalCents)} each (includes card processing)`,
];

export default function PremiumScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const router = useRouter();
  const { data: profile, isLoading, isError, error, refetch } = useProfile();
  const {
    benefits,
    premiumActive: benefitsPremium,
    boostCreditsRemaining,
    boostCreditsTotal,
    listingsRemaining,
    listingsLimit,
    isLoading: benefitsLoading,
    refetch: refetchBenefits,
  } = useSellerBenefits();
  const { checkout } = useLocalSearchParams<{ checkout?: string }>();
  const { subscribe, subscribing, syncFromStripe } = usePremiumSubscription();
  const { openPortal, opening } = usePremiumBilling();
  const paidPurchasesAvailable = canUseStripePaidMonetization();

  useEffect(() => {
    if (checkout === 'success' && paidPurchasesAvailable) {
      void syncFromStripe();
    }
  }, [checkout, paidPurchasesAvailable, syncFromStripe]);

  if (isError && !profile) {
    return (
      <View style={styles.centered}>
        <ErrorRetry
          message={error instanceof Error ? error.message : 'Could not load your profile'}
          onRetry={() => void refetch()}
        />
      </View>
    );
  }

  if (isLoading || !profile) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const active =
    benefitsPremium || isPremiumActive(profile.is_premium, profile.premium_until);
  const renewsLabel =
    profile.premium_until && active
      ? `Active until ${new Date(profile.premium_until).toLocaleDateString()}`
      : benefits?.premium_until && active
        ? `Active until ${new Date(benefits.premium_until).toLocaleDateString()}`
        : null;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={benefitsLoading}
          onRefresh={() => {
            void refetchBenefits();
            if (paidPurchasesAvailable) {
              void syncFromStripe();
            }
          }}
        />
      }
    >
      <View style={styles.hero}>
        <PremiumBadge />
        <Text style={styles.title}>Premium Seller</Text>
        <Text style={styles.price}>
          {paidPurchasesAvailable
            ? `${formatUsdFromCents(PREMIUM_CHECKOUT.baseCents)} / month + ${formatUsdFromCents(PREMIUM_CHECKOUT.processingFeeCents)} processing`
            : 'Premium benefits'}
        </Text>
        <Text style={styles.priceSub}>
          {paidPurchasesAvailable ? (
            <>
          {formatUsdFromCents(PREMIUM_CHECKOUT.totalCents)} / month total · processing fee goes to
          Stripe
            </>
          ) : (
            'Purchases are disabled on iOS until Apple In-App Purchase is implemented.'
          )}
        </Text>
        {active ? (
          <Text style={styles.active}>{renewsLabel ?? 'Premium active'}</Text>
        ) : (
          <Text style={styles.sub}>
            {paidPurchasesAvailable ? (
              <>
            Opens secure Stripe checkout in your browser · test mode in development
              </>
            ) : (
              'Free marketplace features remain available.'
            )}
          </Text>
        )}
      </View>

      <View style={styles.card}>
        {(paidPurchasesAvailable
          ? BENEFITS
          : BENEFITS.filter((line) => !line.startsWith('After free boosts'))).map((line) => (
          <Text key={line} style={styles.benefit}>
            • {line}
          </Text>
        ))}
      </View>

      {active ? (
        <>
          {benefitsLoading ? (
            <ActivityIndicator color={colors.premium} />
          ) : (
            <BoostCreditsBanner
              remaining={boostCreditsRemaining}
              total={boostCreditsTotal || PREMIUM_FREE_BOOSTS_PER_MONTH}
            />
          )}
          <View style={styles.card}>
            <Text style={styles.section}>Listings this month</Text>
            <Text style={styles.credits}>
              {listingsRemaining} of {listingsLimit} posts remaining
            </Text>
          </View>
          <Pressable style={styles.secondaryBtn} onPress={() => router.push('/my-listings')}>
            <Text style={styles.secondaryText}>Go to My listings to boost</Text>
          </Pressable>
          <Pressable
            style={[styles.portalBtn, (opening || !paidPurchasesAvailable) && styles.ctaDisabled]}
            onPress={openPortal}
            disabled={opening || !paidPurchasesAvailable}
          >
            {opening ? (
              <ActivityIndicator color={colors.premium} />
            ) : (
              <Text style={styles.portalText}>
                {paidPurchasesAvailable ? 'Manage or cancel subscription' : 'Billing unavailable on iOS'}
              </Text>
            )}
          </Pressable>
          <Text style={styles.portalHint}>
            {paidPurchasesAvailable
              ? 'Opens Stripe billing portal to update payment method or cancel Premium.'
              : 'Billing management is disabled on iOS until Apple In-App Purchase is implemented.'}
          </Text>
        </>
      ) : (
        <Pressable
          style={[styles.cta, (subscribing || !paidPurchasesAvailable) && styles.ctaDisabled]}
          onPress={subscribe}
          disabled={subscribing || !paidPurchasesAvailable}
        >
          {subscribing ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.ctaText}>
              {paidPurchasesAvailable ? (
                <>
              Subscribe — {formatUsdFromCents(PREMIUM_CHECKOUT.totalCents)}/mo
                </>
              ) : (
                'Unavailable on iOS'
              )}
            </Text>
          )}
        </Pressable>
      )}

      {paidPurchasesAvailable ? (
      <Text style={styles.legal}>
        Subscription renews monthly. By subscribing you agree to our{' '}
        <Text
          style={styles.legalLink}
          onPress={() => void Linking.openURL(LEGAL_URLS.terms)}
        >
          Terms
        </Text>{' '}
        and{' '}
        <Text
          style={styles.legalLink}
          onPress={() => void Linking.openURL(LEGAL_URLS.privacy)}
        >
          Privacy Policy
        </Text>
        .
      </Text>
      ) : null}
    </ScrollView>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  hero: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  title: {
    fontSize: fontSize.h1,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: spacing.sm,
  },
  price: { fontSize: fontSize.h2, fontWeight: fontWeight.bold, color: colors.premium },
  priceSub: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  sub: { fontSize: fontSize.caption, color: colors.textSecondary, textAlign: 'center' },
  active: {
    fontSize: fontSize.body,
    color: colors.premium,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  benefit: { fontSize: fontSize.body, color: colors.text, lineHeight: 22 },
  section: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  credits: {
    fontSize: fontSize.h2,
    fontWeight: fontWeight.bold,
    color: colors.premium,
  },
  cta: {
    backgroundColor: colors.premium,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.7 },
  ctaText: { color: colors.onPrimary, fontWeight: fontWeight.bold, fontSize: fontSize.body },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.premium,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  secondaryText: { color: colors.premium, fontWeight: fontWeight.semibold },
  portalBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  portalText: { color: colors.text, fontWeight: fontWeight.semibold },
  portalHint: { fontSize: fontSize.caption, color: colors.textMuted, textAlign: 'center' },
  legal: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  legalLink: {
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
}));
