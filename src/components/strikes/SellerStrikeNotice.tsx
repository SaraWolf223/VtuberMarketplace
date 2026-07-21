import { useQuery } from '@tanstack/react-query';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import {
  fetchOwnOpenLinkHealthIssues,
  fetchOwnStrikes,
  fetchSellerDashboardSummary,
  strikeSourceLabel,
} from '@/features/strikes/strike-service';
import { queryKeys } from '@/lib/query-keys';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

export function SellerStrikeNotice(): React.JSX.Element | null {
  const styles = useStyles();
  const router = useRouter();
  const { session, user } = useAuth();
  const token = session?.access_token ?? '';
  const userId = user?.id ?? '';

  const summaryQuery = useQuery({
    queryKey: queryKeys.sellerDashboard(userId),
    enabled: !!token && !!userId,
    queryFn: () => fetchSellerDashboardSummary(token),
    staleTime: 30_000,
  });

  const strikesQuery = useQuery({
    queryKey: queryKeys.sellerStrikes(userId),
    enabled: !!token && !!userId,
    queryFn: () => fetchOwnStrikes(token, userId),
    staleTime: 30_000,
  });

  const issuesQuery = useQuery({
    queryKey: queryKeys.sellerLinkHealth(userId),
    enabled: !!token && !!userId,
    queryFn: () => fetchOwnOpenLinkHealthIssues(token),
    staleTime: 30_000,
  });

  const activeCount = summaryQuery.data?.active_strike_count ?? strikesQuery.data?.length ?? 0;
  const openIssues = issuesQuery.data ?? [];
  const graceIssues = openIssues.filter((issue) => {
    if (!issue.grace_period_ends_at) return true;
    return new Date(issue.grace_period_ends_at).getTime() > Date.now();
  });

  if (activeCount === 0 && graceIssues.length === 0) {
    return null;
  }

  const latestStrike = strikesQuery.data?.[0];

  return (
    <View style={styles.banner}>
      {graceIssues.length > 0 ? (
        <>
          <Text style={styles.title}>Download link needs attention</Text>
          <Text style={styles.body}>
            {graceIssues.length === 1
              ? 'A listing or order download link failed health checks. Fix the URL before the grace period ends to avoid a strike.'
              : `${graceIssues.length} download links need attention. Fix them before grace periods end to avoid strikes.`}
          </Text>
        </>
      ) : null}
      {activeCount > 0 ? (
        <>
          <Text style={styles.title}>
            {activeCount} active strike{activeCount === 1 ? '' : 's'}
          </Text>
          {latestStrike ? (
            <Text style={styles.body}>
              Latest: {latestStrike.reason} ({strikeSourceLabel(latestStrike.source)}). Three
              strikes in 12 months triggers an automatic ban.
            </Text>
          ) : (
            <Text style={styles.body}>
              Fix broken download links promptly. Three strikes in 12 months triggers an automatic
              ban.
            </Text>
          )}
        </>
      ) : null}
      <Pressable onPress={() => router.push('/settings/safety')}>
        <Text style={styles.link}>Learn about the strike system →</Text>
      </Pressable>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  banner: {
    backgroundColor: colors.warningMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  title: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  body: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  link: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
    marginTop: spacing.xs,
  },
}));
