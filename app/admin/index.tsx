import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { canAccessAdminRoute, type AdminHubRoute } from '@/lib/admin-access';
import { AdminErrorBanner } from '@/components/admin/AdminErrorBanner';
import { adminQueryErrorMessage, fetchAdminQueueCounts } from '@/features/admin/admin-service';
import { queryKeys } from '@/lib/query-keys';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

type HubRoute = AdminHubRoute;

type HubItem = {
  title: string;
  description: string;
  route: HubRoute;
  countKey?: 'openReports' | 'pendingStrikes';
};

const SECTIONS: { label: string; items: HubItem[] }[] = [
  {
    label: 'Moderation',
    items: [
      {
        title: 'Paused listings & reports',
        description: 'Review paused listings, open reports, warn, ban, or delete.',
        route: '/admin/moderation',
        countKey: 'openReports',
      },
      {
        title: 'Strike confirmation queue',
        description: 'Confirm link-health strikes after grace periods expire.',
        route: '/admin/strikes',
        countKey: 'pendingStrikes',
      },
      {
        title: 'Warned users',
        description: 'Users with admin warnings — see count and last note.',
        route: '/admin/warned-users',
      },
      {
        title: 'Banned users',
        description: 'Currently banned accounts — unban to restore access.',
        route: '/admin/banned-users',
      },
      {
        title: 'Banned keywords',
        description: 'Enable or disable listing keyword filters; add new blocked terms.',
        route: '/admin/banned-keywords',
      },
      {
        title: 'Bulletin board',
        description: 'Hide abusive profile bulletin posts.',
        route: '/admin/bulletin',
      },
      {
        title: 'Support subscriptions',
        description: 'Review model-support subscriptions and work quotes; force-cancel abuse.',
        route: '/admin/support',
      },
      {
        title: 'SLA & audit log',
        description: '24h report SLA metrics and moderation action history.',
        route: '/admin/sla',
      },
    ],
  },
  {
    label: 'Users',
    items: [
      {
        title: 'All users & emails',
        description: 'Searchable list of every account email address.',
        route: '/admin/users',
      },
    ],
  },
  {
    label: 'Commerce & settings',
    items: [
      {
        title: 'Promo codes',
        description: 'Create and deactivate promo codes.',
        route: '/admin/promo-codes',
      },
      {
        title: 'Platform settings',
        description: 'Featured placement, fee tiers, and moderation thresholds.',
        route: '/admin/settings',
      },
      {
        title: 'Bulk email',
        description: 'Email registered users in bulk.',
        route: '/admin/bulk-email',
      },
    ],
  },
  {
    label: 'Store settings',
    items: [
      {
        title: 'Branding',
        description: 'Logo, app name, support email, and brand colors.',
        route: '/admin/branding',
      },
      {
        title: 'Categories',
        description: 'Add, remove, reorder, and re-icon listing categories.',
        route: '/admin/categories',
      },
      {
        title: 'Email templates',
        description: 'Edit the subject/body of transactional emails.',
        route: '/admin/email-templates',
      },
      {
        title: 'Setup status',
        description: 'Checklist of required accounts/keys — configured or missing.',
        route: '/admin/setup-status',
      },
      {
        title: 'Admin security',
        description: 'Two-factor authentication for staff accounts.',
        route: '/admin/security',
      },
    ],
  },
];

function useQueueCountMap(counts: {
  pausedListings: number;
  openReports: number;
  overdueReports: number;
  pendingStrikes: number;
} | undefined) {
  return {
    pausedListings: counts?.pausedListings ?? 0,
    openReports: counts?.openReports ?? 0,
    pendingStrikes: counts?.pendingStrikes ?? 0,
  };
}

export default function AdminHomeScreen(): React.JSX.Element {
  const styles = useStyles();
  const router = useRouter();
  const { session } = useAuth();
  const { data: profile } = useProfile();
  const token = session?.access_token ?? '';

  const countsQuery = useQuery({
    queryKey: queryKeys.adminQueueCounts,
    enabled: !!token,
    queryFn: () => fetchAdminQueueCounts(token),
    refetchInterval: 60_000,
  });

  const countMap = useQueueCountMap(countsQuery.data);
  const counts = countsQuery.data;

  const badgeFor = (item: HubItem): number | null => {
    if (!counts) return null;
    if (item.route === '/admin/moderation') {
      const total = counts.openReports + counts.pausedListings;
      return total > 0 ? total : null;
    }
    if (!item.countKey) return null;
    const value = countMap[item.countKey];
    return value > 0 ? value : null;
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.lead}>
        {profile?.role === 'manager'
          ? 'Moderation tools for reports, strikes, and users.'
          : 'Choose a section below.'}
      </Text>

      <AdminErrorBanner
        message={adminQueryErrorMessage(
          countsQuery.isError,
          countsQuery.error,
          'Could not load queue summary'
        )}
        onRetry={() => void countsQuery.refetch()}
        loading={countsQuery.isFetching}
      />

      {counts ? (
        <View style={styles.slaCard}>
          <Text style={styles.slaTitle}>Queue summary</Text>
          <Text style={styles.slaLine}>
            {counts.openReports} open report{counts.openReports === 1 ? '' : 's'}
            {counts.overdueReports > 0
              ? ` · ${counts.overdueReports} overdue (>24h)`
              : ''}
          </Text>
          <Text style={styles.slaLine}>
            {counts.pausedListings} paused listing{counts.pausedListings === 1 ? '' : 's'}
          </Text>
          <Text style={styles.slaLine}>
            {counts.pendingStrikes} strike{counts.pendingStrikes === 1 ? '' : 's'} ready to confirm
          </Text>
        </View>
      ) : null}

      {SECTIONS.map((section) => {
        const items = section.items.filter((item) =>
          canAccessAdminRoute(profile?.role, item.route)
        );
        if (items.length === 0) return null;
        return (
        <View key={section.label} style={styles.section}>
          <Text style={styles.sectionLabel}>{section.label}</Text>
          {items.map((item) => {
            const badge = badgeFor(item);
            const isUsernameOnlyUsers =
              item.route === '/admin/users' && profile?.role === 'manager';
            const title = isUsernameOnlyUsers ? 'All usernames' : item.title;
            const description = isUsernameOnlyUsers
              ? 'Searchable list of usernames for warn, ban, or shadow ban.'
              : item.description;
            return (
              <Pressable
                key={item.route}
                style={styles.card}
                onPress={() => router.push(item.route)}
                accessibilityRole="button"
              >
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>{title}</Text>
                  {badge != null ? (
                    <View style={styles.countBadge}>
                      <Text style={styles.countBadgeText}>{badge}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.cardDesc}>{description}</Text>
              </Pressable>
            );
          })}
        </View>
        );
      })}
    </ScrollView>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xl },
  lead: { fontSize: fontSize.body, color: colors.textSecondary, lineHeight: 22 },
  slaCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  slaTitle: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  slaLine: { fontSize: fontSize.body, color: colors.text, lineHeight: 22 },
  section: { gap: spacing.sm },
  sectionLabel: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { flex: 1, fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.primary },
  cardDesc: { fontSize: fontSize.caption, color: colors.textSecondary, lineHeight: 20 },
  countBadge: {
    backgroundColor: colors.errorMuted,
    minWidth: 24,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    alignItems: 'center',
  },
  countBadgeText: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.bold,
    color: colors.errorMutedText,
  },
}));
