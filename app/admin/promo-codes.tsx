import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  createPromoCode,
  deactivatePromoCode,
  adminQueryErrorMessage,
  fetchPromoCodes,
  formatPromoValue,
  promoTypeLabel,
} from '@/features/admin/admin-service';
import { AdminErrorBanner } from '@/components/admin/AdminErrorBanner';
import type { AdminPromoCodeType } from '@/features/admin/admin-types';
import { queryKeys } from '@/lib/query-keys';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

export default function AdminPromoCodesScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const { session } = useAuth();
  const token = session?.access_token ?? '';
  const queryClient = useQueryClient();

  const [code, setCode] = useState('');
  const [type, setType] = useState<AdminPromoCodeType>('free_premium_month');
  const [value, setValue] = useState('1');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [creating, setCreating] = useState(false);

  const listQuery = useQuery({
    queryKey: queryKeys.adminPromoCodes,
    enabled: !!token,
    queryFn: () => fetchPromoCodes(token),
  });

  const create = async () => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      Alert.alert('Code required', 'Enter a promo code.');
      return;
    }

    setCreating(true);
    try {
      await createPromoCode(token, {
        code: normalized,
        type,
        value:
          type === 'free_premium_month' || type === 'founding_seller'
            ? 1
            : Math.max(1, parseInt(value, 10) || 1),
        max_redemptions: maxRedemptions ? Math.max(1, parseInt(maxRedemptions, 10) || 1) : null,
        expires_at: expiresAt.trim()
          ? new Date(`${expiresAt.trim()}T23:59:59`).toISOString()
          : null,
      });
      setCode('');
      setMaxRedemptions('');
      setExpiresAt('');
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminPromoCodes });
      Alert.alert('Created', `Promo code ${normalized} is ready.`);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not create code');
    } finally {
      setCreating(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={listQuery.isFetching}
          onRefresh={() => void listQuery.refetch()}
        />
      }
    >
      <Text style={styles.section}>Create promo code</Text>

      <AdminErrorBanner
        message={adminQueryErrorMessage(
          listQuery.isError,
          listQuery.error,
          'Could not load promo codes'
        )}
        onRetry={() => void listQuery.refetch()}
        loading={listQuery.isFetching}
      />

      <Text style={styles.label}>Code (A-Z, 0-9, _ -)</Text>
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase())}
        autoCapitalize="characters"
        autoCorrect={false}
      />

      <View style={styles.typeRow}>
        {(['founding_seller', 'free_premium_month', 'free_boosts'] as const).map((option) => (
          <Pressable
            key={option}
            style={[styles.chip, type === option && styles.chipActive]}
            onPress={() => setType(option)}
          >
            <Text style={[styles.chipText, type === option && styles.chipTextActive]}>
              {promoTypeLabel(option)}
            </Text>
          </Pressable>
        ))}
      </View>

      {type === 'free_boosts' ? (
        <>
          <Text style={styles.label}>Number of free boosts</Text>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            keyboardType="number-pad"
          />
        </>
      ) : null}

      <Text style={styles.label}>Max redemptions (optional)</Text>
      <TextInput
        style={styles.input}
        value={maxRedemptions}
        onChangeText={setMaxRedemptions}
        keyboardType="number-pad"
        placeholder="Unlimited if empty"
      />

      <Text style={styles.label}>Expires on (optional)</Text>
      <TextInput
        style={styles.input}
        value={expiresAt}
        onChangeText={setExpiresAt}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
      />
      <Text style={styles.hint}>Leave empty for no expiration. Uses local end-of-day.</Text>

      <Pressable
        style={[styles.primaryBtn, creating && styles.disabled]}
        onPress={() => void create()}
        disabled={creating}
      >
        {creating ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.primaryBtnText}>Create code</Text>
        )}
      </Pressable>

      <Text style={styles.section}>Existing codes</Text>
      {listQuery.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {listQuery.data?.map((promo) => (
        <View key={promo.id} style={styles.card}>
          <Text style={styles.code}>{promo.code}</Text>
          <Text style={styles.meta}>
            {promoTypeLabel(promo.type)} · {formatPromoValue(promo.type, promo.value)}
          </Text>
          <Text style={styles.meta}>
            {promo.redemption_count}
            {promo.max_redemptions != null ? ` / ${promo.max_redemptions}` : ''} redeemed ·{' '}
            {promo.active ? 'Active' : 'Inactive'}
            {promo.expires_at
              ? ` · expires ${new Date(promo.expires_at).toLocaleDateString()}`
              : ''}
          </Text>
          {promo.active ? (
            <Pressable
              style={styles.dangerBtn}
              onPress={() => {
                Alert.alert('Deactivate', `Deactivate ${promo.code}?`, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Deactivate',
                    style: 'destructive',
                    onPress: () => {
                      void deactivatePromoCode(token, promo.id)
                        .then(() =>
                          queryClient.invalidateQueries({ queryKey: queryKeys.adminPromoCodes })
                        )
                        .catch((e) =>
                          Alert.alert('Error', e instanceof Error ? e.message : 'Failed')
                        );
                    },
                  },
                ]);
              }}
            >
              <Text style={styles.dangerBtnText}>Deactivate</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  section: {
    marginTop: spacing.md,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  label: { fontSize: fontSize.body, color: colors.text, fontWeight: fontWeight.semibold },
  hint: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: -spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.body,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text },
  chipTextActive: { color: colors.onPrimary, fontWeight: fontWeight.bold },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  primaryBtnText: { color: colors.onPrimary, fontWeight: fontWeight.bold },
  disabled: { opacity: 0.7 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  code: { fontSize: fontSize.h2, fontWeight: fontWeight.bold, color: colors.text },
  meta: { fontSize: fontSize.caption, color: colors.textSecondary },
  dangerBtn: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    backgroundColor: colors.errorMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  dangerBtnText: { color: colors.error, fontWeight: fontWeight.semibold },
}));
