import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { useAuth } from '@/hooks/useAuth';
import { listMyConversations } from '@/features/messages/dm-service';

export function useConversations() {
  const { user, session, isSignedIn } = useAuth();
  const userId = user?.id;
  const token = session?.access_token;

  return useQuery({
    queryKey: queryKeys.conversations(userId ?? 'none'),
    enabled: isSignedIn && !!userId && !!token,
    queryFn: () => listMyConversations(token!),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}
