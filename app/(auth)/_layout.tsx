import { Redirect, Stack, useSegments } from 'expo-router';
import { useAuthContext } from '@/providers/AuthProvider';
import { useThemeColors } from '@/hooks/useThemeColors';

// `reset-password` is reachable even while "signed in" — Supabase's password
// recovery link establishes a real (recovery) session before the user has
// actually chosen a new password, so it must not bounce to the main app.
// `verify-mfa` is reachable while "signed in" — the session exists at aal1 but
// the user must complete a TOTP challenge (step-up to aal2) before continuing.
const ALWAYS_ACCESSIBLE = new Set(['reset-password', 'verify-mfa']);

export default function AuthLayout(): React.JSX.Element {
  const colors = useThemeColors();
  const { isLoading, isSignedIn } = useAuthContext();
  const segments = useSegments();
  const current = segments[segments.length - 1];

  if (!isLoading && isSignedIn && !ALWAYS_ACCESSIBLE.has(current)) {
    return <Redirect href="/" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="verify-mfa" />
      <Stack.Screen name="callback" />
    </Stack>
  );
}
