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
  Switch,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  adminQueryErrorMessage,
  createCategory,
  deleteCategory,
  fetchAdminCategories,
  updateCategory,
} from '@/features/admin/admin-service';
import type { AdminListingCategory } from '@/features/admin/admin-types';
import { AdminErrorBanner } from '@/components/admin/AdminErrorBanner';
import { CATEGORY_ICON_ALLOWLIST, toSafeCategoryIcon } from '@/constants/ionicons-allowlist';
import { useAppConfigStore } from '@/stores/app-config-store';
import { useCategoriesStore } from '@/stores/categories-store';
import { fetchListingCategories } from '@/features/listings/categories-service';
import { queryKeys } from '@/lib/query-keys';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (icon: string) => void;
}): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable style={styles.iconPickerBtn} onPress={() => setOpen(true)}>
        <Ionicons name={toSafeCategoryIcon(value)} size={22} color={colors.primary} />
        <Text style={styles.iconPickerBtnText}>Change icon</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choose an icon</Text>
            <ScrollView contentContainerStyle={styles.iconGrid}>
              {CATEGORY_ICON_ALLOWLIST.map((icon) => (
                <Pressable
                  key={icon}
                  style={[styles.iconTile, value === icon && styles.iconTileSelected]}
                  onPress={() => {
                    onChange(icon);
                    setOpen(false);
                  }}
                >
                  <Ionicons
                    name={icon}
                    size={24}
                    color={value === icon ? colors.onPrimary : colors.primary}
                  />
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.modalCloseBtn} onPress={() => setOpen(false)}>
              <Text style={styles.modalCloseBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

export default function AdminCategoriesScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const { session, user } = useAuth();
  const token = session?.access_token ?? '';
  const adminUserId = user?.id ?? '';
  const queryClient = useQueryClient();

  const [slug, setSlug] = useState('');
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState('grid-outline');
  const [adding, setAdding] = useState(false);

  const listQuery = useQuery({
    queryKey: queryKeys.adminCategories,
    enabled: !!token,
    queryFn: () => fetchAdminCategories(token),
  });

  const refreshPublicCategoriesCache = async () => {
    try {
      const rows = await fetchListingCategories();
      if (rows.length > 0) useCategoriesStore.getState().setCategories(rows);
    } catch {
      /* admin list already reflects the change; public cache refreshes next launch */
    }
  };

  const addCategory = async () => {
    if (!slug.trim() || !label.trim()) {
      Alert.alert('Missing fields', 'Enter both a slug and a label.');
      return;
    }
    setAdding(true);
    try {
      await createCategory(token, adminUserId, { slug, label, icon_name: icon });
      setSlug('');
      setLabel('');
      setIcon('grid-outline');
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminCategories });
      await refreshPublicCategoriesCache();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not add category');
    } finally {
      setAdding(false);
    }
  };

  const toggleActive = async (row: AdminListingCategory) => {
    try {
      await updateCategory(token, adminUserId, row.slug, { is_active: !row.is_active });
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminCategories });
      await refreshPublicCategoriesCache();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not update category');
    }
  };

  const changeIcon = async (row: AdminListingCategory, newIcon: string) => {
    try {
      await updateCategory(token, adminUserId, row.slug, { icon_name: newIcon });
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminCategories });
      await refreshPublicCategoriesCache();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not update icon');
    }
  };

  const move = async (row: AdminListingCategory, dir: -1 | 1) => {
    const rows = listQuery.data ?? [];
    const idx = rows.findIndex((r) => r.slug === row.slug);
    const swapWith = rows[idx + dir];
    if (!swapWith) return;
    try {
      await updateCategory(token, adminUserId, row.slug, { sort_order: swapWith.sort_order });
      await updateCategory(token, adminUserId, swapWith.slug, { sort_order: row.sort_order });
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminCategories });
      await refreshPublicCategoriesCache();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not reorder');
    }
  };

  const remove = (row: AdminListingCategory) => {
    Alert.alert('Delete category?', `"${row.label}" will be permanently removed. This fails if any listing still uses it — deactivate it instead in that case.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          void deleteCategory(token, adminUserId, row.slug)
            .then(async () => {
              await queryClient.invalidateQueries({ queryKey: queryKeys.adminCategories });
              await refreshPublicCategoriesCache();
            })
            .catch((e) => Alert.alert('Could not delete', e instanceof Error ? e.message : 'Try deactivating instead')),
      },
    ]);
  };

  const appDisplayName = useAppConfigStore((s) => s.config.appDisplayName);

  return (
    <View style={styles.root}>
      <Text style={styles.lead}>
        Categories shown across {appDisplayName} — the feed filters, category chips, and the sell
        form. Deactivate a category to hide it without breaking existing listings; delete only
        works if no listing uses it.
      </Text>

      <Text style={styles.section}>Add category</Text>
      <View style={styles.addForm}>
        <TextInput
          style={styles.input}
          value={slug}
          onChangeText={setSlug}
          placeholder="slug (e.g. plants)"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          value={label}
          onChangeText={setLabel}
          placeholder="Label shown to users (e.g. Plants)"
        />
        <IconPicker value={icon} onChange={setIcon} />
        <Pressable style={[styles.addBtn, adding && styles.disabled]} onPress={() => void addCategory()} disabled={adding}>
          {adding ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.addBtnText}>Add category</Text>}
        </Pressable>
      </View>

      <AdminErrorBanner
        message={adminQueryErrorMessage(listQuery.isError, listQuery.error, 'Could not load categories')}
        onRetry={() => void listQuery.refetch()}
        loading={listQuery.isFetching}
      />

      {listQuery.isLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={listQuery.data ?? []}
          keyExtractor={(item) => item.slug}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No categories yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Ionicons name={toSafeCategoryIcon(item.icon_name)} size={22} color={colors.primary} />
              <View style={styles.rowInfo}>
                <Text style={[styles.rowLabel, !item.is_active && styles.rowLabelInactive]}>{item.label}</Text>
                <Text style={styles.rowSlug}>{item.slug}</Text>
              </View>
              <Pressable onPress={() => void move(item, -1)} hitSlop={8}>
                <Ionicons name="arrow-up-outline" size={18} color={colors.textSecondary} />
              </Pressable>
              <Pressable onPress={() => void move(item, 1)} hitSlop={8}>
                <Ionicons name="arrow-down-outline" size={18} color={colors.textSecondary} />
              </Pressable>
              <IconPicker value={item.icon_name} onChange={(next) => void changeIcon(item, next)} />
              <Switch
                value={item.is_active}
                onValueChange={() => void toggleActive(item)}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
              <Pressable onPress={() => remove(item)} hitSlop={8}>
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  lead: { fontSize: fontSize.body, color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.md },
  section: { fontSize: fontSize.caption, fontWeight: fontWeight.bold, color: colors.textMuted, textTransform: 'uppercase', marginBottom: spacing.xs },
  addForm: { gap: spacing.sm, marginBottom: spacing.lg },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: fontSize.body, backgroundColor: colors.surface, color: colors.text },
  addBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  addBtnText: { color: colors.onPrimary, fontWeight: fontWeight.bold },
  disabled: { opacity: 0.7 },
  loader: { marginTop: spacing.xl },
  list: { paddingBottom: spacing.xl, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  rowInfo: { flex: 1, gap: 2 },
  rowLabel: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.text },
  rowLabelInactive: { color: colors.textMuted, textDecorationLine: 'line-through' },
  rowSlug: { fontSize: fontSize.caption, color: colors.textMuted },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.xl },
  iconPickerBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.xs },
  iconPickerBtnText: { fontSize: fontSize.caption, color: colors.primary, fontWeight: fontWeight.semibold },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, maxHeight: '70%', width: '100%', maxWidth: 420 },
  modalTitle: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing.md },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  iconTile: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  iconTileSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  modalCloseBtn: { marginTop: spacing.md, alignItems: 'center', paddingVertical: spacing.sm },
  modalCloseBtnText: { color: colors.primary, fontWeight: fontWeight.semibold },
}));
