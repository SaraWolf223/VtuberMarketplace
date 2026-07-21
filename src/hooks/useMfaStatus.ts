import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { useAuth } from '@/hooks/useAuth';
import { fetchMfaStatus, type MfaStatus } from '@/lib/auth/mfa';

export type { MfaStatus };

export function useMfaStatus() {
  const { user, isSignedIn, isLoading: authLoading } = useAuth();
  const userId = user?.id;

  return useQuery<MfaStatus>({
    queryKey: queryKeys.mfaStatus(userId ?? 'none'),
    enabled: !authLoading && isSignedIn && !!userId,
    queryFn: fetchMfaStatus,
    staleTime: 10_000,
    refetchOnMount: 'always',
    retry: 1,
  });
}

export function useInvalidateMfaStatus(): () => Promise<void> {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;
  return async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.mfaStatus(userId ?? 'none') });
  };
}
