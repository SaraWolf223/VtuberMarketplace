import { useCallback, useState } from 'react';
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
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { AdminReportCard } from '@/components/admin/AdminReportCard';
import { AdminErrorBanner } from '@/components/admin/AdminErrorBanner';
import {
  adminListingThumb,
  adminQueryErrorMessage,
  callAdminAction,
  fetchOpenReportsPage,
  fetchPausedListingsPage,
  invalidateAdminModerationQueries,
  notifyModerationAction,
} from '@/features/admin/admin-service';
import type { AdminPausedListing, AdminQueueTab, AdminReport } from '@/features/admin/admin-types';
import { queryKeys } from '@/lib/query-keys';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

const TABS: { id: AdminQueueTab; label: string }[] = [
  { id: 'paused', label: 'Paused listings' },
  { id: 'reports', label: 'Open reports' },
];

export default function AdminModerationScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const router = useRouter();
  const { session, user } = useAuth();
  const token = session?.access_token ?? '';
  const adminUserId = user?.id ?? '';
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<AdminQueueTab>('paused');
  const [busyId, setBusyId] = useState<string | null>(null);

  const pausedQuery = useInfiniteQuery({
    queryKey: queryKeys.adminPausedListings,
    enabled: !!token,
    queryFn: ({ pageParam }) => fetchPausedListingsPage(token, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
  });

  const reportsQuery = useInfiniteQuery({
    queryKey: queryKeys.adminOpenReports,
    enabled: !!token && !!adminUserId,
    queryFn: ({ pageParam }) => fetchOpenReportsPage(token, adminUserId, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
  });

  const pausedListings = pausedQuery.data?.pages.flatMap((p) => p.items) ?? [];
  const openReports = reportsQuery.data?.pages.flatMap((p) => p.items) ?? [];

  const refreshAll = useCallback(async () => {
    invalidateAdminModerationQueries(queryClient);
  }, [queryClient]);

  const runAction = async (label: string, fn: () => Promise<void>) => {
    try {
      await fn();
      Alert.alert('Done', label);
      await refreshAll();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  const notifyBestEffort = async (params: {
    userId: string;
    action: 'warn_user' | 'ban_user' | 'delete_listing';
    listingId?: string | null;
    listingTitle?: string | null;
  }) => {
    try {
      await notifyModerationAction(token, params);
    } catch {
      /* notification delivery is non-critical */
    }
  };

  const activeQuery = tab === 'paused' ? pausedQuery : reportsQuery;
  const loadError = adminQueryErrorMessage(
    activeQuery.isError,
    activeQuery.error,
    tab === 'paused' ? 'Could not load paused listings' : 'Could not load reports'
  );

  const listData: ({ kind: 'paused'; item: AdminPausedListing } | { kind: 'report'; item: AdminReport })[] =
    tab === 'paused'
      ? pausedListings.map((item) => ({ kind: 'paused' as const, item }))
      : openReports.map((item) => ({ kind: 'report' as const, item }));

  const renderPausedCard = (listing: AdminPausedListing) => {
    const thumb = adminListingThumb(listing);
    return (
      <View style={styles.card}>
                  <Pressable
                    style={styles.row}
                    onPress={() => router.push(`/listing/${listing.id}`)}
                  >
                    {thumb ? (
                      <Image source={{ uri: thumb }} style={styles.thumb} contentFit="cover" />
                    ) : (
                      <View style={[styles.thumb, styles.thumbEmpty]} />
                    )}
                    <View style={styles.flex}>
                      <Text style={styles.title}>{listing.title}</Text>
                      <Text style={styles.meta}>
                        ${listing.price.toFixed(2)} · @
                        {listing.profiles?.username ?? listing.seller_id.slice(0, 8)}
                      </Text>
                      <Text style={styles.linkHint}>Tap to open listing</Text>
                    </View>
                  </Pressable>
                  <Pressable onPress={() => router.push(`/profile/${listing.seller_id}`)}>
                    <Text style={styles.linkHint}>Open seller profile</Text>
                  </Pressable>
                  <View style={styles.actions}>
                    <Pressable
                      style={styles.primaryBtn}
                      disabled={busyId === listing.id}
                      onPress={() => {
                        setBusyId(listing.id);
                        void runAction('Listing unpaused', () =>
                          callAdminAction(token, adminUserId, {
                            action: 'unpause_listing',
                            listing_id: listing.id,
                          }).then(() => undefined)
                        );
                      }}
                    >
                      <Text style={styles.primaryBtnText}>Unpause</Text>
                    </Pressable>
                    <Pressable
                      style={styles.dangerBtn}
                      disabled={busyId === listing.id}
                      onPress={() => {
                        Alert.alert('Delete listing', 'Permanently delete this listing?', [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: () => {
                              setBusyId(listing.id);
                              void runAction('Listing deleted', async () => {
                                await callAdminAction(token, adminUserId, {
                                  action: 'delete_listing',
                                  listing_id: listing.id,
                                });
                                await notifyBestEffort({
                                  userId: listing.seller_id,
                                  action: 'delete_listing',
                                  listingId: listing.id,
                                  listingTitle: listing.title,
                                });
                              });
                            },
                          },
                        ]);
                      }}
                    >
                      <Text style={styles.dangerBtnText}>Delete</Text>
                    </Pressable>
                  </View>
                  <View style={styles.moderationRow}>
                    <Pressable
                      style={styles.secondaryBtn}
                      disabled={busyId === listing.id}
                      onPress={() => {
                        Alert.alert(
                          'Warn seller',
                          `Log a warning for @${listing.profiles?.username ?? 'this seller'}?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Warn',
                              onPress: () => {
                                setBusyId(listing.id);
                                void runAction('Warning logged', async () => {
                                  await callAdminAction(token, adminUserId, {
                                    action: 'warn_user',
                                    user_id: listing.seller_id,
                                  });
                                  await notifyBestEffort({
                                    userId: listing.seller_id,
                                    action: 'warn_user',
                                  });
                                });
                              },
                            },
                          ]
                        );
                      }}
                    >
                      <Text style={styles.secondaryBtnText}>Warn seller</Text>
                    </Pressable>
                    <Pressable
                      style={styles.dangerBtn}
                      disabled={busyId === listing.id}
                      onPress={() => {
                        Alert.alert(
                          'Ban seller',
                          `Ban @${listing.profiles?.username ?? 'this seller'}?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Ban',
                              style: 'destructive',
                              onPress: () => {
                                setBusyId(listing.id);
                                void runAction('User banned', async () => {
                                  await callAdminAction(token, adminUserId, {
                                    action: 'ban_user',
                                    user_id: listing.seller_id,
                                  });
                                  await notifyBestEffort({
                                    userId: listing.seller_id,
                                    action: 'ban_user',
                                  });
                                });
                              },
                            },
                          ]
                        );
                      }}
                    >
                      <Text style={styles.dangerBtnText}>Ban seller</Text>
                    </Pressable>
                  </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.tabs}>
        {TABS.map((item) => (
          <Pressable
            key={item.id}
            style={[styles.tab, tab === item.id && styles.tabActive]}
            onPress={() => setTab(item.id)}
          >
            <Text style={[styles.tabText, tab === item.id && styles.tabTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={listData}
        keyExtractor={(row) =>
          row.kind === 'paused' ? `paused-${row.item.id}` : `report-${row.item.id}`
        }
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={activeQuery.isFetching} onRefresh={() => void refreshAll()} />
        }
        ListHeaderComponent={
          <>
            {activeQuery.isLoading ? (
              <ActivityIndicator color={colors.primary} style={styles.loader} />
            ) : null}
            <AdminErrorBanner
              message={loadError}
              onRetry={() => void activeQuery.refetch()}
              loading={activeQuery.isFetching}
            />
          </>
        }
        renderItem={({ item: row }) =>
          row.kind === 'paused' ? (
            renderPausedCard(row.item)
          ) : (
            <AdminReportCard
              report={row.item}
              accessToken={token}
              adminUserId={adminUserId}
              busy={busyId === row.item.id}
              onBusyChange={(busy) => setBusyId(busy ? row.item.id : null)}
              onComplete={async (message) => {
                Alert.alert('Done', message);
                setBusyId(null);
                await refreshAll();
              }}
            />
          )
        }
        ListEmptyComponent={
          activeQuery.isLoading ? null : (
            <Text style={styles.empty}>
              {tab === 'paused' ? 'No paused listings.' : 'No open reports.'}
            </Text>
          )
        }
        ListFooterComponent={
          activeQuery.hasNextPage ? (
            <Pressable
              style={styles.loadMore}
              onPress={() => void activeQuery.fetchNextPage()}
              disabled={activeQuery.isFetchingNextPage}
            >
              {activeQuery.isFetchingNextPage ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.loadMoreText}>Load more</Text>
              )}
            </Pressable>
          ) : (
            <View style={styles.footerSpacer} />
          )
        }
      />
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  tab: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText: { fontSize: fontSize.caption, color: colors.textSecondary },
  tabTextActive: { color: colors.primary, fontWeight: fontWeight.bold },
  list: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  loader: { marginTop: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  thumb: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.border },
  thumbEmpty: { opacity: 0.4 },
  title: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.text },
  meta: { fontSize: fontSize.caption, color: colors.textSecondary },
  linkHint: { fontSize: fontSize.caption, color: colors.primary },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.xl },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  moderationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.warning,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  secondaryBtnText: { color: colors.warning, fontWeight: fontWeight.semibold },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  primaryBtnText: { color: colors.onPrimary, fontWeight: fontWeight.semibold },
  dangerBtn: {
    backgroundColor: colors.errorMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  dangerBtnText: { color: colors.error, fontWeight: fontWeight.semibold },
  loadMore: { alignItems: 'center', padding: spacing.md },
  loadMoreText: { color: colors.primary, fontWeight: fontWeight.semibold },
  footerSpacer: { height: spacing.lg },
}));
