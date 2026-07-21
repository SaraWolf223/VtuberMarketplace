import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { isAdminRole } from '@/lib/admin-access';
import { AdminErrorBanner } from '@/components/admin/AdminErrorBanner';
import {
  adminQueryErrorMessage,
  fetchModerationActionLogPage,
  fetchModerationSlaMetrics,
} from '@/features/admin/admin-service';
import type { AdminModerationLogEntry } from '@/features/admin/admin-types';
import { queryKeys } from '@/lib/query-keys';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

function formatAction(action: string): string {
  return action.replace(/_/g, ' ');
}

function LogRow({ entry }: { entry: AdminModerationLogEntry }): React.JSX.Element {
  const styles = useStyles();
  return (
    <View style={styles.logCard}>
      <Text style={styles.logAction}>{formatAction(entry.action)}</Text>
      <Text style={styles.logMeta}>
        {new Date(entry.created_at).toLocaleString()}
        {entry.admin?.display_name ? ` · ${entry.admin.display_name}` : ''}
      </Text>
      {entry.notes ? <Text style={styles.logNotes}>{entry.notes}</Text> : null}
      {entry.target_user_id ? (
        <Text style={styles.logMeta}>User: {entry.target_user_id.slice(0, 8)}…</Text>
      ) : null}
      {entry.listing_id ? (
        <Text style={styles.logMeta}>Listing: {entry.listing_id.slice(0, 8)}…</Text>
      ) : null}
    </View>
  );
}

export default function AdminSlaScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const { data: profile } = useProfile();
  const { session } = useAuth();
  const token = session?.access_token ?? '';

  const metricsQuery = useQuery({
    queryKey: queryKeys.adminSlaMetrics,
    enabled: !!token && isAdminRole(profile?.role),
    queryFn: () => fetchModerationSlaMetrics(token),
    refetchInterval: 60_000,
  });

  const logQuery = useInfiniteQuery({
    queryKey: queryKeys.adminModerationLog,
    enabled: !!token && isAdminRole(profile?.role),
    queryFn: ({ pageParam }) => fetchModerationActionLogPage(token, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
  });

  const logEntries = logQuery.data?.pages.flatMap((p) => p.items) ?? [];
  const metrics = metricsQuery.data;

  const medianLabel =
    metrics?.medianResponseHours != null
      ? metrics.medianResponseHours < 1
        ? `${Math.round(metrics.medianResponseHours * 60)} min`
        : `${metrics.medianResponseHours.toFixed(1)} h`
      : '—';

  if (profile && !isAdminRole(profile.role)) {
    return <Redirect href="/admin" />;
  }

  return (
    <View style={styles.root}>
      <FlatList
        data={logEntries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={metricsQuery.isFetching || logQuery.isFetching}
            onRefresh={() => {
              void metricsQuery.refetch();
              void logQuery.refetch();
            }}
          />
        }
        ListHeaderComponent={
          <>
            <Text style={styles.intro}>
              SLA target: review open reports within 24 hours. Median uses the last 200 reviewed
              reports.
            </Text>

            {metricsQuery.isLoading ? (
              <ActivityIndicator color={colors.primary} style={styles.loader} />
            ) : null}

            <AdminErrorBanner
              message={adminQueryErrorMessage(
                metricsQuery.isError,
                metricsQuery.error,
                'Could not load SLA metrics'
              )}
              onRetry={() => void metricsQuery.refetch()}
              loading={metricsQuery.isFetching}
            />

            {metrics ? (
              <View style={styles.metricsCard}>
                <Text style={styles.metricsTitle}>Queue health</Text>
                <Text style={styles.metricsLine}>
                  {metrics.openReports} open · {metrics.overdueReports} overdue (&gt;24h)
                </Text>
                <Text style={styles.metricsLine}>Median response time: {medianLabel}</Text>
                <Text style={styles.metricsLine}>
                  {metrics.actionsLast7Days} admin actions (7 days) · {metrics.reviewedLast30Days}{' '}
                  reviewed in sample
                </Text>
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>Moderation audit log</Text>

            <AdminErrorBanner
              message={adminQueryErrorMessage(
                logQuery.isError,
                logQuery.error,
                'Could not load audit log'
              )}
              onRetry={() => void logQuery.refetch()}
              loading={logQuery.isFetching}
            />
          </>
        }
        renderItem={({ item }) => <LogRow entry={item} />}
        ListEmptyComponent={
          logQuery.isLoading ? null : (
            <Text style={styles.empty}>No moderation actions logged yet.</Text>
          )
        }
        ListFooterComponent={
          logQuery.hasNextPage ? (
            <Pressable
              style={styles.loadMore}
              onPress={() => void logQuery.fetchNextPage()}
              disabled={logQuery.isFetchingNextPage}
            >
              {logQuery.isFetchingNextPage ? (
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

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    list: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm },
    intro: { fontSize: fontSize.body, color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.md },
    loader: { marginVertical: spacing.md },
    metricsCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      gap: spacing.xs,
      marginBottom: spacing.lg,
    },
    metricsTitle: {
      fontSize: fontSize.caption,
      fontWeight: fontWeight.bold,
      color: colors.textMuted,
      textTransform: 'uppercase',
    },
    metricsLine: { fontSize: fontSize.body, color: colors.text },
    sectionTitle: {
      fontSize: fontSize.caption,
      fontWeight: fontWeight.bold,
      color: colors.textMuted,
      textTransform: 'uppercase',
      marginBottom: spacing.sm,
    },
    logCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    logAction: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.text },
    logMeta: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2 },
    logNotes: { fontSize: fontSize.body, color: colors.text, marginTop: spacing.xs },
    empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.lg },
    loadMore: {
      alignItems: 'center',
      padding: spacing.md,
      marginTop: spacing.sm,
    },
    loadMoreText: { color: colors.primary, fontWeight: fontWeight.semibold },
    footerSpacer: { height: spacing.lg },
  })
);
