import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { AdminErrorBanner } from '@/components/admin/AdminErrorBanner';
import {
  adminQueryErrorMessage,
  callAdminAction,
  fetchAdminStrikeQueue,
  invalidateAdminModerationQueries,
} from '@/features/admin/admin-service';
import type { AdminStrikeQueueItem } from '@/features/strikes/strike-service';
import { queryKeys } from '@/lib/query-keys';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

function graceLabel(endsAt: string | null): { text: string; ready: boolean } {
  if (!endsAt) {
    return { text: 'Grace period elapsed — ready to confirm', ready: true };
  }
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) {
    return { text: 'Grace period elapsed — ready to confirm', ready: true };
  }
  const hours = Math.ceil(ms / 3_600_000);
  return { text: `Grace ends in ~${hours}h`, ready: false };
}

export default function AdminStrikesScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const router = useRouter();
  const { session, user } = useAuth();
  const token = session?.access_token ?? '';
  const adminUserId = user?.id ?? '';
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const queueQuery = useQuery({
    queryKey: queryKeys.adminStrikeQueue,
    enabled: !!token,
    queryFn: () => fetchAdminStrikeQueue(token),
    refetchInterval: 60_000,
  });

  const refresh = useCallback(async () => {
    invalidateAdminModerationQueries(queryClient);
    await queueQuery.refetch();
  }, [queryClient, queueQuery]);

  const confirmStrike = (item: AdminStrikeQueueItem) => {
    const listing = item.listings;
    const sellerId = listing?.seller_id;
    if (!sellerId) {
      Alert.alert('Missing seller', 'Could not resolve the seller for this link-health issue.');
      return;
    }

    const grace = graceLabel(item.grace_period_ends_at);
    if (!grace.ready) {
      Alert.alert('Grace period active', grace.text);
      return;
    }

    Alert.alert(
      'Confirm strike?',
      `Issue a link-health strike for @${listing?.profiles?.username ?? 'seller'}? This counts toward the 12-month ban threshold.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm strike',
          style: 'destructive',
          onPress: async () => {
            setBusyId(item.id);
            try {
              await callAdminAction(token, adminUserId, {
                action: 'confirm_seller_strike',
                seller_id: sellerId,
                listing_id: item.listing_id,
                link_health_check_id: item.id,
                reason: `Broken download link (${item.consecutive_failures} failed checks)`,
                source: item.order_id ? 'buyer_report' : 'automated_check',
              });
              Alert.alert('Strike confirmed', 'Seller was notified and the issue was closed.');
              await refresh();
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Could not confirm strike');
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  };

  const loadError = adminQueryErrorMessage(
    queueQuery.isError,
    queueQuery.error,
    'Could not load strike queue'
  );

  return (
    <View style={styles.root}>
      <AdminErrorBanner
        message={loadError}
        onRetry={() => void refresh()}
        loading={queueQuery.isFetching}
      />

      <Text style={styles.lead}>
        Open link-health issues awaiting strike confirmation after the grace period. Confirming
        writes a row to seller_strikes and may auto-ban at three active strikes.
      </Text>

      {queueQuery.isPending ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={queueQuery.data ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={queueQuery.isRefetching} onRefresh={() => void refresh()} />
          }
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>No open link-health issues in the queue.</Text>
          }
          renderItem={({ item }) => {
            const listing = item.listings;
            const grace = graceLabel(item.grace_period_ends_at);
            return (
              <View style={styles.card}>
                <Text style={styles.title}>
                  {listing?.title ?? 'Order deliverable link'}
                </Text>
                <Text style={styles.meta}>
                  @{listing?.profiles?.username ?? 'unknown'} · {grace.text}
                </Text>
                <Text style={styles.url} numberOfLines={2}>
                  {item.url}
                </Text>
                <Text style={styles.meta}>
                  {item.consecutive_failures} consecutive failure
                  {item.consecutive_failures === 1 ? '' : 's'}
                </Text>
                <View style={styles.actions}>
                  {listing?.id ? (
                    <Pressable
                      style={styles.secondaryBtn}
                      onPress={() => router.push(`/listing/${listing.id}`)}
                    >
                      <Text style={styles.secondaryBtnText}>Open listing</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    style={[styles.primaryBtn, !grace.ready && styles.btnDisabled]}
                    disabled={busyId === item.id || !grace.ready}
                    onPress={() => confirmStrike(item)}
                  >
                    {busyId === item.id ? (
                      <ActivityIndicator color={colors.onPrimary} size="small" />
                    ) : (
                      <Text style={styles.primaryBtnText}>Confirm strike</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  lead: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
    lineHeight: 22,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  loader: { marginTop: spacing.xl },
  list: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl, flexGrow: 1 },
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    padding: spacing.xl,
    fontSize: fontSize.body,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  title: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.text },
  meta: { fontSize: fontSize.caption, color: colors.textSecondary },
  url: { fontSize: fontSize.caption, color: colors.textMuted, fontFamily: 'monospace' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.error,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  primaryBtnText: { color: colors.onPrimary, fontWeight: fontWeight.bold, fontSize: fontSize.caption },
  secondaryBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  secondaryBtnText: { color: colors.primary, fontWeight: fontWeight.semibold, fontSize: fontSize.caption },
  btnDisabled: { opacity: 0.5 },
}));
