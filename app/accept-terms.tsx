import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useTermsAcceptance } from '@/hooks/useTermsAcceptance';
import { acceptPlatformTerms } from '@/features/legal/terms-acceptance-service';
import { LegalDocumentLinks } from '@/components/legal/LegalDocumentLinks';
import { CURRENT_TERMS_VERSION, PLATFORM_TERMS_SUMMARY } from '@/constants/legal';
import { queryKeys } from '@/lib/query-keys';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { userFacingErrorMessage } from '@/lib/user-facing-error';
import { fontSize, fontWeight } from '@/theme/typography';
import { useAppConfigStore } from '@/stores/app-config-store';

export default function AcceptTermsScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const appDisplayName = useAppConfigStore((state) => state.config.appDisplayName);
  const { session, isSignedIn, isLoading: authLoading, signOut } = useAuth();
  const { isLoading: termsLoading, needsAcceptance } = useTermsAcceptance();
  const { data: profile } = useProfile();
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!authLoading && !isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (!authLoading && !termsLoading && isSignedIn && !needsAcceptance) {
    return <Redirect href="/" />;
  }

  const handleAccept = async () => {
    const token = session?.access_token;
    if (!token) {
      Alert.alert('Session expired', 'Sign in again to continue.');
      return;
    }
    if (!checked) {
      Alert.alert('Accept required', 'Check the box to agree before continuing.');
      return;
    }

    setSubmitting(true);
    try {
      await acceptPlatformTerms(token);
      if (profile?.id) {
        queryClient.setQueryData(queryKeys.profile(profile.id), {
          ...profile,
          terms_accepted_at: new Date().toISOString(),
          terms_version: CURRENT_TERMS_VERSION,
        });
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile(profile?.id ?? 'none') });
      router.replace('/');
    } catch (e) {
      const message = userFacingErrorMessage(e, 'Try again in a moment.');
      Alert.alert(
        'Could not continue',
        __DEV__ &&
          (message.includes('accept_platform_terms') || message.includes('PROFILE'))
          ? `${message}\n\nIf this is a new install, run: npx supabase db push (migration 077).`
          : message
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || termsLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Welcome to {appDisplayName}</Text>
      <Text style={styles.body}>{PLATFORM_TERMS_SUMMARY}</Text>

      <View style={styles.card}>
        <LegalDocumentLinks showHeading={false} />
      </View>

      <Pressable
        style={styles.checkboxRow}
        onPress={() => setChecked((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
      >
        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
          {checked ? <Text style={styles.checkmark}>✓</Text> : null}
        </View>
        <Text style={styles.checkboxLabel}>
          I am at least 18 years old and agree to the Terms of Service, Privacy Policy, and
          Community Guidelines.
        </Text>
      </Pressable>

      <Pressable
        style={[styles.button, (!checked || submitting) && styles.buttonDisabled]}
        onPress={() => void handleAccept()}
        disabled={!checked || submitting}
      >
        {submitting ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.buttonText}>Agree and continue</Text>
        )}
      </Pressable>

      <Pressable
        style={styles.signOutBtn}
        onPress={() => void signOut()}
        disabled={submitting}
      >
        <Text style={styles.signOutText}>Sign out instead</Text>
      </Pressable>

      <Text style={styles.versionNote}>Legal version {CURRENT_TERMS_VERSION}</Text>
    </ScrollView>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  title: {
    fontSize: fontSize.h1,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  body: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
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
    fontSize: fontSize.body,
    color: colors.text,
    lineHeight: 22,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.onPrimary,
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.body,
  },
  signOutBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  signOutText: {
    color: colors.textSecondary,
    fontSize: fontSize.caption,
  },
  versionNote: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
}));
