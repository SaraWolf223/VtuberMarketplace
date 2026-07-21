import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import {
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/features/notifications/notification-service';
import type { NotificationRow } from '@/types/notifications';

function patchNotificationRead(
  rows: NotificationRow[] | undefined,
  notificationId: string,
  readAt: string
): NotificationRow[] | undefined {
  if (!rows) return rows;
  return rows.map((row) =>
    row.id === notificationId ? { ...row, read_at: row.read_at ?? readAt } : row
  );
}

export function useNotifications(filter: 'all' | 'unread' = 'all', enabled = true) {
  const { user, session, isSignedIn } = useAuth();
  const userId = user?.id;
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.notifications(userId ?? 'none', filter),
    enabled: enabled && isSignedIn && !!userId && !!token,
    queryFn: () =>
      listMyNotifications(token!, {
        unreadOnly: filter === 'unread',
      }),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const markRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error('Sign in again');
      return markNotificationRead(accessToken, notificationId);
    },
    onMutate: async (notificationId) => {
      if (!userId) return;
      const readAt = new Date().toISOString();

      await queryClient.cancelQueries({ queryKey: queryKeys.notifications(userId, 'all') });
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications(userId, 'unread') });

      const prevAll = queryClient.getQueryData<NotificationRow[]>(
        queryKeys.notifications(userId, 'all')
      );
      const prevUnread = queryClient.getQueryData<NotificationRow[]>(
        queryKeys.notifications(userId, 'unread')
      );
      const prevCount = queryClient.getQueryData<number>(
        queryKeys.unreadNotificationCount(userId)
      );

      queryClient.setQueryData<NotificationRow[]>(
        queryKeys.notifications(userId, 'all'),
        (rows) => patchNotificationRead(rows, notificationId, readAt)
      );
      queryClient.setQueryData<NotificationRow[]>(
        queryKeys.notifications(userId, 'unread'),
        (rows) => rows?.filter((row) => row.id !== notificationId)
      );
      queryClient.setQueryData<number>(queryKeys.unreadNotificationCount(userId), (count) =>
        Math.max(0, (count ?? 0) - 1)
      );

      return { prevAll, prevUnread, prevCount };
    },
    onError: (_err, _id, context) => {
      if (!userId || !context) return;
      queryClient.setQueryData(queryKeys.notifications(userId, 'all'), context.prevAll);
      queryClient.setQueryData(queryKeys.notifications(userId, 'unread'), context.prevUnread);
      queryClient.setQueryData(queryKeys.unreadNotificationCount(userId), context.prevCount);
    },
    onSettled: () => {
      if (!userId) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications(userId, 'all') });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications(userId, 'unread') });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.unreadNotificationCount(userId),
      });
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error('Sign in again');
      return markAllNotificationsRead(accessToken);
    },
    onSuccess: () => {
      if (!userId) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications(userId, 'all') });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications(userId, 'unread') });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.unreadNotificationCount(userId),
      });
    },
  });

  return { ...query, markRead, markAllRead };
}
