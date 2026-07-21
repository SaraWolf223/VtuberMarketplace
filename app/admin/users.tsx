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
  Alert,
  Modal,
} from 'react-native';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useAppConfigStore } from '@/stores/app-config-store';
import { isAdminRole } from '@/lib/admin-access';
import {
  callAdminAction,
  adminQueryErrorMessage,
  fetchAdminUsersPage,
  logAdminAudit,
  invalidateAdminModerationQueries,
  notifyModerationAction,
  grantPremium,
  revokePremium,
} from '@/features/admin/admin-service';
import { staffUserHasEmail, type StaffDirectoryUser } from '@/features/admin/admin-types';
import { AdminErrorBanner } from '@/components/admin/AdminErrorBanner';
import { queryKeys } from '@/lib/query-keys';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

export default function AdminUsersScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const { session, user } = useAuth();
  const { data: profile } = useProfile();
  const isAdmin = isAdminRole(profile?.role);
  const token = session?.access_token ?? '';
  const adminUserId = user?.id ?? '';
  const appDisplayName = useAppConfigStore((s) => s.config.appDisplayName);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [menuUser, setMenuUser] = useState<StaffDirectoryUser | null>(null);
  const [grantUser, setGrantUser] = useState<StaffDirectoryUser | null>(null);

  const usersQuery = useInfiniteQuery({
    queryKey: queryKeys.adminUsers,
    enabled: !!token,
    queryFn: ({ pageParam }) => fetchAdminUsersPage(token, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
  });

  const filtered = useMemo(() => {
    const allUsers = usersQuery.data?.pages.flatMap((p) => p.items) ?? [];
    const q = search.trim().toLowerCase();
    const rows = allUsers;
    if (!q) return rows;
    if (isAdmin) {
      return rows.filter(
        (u) =>
          (staffUserHasEmail(u) && u.email.toLowerCase().includes(q)) ||
          u.username.toLowerCase().includes(q) ||
          (staffUserHasEmail(u) && u.display_name.toLowerCase().includes(q))
      );
    }
    return rows.filter((u) => u.username.toLowerCase().includes(q));
  }, [search, usersQuery.data?.pages, isAdmin]);

  const exportEmails = async () => {
    const emails = filtered
      .filter(staffUserHasEmail)
      .map((u) => u.email)
      .join('\n');
    await Share.share({
      message: emails,
      title: `${appDisplayName} user emails`,
    });
    if (adminUserId) {
      await logAdminAudit(
        token,
        adminUserId,
        'export_user_emails',
        `${filtered.length} email(s) shared`
      ).catch(() => {});
    }
  };

  const runAdminUserAction = async (
    action: Parameters<typeof callAdminAction>[2],
    successMessage: string,
    notify?: { userId: string; action: 'warn_user' | 'ban_user' }
  ) => {
    try {
      await callAdminAction(token, adminUserId, action);
      if (notify) {
        try {
          await notifyModerationAction(token, notify);
        } catch {
          /* notification delivery is non-critical */
        }
      }
      invalidateAdminModerationQueries(queryClient);
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers });
      setMenuUser(null);
      Alert.alert('Done', successMessage);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const confirmWarnUser = (item: StaffDirectoryUser) => {
    Alert.alert('Warn user', `Log a warning for @${item.username}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Warn',
        onPress: () => {
          void runAdminUserAction(
            { action: 'warn_user', user_id: item.id },
            'Warning logged.',
            { userId: item.id, action: 'warn_user' }
          );
        },
      },
    ]);
  };

  const confirmBanUser = (item: StaffDirectoryUser) => {
    Alert.alert('Ban user', `Ban @${item.username}? They cannot sign in.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Ban',
        style: 'destructive',
        onPress: () => {
          void runAdminUserAction(
            { action: 'ban_user', user_id: item.id },
            'User banned.',
            { userId: item.id, action: 'ban_user' }
          );
        },
      },
    ]);
  };

  const confirmShadowBanUser = (item: StaffDirectoryUser) => {
    Alert.alert(
      'Shadow ban user?',
      `@${item.username} stays signed in but their listings are hidden from feeds.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Shadow ban',
          style: 'destructive',
          onPress: () => {
            void runAdminUserAction(
              { action: 'shadow_ban_user', user_id: item.id },
              'User shadow banned.'
            );
          },
        },
      ]
    );
  };

  const doGrantPremium = async (item: StaffDirectoryUser, months: number | null) => {
    try {
      await grantPremium(token, adminUserId, item.id, months);
      invalidateAdminModerationQueries(queryClient);
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers });
      setGrantUser(null);
      setMenuUser(null);
      Alert.alert(
        'Premium granted',
        months ? `@${item.username} is Premium for ${months} month(s).` : `@${item.username} is Premium (open-ended).`
      );
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to grant premium');
    }
  };

  const confirmRevokePremium = (item: StaffDirectoryUser) => {
    Alert.alert('Revoke Premium', `Remove Premium from @${item.username}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await revokePremium(token, adminUserId, item.id);
              invalidateAdminModerationQueries(queryClient);
              await queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers });
              setMenuUser(null);
              Alert.alert('Done', 'Premium revoked.');
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed to revoke premium');
            }
          })();
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <TextInput
        style={styles.search}
        placeholder={isAdmin ? 'Search email, username, or name' : 'Search username'}
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <View style={styles.toolbar}>
        <Text style={styles.count}>
          {filtered.length} user{filtered.length === 1 ? '' : 's'}
        </Text>
        {isAdmin ? (
          <Pressable style={styles.exportBtn} onPress={() => void exportEmails()}>
            <Text style={styles.exportBtnText}>Share email list</Text>
          </Pressable>
        ) : null}
      </View>

      {usersQuery.isLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          style={styles.list}
          data={filtered}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={usersQuery.isFetching} onRefresh={() => usersQuery.refetch()} />
          }
          ListHeaderComponent={
            <AdminErrorBanner
              message={adminQueryErrorMessage(
                usersQuery.isError,
                usersQuery.error,
                'Could not load users'
              )}
              onRetry={() => void usersQuery.refetch()}
              loading={usersQuery.isFetching}
            />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              {isAdmin ? 'No users match your search.' : 'No usernames match your search.'}
            </Text>
          }
          ListFooterComponent={
            usersQuery.hasNextPage ? (
              <Pressable
                style={styles.loadMore}
                onPress={() => void usersQuery.fetchNextPage()}
                disabled={usersQuery.isFetchingNextPage}
              >
                {usersQuery.isFetchingNextPage ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Text style={styles.loadMoreText}>Load more users</Text>
                )}
              </Pressable>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => setMenuUser(item)}>
              <View style={styles.flex}>
                {isAdmin && staffUserHasEmail(item) ? (
                  <>
                    <Text style={styles.email} selectable>
                      {item.email}
                    </Text>
                    <Text style={styles.meta}>
                      @{item.username} · {item.display_name}
                    </Text>
                    <Text style={styles.metaSmall}>
                      {item.role}
                      {item.banned_at ? ' · banned' : ''}
                      {item.shadow_banned ? ' · shadow banned' : ''} · joined{' '}
                      {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.username}>@{item.username}</Text>
                    {(item.banned_at || item.shadow_banned) && (
                      <Text style={styles.metaSmall}>
                        {item.banned_at ? 'banned' : ''}
                        {item.banned_at && item.shadow_banned ? ' · ' : ''}
                        {item.shadow_banned ? 'shadow banned' : ''}
                      </Text>
                    )}
                  </>
                )}
              </View>
              <Text style={styles.menuHint}>⋯</Text>
            </Pressable>
          )}
          contentContainerStyle={styles.listContent}
        />
      )}

      <Modal
        visible={menuUser != null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuUser(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setMenuUser(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {menuUser ? (
              <>
                <Text style={styles.modalTitle}>@{menuUser.username}</Text>
                {isAdmin && staffUserHasEmail(menuUser) ? (
                  <Text style={styles.modalSub} selectable>
                    {menuUser.email}
                  </Text>
                ) : null}
                {menuUser.shadow_banned ? (
                  <Pressable
                    style={styles.modalAction}
                    onPress={() => {
                      void runAdminUserAction(
                        { action: 'unshadow_ban_user', user_id: menuUser.id },
                        'Shadow ban removed.'
                      );
                    }}
                  >
                    <Text style={styles.modalActionText}>Remove shadow ban</Text>
                  </Pressable>
                ) : !menuUser.banned_at ? (
                  <>
                    <Pressable
                      style={styles.modalAction}
                      onPress={() => confirmWarnUser(menuUser)}
                    >
                      <Text style={styles.modalActionText}>Warn user</Text>
                    </Pressable>
                    <Pressable
                      style={styles.modalAction}
                      onPress={() => confirmBanUser(menuUser)}
                    >
                      <Text style={[styles.modalActionText, styles.modalActionDanger]}>Ban user</Text>
                    </Pressable>
                    <Pressable
                      style={styles.modalAction}
                      onPress={() => confirmShadowBanUser(menuUser)}
                    >
                      <Text style={[styles.modalActionText, styles.modalActionDanger]}>
                        Shadow ban
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <Text style={styles.modalNote}>This user is already banned.</Text>
                )}
                {isAdmin ? (
                  <>
                    <Pressable
                      style={styles.modalAction}
                      onPress={() => setGrantUser(menuUser)}
                    >
                      <Text style={styles.modalActionText}>Grant Premium…</Text>
                    </Pressable>
                    <Pressable
                      style={styles.modalAction}
                      onPress={() => confirmRevokePremium(menuUser)}
                    >
                      <Text style={styles.modalActionText}>Revoke Premium</Text>
                    </Pressable>
                  </>
                ) : null}
                <Pressable style={styles.modalCloseBtn} onPress={() => setMenuUser(null)}>
                  <Text style={styles.modalCloseText}>Close</Text>
                </Pressable>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={grantUser != null}
        transparent
        animationType="fade"
        onRequestClose={() => setGrantUser(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setGrantUser(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {grantUser ? (
              <>
                <Text style={styles.modalTitle}>Grant Premium</Text>
                <Text style={styles.modalSub}>@{grantUser.username}</Text>
                {PREMIUM_DURATIONS.map((d) => (
                  <Pressable
                    key={d.label}
                    style={styles.modalAction}
                    onPress={() => void doGrantPremium(grantUser, d.months)}
                  >
                    <Text style={styles.modalActionText}>{d.label}</Text>
                  </Pressable>
                ))}
                <Pressable style={styles.modalCloseBtn} onPress={() => setGrantUser(null)}>
                  <Text style={styles.modalCloseText}>Cancel</Text>
                </Pressable>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const PREMIUM_DURATIONS: { label: string; months: number | null }[] = [
  { label: '1 month', months: 1 },
  { label: '2 months (seed default)', months: 2 },
  { label: '6 months', months: 6 },
  { label: '12 months', months: 12 },
  { label: 'Open-ended (no expiry)', months: null },
];

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
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
  count: { fontSize: fontSize.caption, color: colors.textSecondary },
  exportBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  exportBtnText: { color: colors.primary, fontWeight: fontWeight.semibold },
  loader: { marginTop: spacing.xl },
  list: { flex: 1 },
  listContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  flex: { flex: 1 },
  menuHint: { fontSize: 20, color: colors.textMuted, paddingLeft: spacing.sm },
  email: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.text },
  username: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.text },
  meta: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2 },
  metaSmall: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: 2 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.xl },
  loadMore: { alignItems: 'center', padding: spacing.md },
  loadMoreText: { color: colors.primary, fontWeight: fontWeight.semibold },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  modalTitle: {
    fontSize: fontSize.h2,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  modalSub: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  modalNote: {
    fontSize: fontSize.body,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  modalAction: {
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalActionText: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
    textAlign: 'center',
  },
  modalActionDanger: {
    color: colors.error,
  },
  modalCloseBtn: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCloseText: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    textAlign: 'center',
  },
}));
