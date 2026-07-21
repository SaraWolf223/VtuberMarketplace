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
  boost_duration_hours: string;
  boost_base_cents: string;
  reports_per_hour: string;
  pause_reports_24h: string;
  pause_reports_lifetime: string;
};

function toForm(settings: Record<string, number>): SettingsForm {
  return {
    boost_duration_hours: String(settings.boost_duration_hours ?? 24),
    boost_base_cents: String(settings.boost_base_cents ?? 100),
    reports_per_hour: String(settings.reports_per_hour ?? 5),
    pause_reports_24h: String(settings.pause_reports_24h ?? 10),
    pause_reports_lifetime: String(settings.pause_reports_lifetime ?? 50),
  };
}

function parseForm(form: SettingsForm): Record<string, number> {
  return {
    boost_duration_hours: parseInt(form.boost_duration_hours, 10) || 24,
    boost_base_cents: parseInt(form.boost_base_cents, 10) || 100,
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
  const [form, setForm] = useState<SettingsForm>(() =>
    toForm(DEFAULT_ADMIN_PLATFORM_SETTINGS)
  );
  const [saving, setSaving] = useState(false);

  const appConfig = useAppConfigStore((s) => s.config);
  const [radiusOptionsText, setRadiusOptionsText] = useState(() =>
    appConfig.feedRadiusOptions.join(', ')
  );
  const [maxRadiusText, setMaxRadiusText] = useState(() => String(appConfig.maxRadiusMiles));
  const [savingRadius, setSavingRadius] = useState(false);

  useEffect(() => {
    setRadiusOptionsText(appConfig.feedRadiusOptions.join(', '));
    setMaxRadiusText(String(appConfig.maxRadiusMiles));
  }, [appConfig.feedRadiusOptions, appConfig.maxRadiusMiles]);

  const saveRadius = async () => {
    if (!token) return;
    const feedRadiusOptions = radiusOptionsText
      .split(',')
      .map((s) => parseFloat(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    const maxRadiusMiles = parseFloat(maxRadiusText);
    if (feedRadiusOptions.length === 0 || !Number.isFinite(maxRadiusMiles) || maxRadiusMiles <= 0) {
      Alert.alert('Error', 'Enter valid, comma-separated radius options and a max radius.');
      return;
    }
    setSavingRadius(true);
    try {
      await updatePublicAppConfig(token, { feedRadiusOptions, maxRadiusMiles });
      const fresh = await fetchPublicAppConfig();
      useAppConfigStore.getState().setConfig(fresh);
      Alert.alert('Saved', 'Feed radius options updated for all users.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save radius options');
    } finally {
      setSavingRadius(false);
    }
  };

  const settingsQuery = useQuery({
    queryKey: queryKeys.adminSettings,
    enabled: !!token,
    queryFn: () => fetchPlatformSettings(token),
    retry: 1,
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setForm(toForm(settingsQuery.data));
    }
  }, [settingsQuery.data]);

  const save = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const updated = await updatePlatformSettings(token, parseForm(form));
      setForm(toForm(updated));
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

      <Text style={styles.section}>Boost defaults</Text>
      <FieldInput
        label="Boost duration (hours)"
        hint="Applies to new boosts"
        value={form.boost_duration_hours}
        onChangeText={(text) => setForm((prev) => ({ ...prev, boost_duration_hours: text }))}
      />
      <FieldInput
        label="Boost base price (cents)"
        hint={`Display/checkout base before Stripe fees (${formatUsdFromCents(parseInt(form.boost_base_cents, 10) || 100)})`}
        value={form.boost_base_cents}
        onChangeText={(text) => setForm((prev) => ({ ...prev, boost_base_cents: text }))}
      />

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
          <Text style={styles.primaryBtnText}>Save settings</Text>
        )}
      </Pressable>

      <Text style={styles.section}>Feed radius options</Text>
      <View style={styles.field}>
        <Text style={styles.label}>Distance chips (miles, comma-separated)</Text>
        <Text style={styles.hint}>Shown to users when picking a search radius, e.g. 0.5, 1, 2, 5, 10, 25, 50</Text>
        <TextInput
          style={styles.input}
          value={radiusOptionsText}
          onChangeText={setRadiusOptionsText}
          placeholder="0.5, 1, 2, 5, 10, 25, 50"
        />
      </View>
      <FieldInput
        label="Max radius (miles)"
        hint="Hard cap enforced server-side — must be ≥ the largest chip above"
        value={maxRadiusText}
        onChangeText={setMaxRadiusText}
      />
      <Pressable
        style={[styles.primaryBtn, savingRadius && styles.disabled]}
        onPress={() => void saveRadius()}
        disabled={savingRadius}
      >
        {savingRadius ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.primaryBtnText}>Save radius options</Text>
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
