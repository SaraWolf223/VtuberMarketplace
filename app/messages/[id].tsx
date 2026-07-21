import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useConversationThread } from '@/hooks/useConversationThread';
import { isEmailVerified } from '@/hooks/useEmailVerification';
import { useEmailVerificationGate } from '@/hooks/useEmailVerificationGate';
import {
  deleteConversation,
  isBannedKeywordError,
  isEmailVerificationError,
  markListingSoldAndEndChat,
} from '@/features/messages/dm-service';
import { ConversationActionsMenu } from '@/components/messages/ConversationActionsMenu';
import { MessageBubble } from '@/components/messages/MessageBubble';
import { ReportSheet } from '@/components/moderation/ReportSheet';
import { blockUser } from '@/features/moderation/moderation-service';
import { ReviewModal } from '@/components/reviews/ReviewModal';
import { useListingReviewStatus } from '@/hooks/useListingReviewStatus';
import { useCreateReview } from '@/hooks/useCreateReview';
import { reviewProgressHint } from '@/features/reviews/review-eligibility';
import { MARK_LISTING_SOLD_ALERT } from '@/features/messages/mark-sold-copy';
import { formatListingPrice } from '@/utils/format-listing';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { ErrorRetry } from '@/components/ui/ErrorRetry';
import { fontSize, fontWeight } from '@/theme/typography';

