import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { fetchPlatformSettings, updatePlatformSettings } from '@/features/admin/admin-service';
import { DEFAULT_ADMIN_PLATFORM_SETTINGS } from '@/features/admin/admin-types';
import { formatUsdFromCents } from '@/constants/stripe-fees';
import { queryKeys } from '@/lib/query-keys';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';
import { useAppConfigStore } from '@/stores/app-config-store';
import { fetchPublicAppConfig, updatePublicAppConfig } from '@/features/app-config/app-config-service';

type SettingsForm = {
  reports_per_hour: string;
  pause_reports_24h: string;
  pause_reports_lifetime: string;
};

type FeeTierForm = {
  feeBpsFree: string;
  feeBpsPro: string;
};

type FeaturedForm = {
  durationDays: string;
  priceCents: string;
};

function toModerationForm(settings: Record<string, number>): SettingsForm {
  return {
    reports_per_hour: String(settings.reports_per_hour ?? 5),
    pause_reports_24h: String(settings.pause_reports_24h ?? 10),
    pause_reports_lifetime: String(settings.pause_reports_lifetime ?? 50),
  };
}

function parseModerationForm(form: SettingsForm): Record<string, number> {
  return {
    reports_per_hour: parseInt(form.reports_per_hour, 10) || 5,
    pause_reports_24h: parseInt(form.pause_reports_24h, 10) || 10,
    pause_reports_lifetime: parseInt(form.pause_reports_lifetime, 10) || 50,
  };
}

function FieldInput(props: {
  label: string;
  hint?: string;
  value: string;
  onChangeText: (text: string) => void;
}): React.JSX.Element {
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      {props.hint ? <Text style={styles.hint}>{props.hint}</Text> : null}
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        keyboardType="number-pad"
      />
    </View>
  );
}

