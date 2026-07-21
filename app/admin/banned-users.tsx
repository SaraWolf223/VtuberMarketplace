import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  fetchBannedUsers,
  adminQueryErrorMessage,
  unbanUser,
  invalidateAdminModerationQueries,
} from '@/features/admin/admin-service';
import { AdminErrorBanner } from '@/components/admin/AdminErrorBanner';
import { queryKeys } from '@/lib/query-keys';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

export default function AdminBannedUsersScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const router = useRouter();
  const { session, user } = useAuth();
  const token = session?.access_token ?? '';
  const adminUserId = user?.id ?? '';
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const bannedQuery = useQuery({
    queryKey: queryKeys.adminBannedUsers,
    enabled: !!token && !!adminUserId,
    queryFn: () => fetchBannedUsers(token),
  });

  const refresh = async () => {
    invalidateAdminModerationQueries(queryClient);
    await queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers });
  };

  const confirmUnban = (userId: string, username: string) => {
    Alert.alert(
      'Unban user',
      `Restore access for @${username}? They can sign in and use the app again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unban',
          onPress: () => {
            setBusyId(userId);
            void unbanUser(token, adminUserId, userId)
              .then(async () => {
                Alert.alert('Done', `@${username} has been unbanned.`);
                await refresh();
              })
              .catch((e) => {
                Alert.alert('Error', e instanceof Error ? e.message : 'Could not unban user');
              })
              .finally(() => setBusyId(null));
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={bannedQuery.isFetching} onRefresh={() => void refresh()} />
      }
    >
      <Text style={styles.intro}>
        Banned users lose access on their next app open. Unban restores their account immediately.
      </Text>

      {bannedQuery.isLoading ? <ActivityIndicator color={colors.primary} /> : null}

      <AdminErrorBanner
        message={adminQueryErrorMessage(
          bannedQuery.isError,
          bannedQuery.error,
          'Could not load banned users'
        )}
        onRetry={() => void bannedQuery.refetch()}
        loading={bannedQuery.isFetching}
      />

      {bannedQuery.data?.length ? (
        bannedQuery.data.map((item) => (
          <View key={item.id} style={styles.card}>
            <Pressable onPress={() => router.push(`/profile/${item.id}`)}>
              <Text style={styles.name}>
                {item.display_name} (@{item.username})
              </Text>
              {item.email ? (
                <Text style={styles.email} selectable>
                  {item.email}
                </Text>
              ) : null}
            </Pressable>
            <Text style={styles.meta}>
              Banned {item.banned_at ? new Date(item.banned_at).toLocaleString() : '—'}
            </Text>
            <View style={styles.actions}>
              <Pressable
                style={styles.profileBtn}
                onPress={() => router.push(`/profile/${item.id}`)}
              >
                <Text style={styles.profileBtnText}>View profile</Text>
              </Pressable>
              <Pressable
                style={[styles.unbanBtn, busyId === item.id && styles.disabled]}
                disabled={busyId === item.id}
                onPress={() => confirmUnban(item.id, item.username)}
              >
                <Text style={styles.unbanBtnText}>
                  {busyId === item.id ? 'Unbanning…' : 'Unban'}
                </Text>
              </Pressable>
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.empty}>No banned users.</Text>
      )}
    </ScrollView>
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
  name: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.text },
  email: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2 },
  meta: { fontSize: fontSize.caption, color: colors.error },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  profileBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  profileBtnText: { color: colors.text, fontWeight: fontWeight.semibold },
  unbanBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  unbanBtnText: { color: colors.onPrimary, fontWeight: fontWeight.semibold },
  disabled: { opacity: 0.6 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.xl },
}));
