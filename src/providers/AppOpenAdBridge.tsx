import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { preloadAppOpenAd, showAppOpenAdIfAvailable } from '@/features/ads/app-open-ad';
import { APP_OPEN_MIN_BACKGROUND_MS } from '@/constants/fullscreen-ads';

/**
 * Shows an App Open ad when a signed-in user switches BACK into the app after
 * being away for a meaningful amount of time.
 *
 * Policy-safe by construction:
 * - Never fires on cold start / first foreground (that's an app-load violation).
 * - Ignores quick app switches shorter than APP_OPEN_MIN_BACKGROUND_MS.
 * - Pre-loads so the ad is ready before it's needed.
 * - The manager itself no-ops unless full-screen ads are live + the native
 *   module is linked, so this is inert until the next EAS rebuild.
 */
export function AppOpenAdBridge(): null {
  const { isSignedIn } = useAuth();
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const backgroundedAt = useRef<number | null>(null);
  const sawFirstForeground = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web' || !isSignedIn) return;

    // Warm a first ad so it's ready by the time the user returns.
    preloadAppOpenAd();

    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      const previous = appState.current;
      appState.current = next;

      if (next === 'background' || next === 'inactive') {
        if (previous === 'active') backgroundedAt.current = Date.now();
        return;
      }

      if (next === 'active' && (previous === 'background' || previous === 'inactive')) {
        // Skip the very first active transition (cold start / returning from the
        // OS splash) — App Open ads must not appear on app load.
        if (!sawFirstForeground.current) {
          sawFirstForeground.current = true;
          backgroundedAt.current = null;
          preloadAppOpenAd();
          return;
        }

        const awayMs = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0;
        backgroundedAt.current = null;

        if (awayMs >= APP_OPEN_MIN_BACKGROUND_MS) {
          showAppOpenAdIfAvailable();
        } else {
          preloadAppOpenAd();
        }
      }
    });

    return () => subscription.remove();
  }, [isSignedIn]);

  return null;
}
