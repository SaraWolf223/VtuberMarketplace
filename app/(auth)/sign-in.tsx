import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';
import {
  signInWithGoogle,
  getAuthRedirectUri,
  getSupabaseRedirectAllowList,
  waitForSupabaseSession,
} from '@/lib/auth/google-oauth';
import { isNativeGoogleSignInAvailable } from '@/lib/auth/google-native-availability';
import { signInWithApple, isAppleSignInAvailable } from '@/lib/auth/apple-auth';
import { signInWithEmailPassword } from '@/lib/auth/email-auth';
import { legalDocumentHref } from '@/lib/legal-navigation';
import { userFacingErrorMessage } from '@/lib/user-facing-error';
import { isSupabaseConfigured } from '@/lib/supabase';
import { WebAuthHeader } from '@/components/web/WebAuthHeader';
import { WebAppLogo } from '@/components/web/WebAppLogo';
import { useWebViewport } from '@/hooks/useWebViewport';
import { WEB_DESKTOP_CHROME_BG } from '@/constants/web-page-layout';
import { useAppConfigStore } from '@/stores/app-config-store';

export default function SignInScreen(): React.JSX.Element {
  const styles = useStyles();
  const appDisplayName = useAppConfigStore((state) => state.config.appDisplayName);
  const colors = useThemeColors();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [nativeLoading, setNativeLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const showNative = isNativeGoogleSignInAvailable();
  const showApple = isAppleSignInAvailable();
  const { isDesktopWeb } = useWebViewport();
  const desktopSignIn = Platform.OS === 'web' && isDesktopWeb;
  const anyLoading = loading || nativeLoading || appleLoading || emailLoading;

  const ensureAgreed = (): boolean => {
    if (agreedToTerms) return true;
    Alert.alert(
      'Accept terms to continue',
      'Check the box to agree to our Terms of Service and Privacy Policy before signing in.'
    );
    return false;
  };
  const handleGoogleSignIn = async () => {
    if (!ensureAgreed()) return;
    if (!isSupabaseConfigured) {
      Alert.alert('Setup required', 'Add Supabase URL and anon key to your .env file.');
      return;
    }

    setLoading(true);
    try {
      await signInWithGoogle();
      if (await waitForSupabaseSession(3000)) {
        router.replace('/');
        return;
      }
      router.replace('/(auth)/callback');
    } catch (e) {
      if (await waitForSupabaseSession(3000)) {
        router.replace('/');
        return;
      }
      const message = userFacingErrorMessage(e, 'Sign-in failed. Try again in a moment.');
      if (__DEV__) {
        const redirect = getAuthRedirectUri();
        const allowList = getSupabaseRedirectAllowList().join('\n');
        Alert.alert(
          'Google sign-in',
          `${message}\n\nSupabase → Auth → URL Configuration:\n` +
            `Site URL: ${redirect}\n` +
            `Redirect URLs:\n${allowList}\n\n` +
            `A blank page at supabase.co means the redirect URL is not on that list.`
        );
      } else {
        Alert.alert('Google sign-in', message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    if (!ensureAgreed()) return;
    setAppleLoading(true);
    try {
      await signInWithApple();
      router.replace('/');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Sign-in failed';
      if (!message.toLowerCase().includes('cancel')) {
        Alert.alert('Apple sign-in', userFacingErrorMessage(e, 'Sign-in failed. Try again.'));
      }
    } finally {
      setAppleLoading(false);
    }
  };

  const handleEmailSignIn = async () => {
    // Unlike Google/Apple (which create a brand-new account on first use),
    // email/password sign-in can only authenticate an account that already
    // exists — new accounts go through the separate sign-up form's own terms
    // checkbox. Returning users already agreed once; the backend's
    // TermsAcceptanceGate/accept_platform_terms flow re-prompts them post-login
    // if the terms version has since changed, so gating this button on a
    // fresh re-tick every sign-in was just unnecessary friction.
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      Alert.alert('Missing info', 'Enter your email and password.');
      return;
    }
    setEmailLoading(true);
    try {
      await signInWithEmailPassword(trimmedEmail, password);
      router.replace('/');
    } catch (e) {
      Alert.alert('Sign-in failed', userFacingErrorMessage(e, 'Check your email and password and try again.'));
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <View style={[styles.screen, desktopSignIn && styles.screenDesktop]}>
      {!desktopSignIn ? <WebAuthHeader /> : null}
      <View style={[styles.container, desktopSignIn && styles.containerDesktop]}>
      {desktopSignIn ? (
        <View style={styles.cardLogo}>
          <WebAppLogo prominent />
        </View>
      ) : null}
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.sub}>
        Continue with Google{showApple ? ', Apple,' : ''} or your email and password.
      </Text>
      {__DEV__ ? (
        <Text style={styles.devHint} selectable>
          Supabase redirect URL: {getAuthRedirectUri()}
        </Text>
      ) : null}
      <Pressable
        style={styles.checkboxRow}
        onPress={() => setAgreedToTerms((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: agreedToTerms }}
      >
        <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
          {agreedToTerms ? <Text style={styles.checkmark}>✓</Text> : null}
        </View>
        <Text style={styles.checkboxLabel}>
          I am at least 18 and agree to the{' '}
          <Text
            style={styles.legalLink}
            onPress={() => router.push(legalDocumentHref('terms'))}
          >
            Terms
          </Text>{' '}
          and{' '}
          <Text
            style={styles.legalLink}
            onPress={() => router.push(legalDocumentHref('privacy'))}
          >
            Privacy Policy
          </Text>
          .
        </Text>
      </Pressable>
      <Pressable
        testID="sign-in-google-button"
        style={[styles.button, (anyLoading || !agreedToTerms) && styles.buttonDisabled]}
        onPress={handleGoogleSignIn}
        disabled={anyLoading || !agreedToTerms}
      >
        {loading ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.buttonText}>Continue with Google</Text>
        )}
      </Pressable>
      {showNative ? (
        <Pressable
          style={[styles.nativeButton, anyLoading && styles.buttonDisabled]}
          onPress={async () => {
            if (!ensureAgreed()) return;
            setNativeLoading(true);
            try {
              const { signInWithGoogleNative } = await import('@/lib/auth/google-native');
              await signInWithGoogleNative();
              router.replace('/');
            } catch (e) {
              Alert.alert(
                'Native Google sign-in',
                e instanceof Error ? e.message : 'Sign-in failed'
              );
            } finally {
              setNativeLoading(false);
            }
          }}
          disabled={anyLoading || !agreedToTerms}
        >
          {nativeLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.nativeButtonText}>Use native Google sign-in</Text>
          )}
        </Pressable>
      ) : null}
      {showApple ? (
        <Pressable
          testID="sign-in-apple-button"
          style={[styles.appleButton, (anyLoading || !agreedToTerms) && styles.buttonDisabled]}
          onPress={() => void handleAppleSignIn()}
          disabled={anyLoading || !agreedToTerms}
        >
          {appleLoading ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.appleButtonText}> Sign in with Apple</Text>
          )}
        </Pressable>
      ) : null}

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!anyLoading}
      />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        autoCapitalize="none"
        editable={!anyLoading}
      />
      <Pressable
        style={[styles.nativeButton, anyLoading && styles.buttonDisabled]}
        onPress={() => void handleEmailSignIn()}
        disabled={anyLoading}
      >
        {emailLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.nativeButtonText}>Sign in with email</Text>
        )}
      </Pressable>
      <Link href="/(auth)/forgot-password" style={styles.forgotLink}>
        <Text style={styles.backText}>Forgot password?</Text>
      </Link>
      <Link href="/(auth)/sign-up" style={styles.back}>
        <Text style={styles.backText}>Don&apos;t have an account? Create one</Text>
      </Link>
      <Link href="/(auth)/onboarding" style={styles.back}>
        <Text style={styles.backText}>What is {appDisplayName}?</Text>
      </Link>
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenDesktop: {
    backgroundColor: WEB_DESKTOP_CHROME_BG,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: spacing.md,
  },
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
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 8px 30px rgba(0, 0, 0, 0.10)' } as object)
      : {}),
  },
  cardLogo: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.h1,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  sub: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
  },
  devHint: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.onPrimary,
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.body,
  },
  nativeButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  nativeButtonText: {
    color: colors.primary,
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.body,
  },
  appleButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.text,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  appleButtonText: {
    color: colors.background,
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.body,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textMuted, fontSize: fontSize.caption },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.body,
    backgroundColor: colors.surface,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  forgotLink: { alignSelf: 'flex-end', marginTop: spacing.xs },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
  },
  checkmark: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: fontWeight.bold,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  legalLink: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  back: { alignSelf: 'center', marginTop: spacing.md },
  backText: { color: colors.primary, fontSize: fontSize.caption },
}));
