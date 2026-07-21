import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Switch,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  addBannedKeyword,
  adminQueryErrorMessage,
  fetchBannedKeywords,
  setBannedKeywordActive,
} from '@/features/admin/admin-service';
import { AdminErrorBanner } from '@/components/admin/AdminErrorBanner';
import { queryKeys } from '@/lib/query-keys';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

export default function AdminBannedKeywordsScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const { session, user } = useAuth();
  const token = session?.access_token ?? '';
  const adminUserId = user?.id ?? '';
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [adding, setAdding] = useState(false);

  const listQuery = useQuery({
    queryKey: queryKeys.adminBannedKeywords,
    enabled: !!token,
    queryFn: () => fetchBannedKeywords(token),
  });

  const addKeyword = async () => {
    const next = keyword.trim().toLowerCase();
    if (!next) {
      Alert.alert('Keyword required', 'Enter a word or phrase to block in listings.');
      return;
    }
    setAdding(true);
    try {
      await addBannedKeyword(token, adminUserId, next);
      setKeyword('');
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminBannedKeywords });
      Alert.alert('Added', `"${next}" is now blocked in new listings.`);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not add keyword');
    } finally {
      setAdding(false);
    }
  };

  const toggleActive = async (id: number, active: boolean) => {
    try {
      await setBannedKeywordActive(token, adminUserId, id, active);
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminBannedKeywords });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not update keyword');
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.lead}>
        Listing titles and descriptions are scanned for these keywords at publish time. Disable a
        keyword to allow it again (whitelist false positives).
      </Text>

      <Text style={styles.label}>Add keyword</Text>
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          value={keyword}
          onChangeText={setKeyword}
          placeholder="e.g. vape"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable
          style={[styles.addBtn, adding && styles.disabled]}
          onPress={() => void addKeyword()}
          disabled={adding}
        >
          {adding ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.addBtnText}>Add</Text>
          )}
        </Pressable>
      </View>

      <AdminErrorBanner
        message={adminQueryErrorMessage(
          listQuery.isError,
          listQuery.error,
          'Could not load banned keywords'
        )}
        onRetry={() => void listQuery.refetch()}
        loading={listQuery.isFetching}
      />

      {listQuery.isLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={listQuery.data ?? []}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl refreshing={listQuery.isFetching} onRefresh={() => listQuery.refetch()} />
          }
          ListEmptyComponent={<Text style={styles.empty}>No banned keywords yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={[styles.keyword, !item.active && styles.keywordInactive]}>
                {item.keyword}
              </Text>
              <Switch
                value={item.active}
                onValueChange={(v) => void toggleActive(item.id, v)}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>
          )}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  lead: { fontSize: fontSize.body, color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.md },
  label: { fontSize: fontSize.caption, fontWeight: fontWeight.bold, color: colors.textMuted, marginBottom: spacing.xs },
  addRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.body,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    minWidth: 72,
    alignItems: 'center',
  },
  addBtnText: { color: colors.onPrimary, fontWeight: fontWeight.bold },
  disabled: { opacity: 0.7 },
  loader: { marginTop: spacing.xl },
  list: { paddingBottom: spacing.xl, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  keyword: { fontSize: fontSize.body, color: colors.text, fontWeight: fontWeight.semibold },
  keywordInactive: { color: colors.textMuted, textDecorationLine: 'line-through' },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.xl },
}));
