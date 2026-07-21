import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Pressable,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { fetchAdminCollegeStudents, adminQueryErrorMessage, logAdminAudit } from '@/features/admin/admin-service';
import { AdminErrorBanner } from '@/components/admin/AdminErrorBanner';
import { queryKeys } from '@/lib/query-keys';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

export default function AdminCollegeStudentsScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const router = useRouter();
  const { session, user } = useAuth();
  const token = session?.access_token ?? '';
  const adminUserId = user?.id ?? '';
  const [search, setSearch] = useState('');

  const query = useQuery({
    queryKey: queryKeys.adminCollegeStudents,
    enabled: !!token,
    queryFn: () => fetchAdminCollegeStudents(token),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = query.data ?? [];
    if (!q) return rows;

    return rows.filter(
      (r) =>
        r.college_edu_email.toLowerCase().includes(q) ||
        (r.email?.toLowerCase().includes(q) ?? false) ||
        r.username.toLowerCase().includes(q) ||
        r.display_name.toLowerCase().includes(q) ||
        (r.phone?.toLowerCase().includes(q) ?? false)
    );
  }, [search, query.data]);

  const exportCollegeEmails = async () => {
    const lines = filtered.map(
      (r) =>
        `${r.college_edu_email}\t${r.display_name}\t@${r.username}\t${r.email ?? ''}\tverified`
    );
    const header = 'college_email\tdisplay_name\tusername\taccount_email\tstatus';
    await Share.share({
      message: [header, ...lines].join('\n'),
      title: 'College student emails',
    });
    if (adminUserId) {
      await logAdminAudit(
        token,
        adminUserId,
        'export_college_emails',
        `${filtered.length} row(s) shared`
      ).catch(() => {});
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.lead}>
        Users with an active, verified .edu email badge. Expired or lapsed verifications are
        removed automatically after a 10-day re-verify window.
      </Text>

      <TextInput
        style={styles.search}
        placeholder="Search .edu email, name, username, account email, phone"
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <View style={styles.toolbar}>
        <Text style={styles.count}>
          {filtered.length} active student{filtered.length === 1 ? '' : 's'}
        </Text>
        <Pressable style={styles.exportBtn} onPress={() => void exportCollegeEmails()}>
          <Text style={styles.exportBtnText}>Share list</Text>
        </Pressable>
      </View>

      <View style={styles.errorWrap}>
        <AdminErrorBanner
          message={adminQueryErrorMessage(
            query.isError,
            query.error,
            'Could not load college students'
          )}
          onRetry={() => void query.refetch()}
          loading={query.isFetching}
        />
      </View>

      {query.isLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          style={styles.list}
          data={filtered}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={query.isFetching} onRefresh={() => query.refetch()} />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>No active college verifications match your search.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.eduEmail} selectable>
                  {item.college_edu_email}
                </Text>
                <View style={[styles.badgePill, styles.badgePillActive]}>
                  <Text style={[styles.badgePillText, styles.badgePillTextActive]}>Verified</Text>
                </View>
              </View>

              <Text style={styles.name}>{item.display_name}</Text>
              <Text style={styles.meta}>@{item.username}</Text>
              {item.email ? (
                <Text style={styles.meta} selectable>
                  Account: {item.email}
                </Text>
              ) : null}

              {item.phone ? (
                <Text style={styles.meta}>
                  Phone: {item.phone}
                  {item.phone_verified_at ? ' · verified' : ' · not verified'}
                </Text>
              ) : (
                <Text style={styles.metaMuted}>No phone on file</Text>
              )}

              <Text style={styles.metaSmall}>
                Verified{' '}
                {item.college_badge_verified_at
                  ? new Date(item.college_badge_verified_at).toLocaleString()
                  : '—'}
              </Text>
              <Text style={styles.metaSmall}>
                Badge renew by{' '}
                {item.college_badge_expires_at
                  ? new Date(item.college_badge_expires_at).toLocaleDateString()
                  : '—'}
              </Text>
              <Text style={styles.metaSmall}>
                Joined {new Date(item.created_at).toLocaleDateString()}
                {item.is_premium ? ' · Premium' : ''}
                {item.banned_at ? ' · Banned' : ''}
              </Text>

              <Pressable
                style={styles.profileBtn}
                onPress={() => router.push(`/profile/${item.id}`)}
              >
                <Text style={styles.profileBtnText}>View public profile</Text>
              </Pressable>
            </View>
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  lead: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  search: {
    margin: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.body,
    backgroundColor: colors.surface,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  count: { fontSize: fontSize.caption, color: colors.textMuted },
  exportBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  exportBtnText: { color: colors.primary, fontWeight: fontWeight.semibold, fontSize: fontSize.caption },
  errorWrap: { paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  loader: { marginTop: spacing.xl },
  list: { flex: 1 },
  listContent: { padding: spacing.md, paddingTop: 0, gap: spacing.sm },
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  eduEmail: {
    flex: 1,
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  badgePill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgePillActive: { backgroundColor: colors.successMuted },
  badgePillText: { fontSize: 11, fontWeight: fontWeight.bold },
  badgePillTextActive: { color: colors.successMutedText },
  name: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.text },
  meta: { fontSize: fontSize.caption, color: colors.textSecondary },
  metaMuted: { fontSize: fontSize.caption, color: colors.textMuted, fontStyle: 'italic' },
  metaSmall: { fontSize: 11, color: colors.textMuted, lineHeight: 16 },
  profileBtn: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  profileBtnText: { color: colors.primary, fontWeight: fontWeight.semibold, fontSize: fontSize.caption },
}));
