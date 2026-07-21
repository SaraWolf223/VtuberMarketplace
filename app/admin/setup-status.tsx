import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/lib/query-keys';
import {
  fetchSetupStatus,
  type SetupCheckItem,
  type SetupCheckStatus,
} from '@/features/setup-status/setup-status-service';
import { AdminErrorBanner } from '@/components/admin/AdminErrorBanner';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

function statusDotColor(status: SetupCheckStatus, colors: ReturnType<typeof useThemeColors>): string {
  if (status === 'ok') return colors.success;
  if (status === 'warning') return colors.warning;
  return colors.error;
}

function statusLabel(status: SetupCheckStatus): string {
  if (status === 'ok') return 'Configured';
  if (status === 'warning') return 'Placeholder';
  return 'Missing';
}

function CheckRow({ item }: { item: SetupCheckItem }): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: statusDotColor(item.status, colors) }]} />
      <View style={styles.rowBody}>
        <View style={styles.rowHeader}>
          <Text style={styles.rowLabel}>{item.label}</Text>
          <Text style={[styles.rowStatus, { color: statusDotColor(item.status, colors) }]}>
            {statusLabel(item.status)}
          </Text>
        </View>
        <Text style={styles.rowNote}>{item.note}</Text>
        <Text style={styles.rowDoc}>{item.docHint}</Text>
      </View>
    </View>
  );
}

export default function AdminSetupStatusScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const { session, isLoading: authLoading } = useAuth();
  const token = session?.access_token ?? '';

  const query = useQuery({
    queryKey: queryKeys.setupStatus,
    enabled: !!token,
    queryFn: () => fetchSetupStatus(token),
    staleTime: 30_000,
  });

  if (authLoading || (query.isLoading && !query.data)) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const sections = query.data ?? [];
  const allItems = sections.flatMap((s) => s.items);
  const missingCount = allItems.filter((i) => i.status !== 'ok').length;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.lead}>
        A live checklist of every account/key this deployment needs. Nothing here can leak a secret
        value — server-only items only report whether they&apos;re set and look correctly formatted.
      </Text>

      <AdminErrorBanner
        message={query.isError ? (query.error instanceof Error ? query.error.message : 'Could not load setup status') : null}
        onRetry={() => void query.refetch()}
        loading={query.isFetching}
      />

      {sections.length > 0 ? (
        <View style={[styles.summary, missingCount === 0 && styles.summaryOk]}>
          <Text style={styles.summaryText}>
            {missingCount === 0
              ? 'Everything is configured.'
              : `${missingCount} item${missingCount === 1 ? '' : 's'} still need${missingCount === 1 ? 's' : ''} attention.`}
          </Text>
        </View>
      ) : null}

      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.card}>
            {section.items.map((item, idx) => (
              <View key={item.key}>
                <CheckRow item={item} />
                {idx < section.items.length - 1 ? <View style={styles.divider} /> : null}
              </View>
            ))}
          </View>
        </View>
      ))}

      <View style={styles.hintCard}>
        <Text style={styles.hintTitle}>How to fix a missing item</Text>
        <Text style={styles.hintBody}>
          Run <Text style={styles.mono}>npm run setup</Text> from the project root to fill in
          client + local values, or add server-only secrets directly as Supabase Edge Function
          secrets (Project Settings → Edge Functions → Secrets, or{' '}
          <Text style={styles.mono}>npx supabase secrets set KEY=value</Text>). See
          docs/00-Developer_Setup.md for where to obtain each key.
        </Text>
      </View>

      <Pressable style={styles.refreshBtn} onPress={() => void query.refetch()} disabled={query.isFetching}>
        {query.isFetching ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.refreshBtnText}>Refresh</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  lead: { fontSize: fontSize.body, color: colors.textSecondary, lineHeight: 21 },
  summary: {
    backgroundColor: colors.errorMuted,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  summaryOk: { backgroundColor: colors.successMuted },
  summaryText: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.text },
  section: { gap: spacing.xs },
  sectionTitle: {
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
  },
  row: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  rowBody: { flex: 1, gap: 2 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  rowLabel: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.text, flex: 1 },
  rowStatus: { fontSize: fontSize.caption, fontWeight: fontWeight.bold },
  rowNote: { fontSize: fontSize.caption, color: colors.textSecondary, lineHeight: 18 },
  rowDoc: { fontSize: fontSize.caption, color: colors.textMuted },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: spacing.md + 10 + spacing.sm },
  hintCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  hintTitle: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.text },
  hintBody: { fontSize: fontSize.caption, color: colors.textSecondary, lineHeight: 19 },
  mono: { fontFamily: 'monospace', color: colors.text },
  refreshBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  refreshBtnText: { color: colors.primary, fontWeight: fontWeight.semibold },
}));
