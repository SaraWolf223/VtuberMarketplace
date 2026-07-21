import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator, Alert, Platform } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useMfaStatus, useInvalidateMfaStatus } from '@/hooks/useMfaStatus';
import { enrollTotpFactor, verifyTotpFactor, unenrollTotpFactor, type TotpEnrollment } from '@/lib/auth/mfa';
import { userFacingErrorMessage } from '@/lib/user-facing-error';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

type Props = {
  /** Shows staff-specific copy explaining enrollment is required for admin/manager access. */
  mandatory?: boolean;
};

export function TotpSecurityManager({ mandatory = false }: Props): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const { data, isLoading, refetch } = useMfaStatus();
  const invalidateMfaStatus = useInvalidateMfaStatus();

  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [starting, setStarting] = useState(false);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [disabling, setDisabling] = useState(false);

  const startEnrollment = async () => {
    setStarting(true);
    try {
      const result = await enrollTotpFactor();
      setEnrollment(result);
    } catch (e) {
      Alert.alert('Could not start setup', userFacingErrorMessage(e, 'Try again in a moment.'));
    } finally {
      setStarting(false);
    }
  };

  const cancelEnrollment = async () => {
    if (!enrollment) return;
    setCancelling(true);
    try {
      await unenrollTotpFactor(enrollment.factorId);
    } catch {
      /* unverified factor cleanup is best-effort */
    } finally {
      setEnrollment(null);
      setCode('');
      setCancelling(false);
    }
  };

  const confirmEnrollment = async () => {
    if (!enrollment) return;
    setVerifying(true);
    try {
      await verifyTotpFactor(enrollment.factorId, code);
      setEnrollment(null);
      setCode('');
      await invalidateMfaStatus();
      await refetch();
      Alert.alert('Two-factor authentication enabled', 'Your account now requires a code from your authenticator app when you sign in.');
    } catch (e) {
      Alert.alert('Incorrect code', userFacingErrorMessage(e, 'That code is invalid or expired. Try again.'));
    } finally {
      setVerifying(false);
    }
  };

  const handleDisable = () => {
    if (!data?.verifiedFactor) return;
    Alert.alert(
      'Turn off two-factor authentication?',
      mandatory
        ? 'Admin and manager accounts require two-factor authentication. You will be asked to set it up again immediately.'
        : 'Your account will no longer require a code at sign-in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Turn off',
          style: 'destructive',
          onPress: () => void disableFactor(data.verifiedFactor!.id),
        },
      ]
    );
  };

  const disableFactor = async (factorId: string) => {
    setDisabling(true);
    try {
      await unenrollTotpFactor(factorId);
      await invalidateMfaStatus();
      await refetch();
    } catch (e) {
      Alert.alert('Could not turn off 2FA', userFacingErrorMessage(e, 'Try again in a moment.'));
    } finally {
      setDisabling(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (data?.verifiedFactor) {
    return (
      <View style={styles.card}>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, styles.statusDotOn]} />
          <Text style={styles.statusText}>Two-factor authentication is on</Text>
        </View>
        <Text style={styles.body}>
          {data.verifiedFactor.friendlyName
            ? `Authenticator "${data.verifiedFactor.friendlyName}" is`
            : 'An authenticator app is'}{' '}
          enrolled on this account. You&apos;ll be asked for a code from it each time you sign in on
          a new device or session.
        </Text>
        <Pressable
          style={[styles.dangerButton, disabling && styles.buttonDisabled]}
          onPress={handleDisable}
          disabled={disabling}
        >
          {disabling ? (
            <ActivityIndicator color={colors.error} />
          ) : (
            <Text style={styles.dangerButtonText}>Turn off two-factor authentication</Text>
          )}
        </Pressable>
      </View>
    );
  }

  if (enrollment) {
    return (
      <View style={styles.card}>
        <Text style={styles.stepTitle}>1. Scan this QR code</Text>
        <Text style={styles.body}>
          Open your authenticator app (Google Authenticator, Authy, 1Password, etc.) and scan the code
          below, or enter the secret manually.
        </Text>
        <View style={styles.qrWrap}>
          <QRCode value={enrollment.uri} size={180} backgroundColor={colors.surface} color={colors.text} />
        </View>
        <Text style={styles.secretLabel}>Manual entry code</Text>
        <Text style={styles.secret} selectable>
          {enrollment.secret}
        </Text>

        <Text style={styles.stepTitle}>2. Enter the 6-digit code</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={(t) => setCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
          placeholder="123456"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          maxLength={6}
          editable={!verifying}
        />
        <Pressable
          style={[styles.button, (verifying || code.length !== 6) && styles.buttonDisabled]}
          onPress={() => void confirmEnrollment()}
          disabled={verifying || code.length !== 6}
        >
          {verifying ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.buttonText}>Verify & enable</Text>
          )}
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => void cancelEnrollment()} disabled={cancelling}>
          <Text style={styles.secondaryText}>Cancel setup</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.statusRow}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>Two-factor authentication is off</Text>
      </View>
      <Text style={styles.body}>
        {mandatory
          ? 'Admin and manager accounts require an authenticator app code at sign-in. Set it up now to access the admin panel.'
          : "Add an authenticator app code to your sign-in for extra protection, even if someone learns your password."}
      </Text>
      <Pressable
        style={[styles.button, starting && styles.buttonDisabled]}
        onPress={() => void startEnrollment()}
        disabled={starting}
      >
        {starting ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.buttonText}>Set up two-factor authentication</Text>
        )}
      </Pressable>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  centered: { padding: spacing.xl, alignItems: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.textMuted,
  },
  statusDotOn: { backgroundColor: colors.success },
  statusText: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.text },
  body: { fontSize: fontSize.body, color: colors.textSecondary, lineHeight: 21 },
  stepTitle: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.text, marginTop: spacing.sm },
  qrWrap: {
    alignSelf: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    ...(Platform.OS === 'web' ? {} : { elevation: 0 }),
  },
  secretLabel: { fontSize: fontSize.caption, color: colors.textMuted, textTransform: 'uppercase' },
  secret: {
    fontSize: fontSize.body,
    fontFamily: 'monospace',
    color: colors.text,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    textAlign: 'center',
    letterSpacing: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.h2,
    textAlign: 'center',
    letterSpacing: 8,
    backgroundColor: colors.background,
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
  secondaryText: { color: colors.textSecondary, fontWeight: fontWeight.semibold, fontSize: fontSize.caption },
  dangerButton: {
    borderWidth: 1,
    borderColor: colors.error,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  dangerButtonText: { color: colors.error, fontWeight: fontWeight.semibold, fontSize: fontSize.body },
}));
