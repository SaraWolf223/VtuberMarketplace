import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator, Platform } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';
import { sendPasswordResetEmail } from '@/lib/auth/email-auth';
import { userFacingErrorMessage } from '@/lib/user-facing-error';
import { WebAuthHeader } from '@/components/web/WebAuthHeader';
import { useWebViewport } from '@/hooks/useWebViewport';
import { WEB_DESKTOP_CHROME_BG } from '@/constants/web-page-layout';

export default function ForgotPasswordScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const router = useRouter();
  const { isDesktopWeb } = useWebViewport();
  const desktopSignIn = Platform.OS === 'web' && isDesktopWeb;

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setFormError('Enter the email address on your account.');
      return;
    }
    setFormError(null);
    setLoading(true);
    try {
      await sendPasswordResetEmail(trimmed);
    } catch (e) {
      // Generic copy regardless of outcome — avoids confirming whether an
      // email is registered (account-enumeration hardening, Phase 9).
      if (__DEV__) {
        setFormError(userFacingErrorMessage(e, 'Could not send reset email'));
        return;
      }
    } finally {
      setLoading(false);
    }
    setSent(true);
  };

  return (
    <View style={[styles.screen, desktopSignIn && styles.screenDesktop]}>
      {!desktopSignIn ? <WebAuthHeader /> : null}
      <View style={[styles.container, desktopSignIn && styles.containerDesktop]}>
        <Text style={styles.title}>Reset your password</Text>
        {sent ? (
          <>
            <Text style={styles.sub}>
              If an account exists for {email.trim()}, a password reset link is on its way. Check
              your inbox and follow the link to choose a new password.
            </Text>
            <Pressable style={styles.button} onPress={() => router.replace('/(auth)/sign-in')}>
              <Text style={styles.buttonText}>Back to sign in</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.sub}>Enter your account email and we&apos;ll send you a reset link.</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                if (formError) setFormError(null);
              }}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
            {formError ? <Text style={styles.error}>{formError}</Text> : null}
            <Pressable
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={() => void submit()}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.buttonText}>Send reset link</Text>
              )}
            </Pressable>
            <Link href="/(auth)/sign-in" style={styles.back}>
              <Text style={styles.backText}>Back to sign in</Text>
            </Link>
          </>
        )}
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  screenDesktop: {
    backgroundColor: WEB_DESKTOP_CHROME_BG,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, justifyContent: 'center', gap: spacing.md },
  containerDesktop: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 440,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 8px 30px rgba(0, 0, 0, 0.10)' } as object) : {}),
  },
  title: { fontSize: fontSize.h1, fontWeight: fontWeight.bold, color: colors.text },
  sub: { fontSize: fontSize.body, color: colors.textSecondary, lineHeight: 22 },
  error: { fontSize: fontSize.caption, color: colors.error, lineHeight: 18 },
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
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: colors.onPrimary, fontWeight: fontWeight.semibold, fontSize: fontSize.body },
  back: { alignSelf: 'center', marginTop: spacing.md },
  backText: { color: colors.primary, fontSize: fontSize.caption },
}));
