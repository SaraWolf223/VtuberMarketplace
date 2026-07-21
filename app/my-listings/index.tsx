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
import { useFeaturedListing } from '@/hooks/useFeaturedListing';
import { useSellerBenefits } from '@/hooks/useSellerBenefits';
import { MyListingRow } from '@/components/listing/MyListingRow';
import { FeaturedCreditsBanner } from '@/components/monetization/BoostCreditsBanner';
import { SellerStrikeNotice } from '@/components/strikes/SellerStrikeNotice';
import { ErrorRetry } from '@/components/ui/ErrorRetry';
import { canUseStripePaidMonetization } from '@/features/monetization/platform-payments';
import { useDraftListingStore } from '@/stores/draft-listing-store';
import type { MyListingStatus } from '@/types/my-listings';
import { PRO_SELLER_FEATURED_CREDITS_PER_MONTH } from '@/constants/pro-seller';
import { FEATURED_CHECKOUT, formatUsdFromCents } from '@/constants/stripe-fees';
import { FEATURED_PLACEMENT_DURATION_DAYS } from '@/constants/pro-seller';
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
  const { featureListing, featuringId } = useFeaturedListing();
  const {
    proSellerActive,
    featuredCreditsRemaining,
    featuredCreditsTotal,
  } = useSellerBenefits();
  const paidFeaturedAvailable = canUseStripePaidMonetization();

  useEffect(() => {
    if (tabParam === 'active' || tabParam === 'sold' || tabParam === 'expired') {
      setTab(tabParam);
    }
  }, [tabParam]);

  const confirmFeatureCredit = (id: string, title: string) => {
    Alert.alert(
      'Use a Pro Seller Featured credit?',
      `Uses 1 of ${featuredCreditsRemaining} credits left this month (${PRO_SELLER_FEATURED_CREDITS_PER_MONTH} per month). Featured listings rank higher for ${FEATURED_PLACEMENT_DURATION_DAYS} days.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Feature', onPress: () => featureListing(id, title, 'credit') },
      ]
    );
  };

  const confirmFeaturePaid = (id: string, title: string) => {
    if (!paidFeaturedAvailable) {
      Alert.alert(
        'Purchases unavailable on iOS',
        'Paid Featured placements are disabled on iOS until Apple In-App Purchase is implemented.'
      );
      return;
    }

    Alert.alert(
      `Feature listing for ${formatUsdFromCents(FEATURED_CHECKOUT.totalCents)}?`,
      featuredCreditsRemaining > 0
        ? `Paid placement — does not use Pro Seller credits. Ranks higher for ${FEATURED_PLACEMENT_DURATION_DAYS} days.`
        : `Ranks higher in the catalog for ${FEATURED_PLACEMENT_DURATION_DAYS} days.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Feature ${formatUsdFromCents(FEATURED_CHECKOUT.totalCents)}`,
          onPress: () => featureListing(id, title, 'paid'),
        },
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
              <>
                <SellerStrikeNotice />
                {proSellerActive ? (
                  <FeaturedCreditsBanner
                    remaining={featuredCreditsRemaining}
                    total={featuredCreditsTotal || PRO_SELLER_FEATURED_CREDITS_PER_MONTH}
                  />
                ) : (
                  <View style={styles.nonProHint}>
                    <Text style={styles.nonProHintText}>
                      {paidFeaturedAvailable
                        ? `Pro Seller includes ${PRO_SELLER_FEATURED_CREDITS_PER_MONTH} Featured credits per month plus an 8% commission rate. Anyone can also buy Featured placement à la carte.`
                        : 'Pro Seller credits and paid Featured placements require Stripe checkout (disabled on iOS until IAP).'}
                    </Text>
                    <Pressable onPress={() => router.push('/settings/premium')}>
                      <Text style={styles.nonProLink}>
                        {paidFeaturedAvailable ? 'View Pro Seller' : 'View seller benefits'}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </>
            ) : null
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              {tab === 'active'
                ? 'No active listings. Post something from the Sell tab.'
                : tab === 'expired'
                  ? 'No expired listings yet.'
                  : `No ${tab} listings yet.`}
            </Text>
          }
          renderItem={({ item }) => (
            <MyListingRow
              item={item}
              showExpiry={tab === 'active'}
              onPress={() => router.push(`/listing/${item.id}`)}
              onEdit={tab === 'active' ? () => startEdit(item) : undefined}
              onFeatureCredit={
                tab === 'active' && proSellerActive && featuredCreditsRemaining > 0
                  ? () => confirmFeatureCredit(item.id, item.title)
                  : undefined
              }
              onFeaturePaid={tab === 'active' && paidFeaturedAvailable ? () => confirmFeaturePaid(item.id, item.title) : undefined}
              onMarkSold={tab === 'active' ? () => confirmMarkSold(item.id, item.title) : undefined}
              onDelete={tab === 'active' ? () => confirmDelete(item.id, item.title) : undefined}
              busy={isMarkingSold || isDeleting}
              featureBusy={featuringId === item.id}
              featuredCreditsRemaining={tab === 'active' ? featuredCreditsRemaining : 0}
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
  nonProHint: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  nonProHintText: { fontSize: fontSize.caption, color: colors.textSecondary },
  nonProLink: {
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
