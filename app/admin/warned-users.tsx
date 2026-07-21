import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { adminQueryErrorMessage, fetchWarnedUsers } from '@/features/admin/admin-service';
import { AdminErrorBanner } from '@/components/admin/AdminErrorBanner';
import { queryKeys } from '@/lib/query-keys';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

export default function AdminWarnedUsersScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const router = useRouter();
  const { session } = useAuth();
  const token = session?.access_token ?? '';
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const warnedQuery = useQuery({
    queryKey: queryKeys.adminWarnedUsers,
    enabled: !!token,
    queryFn: () => fetchWarnedUsers(token),
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.adminWarnedUsers });
  };

  const warnedUsers = warnedQuery.data ?? [];

  return (
    <View style={styles.root}>
      <FlatList
        data={warnedUsers}
        keyExtractor={(item) => item.user_id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={warnedQuery.isFetching} onRefresh={() => void refresh()} />
        }
        ListHeaderComponent={
          <>
            <Text style={styles.intro}>
              Users who received at least one admin warning. Count includes every logged warn
              action.
            </Text>
            {warnedQuery.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
            <AdminErrorBanner
              message={adminQueryErrorMessage(
                warnedQuery.isError,
                warnedQuery.error,
                'Could not load warned users'
              )}
              onRetry={() => void warnedQuery.refetch()}
              loading={warnedQuery.isFetching}
            />
          </>
        }
        renderItem={({ item }) => {
          const profile = item.profile;
          const expanded = expandedId === item.user_id;
          return (
            <View style={styles.card}>
              <Pressable
                style={styles.headerRow}
                onPress={() => router.push(`/profile/${item.user_id}`)}
              >
                <View style={styles.flex}>
                  <Text style={styles.name}>
                    {profile?.display_name ?? 'Unknown user'} (@{profile?.username ?? '—'})
                  </Text>
                  {profile?.email ? (
                    <Text style={styles.email} selectable>
                      {profile.email}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{item.warning_count}</Text>
                  <Text style={styles.countLabel}>
                    warn{item.warning_count === 1 ? '' : 's'}
                  </Text>
                </View>
              </Pressable>

              <Text style={styles.meta}>
                Last warned {new Date(item.last_warned_at).toLocaleString()}
                {item.is_banned ? ' · currently banned' : ''}
              </Text>

              {item.last_notes ? (
                <Pressable onPress={() => setExpandedId(expanded ? null : item.user_id)}>
                  <Text style={styles.notesPreview} numberOfLines={expanded ? undefined : 2}>
                    {item.last_notes}
                  </Text>
                  {!expanded ? <Text style={styles.linkHint}>Tap to expand note</Text> : null}
                </Pressable>
              ) : null}

              <Pressable onPress={() => router.push(`/profile/${item.user_id}`)}>
                <Text style={styles.linkHint}>Open profile</Text>
              </Pressable>
            </View>
          );
        }}
        ListEmptyComponent={
          warnedQuery.isLoading ? null : (
            <Text style={styles.empty}>No warned users yet.</Text>
          )
        }
      />
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  intro: { fontSize: fontSize.body, color: colors.textSecondary, lineHeight: 22 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  flex: { flex: 1 },
  name: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.text },
  email: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2 },
  countBadge: {
    alignItems: 'center',
    backgroundColor: colors.warningMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minWidth: 52,
  },
  countText: { fontSize: fontSize.h2, fontWeight: fontWeight.bold, color: colors.warning },
  countLabel: { fontSize: fontSize.caption, color: colors.warning, fontWeight: fontWeight.semibold },
  meta: { fontSize: fontSize.caption, color: colors.textSecondary },
  notesPreview: { fontSize: fontSize.body, color: colors.text, fontStyle: 'italic' },
  linkHint: { fontSize: fontSize.caption, color: colors.primary },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.xl },
}));
