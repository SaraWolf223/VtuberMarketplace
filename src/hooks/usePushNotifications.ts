import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import {
  disablePushNotifications,
  getPushPermissionStatus,
  registerForPushNotifications,
} from '@/features/notifications/push-notifications';

export type TogglePushResult = {
  ok: boolean;
  message?: string;
  /** True when the failure was a denied OS permission (offer system settings). */
  openSettings?: boolean;
};

type UsePushNotifications = {
  enabled: boolean;
  loading: boolean;
  busy: boolean;
  setPushEnabled: (next: boolean) => Promise<TogglePushResult>;
  refresh: () => Promise<void>;
};

/**
 * Drives the "Push notifications" opt-in toggle. The switch is on only when the
 * OS permission is granted AND a device token is stored server-side.
 */
export function usePushNotifications(): UsePushNotifications {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (Platform.OS === 'web') {
      setEnabled(false);
      setLoading(false);
      return;
    }
    try {
      const status = await getPushPermissionStatus();
      const { data } = await supabase.rpc('get_my_push_token');
      const hasToken = typeof data === 'string' && data.length > 0;
      setEnabled(status === 'granted' && hasToken);
    } catch {
      setEnabled(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setPushEnabled = useCallback(async (next: boolean): Promise<TogglePushResult> => {
    setBusy(true);
    try {
      if (next) {
        const res = await registerForPushNotifications();
        if (res.ok) {
          setEnabled(true);
          return { ok: true };
        }
        return { ok: false, message: res.message, openSettings: res.reason === 'denied' };
      }
      await disablePushNotifications();
      setEnabled(false);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Could not update notifications.' };
    } finally {
      setBusy(false);
    }
  }, []);

  return { enabled, loading, busy, setPushEnabled, refresh };
}
