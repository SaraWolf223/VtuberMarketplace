import { useState } from 'react';
import {
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { isPhoneVerified } from '@/hooks/usePhoneVerification';
import { markPhoneVerifiedStub } from '@/features/messages/dm-service';
import {
  sendPhoneVerificationOtp,
  verifyPhoneOtpAndSyncProfile,
} from '@/features/phone/phone-verification-service';
import { formatPhoneDisplay } from '@/utils/phone-e164';
import { queryKeys } from '@/lib/query-keys';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

type Step = 'phone' | 'code';

export default function VerifyPhoneScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session, user } = useAuth();
  const { data: profile, refetch } = useProfile();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [e164, setE164] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const verified = isPhoneVerified(profile);
  const token = session?.access_token ?? '';

  const invalidateProfile = async () => {
    if (!user?.id) return;
    await refetch();
    await queryClient.invalidateQueries({ queryKey: queryKeys.profile(user.id) });
  };

  const onSendCode = async () => {
    setLoading(true);
    try {
      const normalized = await sendPhoneVerificationOtp(phone);
      setE164(normalized);
      setStep('code');
      Alert.alert('Code sent', `We texted a 6-digit code to ${formatPhoneDisplay(normalized)}.`);
    } catch (e) {
      Alert.alert('Could not send code', e instanceof Error ? e.message : 'Try again');
    } finally {
      setLoading(false);
    }
  };

  const onVerifyCode = async () => {
    if (!token) return;
    setLoading(true);
    try {
      await verifyPhoneOtpAndSyncProfile(e164 || phone, code, token);
      await invalidateProfile();
      Alert.alert('Phone verified', 'You can publish listings, send messages, and use paid features.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Verification failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setLoading(false);
    }
  };

  const onStubVerify = async () => {
    setLoading(true);
    try {
      await markPhoneVerifiedStub(token, phone.trim() || undefined);
      await invalidateProfile();
      Alert.alert('Phone verified (dev)', 'Stub verification enabled for testing.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert(
        'Dev stub unavailable',
        e instanceof Error
          ? `${e.message}\n\nDeploy dev-mark-phone-verified and set ALLOW_DEV_PHONE_STUB=true in Supabase, or use SMS verification.`
          : 'Stub verification is disabled in production builds.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {verified ? (
          <>
            <Text style={styles.title}>Phone verified</Text>
            <Text style={styles.sub}>
              {profile?.phone
                ? formatPhoneDisplay(profile.phone)
                : 'Your phone is verified.'}{' '}
              You can publish listings, send messages, boost listings, and subscribe to Premium.
            </Text>
          </>
        ) : step === 'phone' ? (
          <>
            <Text style={styles.title}>Verify your phone</Text>
            <Text style={styles.sub}>
              SMS verification is required before you can publish listings, send messages, boost
              listings, or subscribe to Premium. Browsing and favorites do not require verification.
            </Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="555 123 4567"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
            />
            <Pressable style={styles.btn} onPress={onSendCode} disabled={loading || !phone.trim()}>
              {loading ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.btnText}>Send verification code</Text>
              )}
            </Pressable>
            {__DEV__ ? (
              <Pressable style={styles.devBtn} onPress={onStubVerify} disabled={loading}>
                <Text style={styles.devBtnText}>Dev: skip SMS (testing only)</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.title}>Enter your code</Text>
            <Text style={styles.sub}>
              Code sent to {formatPhoneDisplay(e164)}. Standard SMS rates may apply.
            </Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              placeholder="6-digit code"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={6}
              autoComplete="sms-otp"
              textContentType="oneTimeCode"
            />
            <Pressable
              style={styles.btn}
              onPress={onVerifyCode}
              disabled={loading || code.replace(/\D/g, '').length < 6}
            >
              {loading ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.btnText}>Verify</Text>
              )}
            </Pressable>
            <Pressable
              style={styles.linkBtn}
              onPress={() => {
                setStep('phone');
                setCode('');
              }}
              disabled={loading}
            >
              <Text style={styles.linkText}>Use a different number</Text>
            </Pressable>
            <Pressable style={styles.linkBtn} onPress={onSendCode} disabled={loading}>
              <Text style={styles.linkText}>Resend code</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  title: { fontSize: fontSize.h2, fontWeight: fontWeight.bold, color: colors.text },
  sub: { fontSize: fontSize.body, color: colors.textSecondary, lineHeight: 22 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.body,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  btn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  btnText: { color: colors.onPrimary, fontWeight: fontWeight.semibold },
  linkBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  linkText: { color: colors.primary, fontWeight: fontWeight.semibold },
  devBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  devBtnText: { color: colors.textMuted, fontSize: fontSize.caption },
}));
