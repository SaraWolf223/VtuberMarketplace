import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import {
  fetchConversationMessages,
  getConversationDetail,
  sendConversationMessage,
} from '@/features/messages/dm-service';
import type { ConversationDetail, MessageRow } from '@/types/messages';

export function useConversationThread(conversationId: string | undefined) {
  const { user, session, isSignedIn } = useAuth();
  const userId = user?.id;
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const detailQuery = useQuery({
    queryKey: queryKeys.conversation(conversationId ?? 'none'),
    enabled: isSignedIn && !!conversationId && !!token,
    queryFn: () => getConversationDetail(token!, conversationId!),
    staleTime: 30_000,
  });

  const messagesQuery = useQuery({
    queryKey: queryKeys.conversationMessages(conversationId ?? 'none'),
    enabled: isSignedIn && !!conversationId && !!token,
    queryFn: () => fetchConversationMessages(token!, conversationId!),
    staleTime: 5_000,
    refetchInterval: 3_000,
  });

  useEffect(() => {
    if (!conversationId || !isSignedIn) return;

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as MessageRow;
          queryClient.setQueryData<MessageRow[]>(
            queryKeys.conversationMessages(conversationId),
            (prev) => {
              if (!prev?.some((m) => m.id === row.id)) {
                return [...(prev ?? []), row];
              }
              return prev;
            }
          );
          if (userId) {
            void queryClient.invalidateQueries({
              queryKey: queryKeys.conversations(userId),
            });
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, isSignedIn, queryClient, userId]);

  const sendMessage = useMutation({
    mutationFn: (body: string) =>
      sendConversationMessage(token!, conversationId!, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.conversationMessages(conversationId!),
      });
      if (userId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.conversations(userId),
        });
      }
      const detail = queryClient.getQueryData<ConversationDetail>(
        queryKeys.conversation(conversationId ?? 'none')
      );
      if (detail?.listing_id) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.listingReviewStatus(detail.listing_id),
        });
      }
    },
  });

  return {
    detail: detailQuery.data,
    messages: messagesQuery.data ?? [],
    isLoading: detailQuery.isLoading || messagesQuery.isLoading,
    isError: detailQuery.isError || messagesQuery.isError,
    error: detailQuery.error ?? messagesQuery.error,
    sendMessage,
    refetch: () => {
      void detailQuery.refetch();
      void messagesQuery.refetch();
    },
  };
}
