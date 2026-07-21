import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMyListings } from '@/hooks/useMyListings';
import { useBoostListing } from '@/hooks/useBoostListing';
import { useSellerBenefits } from '@/hooks/useSellerBenefits';
import { useProfile } from '@/hooks/useProfile';
import { MyListingRow } from '@/components/listing/MyListingRow';
import { BoostCreditsBanner } from '@/components/monetization/BoostCreditsBanner';
import { ErrorRetry } from '@/components/ui/ErrorRetry';
import { canUseStripePaidMonetization } from '@/features/monetization/platform-payments';
import { useDraftListingStore } from '@/stores/draft-listing-store';
import type { MyListingStatus } from '@/types/my-listings';
import { PREMIUM_FREE_BOOSTS_PER_MONTH } from '@/constants/premium';
import { FOUNDING_FREE_BOOSTS_PER_MONTH } from '@/constants/founding';
import { LISTING_EXPIRY_HINT } from '@/constants/listing-lifecycle';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

const TABS: { key: MyListingStatus; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'sold', label: 'Sold' },
  { key: 'expired', label: 'Expired' },
];

export default function MyListingsScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const router = useRouter();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<MyListingStatus>('active');
  const { data, isLoading, isError, refetch, isRefetching, markSold, removeListing, isMarkingSold, isDeleting } =
    useMyListings(tab);
  const loadForEdit = useDraftListingStore((s) => s.loadForEdit);
  const { boostListing, boostingId } = useBoostListing();
  const { data: profile } = useProfile();
  const {
    premiumActive,
    isFoundingSeller: benefitsFounding,
    boostCreditsRemaining: freeBoosts,
    boostCreditsTotal,
    foundingBoostsRemaining,
    foundingBoostsTotal,
    promoBoostsRemaining,
  } = useSellerBenefits();
  const paidBoostsAvailable = canUseStripePaidMonetization();

  const isFoundingSeller = benefitsFounding || !!profile?.is_founding_seller;
  const foundingRemaining =
    foundingBoostsRemaining ||
    (isFoundingSeller && !benefitsFounding ? FOUNDING_FREE_BOOSTS_PER_MONTH : 0);
  const foundingTotal =
    foundingBoostsTotal ||
    (isFoundingSeller ? FOUNDING_FREE_BOOSTS_PER_MONTH : 0);

  useEffect(() => {
    if (tabParam === 'active' || tabParam === 'sold' || tabParam === 'expired') {
      setTab(tabParam);
    }
  }, [tabParam]);

  const confirmBoostFree = (id: string, title: string) => {
    Alert.alert(
      'Use a free Premium boost?',
      `Uses 1 of ${freeBoosts} free boosts left this month (${PREMIUM_FREE_BOOSTS_PER_MONTH} per month). Ranks higher for 24h; adds 14 days if expiring within a week.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Boost free', onPress: () => boostListing(id, title, 'free') },
      ]
    );
  };

  const confirmBoostFounding = (id: string, title: string) => {
    Alert.alert(
      'Use a Founding Seller boost?',
      `Uses 1 of ${foundingRemaining} free boosts left this month (${FOUNDING_FREE_BOOSTS_PER_MONTH} per month for Founding Sellers).`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Boost free', onPress: () => boostListing(id, title, 'founding') },
      ]
    );
  };

  const confirmBoostPromo = (id: string, title: string) => {
    Alert.alert(
      'Use a promo boost?',
      `Uses 1 of ${promoBoostsRemaining} promo boost${promoBoostsRemaining === 1 ? '' : 's'} left. Ranks higher for 24h.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Boost with promo', onPress: () => boostListing(id, title, 'promo') },
      ]
    );
  };

  const confirmBoostPaid = (id: string, title: string) => {
    if (!paidBoostsAvailable) {
      Alert.alert('Purchases unavailable on iOS', 'Paid boosts are disabled on iOS until Apple In-App Purchase is implemented.');
      return;
    }

    Alert.alert(
      'Boost listing for $1?',
      freeBoosts > 0
        ? 'Paid boost — does not use Premium credits. Ranks higher 24h; adds 14 days if expiring within a week.'
        : 'Ranks higher for 24 hours. Adds 14 days to listing life if expiring within a week.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Boost $1', onPress: () => boostListing(id, title, 'paid') },
      ]
    );
  };

  const confirmMarkSold = (id: string, title: string) => {
    Alert.alert('Mark as sold?', `"${title}" will leave the active feed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark sold',
        onPress: () =>
          markSold(id, {
            onSuccess: () => Alert.alert('Marked sold'),
            onError: (e) =>
              Alert.alert('Error', e instanceof Error ? e.message : 'Could not update'),
          }),
      },
    ]);
  };

  const confirmDelete = (id: string, title: string) => {
    Alert.alert(
      'Delete listing permanently?',
      `"${title}" and its photos will be removed and cannot be undone.`,
      [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          removeListing(id, {
            onSuccess: () => Alert.alert('Deleted'),
            onError: (e) =>
              Alert.alert('Error', e instanceof Error ? e.message : 'Could not delete'),
          }),
      },
    ]);
  };

  const startEdit = (item: NonNullable<typeof data>[number]) => {
    loadForEdit(item);
    router.push('/(tabs)/sell');
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <ErrorRetry message="Could not load listings." onRetry={() => refetch()} />
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />
          }
          ListHeaderComponent={
            tab === 'active' ? (
              isFoundingSeller ? (
                <BoostCreditsBanner
                  remaining={foundingRemaining}
                  total={foundingTotal}
                  title="Founding Seller boosts"
                  subtitle="Tap Founding boost on a listing below."
                />
              ) : premiumActive ? (
                <BoostCreditsBanner
                  remaining={freeBoosts}
                  total={boostCreditsTotal || PREMIUM_FREE_BOOSTS_PER_MONTH}
                />
              ) : (
                <View style={styles.nonPremiumHint}>
                  <Text style={styles.nonPremiumHintText}>
                    {paidBoostsAvailable
                      ? `Premium includes ${PREMIUM_FREE_BOOSTS_PER_MONTH} free boosts per month. Paid boosts are $1 each below.`
                      : 'Free, promo, and founding boost credits remain available. Paid boosts are disabled on iOS until Apple In-App Purchase is implemented.'}
                  </Text>
                  <Pressable onPress={() => router.push('/settings/premium')}>
                    <Text style={styles.nonPremiumLink}>
                      {paidBoostsAvailable ? 'View Premium' : 'View benefits'}
                    </Text>
                  </Pressable>
                </View>
              )
            ) : null
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              {tab === 'active'
                ? 'No active listings. Post something from the Post Ad tab.'
                : tab === 'expired'
                  ? `No expired listings yet. ${LISTING_EXPIRY_HINT} — post a new listing from the Post Ad tab to sell again.`
                  : `No ${tab} listings yet.`}
            </Text>
          }
          renderItem={({ item }) => (
            <MyListingRow
              item={item}
              showExpiry={tab === 'active'}
              onPress={() => router.push(`/listing/${item.id}`)}
              onEdit={tab === 'active' ? () => startEdit(item) : undefined}
              onBoostFree={
                tab === 'active' && premiumActive && freeBoosts > 0
                  ? () => confirmBoostFree(item.id, item.title)
                  : undefined
              }
              onBoostFounding={
                tab === 'active' && isFoundingSeller && foundingRemaining > 0
                  ? () => confirmBoostFounding(item.id, item.title)
                  : undefined
              }
              onBoostPromo={
                tab === 'active' && promoBoostsRemaining > 0
                  ? () => confirmBoostPromo(item.id, item.title)
                  : undefined
              }
              onBoostPaid={tab === 'active' && paidBoostsAvailable ? () => confirmBoostPaid(item.id, item.title) : undefined}
              onMarkSold={tab === 'active' ? () => confirmMarkSold(item.id, item.title) : undefined}
              onDelete={tab === 'active' ? () => confirmDelete(item.id, item.title) : undefined}
              busy={isMarkingSold || isDeleting}
              boostBusy={boostingId === item.id}
              freeBoostsRemaining={tab === 'active' ? freeBoosts : 0}
            />
          )}
        />
      )}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabs: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  tabActive: { borderColor: colors.primary, backgroundColor: colors.priceBackground },
  tabText: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.textSecondary },
  tabTextActive: { color: colors.primary },
  list: { padding: spacing.md, paddingTop: 0, flexGrow: 1 },
  nonPremiumHint: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  nonPremiumHintText: { fontSize: fontSize.caption, color: colors.textSecondary },
  nonPremiumLink: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.bold,
    color: colors.premium,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    padding: spacing.xl,
    fontSize: fontSize.body,
  },
}));
