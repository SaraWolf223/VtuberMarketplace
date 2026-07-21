import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useAuth } from '@/hooks/useAuth';
import { useConversations } from '@/hooks/useConversations';
import { deleteConversation } from '@/features/messages/dm-service';
import { formatListingPrice } from '@/utils/format-listing';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';
import type { ConversationInboxRow } from '@/types/messages';

export default function MessagesInboxScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const router = useRouter();
  const { session, isSignedIn } = useAuth();
  const token = session?.access_token ?? '';
  const { data, isLoading, isError, error, refetch, isRefetching } = useConversations();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const confirmDeleteChat = (item: ConversationInboxRow) => {
    Alert.alert(
      'Delete chat?',
      `Remove your conversation with ${item.other_display_name} about "${item.listing_title}"? This deletes the chat for both of you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(item.conversation_id);
            try {
              await deleteConversation(token, item.conversation_id);
              await refetch();
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Could not delete chat');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const openRowMenu = (item: ConversationInboxRow) => {
    Alert.alert(item.other_display_name, item.listing_title, [
      {
        text: 'Open chat',
        onPress: () => router.push(`/messages/${item.conversation_id}`),
      },
      {
        text: 'Delete chat',
        style: 'destructive',
        onPress: () => confirmDeleteChat(item),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  if (!isSignedIn) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Sign in for messages</Text>
        <Text style={styles.emptySub}>
          Tap Message seller on a listing to start chatting with other users.
        </Text>
        <Pressable
          style={styles.signInButton}
          onPress={() => router.push('/(auth)/sign-in')}
          accessibilityRole="button"
        >
          <Text style={styles.signInButtonText}>Sign in with Google</Text>
        </Pressable>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>
          {error instanceof Error ? error.message : 'Could not load messages'}
        </Text>
        <Pressable onPress={() => refetch()}>
          <Text style={styles.link}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const rows = data ?? [];

  const renderItem = ({ item }: { item: ConversationInboxRow }) => (
    <View style={styles.row}>
      <Pressable
        style={styles.rowMain}
        onPress={() => router.push(`/messages/${item.conversation_id}`)}
        onLongPress={() => openRowMenu(item)}
      >
        {item.other_avatar_url ? (
          <Image source={{ uri: item.other_avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>
              {item.other_display_name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.body}>
          <View style={styles.topLine}>
            <Text style={styles.name} numberOfLines={1}>
              {item.other_display_name}
            </Text>
            <Text style={styles.price}>{formatListingPrice(item.listing_price)}</Text>
          </View>
          <Text style={styles.listingTitle} numberOfLines={1}>
            {item.listing_title}
          </Text>
          <Text style={styles.preview} numberOfLines={1}>
            {item.last_message_body ?? 'No messages yet'}
          </Text>
        </View>
      </Pressable>
      <Pressable
        style={styles.menuBtn}
        onPress={() => openRowMenu(item)}
        disabled={deletingId === item.conversation_id}
        hitSlop={8}
      >
        {deletingId === item.conversation_id ? (
          <ActivityIndicator size="small" color={colors.textMuted} />
        ) : (
          <Text style={styles.menuBtnText}>⋯</Text>
        )}
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      {rows.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptySub}>
            Tap Message seller on a listing to start chatting.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.conversation_id}
          renderItem={renderItem}
          refreshing={isRefetching}
          onRefresh={() => refetch()}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { paddingVertical: spacing.sm },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  menuBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  menuBtnText: {
    fontSize: 20,
    color: colors.textMuted,
    fontWeight: fontWeight.bold,
  },
  avatar: { width: 48, height: 48, borderRadius: radius.full },
  avatarPlaceholder: {
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: fontSize.h2, fontWeight: fontWeight.bold, color: colors.textMuted },
  body: { flex: 1 },
  topLine: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  name: {
    flex: 1,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  price: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.price },
  listingTitle: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2 },
  preview: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: 4 },
  emptyTitle: { fontSize: fontSize.h2, fontWeight: fontWeight.semibold, color: colors.text },
  emptySub: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  signInButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  signInButtonText: {
    color: colors.onPrimary,
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.body,
  },
  error: { color: colors.error, textAlign: 'center', marginBottom: spacing.md },
  link: { color: colors.primary, fontWeight: fontWeight.semibold },
}));
