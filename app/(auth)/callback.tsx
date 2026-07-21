import { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useURL } from 'expo-linking';
import * as Linking from 'expo-linking';
import {
  buildOAuthCallbackUrl,
  createSessionFromUrl,
  isTrustedOAuthCallbackUrl,
  resolveOAuthCallbackUrl,
  urlHasAuthPayload,
  waitForSupabaseSession,
} from '@/lib/auth/google-oauth';
import { useAuthContext } from '@/providers/AuthProvider';
import { spacing } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';
import { BUILD_APP_IDENTITY } from '@/config/app-identity';

const CALLBACK_TIMEOUT_MS = 30_000;

export default function AuthCallbackScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const router = useRouter();
  const incomingUrl = useURL();
  const routeParams = useLocalSearchParams<{
    code?: string | string[];
    access_token?: string | string[];
    refresh_token?: string | string[];
  }>();
  const { isSignedIn, isLoading: authLoading } = useAuthContext();
  const [error, setError] = useState<string | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    const complete = async () => {
      try {
        if (await waitForSupabaseSession(1500)) {
          return;
        }

        const fromRoute = buildOAuthCallbackUrl(routeParams);
        if (fromRoute && isTrustedOAuthCallbackUrl(fromRoute)) {
          await createSessionFromUrl(fromRoute);
          return;
        }

        if (incomingUrl && isTrustedOAuthCallbackUrl(incomingUrl) && urlHasAuthPayload(incomingUrl)) {
          await createSessionFromUrl(incomingUrl);
          return;
        }

        const resolved = await resolveOAuthCallbackUrl();
        if (resolved && isTrustedOAuthCallbackUrl(resolved)) {
          await createSessionFromUrl(resolved);
          return;
        }

        const linkSub = Linking.addEventListener('url', ({ url }) => {
          if (!isTrustedOAuthCallbackUrl(url) || !urlHasAuthPayload(url)) return;
          void createSessionFromUrl(url).then(() => linkSub.remove());
        });

        if (await waitForSupabaseSession(15_000)) {
          linkSub.remove();
          return;
        }

        linkSub.remove();

        if (!(await waitForSupabaseSession(2000))) {
          throw new Error('No auth code or tokens in redirect URL');
        }
      } catch (e) {
        if (await waitForSupabaseSession(2000)) {
          return;
        }
        setError(e instanceof Error ? e.message : 'Could not complete sign-in');
      }
    };

    const timer = setTimeout(() => {
      void waitForSupabaseSession(500).then((ok) => {
        if (!ok) {
          setError('Sign-in is taking too long. Go back and try again.');
        }
      });
    }, CALLBACK_TIMEOUT_MS);

    void complete().finally(() => clearTimeout(timer));
    // `handledRef` makes this run at most once per mount regardless of how many times this
    // effect re-fires, so depending on the whole (re-created-per-render) `routeParams` object
    // is safe and avoids reading stale route params if this ever re-runs.
  }, [incomingUrl, routeParams]);

  if (!authLoading && isSignedIn && !error) {
    return <Redirect href="/" />;
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{error}</Text>
        <Text style={styles.hintSmall}>
          In Supabase → Authentication → URL Configuration, add redirect URL:{'\n'}
          {Platform.OS === 'web'
            ? `http://localhost:8081/callback (dev) or https://${BUILD_APP_IDENTITY.appDomain}/app/callback (prod)`
            : `${BUILD_APP_IDENTITY.appScheme}://callback`}
        </Text>
        <Pressable style={styles.button} onPress={() => router.replace('/(auth)/sign-in')}>
          <Text style={styles.buttonText}>Back to sign in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.hint}>Completing sign-in…</Text>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.md,
  },
  hint: { color: colors.textSecondary, fontSize: fontSize.body },
  hintSmall: {
    color: colors.textMuted,
    fontSize: fontSize.caption,
    textAlign: 'center',
    lineHeight: 18,
  },
  error: { color: colors.error, textAlign: 'center', fontSize: fontSize.body },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
  },
  buttonText: { color: colors.onPrimary, fontWeight: fontWeight.semibold },
}));