export default function AdminSettingsScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const { session, isLoading: authLoading } = useAuth();
  const token = session?.access_token ?? '';
  const [form, setForm] = useState<SettingsForm>(() => toModerationForm(DEFAULT_ADMIN_PLATFORM_SETTINGS));
  const [feeForm, setFeeForm] = useState<FeeTierForm>({ feeBpsFree: '1000', feeBpsPro: '800' });
  const [featuredForm, setFeaturedForm] = useState<FeaturedForm>({ durationDays: '7', priceCents: '500' });
  const [saving, setSaving] = useState(false);
  const [savingFees, setSavingFees] = useState(false);
  const [savingFeatured, setSavingFeatured] = useState(false);

  const appConfig = useAppConfigStore((s) => s.config);

  useEffect(() => {
    setFeeForm({
      feeBpsFree: String(Math.round(appConfig.platformFeePercentFree * 10_000)),
      feeBpsPro: String(Math.round(appConfig.platformFeePercentPro * 10_000)),
    });
    setFeaturedForm({
      durationDays: String(appConfig.featuredPlacementDurationDays),
      priceCents: String(appConfig.featuredPlacementPriceCents),
    });
  }, [
    appConfig.platformFeePercentFree,
    appConfig.platformFeePercentPro,
    appConfig.featuredPlacementDurationDays,
    appConfig.featuredPlacementPriceCents,
  ]);

  const settingsQuery = useQuery({
    queryKey: queryKeys.adminSettings,
    enabled: !!token,
    queryFn: () => fetchPlatformSettings(token),
    retry: 1,
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setForm(toModerationForm(settingsQuery.data));
    }
  }, [settingsQuery.data]);

  const saveFeatured = async () => {
    if (!token) return;
    const durationDays = parseInt(featuredForm.durationDays, 10);
    const priceCents = parseInt(featuredForm.priceCents, 10);
    if (!Number.isFinite(durationDays) || durationDays <= 0 || !Number.isFinite(priceCents) || priceCents <= 0) {
      Alert.alert('Error', 'Enter valid Featured duration and price.');
      return;
    }
    setSavingFeatured(true);
    try {
      await updatePublicAppConfig(token, {
        featuredPlacementDurationDays: durationDays,
        featuredPlacementPriceCents: priceCents,
      });
      const fresh = await fetchPublicAppConfig();
      useAppConfigStore.getState().setConfig(fresh);
      Alert.alert('Saved', 'Featured placement defaults updated.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save Featured settings');
    } finally {
      setSavingFeatured(false);
    }
  };

  const saveFees = async () => {
    if (!token) return;
    const feeBpsFree = parseInt(feeForm.feeBpsFree, 10);
    const feeBpsPro = parseInt(feeForm.feeBpsPro, 10);
    if (!Number.isFinite(feeBpsFree) || feeBpsFree <= 0 || !Number.isFinite(feeBpsPro) || feeBpsPro <= 0) {
      Alert.alert('Error', 'Enter valid basis-point values (1000 = 10%).');
      return;
    }
    setSavingFees(true);
    try {
      await updatePublicAppConfig(token, { platformFeeBpsFree: feeBpsFree, platformFeeBpsPro: feeBpsPro });
      const fresh = await fetchPublicAppConfig();
      useAppConfigStore.getState().setConfig(fresh);
      Alert.alert('Saved', 'Commission tiers updated for new checkouts.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save fee tiers');
    } finally {
      setSavingFees(false);
    }
  };

  const save = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const updated = await updatePlatformSettings(token, parseModerationForm(form));
      setForm(toModerationForm(updated));
      Alert.alert('Saved', 'Platform settings updated. New checkouts use these values.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.statusText}>Loading session…</Text>
      </View>
    );
  }

  if (!token) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Sign in required to edit platform settings.</Text>
      </View>
    );
  }

  const loadError =
    settingsQuery.isError && settingsQuery.error instanceof Error
      ? settingsQuery.error.message
      : settingsQuery.isError
        ? 'Could not load settings'
        : null;

  const showLoadingBanner = settingsQuery.isPending && !settingsQuery.data && !loadError;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      {loadError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{loadError}</Text>
          <Pressable style={styles.retryBtn} onPress={() => void settingsQuery.refetch()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
      {showLoadingBanner ? (
        <View style={styles.loadingBanner}>
          <ActivityIndicator color={colors.primary} size="small" />
          <Text style={styles.statusText}>Loading saved values…</Text>
        </View>
      ) : null}

      <Text style={styles.section}>Commission tiers</Text>
      <FieldInput
        label="Free-tier fee (basis points)"
        hint="1000 = 10% platform commission on destination charges"
        value={feeForm.feeBpsFree}
        onChangeText={(text) => setFeeForm((prev) => ({ ...prev, feeBpsFree: text }))}
      />
      <FieldInput
        label="Pro Seller fee (basis points)"
        hint="800 = 8% commission for active Pro Seller subscribers"
        value={feeForm.feeBpsPro}
        onChangeText={(text) => setFeeForm((prev) => ({ ...prev, feeBpsPro: text }))}
      />
      <Pressable
        style={[styles.primaryBtn, savingFees && styles.disabled]}
        onPress={() => void saveFees()}
        disabled={savingFees}
      >
        {savingFees ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.primaryBtnText}>Save commission tiers</Text>
        )}
      </Pressable>

      <Text style={styles.section}>Featured placement defaults</Text>
      <FieldInput
        label="Featured duration (days)"
        hint="Applies to new Featured purchases and Pro Seller credits"
        value={featuredForm.durationDays}
        onChangeText={(text) => setFeaturedForm((prev) => ({ ...prev, durationDays: text }))}
      />
      <FieldInput
        label="Featured base price (cents)"
        hint={`Display/checkout base before Stripe fees (${formatUsdFromCents(parseInt(featuredForm.priceCents, 10) || 500)})`}
        value={featuredForm.priceCents}
        onChangeText={(text) => setFeaturedForm((prev) => ({ ...prev, priceCents: text }))}
      />
      <Pressable
        style={[styles.primaryBtn, savingFeatured && styles.disabled]}
        onPress={() => void saveFeatured()}
        disabled={savingFeatured}
      >
        {savingFeatured ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.primaryBtnText}>Save Featured defaults</Text>
        )}
      </Pressable>

      <Text style={styles.section}>Moderation auto-pause</Text>
      <FieldInput
        label="Report rate limit (per hour)"
        hint="A reporter is blocked from filing more reports past this hourly count"
        value={form.reports_per_hour}
        onChangeText={(text) => setForm((prev) => ({ ...prev, reports_per_hour: text }))}
      />
      <FieldInput
        label="Auto-pause threshold (24h reports)"
        hint="A listing/seller is auto-paused once it receives this many reports in 24h"
        value={form.pause_reports_24h}
        onChangeText={(text) => setForm((prev) => ({ ...prev, pause_reports_24h: text }))}
      />
      <FieldInput
        label="Auto-pause threshold (lifetime reports)"
        hint="A listing/seller is auto-paused once it receives this many reports total"
        value={form.pause_reports_lifetime}
        onChangeText={(text) => setForm((prev) => ({ ...prev, pause_reports_lifetime: text }))}
      />

      <Pressable
        style={[styles.primaryBtn, saving && styles.disabled]}
        onPress={() => void save()}
        disabled={saving || showLoadingBanner}
      >
        {saving ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.primaryBtnText}>Save platform settings</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  container: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  section: {
    marginTop: spacing.md,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  field: { gap: spacing.xs },
  label: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.text },
  hint: { fontSize: fontSize.caption, color: colors.textSecondary },
  statusText: { fontSize: fontSize.body, color: colors.textSecondary },
  errorText: {
    fontSize: fontSize.body,
    color: colors.error,
    textAlign: 'center',
    lineHeight: 22,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.body,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  errorBanner: {
    backgroundColor: colors.errorMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
  },
  retryBtnText: { color: colors.onPrimary, fontWeight: fontWeight.semibold, fontSize: fontSize.caption },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    alignSelf: 'stretch',
  },
  primaryBtnText: { color: colors.onPrimary, fontWeight: fontWeight.bold },
  disabled: { opacity: 0.7 },
}));
