import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { useAuth } from '@/hooks/useAuth';
import { getUnreadNotificationCount } from '@/features/notifications/notification-service';

export function useUnreadNotificationCount() {
  const { user, session, isSignedIn } = useAuth();
  const userId = user?.id;
  const token = session?.access_token;

  return useQuery({
    queryKey: queryKeys.unreadNotificationCount(userId ?? 'none'),
    enabled: isSignedIn && !!userId && !!token,
    queryFn: () => getUnreadNotificationCount(token!),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}
