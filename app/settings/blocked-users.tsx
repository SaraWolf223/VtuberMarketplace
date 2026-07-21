import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Image,
  FlatList,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/hooks/useAuth';
import {
  listBlockedUsers,
  unblockUser,
  type BlockedUser,
} from '@/features/moderation/moderation-service';
import { ErrorRetry } from '@/components/ui/ErrorRetry';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

function blockedUsersKey(userId: string): [string, string] {
  return ['blocked-users', userId];
}

function displayLabel(u: BlockedUser): string {
  return u.display_name?.trim() || (u.username ? `@${u.username}` : 'Blocked user');
}

function initials(u: BlockedUser): string {
  const base = u.display_name?.trim() || u.username || '?';
  return base.charAt(0).toUpperCase();
}

export default function BlockedUsersScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const { user, session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const {
    data: blocked,
    isPending,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: blockedUsersKey(user?.id ?? ''),
    queryFn: () => listBlockedUsers(token!, user!.id),
    enabled: !!token && !!user?.id,
    staleTime: 30_000,
  });

  const unblockMutation = useMutation({
    mutationFn: (blockedId: string) => unblockUser(token!, user!.id, blockedId),
    onMutate: (blockedId: string) => setUnblockingId(blockedId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: blockedUsersKey(user?.id ?? '') });
    },
    onError: (e) => {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not unblock user');
    },
    onSettled: () => setUnblockingId(null),
  });

  const confirmUnblock = (u: BlockedUser) => {
    Alert.alert(
      'Unblock user?',
      `${displayLabel(u)} will be able to message you and appear in your feed again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: () => unblockMutation.mutate(u.id),
        },
      ]
    );
  };

  if (isError) {
    return (
      <View style={styles.centered}>
        <ErrorRetry
          message={error instanceof Error ? error.message : 'Could not load blocked users'}
          onRetry={() => void refetch()}
        />
      </View>
    );
  }

  if (isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!blocked.length) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>No blocked users</Text>
        <Text style={styles.emptyBody}>
          People you block won&apos;t appear in your feed or be able to message you. You can unblock
          them here anytime.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={blocked}
      keyExtractor={(item) => item.id}
      refreshing={isRefetching}
      onRefresh={() => void refetch()}
      ListHeaderComponent={
        <Text style={styles.header}>
          These people can&apos;t message you or see your activity. Tap Unblock to restore access.
        </Text>
      }
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => {
        const busy = unblockingId === item.id;
        return (
          <View style={styles.row}>
            {item.avatar_url ? (
              <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>{initials(item)}</Text>
              </View>
            )}
            <View style={styles.textCol}>
              <Text style={styles.name} numberOfLines={1}>
                {displayLabel(item)}
              </Text>
              {item.username ? (
                <Text style={styles.username} numberOfLines={1}>
                  @{item.username}
                </Text>
              ) : null}
            </View>
            <Pressable
              style={[styles.unblockBtn, busy && styles.unblockBtnDisabled]}
              onPress={() => confirmUnblock(item)}
              disabled={busy}
              accessibilityRole="button"
            >
              {busy ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Text style={styles.unblockText}>Unblock</Text>
              )}
            </Pressable>
          </View>
        );
      }}
    />
  );
}

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    list: { flex: 1, backgroundColor: colors.background },
    listContent: { padding: spacing.lg },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.xl,
      backgroundColor: colors.background,
    },
    header: {
      fontSize: fontSize.caption,
      color: colors.textSecondary,
      lineHeight: 18,
      marginBottom: spacing.md,
    },
    emptyTitle: {
      fontSize: fontSize.h2,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
    emptyBody: {
      fontSize: fontSize.body,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
    },
    avatarFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      fontSize: fontSize.h2,
      fontWeight: fontWeight.semibold,
      color: colors.textSecondary,
    },
    textCol: { flex: 1, gap: 2 },
    name: {
      fontSize: fontSize.body,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
    username: {
      fontSize: fontSize.caption,
      color: colors.textSecondary,
    },
    unblockBtn: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 96,
    },
    unblockBtnDisabled: { opacity: 0.6 },
    unblockText: {
      color: colors.primary,
      fontWeight: fontWeight.semibold,
      fontSize: fontSize.body,
    },
  })
);
