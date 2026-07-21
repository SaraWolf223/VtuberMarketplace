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
import { adminQueryErrorMessage, fetchAdminWaitlistPage } from '@/features/admin/admin-service';
import { AdminErrorBanner } from '@/components/admin/AdminErrorBanner';
import { queryKeys } from '@/lib/query-keys';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

export default function AdminWaitlistScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const router = useRouter();
  const { session } = useAuth();
  const token = session?.access_token ?? '';
  const appDisplayName = useAppConfigStore((s) => s.config.appDisplayName);
  const [search, setSearch] = useState('');

  const waitlistQuery = useInfiniteQuery({
    queryKey: queryKeys.adminWaitlist,
    enabled: !!token,
    queryFn: ({ pageParam }) => fetchAdminWaitlistPage(token, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
  });

  const filtered = useMemo(() => {
    const allRows = waitlistQuery.data?.pages.flatMap((p) => p.items) ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter(
      (row) =>
        row.email.toLowerCase().includes(q) ||
        row.zip_code.includes(q) ||
        row.founding_code.toLowerCase().includes(q)
    );
  }, [search, waitlistQuery.data?.pages]);

  const exportEmails = async () => {
    const emails = filtered.map((row) => row.email).join('\n');
    await Share.share({ message: emails, title: `${appDisplayName} waitlist emails` });
  };

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Search email, ZIP, or code"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable style={styles.exportBtn} onPress={() => void exportEmails()}>
          <Text style={styles.exportBtnText}>Share emails</Text>
        </Pressable>
        <Pressable style={styles.exportBtn} onPress={() => router.push('/admin/ios-waitlist')}>
          <Text style={styles.exportBtnText}>iPhone list</Text>
        </Pressable>
        <Pressable style={styles.exportBtn} onPress={() => router.push('/admin/bulk-email')}>
          <Text style={styles.exportBtnText}>Bulk email</Text>
        </Pressable>
      </View>

      <AdminErrorBanner
        message={adminQueryErrorMessage(
          waitlistQuery.isError,
          waitlistQuery.error,
          'Could not load waitlist'
        )}
        onRetry={() => void waitlistQuery.refetch()}
        loading={waitlistQuery.isFetching && !waitlistQuery.isFetchingNextPage}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={waitlistQuery.isRefetching && !waitlistQuery.isFetchingNextPage}
            onRefresh={() => void waitlistQuery.refetch()}
            tintColor={colors.primary}
          />
        }
        onEndReached={() => {
          if (waitlistQuery.hasNextPage && !waitlistQuery.isFetchingNextPage) {
            void waitlistQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          waitlistQuery.isLoading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : (
            <Text style={styles.empty}>No waitlist signups yet.</Text>
          )
        }
        ListFooterComponent={
          waitlistQuery.isFetchingNextPage ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.email} selectable>
              {item.email}
            </Text>
            <Text style={styles.meta}>
              ZIP {item.zip_code} · {item.role} · {new Date(item.created_at).toLocaleDateString()}
            </Text>
            <Text style={styles.code} selectable>
              {item.founding_code}
              {item.redeemed_at ? ' · redeemed' : ''}
            </Text>
          </View>
        )}
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
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    search: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.md,
      fontSize: fontSize.body,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    exportBtn: {
      alignSelf: 'flex-start',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    exportBtnText: { color: colors.primary, fontWeight: fontWeight.bold },
    list: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      gap: spacing.xs,
    },
    email: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.text },
    meta: { fontSize: fontSize.caption, color: colors.textSecondary },
    code: {
      fontSize: fontSize.caption,
      fontFamily: 'monospace',
      color: colors.primary,
    },
    empty: { textAlign: 'center', color: colors.textSecondary, padding: spacing.lg },
    loader: { marginVertical: spacing.md },
  })
);
