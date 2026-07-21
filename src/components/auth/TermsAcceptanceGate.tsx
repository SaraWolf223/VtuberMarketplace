import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect, useSegments } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useTermsAcceptance } from '@/hooks/useTermsAcceptance';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';

/** Blocks app routes until the user accepts the current Terms / Privacy bundle. */
export function TermsAcceptanceGate({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const { isSignedIn } = useAuth();
  const { isLoading, needsAcceptance } = useTermsAcceptance();
  const segments = useSegments();

  const root = segments[0];
  const onAcceptTerms = root === 'accept-terms';
  const onAuthFlow = root === '(auth)';
  const onLegalDocs = root === 'legal';

  if (isSignedIn && isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isSignedIn && needsAcceptance && !onAcceptTerms && !onAuthFlow && !onLegalDocs) {
    return <Redirect href="/accept-terms" />;
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
