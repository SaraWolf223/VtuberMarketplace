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
  ScrollView,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';
import { signUpWithEmailPassword, validatePassword, MIN_PASSWORD_LENGTH } from '@/lib/auth/email-auth';
import { legalDocumentHref } from '@/lib/legal-navigation';
import { userFacingErrorMessage } from '@/lib/user-facing-error';
import { isSupabaseConfigured } from '@/lib/supabase';
import { TurnstileWidget } from '@/components/auth/TurnstileWidget';
import { WebAuthHeader } from '@/components/web/WebAuthHeader';
import { WebAppLogo } from '@/components/web/WebAppLogo';
import { useWebViewport } from '@/hooks/useWebViewport';
import { WEB_DESKTOP_CHROME_BG } from '@/constants/web-page-layout';

export default function SignUpScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const router = useRouter();
  const { isDesktopWeb } = useWebViewport();
  const desktopSignIn = Platform.OS === 'web' && isDesktopWeb;

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');

  const handleSignUp = async () => {
    if (!agreedToTerms) {
      Alert.alert(
        'Accept terms to continue',
        'Check the box to agree to our Terms of Service and Privacy Policy before creating an account.'
      );
      return;
    }
    if (!isSupabaseConfigured) {
      Alert.alert('Setup required', 'Add Supabase URL and anon key to your .env file.');
      return;
    }
    const trimmedName = displayName.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      Alert.alert('Name required', 'Enter the name shown on your seller profile.');
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      Alert.alert('Email required', 'Enter a valid email address.');
      return;
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      Alert.alert('Weak password', passwordError);
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Re-enter your password to confirm.');
      return;
    }

    setLoading(true);
    try {
      const result = await signUpWithEmailPassword({
        email: trimmedEmail,
        password,
        displayName: trimmedName,
        captchaToken,
      });
      if (result.needsEmailConfirmation) {
        setConfirmationSent(true);
      } else {
        router.replace('/');
      }
    } catch (e) {
      const message = userFacingErrorMessage(e, 'Could not create your account. Try again.');
      Alert.alert('Sign-up failed', message);
    } finally {
      setLoading(false);
    }
  };

  if (confirmationSent) {
    return (
      <View style={[styles.screen, desktopSignIn && styles.screenDesktop]}>
        {!desktopSignIn ? <WebAuthHeader /> : null}
        <View style={[styles.container, desktopSignIn && styles.containerDesktop]}>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.sub}>
            We sent a confirmation link to {email.trim()}. Click it, then come back and sign in.
          </Text>
          <Pressable style={styles.button} onPress={() => router.replace('/(auth)/sign-in')}>
            <Text style={styles.buttonText}>Back to sign in</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.screen, desktopSignIn && styles.screenDesktopBg]}
      contentContainerStyle={desktopSignIn ? styles.contentDesktop : { flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
      {!desktopSignIn ? <WebAuthHeader /> : null}
      <View style={[styles.container, desktopSignIn && styles.containerDesktop]}>
        {desktopSignIn ? (
          <View style={styles.cardLogo}>
            <WebAppLogo prominent />
          </View>
        ) : null}
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.sub}>Buy and sell locally with an email and password.</Text>

        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Shown on your seller profile"
          autoCapitalize="words"
          editable={!loading}
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          secureTextEntry
          autoCapitalize="none"
          editable={!loading}
        />

        <Text style={styles.label}>Confirm password</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Re-enter your password"
          secureTextEntry
          autoCapitalize="none"
          editable={!loading}
        />

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
            <Text style={styles.legalLink} onPress={() => router.push(legalDocumentHref('terms'))}>
              Terms
            </Text>{' '}
            and{' '}
            <Text style={styles.legalLink} onPress={() => router.push(legalDocumentHref('privacy'))}>
              Privacy Policy
            </Text>
            .
          </Text>
        </Pressable>

        <TurnstileWidget onToken={setCaptchaToken} />

        <Pressable
          style={[styles.button, (loading || !agreedToTerms) && styles.buttonDisabled]}
          onPress={() => void handleSignUp()}
          disabled={loading || !agreedToTerms}
        >
          {loading ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.buttonText}>Create account</Text>
          )}
        </Pressable>

        <Link href="/(auth)/sign-in" style={styles.back}>
          <Text style={styles.backText}>Already have an account? Sign in</Text>
        </Link>
      </View>
    </ScrollView>
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
  // react-native-web's ScrollView forbids alignItems/justifyContent on `style`
  // (must go through contentContainerStyle) — split out for the ScrollView
  // root below; screenDesktop above is still used as-is for the plain `View`
  // confirmation screen.
  screenDesktopBg: { backgroundColor: WEB_DESKTOP_CHROME_BG },
  contentDesktop: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.sm,
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
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 8px 30px rgba(0, 0, 0, 0.10)' } as object) : {}),
  },
  cardLogo: { alignItems: 'center', marginBottom: spacing.md },
  title: { fontSize: fontSize.h1, fontWeight: fontWeight.bold, color: colors.text },
  sub: { fontSize: fontSize.body, color: colors.textSecondary, marginBottom: spacing.xs },
  label: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.textMuted, marginTop: spacing.xs },
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
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.sm },
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
  checkboxChecked: { backgroundColor: colors.primary },
  checkmark: { color: colors.onPrimary, fontSize: 14, fontWeight: fontWeight.bold },
  checkboxLabel: { flex: 1, fontSize: fontSize.caption, color: colors.textSecondary, lineHeight: 18 },
  legalLink: { color: colors.primary, textDecorationLine: 'underline' },
  back: { alignSelf: 'center', marginTop: spacing.md },
  backText: { color: colors.primary, fontSize: fontSize.caption },
}));
