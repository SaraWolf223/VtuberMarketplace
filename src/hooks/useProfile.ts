import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { useAuth } from '@/hooks/useAuth';
import { fetchProfile, type ProfileRow } from '@/features/profile/profile-service';

export type { ProfileRow };

export function useProfile() {
  const { user, session, isSignedIn, isLoading: authLoading } = useAuth();
  const userId = user?.id;
  const token = session?.access_token;

  return useQuery({
    queryKey: queryKeys.profile(userId ?? 'none'),
    enabled: !authLoading && isSignedIn && !!userId && !!token,
    queryFn: () => fetchProfile(token!, userId!),
    staleTime: 30_000,
    refetchOnMount: 'always',
    retry: 1,
  });
}