export default function ConversationScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, session } = useAuth();
  const { data: profile } = useProfile();
  const { requireVerification } = useEmailVerificationGate();
  const token = session?.access_token ?? '';
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);

  const { detail, messages, isLoading, isError, error, refetch, sendMessage } = useConversationThread(id);
  const [draft, setDraft] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [endingChat, setEndingChat] = useState(false);

  const isBuyer = Boolean(user?.id && detail && user.id === detail.buyer_id);
  const isSeller = Boolean(user?.id && detail && user.id === detail.seller_id);
  const listingActive =
    detail?.listing_status === 'active' ||
    detail?.listing_status === 'paused_pending_review';
  const { data: reviewStatus } = useListingReviewStatus(detail?.listing_id, isBuyer);
  const createReview = useCreateReview();
  const verified = isEmailVerified(user, profile);

  const invalidateConversationLists = () => {
    if (user?.id) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.conversations(user.id),
      });
    }
    void queryClient.invalidateQueries({ queryKey: ['my-listings'] });
    void queryClient.invalidateQueries({ queryKey: ['listing'] });
  };

  const confirmDeleteChat = () => {
    if (!detail) return;
    Alert.alert(
      'Delete chat?',
      'This permanently removes the conversation and all messages for both you and the other person.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setEndingChat(true);
            try {
              await deleteConversation(token, detail.conversation_id);
              invalidateConversationLists();
              router.replace('/messages');
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Could not delete chat');
            } finally {
              setEndingChat(false);
            }
          },
        },
      ]
    );
  };

  const confirmMarkSoldAndEndChat = () => {
    if (!detail) return;
    Alert.alert(
      MARK_LISTING_SOLD_ALERT.title,
      MARK_LISTING_SOLD_ALERT.message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: MARK_LISTING_SOLD_ALERT.confirm,
          style: 'destructive',
          onPress: async () => {
            setEndingChat(true);
            try {
              await markListingSoldAndEndChat(token, detail.conversation_id);
              invalidateConversationLists();
              Alert.alert('Listing sold', 'Your listing is marked sold and all related chats were removed.', [
                { text: 'OK', onPress: () => router.replace('/messages') },
              ]);
            } catch (e) {
              Alert.alert(
                'Error',
                e instanceof Error ? e.message : 'Could not mark listing sold'
              );
            } finally {
              setEndingChat(false);
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isError || !detail) {
    return (
      <View style={styles.center}>
        <ErrorRetry
          message={error instanceof Error ? error.message : 'Conversation not found'}
          onRetry={() => refetch()}
          retryLabel="Try again"
        />
        <Pressable
          style={styles.backLink}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to inbox"
        >
          <Text style={styles.backLinkText}>Back to inbox</Text>
        </Pressable>
      </View>
    );
  }

  const onSend = async () => {
    const text = draft.trim();
    if (!text) return;

    if (!requireVerification('Sending a message')) return;

    try {
      await sendMessage.mutateAsync(text);
      setDraft('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not send';
      if (isEmailVerificationError(msg)) {
        requireVerification('Sending a message');
        return;
      }
      if (isBannedKeywordError(msg)) {
        Alert.alert(
          'Message not sent',
          'Your message contains a word or phrase that isn\u2019t allowed. Please remove it and try again.'
        );
        return;
      }
      Alert.alert('Could not send', msg);
    }
  };

  const onBlock = () => {
    Alert.alert(
      'Block user?',
      `Stop messages and hide listings from ${detail.other_display_name}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockUser(token, user!.id, detail.other_user_id);
              Alert.alert('Blocked', 'You will not receive messages from this user.');
              router.back();
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Could not block');
            }
          },
        },
      ]
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: detail.other_display_name,
          headerRight: () => (
            <ConversationActionsMenu
              onReport={() => setReportOpen(true)}
              onBlockUser={onBlock}
              onDeleteChat={confirmDeleteChat}
              onMarkListingSold={
                isSeller && listingActive ? confirmMarkSoldAndEndChat : undefined
              }
            />
          ),
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={88}
      >
        <Pressable
          style={styles.listingBanner}
          onPress={() => router.push(`/listing/${detail.listing_id}`)}
        >
          <Text style={styles.listingTitle} numberOfLines={1}>
            {detail.listing_title}
          </Text>
          <Text style={styles.listingPrice}>{formatListingPrice(detail.listing_price)}</Text>
        </Pressable>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble
              body={item.body}
              isOwn={item.sender_id === user?.id}
              sentAt={item.created_at}
            />
          )}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        {!verified ? (
          <Pressable
            style={styles.verifyBanner}
            onPress={() => requireVerification('Sending a message')}
          >
            <Text style={styles.verifyBannerText}>
              Verify your email to send messages →
            </Text>
          </Pressable>
        ) : null}

        {isBuyer && reviewStatus && !reviewStatus.has_review ? (
          <View style={styles.reviewSection}>
            {reviewStatus.can_review ? (
              <Pressable style={styles.reviewButton} onPress={() => setReviewOpen(true)}>
                <Text style={styles.reviewButtonText}>Rate seller</Text>
              </Pressable>
            ) : (
              <Text style={styles.reviewProgress}>{reviewProgressHint(reviewStatus)}</Text>
            )}
          </View>
        ) : null}

        {isBuyer && reviewStatus?.has_review ? (
          <Text style={styles.reviewedHint}>You reviewed this seller for this listing.</Text>
        ) : null}

        <View style={[styles.composerRow, { paddingBottom: spacing.sm + insets.bottom }]}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={verified ? 'Message…' : 'Verify email to send'}
            placeholderTextColor={colors.textMuted}
            editable={verified && !sendMessage.isPending}
            multiline
            maxLength={2000}
          />
          <Pressable
            style={[styles.sendBtn, (!draft.trim() || sendMessage.isPending) && styles.sendDisabled]}
            onPress={onSend}
            disabled={!draft.trim() || sendMessage.isPending}
          >
            {sendMessage.isPending ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <Text style={styles.sendText}>Send</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {token && detail && isBuyer ? (
        <ReviewModal
          visible={reviewOpen}
          onClose={() => setReviewOpen(false)}
          sellerName={detail.other_display_name}
          onSubmit={async (rating, body) => {
            if (!reviewStatus?.order_id) {
              throw new Error('Complete a fulfilled purchase before leaving a review.');
            }
            await createReview.mutateAsync({
              orderId: reviewStatus.order_id,
              listingId: detail.listing_id,
              sellerId: detail.seller_id,
              rating,
              body,
            });
          }}
        />
      ) : null}

      {token ? (
        <ReportSheet
          visible={reportOpen}
          onClose={() => setReportOpen(false)}
          accessToken={token}
          targetType="user"
          reportedUserId={detail.other_user_id}
          title="Report user"
        />
      ) : null}
    </>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  error: { color: colors.error, padding: spacing.lg, textAlign: 'center' },
  backLink: { marginTop: spacing.md, padding: spacing.sm },
  backLinkText: { color: colors.primary, fontWeight: fontWeight.semibold, fontSize: fontSize.body },
  headerAction: { color: colors.primary, fontWeight: fontWeight.semibold, marginRight: spacing.sm },
  listingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  listingTitle: { flex: 1, fontSize: fontSize.caption, color: colors.textSecondary },
  listingPrice: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.price },
  messageList: { paddingVertical: spacing.md, flexGrow: 1 },
  verifyBanner: {
    backgroundColor: colors.priceBackground,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  verifyBannerText: {
    color: colors.primary,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
    fontSize: fontSize.caption,
  },
  reviewSection: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  reviewButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.priceBackground,
  },
  reviewButtonText: {
    color: colors.primary,
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.caption,
  },
  reviewProgress: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  reviewedHint: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.body,
    color: colors.text,
    backgroundColor: colors.background,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.5 },
  sendText: { color: colors.onPrimary, fontWeight: fontWeight.semibold },
}));
