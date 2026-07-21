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
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useAppConfigStore } from '@/stores/app-config-store';
import { adminQueryErrorMessage, fetchAdminIosWaitlistPage } from '@/features/admin/admin-service';
import { AdminErrorBanner } from '@/components/admin/AdminErrorBanner';
import { queryKeys } from '@/lib/query-keys';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

export default function AdminIosWaitlistScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const router = useRouter();
  const { session } = useAuth();
  const token = session?.access_token ?? '';
  const appDisplayName = useAppConfigStore((s) => s.config.appDisplayName);
  const [search, setSearch] = useState('');

  const listQuery = useInfiniteQuery({
    queryKey: queryKeys.adminIosWaitlist,
    enabled: !!token,
    queryFn: ({ pageParam }) => fetchAdminIosWaitlistPage(token, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
  });

  const filtered = useMemo(() => {
    const allRows = listQuery.data?.pages.flatMap((p) => p.items) ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter(
      (row) =>
        row.email.toLowerCase().includes(q) ||
        (row.zip_code ?? '').includes(q)
    );
  }, [search, listQuery.data?.pages]);

  const exportEmails = async () => {
    const emails = filtered.map((row) => row.email).join('\n');
    await Share.share({ message: emails, title: `${appDisplayName} iPhone waitlist` });
  };

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Search email or ZIP"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable style={styles.exportBtn} onPress={() => void exportEmails()}>
          <Text style={styles.exportBtnText}>Share emails</Text>
        </Pressable>
        <Pressable
          style={styles.exportBtn}
          onPress={() => router.push('/admin/bulk-email')}
        >
          <Text style={styles.exportBtnText}>Bulk email</Text>
        </Pressable>
      </View>

      <AdminErrorBanner
        message={adminQueryErrorMessage(
          listQuery.isError,
          listQuery.error,
          'Could not load iPhone waitlist'
        )}
        onRetry={() => void listQuery.refetch()}
        loading={listQuery.isFetching && !listQuery.isFetchingNextPage}
      />

      <FlatList
        style={styles.list}
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={listQuery.isRefetching && !listQuery.isFetchingNextPage}
            onRefresh={() => void listQuery.refetch()}
          />
        }
        onEndReached={() => {
          if (listQuery.hasNextPage && !listQuery.isFetchingNextPage) {
            void listQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          listQuery.isLoading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : (
            <Text style={styles.empty}>No iPhone waitlist signups yet.</Text>
          )
        }
        ListFooterComponent={
          listQuery.isFetchingNextPage ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.email} selectable>
              {item.email}
            </Text>
            <Text style={styles.meta}>
              {item.zip_code ? `ZIP ${item.zip_code}` : 'No ZIP'}
              {item.source ? ` · ${item.source}` : ''}
            </Text>
            <Text style={styles.metaSmall}>{new Date(item.created_at).toLocaleString()}</Text>
          </View>
        )}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    toolbar: {
      padding: spacing.md,
      gap: spacing.sm,
    },
    search: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.md,
      fontSize: fontSize.body,
      backgroundColor: colors.surface,
    },
    exportBtn: {
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    exportBtnText: { color: colors.primary, fontWeight: fontWeight.semibold },
    list: { flex: 1 },
    listContent: { padding: spacing.md, paddingTop: 0, gap: spacing.sm },
    row: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    email: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.text },
    meta: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 4 },
    metaSmall: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: 2 },
    empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.xl },
    loader: { marginVertical: spacing.lg },
  })
);
