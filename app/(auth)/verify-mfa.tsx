import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useMfaStatus, useInvalidateMfaStatus } from '@/hooks/useMfaStatus';
import { verifyTotpFactor } from '@/lib/auth/mfa';
import { userFacingErrorMessage } from '@/lib/user-facing-error';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

export default function VerifyMfaScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const router = useRouter();
  const { signOut } = useAuth();
  const { data, isLoading } = useMfaStatus();
  const invalidateMfaStatus = useInvalidateMfaStatus();

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const factorId = data?.verifiedFactor?.id;

  const submit = async () => {
    if (!factorId) {
      Alert.alert('No authenticator found', 'Sign out and sign back in to try again.');
      return;
    }
    setVerifying(true);
    try {
      await verifyTotpFactor(factorId, code);
      await invalidateMfaStatus();
      setCode('');
      router.replace('/');
    } catch (e) {
      Alert.alert('Incorrect code', userFacingErrorMessage(e, 'That code is invalid or expired. Try again.'));
    } finally {
      setVerifying(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter your authentication code</Text>
      <Text style={styles.sub}>
        Two-factor authentication is enabled on this account. Open your authenticator app and enter
        the 6-digit code to continue.
      </Text>
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={(t) => setCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
        placeholder="123456"
        keyboardType="number-pad"
        autoComplete="one-time-code"
        maxLength={6}
        editable={!verifying}
      />
      <Pressable
        style={[styles.button, (verifying || code.length !== 6) && styles.buttonDisabled]}
        onPress={() => void submit()}
        disabled={verifying || code.length !== 6}
      >
        {verifying ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.buttonText}>Verify</Text>}
      </Pressable>
      <Pressable style={styles.secondary} onPress={() => void handleSignOut()} disabled={signingOut}>
        {signingOut ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.secondaryText}>Lost access to your authenticator? Sign out</Text>
        )}
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
  sub: { fontSize: fontSize.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.h2,
    textAlign: 'center',
    letterSpacing: 8,
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
  secondary: { alignItems: 'center', paddingVertical: spacing.sm },
  secondaryText: { color: colors.primary, fontWeight: fontWeight.semibold, fontSize: fontSize.caption },
}));
