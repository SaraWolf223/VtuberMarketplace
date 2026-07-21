import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/lib/query-keys';
import {
  acceptContactAgreement,
  fetchContactAgreement,
  proposeContactAgreement,
} from '@/features/messages/contact-agreement-service';
import type { ContactAgreementType } from '@/types/contact-agreement';

export function useContactAgreement(conversationId: string | undefined) {
  const { session, isSignedIn } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const queryKey = queryKeys.contactAgreement(conversationId ?? 'none');

  const query = useQuery({
    queryKey,
    enabled: isSignedIn && !!conversationId && !!token,
    queryFn: () => fetchContactAgreement(token!, conversationId!),
    staleTime: 5_000,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey });
  };

  const propose = useMutation({
    mutationFn: (type: ContactAgreementType) =>
      proposeContactAgreement(token!, conversationId!, type),
    onSuccess: invalidate,
  });

  const accept = useMutation({
    mutationFn: () => acceptContactAgreement(token!, conversationId!),
    onSuccess: invalidate,
  });

  return {
    agreement: query.data,
    isLoading: query.isLoading,
    propose,
    accept,
    refetch: query.refetch,
  };
}
