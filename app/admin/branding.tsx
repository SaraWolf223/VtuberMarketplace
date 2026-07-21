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
import { Image } from 'expo-image';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useAppConfigStore } from '@/stores/app-config-store';
import { fetchPublicAppConfig, updatePublicAppConfig, uploadBrandingLogo } from '@/features/app-config/app-config-service';
import { pickBrandingLogoFromLibrary, compressBrandingLogo, BRANDING_LOGO_MIME } from '@/lib/branding-logo-image';
import { BRANDING_LOGO_LIMITS_LABEL } from '@/constants/branding';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function ColorField(props: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
}): React.JSX.Element {
  const styles = useStyles();
  const valid = props.value === '' || HEX_RE.test(props.value);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <View style={styles.colorRow}>
        <View
          style={[
            styles.swatch,
            { backgroundColor: valid && props.value ? props.value : '#CCCCCC' },
          ]}
        />
        <TextInput
          style={[styles.input, styles.colorInput]}
          value={props.value}
          onChangeText={props.onChangeText}
          placeholder="#0066FF"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      {!valid ? <Text style={styles.hintError}>Use a 6-digit hex color like #0066FF</Text> : null}
    </View>
  );
}

export default function AdminBrandingScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const { session, isLoading: authLoading } = useAuth();
  const token = session?.access_token ?? '';
  const config = useAppConfigStore((s) => s.config);
  const [appDisplayName, setAppDisplayName] = useState(config.appDisplayName);
  const [supportEmail, setSupportEmail] = useState(config.supportEmail);
  const [primary, setPrimary] = useState(config.brandingColors.primary ?? '');
  const [primaryDark, setPrimaryDark] = useState(config.brandingColors.primaryDark ?? '');
  const [accent, setAccent] = useState(config.brandingColors.accent ?? '');
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetchPublicAppConfig()
      .then((fresh) => {
        useAppConfigStore.getState().setConfig(fresh);
        setAppDisplayName(fresh.appDisplayName);
        setSupportEmail(fresh.supportEmail);
        setPrimary(fresh.brandingColors.primary ?? '');
        setPrimaryDark(fresh.brandingColors.primaryDark ?? '');
        setAccent(fresh.brandingColors.accent ?? '');
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Could not load branding'));
  }, []);

  const chooseLogo = async () => {
    if (!token) return;
    try {
      const uri = await pickBrandingLogoFromLibrary();
      if (!uri) return;
      setUploadingLogo(true);
      const compressed = await compressBrandingLogo(uri);
      const logoUrl = await uploadBrandingLogo(token, compressed.uri, BRANDING_LOGO_MIME);
      useAppConfigStore.getState().setConfig({ ...useAppConfigStore.getState().config, brandingLogoUrl: logoUrl });
      Alert.alert('Logo updated', 'The new logo now shows across the app and website.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const save = async () => {
    if (!token) return;
    for (const [label, value] of [
      ['Primary', primary],
      ['Primary dark', primaryDark],
      ['Accent', accent],
    ] as const) {
      if (value && !HEX_RE.test(value)) {
        Alert.alert('Invalid color', `${label} must be a 6-digit hex color like #0066FF`);
        return;
      }
    }
    setSaving(true);
    try {
      await updatePublicAppConfig(token, {
        appDisplayName,
        supportEmail,
        brandingColors: {
          ...(primary ? { primary } : {}),
          ...(primaryDark ? { primaryDark } : {}),
          ...(accent ? { accent } : {}),
        },
      });
      const fresh = await fetchPublicAppConfig();
      useAppConfigStore.getState().setConfig(fresh);
      await queryClient.invalidateQueries();
      Alert.alert('Saved', 'Branding updated across the app and website.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save branding');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!token) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Sign in required to edit branding.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}

      <Text style={styles.section}>Logo</Text>
      <View style={styles.logoRow}>
        {config.brandingLogoUrl ? (
          <Image source={{ uri: config.brandingLogoUrl }} style={styles.logoPreview} contentFit="contain" />
        ) : (
          <View style={[styles.logoPreview, styles.logoPreviewEmpty]}>
            <Text style={styles.hint}>No custom logo yet</Text>
          </View>
        )}
        <Pressable style={[styles.secondaryBtn, uploadingLogo && styles.disabled]} onPress={() => void chooseLogo()} disabled={uploadingLogo}>
          {uploadingLogo ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.secondaryBtnText}>Choose new logo</Text>
          )}
        </Pressable>
      </View>
      <Text style={styles.hint}>{BRANDING_LOGO_LIMITS_LABEL}</Text>
      <Text style={styles.hint}>
        This updates the logo shown in-app, in the web header, and on the landing page instantly.
        The app icon and splash screen shown before the app loads are separate — regenerate those
        with `npm run gen-assets:from-logo` and rebuild before resubmitting to the app stores.
      </Text>

      <Text style={styles.section}>App name</Text>
      <View style={styles.field}>
        <TextInput style={styles.input} value={appDisplayName} onChangeText={setAppDisplayName} maxLength={60} />
      </View>

      <Text style={styles.section}>Support email</Text>
      <View style={styles.field}>
        <TextInput
          style={styles.input}
          value={supportEmail}
          onChangeText={setSupportEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={120}
        />
      </View>

      <Text style={styles.section}>Brand colors</Text>
      <Text style={styles.hint}>
        Only these three accent colors are editable — backgrounds and text stay fixed so dark mode
        always stays readable.
      </Text>
      <ColorField label="Primary" value={primary} onChangeText={setPrimary} />
      <ColorField label="Primary (dark mode)" value={primaryDark} onChangeText={setPrimaryDark} />
      <ColorField label="Accent" value={accent} onChangeText={setAccent} />

      <Pressable style={[styles.primaryBtn, saving && styles.disabled]} onPress={() => void save()} disabled={saving}>
        {saving ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.primaryBtnText}>Save branding</Text>}
      </Pressable>
    </ScrollView>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, gap: spacing.md, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  section: { marginTop: spacing.md, fontSize: fontSize.caption, fontWeight: fontWeight.bold, color: colors.textMuted, textTransform: 'uppercase' },
  field: { gap: spacing.xs, marginBottom: spacing.sm },
  label: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.text },
  hint: { fontSize: fontSize.caption, color: colors.textSecondary, lineHeight: 18 },
  hintError: { fontSize: fontSize.caption, color: colors.error },
  errorText: { fontSize: fontSize.body, color: colors.error, textAlign: 'center', lineHeight: 22 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: fontSize.body, backgroundColor: colors.surface, color: colors.text },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  colorInput: { flex: 1 },
  swatch: { width: 36, height: 36, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  logoPreview: { width: 80, height: 80, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  logoPreviewEmpty: { justifyContent: 'center', alignItems: 'center', padding: spacing.xs },
  secondaryBtn: { borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, alignItems: 'center' },
  secondaryBtnText: { color: colors.primary, fontWeight: fontWeight.semibold },
  primaryBtn: { backgroundColor: colors.primary, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.lg, alignSelf: 'stretch' },
  primaryBtnText: { color: colors.onPrimary, fontWeight: fontWeight.bold },
  disabled: { opacity: 0.7 },
}));
