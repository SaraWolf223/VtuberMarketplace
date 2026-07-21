import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import {
  ensureAndroidChannel,
  getPushPermissionStatus,
  handleNotificationResponse,
  registerForPushNotifications,
} from '@/features/notifications/push-notifications';

/**
 * Wires Expo push into the app: keeps the stored token fresh for opted-in
 * users, displays foreground notifications, and routes notification taps.
 *
 * Every native call is guarded so a build that predates the `expo-notifications`
 * native module (e.g. before the next rebuild) degrades gracefully instead of
 * crashing on launch.
 */
export function PushNotificationsBridge(): null {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const handledColdStart = useRef(false);

  // Foreground display behavior. Set once, defensively.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    } catch {
      // Native module unavailable in this build — ignore until rebuilt.
    }
  }, []);

  // Refresh the device token whenever an opted-in user is signed in (handles
  // token rotation and app reinstalls). No-op if permission isn't granted.
  useEffect(() => {
    if (Platform.OS === 'web' || !isSignedIn) return;
    void (async () => {
      try {
        await ensureAndroidChannel();
        const status = await getPushPermissionStatus();
        if (status === 'granted') {
          await registerForPushNotifications();
        }
      } catch {
        // Ignore — push simply stays off until the app is rebuilt/configured.
      }
    })();
  }, [isSignedIn]);

  // Handle taps: cold start (app opened from a notification) + warm taps.
  useEffect(() => {
    if (Platform.OS === 'web') return;

    void (async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        if (last && !handledColdStart.current) {
          handledColdStart.current = true;
          handleNotificationResponse(router, last);
        }
      } catch {
        // No-op without the native module.
      }
    })();

    try {
      const sub = Notifications.addNotificationResponseReceivedListener((response) => {
        handleNotificationResponse(router, response);
      });
      return () => sub.remove();
    } catch {
      return undefined;
    }
  }, [router]);

  return null;
}
