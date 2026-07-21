import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import {
  daysUntil,
  isCollegeBadgeActive,
  isInCollegeReverifyGrace,
  sendCollegeEmailCode,
  verifyCollegeEmailCode,
} from '@/features/college/college-badge-service';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

export default function VerifyCollegeEmailScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const { session, isSignedIn } = useAuth();
  const { data: profile, refetch } = useProfile();
  const queryClient = useQueryClient();
  const profileCollege = profile as {
    college_edu_email?: string | null;
    college_badge_expires_at?: string | null;
    college_reverify_deadline_at?: string | null;
  } | null;
  const [email, setEmail] = useState(profileCollege?.college_edu_email ?? '');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  if (!isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  const token = session?.access_token ?? '';
  const active = isCollegeBadgeActive(profileCollege?.college_badge_expires_at ?? null);
  const inGrace = isInCollegeReverifyGrace(
    profileCollege?.college_badge_expires_at,
    profileCollege?.college_reverify_deadline_at
  );
  const graceDaysLeft = daysUntil(profileCollege?.college_reverify_deadline_at);

  const onSend = async () => {
    setSending(true);
    try {
      await sendCollegeEmailCode(token, email.trim());
      Alert.alert('Code sent', 'Check your .edu inbox for a 6-digit code (expires in 15 minutes).');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not send code');
    } finally {
      setSending(false);
    }
  };

  const onVerify = async () => {
    setVerifying(true);
    try {
      await verifyCollegeEmailCode(token, email.trim(), code.trim());
      await refetch();
      if (profile?.id) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.profile(profile.id) });
      }
      Alert.alert('Verified', 'Your college student badge is active for one year.');
      setCode('');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not verify');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>College student badge</Text>
      <Text style={styles.sub}>
        Verify a .edu email to show the college student badge on your profile and listings.
        Re-verify once per year. If your badge expires, you have 10 days to re-verify or you
        lose the badge and must start over.
      </Text>

      {active ? (
        <View style={styles.statusBox}>
          <Text style={styles.statusTitle}>Badge active</Text>
          <Text style={styles.statusMeta}>
            Re-verify by {new Date(profileCollege!.college_badge_expires_at!).toLocaleDateString()}
          </Text>
          <Text style={styles.statusEmail}>{profileCollege?.college_edu_email}</Text>
        </View>
      ) : inGrace ? (
        <View style={[styles.statusBox, styles.graceBox]}>
          <Text style={styles.statusTitle}>Re-verification required</Text>
          <Text style={styles.expired}>
            Your badge is inactive. Verify your .edu email within{' '}
            {graceDaysLeft ?? 10} day{(graceDaysLeft ?? 10) === 1 ? '' : 's'} or your college
            verification will be removed.
          </Text>
          <Text style={styles.statusEmail}>{profileCollege?.college_edu_email}</Text>
        </View>
      ) : null}

      <Text style={styles.label}>.edu email</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="you@university.edu"
        placeholderTextColor={colors.textMuted}
      />

      <Pressable style={styles.button} onPress={onSend} disabled={sending}>
        {sending ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.buttonText}>Send verification code</Text>
        )}
      </Pressable>

      <Text style={styles.label}>6-digit code</Text>
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="123456"
        placeholderTextColor={colors.textMuted}
      />

      <Pressable style={styles.button} onPress={onVerify} disabled={verifying}>
        {verifying ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.buttonText}>Verify & activate badge</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: fontSize.h2, fontWeight: fontWeight.bold, color: colors.text },
  sub: { fontSize: fontSize.body, color: colors.textSecondary, lineHeight: 22 },
  label: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.text },
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
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonText: { color: colors.onPrimary, fontWeight: fontWeight.bold },
  statusBox: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  graceBox: { borderColor: colors.warning },
  statusTitle: { fontWeight: fontWeight.bold, color: colors.text },
  statusMeta: { color: colors.textSecondary, fontSize: fontSize.caption },
  statusEmail: { color: colors.textMuted, fontSize: fontSize.caption },
  expired: { color: colors.warning, fontSize: fontSize.body },
}));
