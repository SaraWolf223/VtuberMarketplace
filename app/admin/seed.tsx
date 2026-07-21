import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  adminQueryErrorMessage,
  fetchSeedPayoutOverview,
  approveSeedListing,
  revokeSeedApproval,
  markSeedPaid,
  extendListingExpiry,
} from '@/features/admin/admin-service';
import type { SeedListingRow, SeedSellerGroup } from '@/features/admin/admin-types';
import { AdminErrorBanner } from '@/components/admin/AdminErrorBanner';
import { listingThumbSource } from '@/lib/listing-thumb-source';
import { formatListingPrice } from '@/utils/format-listing';
import { SEED_PAID_CAP_PER_PERSON, SEED_PAYOUT_CENTS } from '@/constants/seed';
import { queryKeys } from '@/lib/query-keys';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

const EXTEND_DAYS = 60;

export default function AdminSeedScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const { session, user } = useAuth();
  const token = session?.access_token ?? '';
  const adminUserId = user?.id ?? '';
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.adminSeedPayouts,
    enabled: !!token,
    queryFn: () => fetchSeedPayoutOverview(token),
  });

  const groups = query.data ?? [];
  const totalApproved = groups.reduce((sum, g) => sum + g.approved_count, 0);
  const totalPaid = groups.reduce((sum, g) => sum + g.paid_count, 0);
  const owedCents = (totalApproved - totalPaid) * SEED_PAYOUT_CENTS;

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.adminSeedPayouts });

  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    try {
      await fn();
      await refresh();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : okMsg);
    }
  };

  const onApprove = (l: SeedListingRow) =>
    run(() => approveSeedListing(token, adminUserId, l.listing_id), 'Failed to approve');
  const onRevoke = (l: SeedListingRow) =>
    run(() => revokeSeedApproval(token, adminUserId, l.listing_id), 'Failed to revoke');
  const onPaid = (l: SeedListingRow) =>
    run(() => markSeedPaid(token, adminUserId, l.listing_id), 'Failed to mark paid');
  const onExtend = (l: SeedListingRow) =>
    Alert.alert('Extend expiry', `Push "${l.title}" out ${EXTEND_DAYS} days?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Extend',
        onPress: () =>
          void run(
            () => extendListingExpiry(token, adminUserId, l.listing_id, EXTEND_DAYS),
            'Failed to extend'
          ),
      },
    ]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={query.isFetching} onRefresh={() => query.refetch()} />
      }
    >
      <Text style={styles.lead}>
        Founding (seed) sellers and their listings. Approve genuine items for the $1 payout — up to{' '}
        {SEED_PAID_CAP_PER_PERSON} per person. Pay off-app (Venmo/Zelle/cash), then mark paid.
      </Text>

      <AdminErrorBanner
        message={adminQueryErrorMessage(query.isError, query.error, 'Could not load seed sellers')}
        onRetry={() => void query.refetch()}
        loading={query.isFetching}
      />

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Payout summary</Text>
        <Text style={styles.summaryLine}>
          {groups.length} seed seller{groups.length === 1 ? '' : 's'} · {totalApproved} approved ·{' '}
          {totalPaid} paid
        </Text>
        <Text style={styles.summaryOwed}>
          Owed: {formatListingPrice(owedCents / 100)} ({totalApproved - totalPaid} unpaid)
        </Text>
      </View>

      {query.isLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : groups.length === 0 ? (
        <Text style={styles.empty}>
          No founding sellers yet. Tag seed sellers with a founding_seller promo code, then comp
          Premium so their listings get the 2-month window.
        </Text>
      ) : (
        groups.map((group) => <SeedSellerCard key={group.seller_id} group={group} onApprove={onApprove} onRevoke={onRevoke} onPaid={onPaid} onExtend={onExtend} />)
      )}
    </ScrollView>
  );
}

function SeedSellerCard({
  group,
  onApprove,
  onRevoke,
  onPaid,
  onExtend,
}: {
  group: SeedSellerGroup;
  onApprove: (l: SeedListingRow) => void;
  onRevoke: (l: SeedListingRow) => void;
  onPaid: (l: SeedListingRow) => void;
  onExtend: (l: SeedListingRow) => void;
}): React.JSX.Element {
  const styles = useStyles();
  const atCap = group.approved_count >= SEED_PAID_CAP_PER_PERSON;

  return (
    <View style={styles.sellerCard}>
      <View style={styles.sellerHeader}>
        <View style={styles.flex}>
          <Text style={styles.sellerName}>@{group.username}</Text>
          <Text style={styles.sellerMeta}>
            {group.is_premium ? 'Premium' : 'Standard'} · {group.approved_count}/
            {SEED_PAID_CAP_PER_PERSON} approved · {group.paid_count} paid
          </Text>
        </View>
        {atCap ? <Text style={styles.capPill}>At cap</Text> : null}
      </View>

      {group.listings.length === 0 ? (
        <Text style={styles.noListings}>No listings posted yet.</Text>
      ) : (
        group.listings.map((l) => {
          const thumb = listingThumbSource(l.thumb_path);
          return (
            <View key={l.listing_id} style={styles.listingRow}>
              {thumb ? (
                <Image source={thumb} style={styles.thumb} contentFit="cover" />
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]}>
                  <Text style={styles.thumbPlaceholderText}>No photo</Text>
                </View>
              )}
              <View style={styles.flex}>
                <Text style={styles.listingTitle} numberOfLines={1}>
                  {l.title}
                </Text>
                <Text style={styles.listingMeta}>
                  {formatListingPrice(l.price)} · {l.status}
                  {l.approved ? ' · approved' : ''}
                  {l.paid ? ' · paid' : ''}
                </Text>
                <View style={styles.actions}>
                  {!l.approved ? (
                    <Pressable
                      style={[styles.actionBtn, atCap && styles.actionBtnDisabled]}
                      disabled={atCap}
                      onPress={() => onApprove(l)}
                    >
                      <Text style={styles.actionBtnText}>Approve</Text>
                    </Pressable>
                  ) : !l.paid ? (
                    <>
                      <Pressable style={styles.actionBtn} onPress={() => onPaid(l)}>
                        <Text style={styles.actionBtnText}>Mark paid</Text>
                      </Pressable>
                      <Pressable style={styles.actionBtnGhost} onPress={() => onRevoke(l)}>
                        <Text style={styles.actionBtnGhostText}>Revoke</Text>
                      </Pressable>
                    </>
                  ) : (
                    <Text style={styles.paidTag}>Paid ✓</Text>
                  )}
                  <Pressable style={styles.actionBtnGhost} onPress={() => onExtend(l)}>
                    <Text style={styles.actionBtnGhostText}>+{EXTEND_DAYS}d</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  lead: { fontSize: fontSize.body, color: colors.textSecondary, lineHeight: 22 },
  loader: { marginTop: spacing.xl },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.lg, lineHeight: 20 },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  summaryTitle: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  summaryLine: { fontSize: fontSize.body, color: colors.text },
  summaryOwed: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.price },
  sellerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sellerHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  sellerName: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.text },
  sellerMeta: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2 },
  capPill: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.bold,
    color: colors.errorMutedText,
    backgroundColor: colors.errorMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  noListings: { fontSize: fontSize.caption, color: colors.textMuted },
  listingRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.border },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  thumbPlaceholderText: { fontSize: 9, color: colors.textMuted },
  listingTitle: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.text },
  listingMeta: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs, flexWrap: 'wrap' },
  actionBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  actionBtnDisabled: { opacity: 0.4 },
  actionBtnText: { color: colors.onPrimary, fontWeight: fontWeight.semibold, fontSize: fontSize.caption },
  actionBtnGhost: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  actionBtnGhostText: { color: colors.textSecondary, fontWeight: fontWeight.semibold, fontSize: fontSize.caption },
  paidTag: { color: colors.price, fontWeight: fontWeight.bold, fontSize: fontSize.caption },
}));
