import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useURL } from 'expo-linking';
import * as Linking from 'expo-linking';
import {
  buildRecoveryCallbackUrl,
  createRecoverySessionFromUrl,
  isTrustedPasswordResetCallbackUrl,
} from '@/lib/auth/google-oauth';
import { completePasswordReset, validatePassword, MIN_PASSWORD_LENGTH } from '@/lib/auth/email-auth';
import { userFacingErrorMessage } from '@/lib/user-facing-error';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

const LINK_TIMEOUT_MS = 20_000;

export default function ResetPasswordScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const router = useRouter();
  const incomingUrl = useURL();
  const routeParams = useLocalSearchParams<{ code?: string | string[] }>();
  const handledRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    const complete = async () => {
      try {
        const url =
          Platform.OS === 'web' && typeof window !== 'undefined'
            ? window.location.href
            : buildRecoveryCallbackUrl(routeParams.code);
        if (url && isTrustedPasswordResetCallbackUrl(url)) {
          await createRecoverySessionFromUrl(url);
          setReady(true);
          return;
        }

        if (incomingUrl && isTrustedPasswordResetCallbackUrl(incomingUrl)) {
          await createRecoverySessionFromUrl(incomingUrl);
          setReady(true);
          return;
        }

        const linkSub = Linking.addEventListener('url', ({ url }) => {
          if (!isTrustedPasswordResetCallbackUrl(url)) return;
          void createRecoverySessionFromUrl(url)
            .then(() => setReady(true))
            .catch((e) => setLinkError(e instanceof Error ? e.message : 'Could not verify reset link'));
        });

        setTimeout(() => linkSub.remove(), LINK_TIMEOUT_MS);
      } catch (e) {
        setLinkError(userFacingErrorMessage(e, 'This reset link is invalid or expired. Request a new one.'));
      }
    };

    void complete();
  }, [incomingUrl, routeParams.code]);

  const submit = async () => {
    const passwordError = validatePassword(password);
    if (passwordError) {
      Alert.alert('Weak password', passwordError);
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Re-enter your new password to confirm.');
      return;
    }
    setSaving(true);
    try {
      await completePasswordReset(password);
      setDone(true);
    } catch (e) {
      Alert.alert('Could not update password', userFacingErrorMessage(e, 'Try requesting a new reset link.'));
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Password updated</Text>
        <Text style={styles.sub}>Your password has been changed.</Text>
        <Pressable style={styles.button} onPress={() => router.replace('/')}>
          <Text style={styles.buttonText}>Continue</Text>
        </Pressable>
      </View>
    );
  }

  if (linkError) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{linkError}</Text>
        <Pressable style={styles.button} onPress={() => router.replace('/(auth)/forgot-password')}>
          <Text style={styles.buttonText}>Request a new link</Text>
        </Pressable>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.sub}>Verifying reset link…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose a new password</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
        secureTextEntry
        autoCapitalize="none"
        editable={!saving}
      />
      <TextInput
        style={styles.input}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Re-enter your new password"
        secureTextEntry
        autoCapitalize="none"
        editable={!saving}
      />
      <Pressable style={[styles.button, saving && styles.buttonDisabled]} onPress={() => void submit()} disabled={saving}>
        {saving ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.buttonText}>Update password</Text>}
      </Pressable>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.md,
    maxWidth: 440,
    alignSelf: 'center',
    width: '100%',
  },
  title: { fontSize: fontSize.h1, fontWeight: fontWeight.bold, color: colors.text, textAlign: 'center' },
  sub: { fontSize: fontSize.body, color: colors.textSecondary, textAlign: 'center' },
  error: { fontSize: fontSize.body, color: colors.error, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.body,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: colors.onPrimary, fontWeight: fontWeight.semibold, fontSize: fontSize.body },
}));
