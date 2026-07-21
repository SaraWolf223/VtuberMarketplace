import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useAuthContext } from '@/providers/AuthProvider';
import { useLocationPrefs } from '@/hooks/useLocationPrefs';
import {
  saveLocationPrefs,
  invalidateFeedQueries,
} from '@/features/profile/prefs-service';
import { getCachedHomeZip } from '@/stores/prefs-store';
import { formatRadiusLabel, parseRadiusMiles } from '@/types/enums';
import { useRadiusOptions } from '@/hooks/useRadiusOptions';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

type LocationSetupScreenProps = {
  /** First-time onboarding at root `/location-setup` (not settings sub-stack). */
  isOnboarding?: boolean;
};

export function LocationSetupScreen({
  isOnboarding = false,
}: LocationSetupScreenProps): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, session } = useAuth();
  const { markLocationPrefsSaved, hasLocationPrefs } = useAuthContext();
  const { homeZip: storedZip, radiusMiles: storedRadius, setRadiusMiles } = useLocationPrefs();
  const radiusOptions = useRadiusOptions();
  const [zip, setZip] = useState(storedZip);
  const [radiusMiles, setRadiusLocal] = useState<number>(parseRadiusMiles(storedRadius, radiusOptions));
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (storedZip) setZip(storedZip);
    // Clamp through the same options list as the initial state (below) — a
    // radius saved before the admin lowered the max/options list would
    // otherwise select a value no chip matches and the server will reject.
    setRadiusLocal(parseRadiusMiles(storedRadius, radiusOptions));
  }, [storedZip, storedRadius, radiusOptions]);

  useEffect(() => {
    if (!hasLocationPrefs || !isOnboarding) return;
    const cleaned = storedZip.replace(/\D/g, '').slice(0, 5) || getCachedHomeZip();
    if (cleaned.length === 5) {
      router.replace('/');
    }
  }, [hasLocationPrefs, storedZip, router, isOnboarding]);

  const selectRadius = (r: number) => {
    setRadiusLocal(r);
    setRadiusMiles(r);
  };

  const saveLocation = async () => {
    const cleaned = zip.replace(/\D/g, '').slice(0, 5);
    if (cleaned.length !== 5) {
      Alert.alert('ZIP code', 'Enter a valid 5-digit US ZIP code.');
      return;
    }
    if (!user || !session?.access_token) {
      Alert.alert('Sign in required', 'Please sign out and sign in again.');
      return;
    }

    setLoading(true);
    setErrorText(null);
    try {
      setStatus('Looking up ZIP…');
      const geo = await saveLocationPrefs({
        accessToken: session.access_token,
        homeZip: cleaned,
        radiusMiles,
      });

      invalidateFeedQueries(queryClient, user.id);
      markLocationPrefsSaved();

      const place =
        geo.city && geo.state ? `${geo.city}, ${geo.state}` : geo.city || geo.state || cleaned;

      setLoading(false);

      if (!isOnboarding && router.canGoBack()) {
        Alert.alert('Location saved', `Showing listings near ${place}.`, [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        setStatus('Opening app…');
        router.replace('/');
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not save location';
      setErrorText(message);
      setStatus(null);
      Alert.alert('Could not save ZIP', message);
      setLoading(false);
    }
  };

  const showUpdateCopy = hasLocationPrefs && !isOnboarding;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {showUpdateCopy ? 'Update home ZIP' : 'Set your home ZIP'}
      </Text>
      <Text style={styles.sub}>
        {showUpdateCopy
          ? 'Change where you browse local listings. Saved to your account.'
          : 'One-time setup — listings are filtered by distance from your ZIP.'}
      </Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 10001"
        keyboardType="number-pad"
        maxLength={5}
        value={zip}
        onChangeText={setZip}
        editable={!loading}
      />
      <Text style={styles.label}>Search radius</Text>
      <View style={styles.chips}>
        {radiusOptions.map((r) => (
          <Pressable
            key={r}
            style={[styles.chip, radiusMiles === r && styles.chipActive]}
            onPress={() => selectRadius(r)}
            disabled={loading}
          >
            <Text style={[styles.chipText, radiusMiles === r && styles.chipTextActive]}>
              {formatRadiusLabel(r)}
            </Text>
          </Pressable>
        ))}
      </View>
      {status ? <Text style={styles.status}>{status}</Text> : null}
      {errorText ? <Text style={styles.error}>{errorText}</Text> : null}
      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={saveLocation}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.buttonText}>{showUpdateCopy ? 'Save ZIP' : 'Continue'}</Text>
        )}
      </Pressable>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: { fontSize: fontSize.h1, fontWeight: fontWeight.bold, color: colors.text },
  sub: { fontSize: fontSize.body, color: colors.textSecondary },
  label: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  chipText: {
    fontSize: fontSize.body,
    color: colors.text,
    fontWeight: fontWeight.semibold,
  },
  chipTextActive: {
    color: colors.onPrimary,
  },
  status: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
  },
  error: {
    fontSize: fontSize.caption,
    color: colors.error,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.8 },
  buttonText: { color: colors.onPrimary, fontWeight: fontWeight.semibold },
}));
