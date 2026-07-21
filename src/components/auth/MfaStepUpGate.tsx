import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect, useSegments } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useMfaStatus } from '@/hooks/useMfaStatus';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';

/**
 * Enforces the TOTP step-up challenge: if the signed-in session has a verified
 * factor but hasn't completed the challenge yet (aal1 -> aal2 pending), every
 * route is blocked behind `/verify-mfa` until the user enters a valid code.
 * Users who never enrolled a factor are unaffected (2FA is optional for them).
 */
export function MfaStepUpGate({ children }: { children: React.ReactNode }): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const { isSignedIn } = useAuth();
  const { data, isLoading } = useMfaStatus();
  const segments = useSegments();

  const onAuthFlow = segments[0] === '(auth)';

  if (isSignedIn && isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isSignedIn && data?.needsStepUp && !onAuthFlow) {
    return <Redirect href="/(auth)/verify-mfa" />;
  }

  return <>{children}</>;
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
}));
