import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Redirect, useSegments } from 'expo-router';
import { useAuthContext } from '@/providers/AuthProvider';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';

const PUBLIC_ROUTE_ROOTS = new Set(['(auth)', 'legal', 'auth']);

function isPublicWhenSignedOut(segments: string[]): boolean {
  const root = segments[0];
  if (!root || root === 'index') return true;
  if (PUBLIC_ROUTE_ROOTS.has(root)) return true;
  if (root === 'marketing-capture') return true;
  return false;
}

/** Blocks UI while auth hydrates; redirects signed-out users off protected routes. */
export function AuthGate({ children }: { children: React.ReactNode }): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const { isLoading, isSignedIn } = useAuthContext();
  const segments = useSegments();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isSignedIn && !isPublicWhenSignedOut(segments)) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return <>{children}</>;
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
}));
