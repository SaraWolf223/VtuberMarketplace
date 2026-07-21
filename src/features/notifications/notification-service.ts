import { supabaseRpc } from '@/lib/supabase-rest';
import type { NotificationRow } from '@/types/notifications';

type OkResult = { ok: true } | { error: string };

export async function listMyNotifications(
  accessToken: string,
  options?: { limit?: number; offset?: number; unreadOnly?: boolean }
): Promise<NotificationRow[]> {
  return supabaseRpc<NotificationRow[]>(
    'list_my_notifications',
    {
      p_limit: options?.limit ?? 50,
      p_offset: options?.offset ?? 0,
      p_unread_only: options?.unreadOnly ?? false,
    },
    accessToken
  );
}

export async function getUnreadNotificationCount(accessToken: string): Promise<number> {
  const count = await supabaseRpc<number>('get_unread_notification_count', {}, accessToken);
  return count ?? 0;
}

export async function markNotificationRead(
  accessToken: string,
  notificationId: string
): Promise<void> {
  const result = await supabaseRpc<OkResult>(
    'mark_notification_read',
    { p_notification_id: notificationId },
    accessToken
  );
  if ('error' in result && result.error) {
    throw new Error('Notification not found');
  }
}

export async function markAllNotificationsRead(accessToken: string): Promise<void> {
  await supabaseRpc<OkResult>('mark_all_notifications_read', {}, accessToken);
}
