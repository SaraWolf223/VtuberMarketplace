import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/query-keys';

/** Single Realtime subscription for notification updates (avoids duplicate channel callbacks). */
export function NotificationRealtimeSync(): null {
  const { user, isSignedIn } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId || !isSignedIn) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.unreadNotificationCount(userId),
          });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.notifications(userId, 'all'),
          });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.notifications(userId, 'unread'),
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, isSignedIn, queryClient]);

  return null;
}
