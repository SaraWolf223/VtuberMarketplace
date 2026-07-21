import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';
import type { NotificationKind, NotificationRow } from '@/types/notifications';
import { navigateToNotification, type NotificationRouter } from './notification-navigation';

export const ANDROID_CHANNEL_ID = 'default';

/** Android requires an explicit channel before notifications display. */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'General',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#2563EB',
  });
}

export async function getPushPermissionStatus(): Promise<Notifications.PermissionStatus> {
  if (Platform.OS === 'web') return Notifications.PermissionStatus.DENIED;
  const permissions = await Notifications.getPermissionsAsync();
  return permissions.granted ? Notifications.PermissionStatus.GRANTED : Notifications.PermissionStatus.DENIED;
}

function getProjectId(): string | undefined {
  const fromConfig = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const fromEas = (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  return fromConfig ?? fromEas;
}

export type RegisterResult =
  | { ok: true; token: string }
  | {
      ok: false;
      reason: 'unsupported' | 'denied' | 'no_project_id' | 'error';
      message: string;
    };

/**
 * Requests notification permission, gets the Expo push token, and stores it on
 * the user's profile prefs so the backend can target this device.
 */
export async function registerForPushNotifications(): Promise<RegisterResult> {
  if (Platform.OS === 'web' || !Device.isDevice) {
    return {
      ok: false,
      reason: 'unsupported',
      message: 'Push notifications require a physical device.',
    };
  }

  await ensureAndroidChannel();

  let permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted) {
    permissions = await Notifications.requestPermissionsAsync();
  }
  if (!permissions.granted) {
    return {
      ok: false,
      reason: 'denied',
      message: 'Notifications are turned off. Enable them in system settings.',
    };
  }

  const projectId = getProjectId();
  if (!projectId) {
    return {
      ok: false,
      reason: 'no_project_id',
      message: 'Push is not configured yet (missing EAS project ID).',
    };
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const { data, error } = await supabase.rpc('set_my_push_token', { p_token: token });
    if (error) throw error;
    const result = data as { ok?: boolean; error?: string } | null;
    if (!result?.ok) {
      return {
        ok: false,
        reason: 'error',
        message:
          result?.error === 'NO_PREFS'
            ? 'Could not save your push token yet — finish setting your home ZIP first, then try again.'
            : 'Could not register this device for push.',
      };
    }
    return { ok: true, token };
  } catch (e) {
    return {
      ok: false,
      reason: 'error',
      message: e instanceof Error ? e.message : 'Could not register this device for push.',
    };
  }
}

/** Clears the stored push token so the backend stops targeting this device. */
export async function disablePushNotifications(): Promise<void> {
  await supabase.rpc('clear_my_push_token');
}

/** Builds a minimal NotificationRow from a push payload for tap navigation. */
function rowFromPushData(data: Record<string, unknown>): NotificationRow | null {
  const kind = data.kind as NotificationKind | undefined;
  if (!kind) return null;
  const row: NotificationRow = {
    id: String(data.notification_id ?? ''),
    kind,
    title: '',
    body: '',
    listing_id: (data.listing_id as string | null) ?? null,
    conversation_id: (data.conversation_id as string | null) ?? null,
    actor_user_id: null,
    actor_display_name: null,
    actor_avatar_url: null,
    read_at: null,
    created_at: new Date().toISOString(),
  };
  return row;
}

export function handleNotificationResponse(
  router: NotificationRouter,
  response: Notifications.NotificationResponse
): void {
  const data = response.notification.request.content.data ?? {};
  const row = rowFromPushData(data as Record<string, unknown>);
  if (row) navigateToNotification(router, row);
}
