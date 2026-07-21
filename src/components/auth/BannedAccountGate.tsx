import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, Linking } from 'react-native';
import { SUPPORT_EMAIL } from '@/constants/legal';
import { useAuth } from '@/hooks/useAuth';
import { ErrorRetry } from '@/components/ui/ErrorRetry';
import { useProfile } from '@/hooks/useProfile';
import { spacing } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';
import { useAppConfigStore } from '@/stores/app-config-store';

/** Signs out suspended accounts and blocks the UI until session clears. */
export function BannedAccountGate({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const appDisplayName = useAppConfigStore((state) => state.config.appDisplayName);
  const { isSignedIn, signOut } = useAuth();
  const { data: profile, isPending, isError, error, refetch } = useProfile();
  const signingOutRef = useRef(false);

  const isBanned = isSignedIn && !!profile?.banned_at;

  useEffect(() => {
    if (!isBanned || signingOutRef.current) return;
    signingOutRef.current = true;
    void signOut().finally(() => {
      signingOutRef.current = false;
    });
  }, [isBanned, signOut]);

  if (isSignedIn && isPending && !profile) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isSignedIn && isError && !profile) {
    return (
      <View style={styles.centered}>
        <ErrorRetry
          message={error instanceof Error ? error.message : 'Could not verify account status'}
          onRetry={() => void refetch()}
        />
      </View>
    );
  }

  if (isBanned) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Account suspended</Text>
        <Text style={styles.body}>
          Your account was banned for violating {appDisplayName} rules. Contact {SUPPORT_EMAIL} if you
          believe this is a mistake.
        </Text>
        <Pressable
          onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
          accessibilityRole="button"
          accessibilityLabel="Email support"
        >
          <Text style={styles.supportLink}>{SUPPORT_EMAIL}</Text>
        </Pressable>
        <ActivityIndicator color={colors.primary} style={styles.spinner} />
      </View>
    );
  }

  return <>{children}</>;
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontSize: fontSize.h2,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  spinner: { marginTop: spacing.md },
  supportLink: {
    fontSize: fontSize.body,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
    textDecorationLine: 'underline',
  },
}));
