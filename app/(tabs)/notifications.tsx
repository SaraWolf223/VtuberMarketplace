import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator as Spinner,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect, usePathname } from 'expo-router';
import { useWebViewport } from '@/hooks/useWebViewport';
import { useWebSlidePanelStore } from '@/stores/web-slide-panel-store';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useMarkNotificationsReadOnView } from '@/hooks/useMarkNotificationsReadOnView';
import { useUnreadNotificationCount } from '@/hooks/useUnreadNotificationCount';
import { VisibleNotificationRow } from '@/components/notifications/VisibleNotificationRow';
import { navigateToNotification } from '@/features/notifications/notification-navigation';
import type { NotificationRow as Row } from '@/types/notifications';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

type Filter = 'all' | 'unread';

export default function NotificationsScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const [routeFocused, setRouteFocused] = useState(false);
  const { isDesktopWeb } = useWebViewport();
  const panel = useWebSlidePanelStore((s) => s.panel);
  const openPanel = useWebSlidePanelStore((s) => s.open);
  const panelActive = Platform.OS === 'web' && isDesktopWeb && panel === 'activity';
  const activityVisible = routeFocused || panelActive;
  const { isSignedIn } = useAuth();
  const [filter, setFilter] = useState<Filter>('all');
  const { data, isLoading, isError, error, refetch, isRefetching, markRead, markAllRead } =
    useNotifications(filter, activityVisible);

  useEffect(() => {
    if (Platform.OS !== 'web' || !isDesktopWeb) return;
    if (pathname.includes('/notifications')) {
      openPanel('activity');
      router.replace('/(tabs)');
    }
  }, [isDesktopWeb, pathname, openPanel, router]);
  const { data: unreadTotal = 0 } = useUnreadNotificationCount();

  const markReadFn = useCallback(
    (notificationId: string) => markRead.mutateAsync(notificationId),
    [markRead]
  );
  const visibilityActive = activityVisible && isSignedIn;
  const { markVisible, visibilityTick, notifyScroll, flushOnLeave } = useMarkNotificationsReadOnView(
    visibilityActive,
    markReadFn
  );
  const flushOnLeaveRef = useRef(flushOnLeave);
  flushOnLeaveRef.current = flushOnLeave;
  const notifyScrollRef = useRef(notifyScroll);
  notifyScrollRef.current = notifyScroll;
  const scrollThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      setRouteFocused(true);
      return () => {
        setRouteFocused(false);
        notifyScrollRef.current();
        setTimeout(() => flushOnLeaveRef.current(), 50);
      };
    }, [])
  );

  const onListScroll = useCallback(() => {
    if (scrollThrottleRef.current) return;
    scrollThrottleRef.current = setTimeout(() => {
      scrollThrottleRef.current = null;
      notifyScroll();
    }, 120);
  }, [notifyScroll]);

  useEffect(() => {
    if (!visibilityActive || !(data?.length ?? 0)) return;
    const timer = setTimeout(() => notifyScroll(), 150);
    return () => clearTimeout(timer);
  }, [visibilityActive, data, filter, notifyScroll]);

  const onPressItem = async (item: Row) => {
    if (!item.read_at) {
      try {
        await markRead.mutateAsync(item.id);
      } catch {
        // still navigate if mark-read races
      }
    }
    navigateToNotification(router, item);
  };

  const onMarkAllRead = () => {
    Alert.alert('Mark all as read?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark all read',
        onPress: () => {
          markAllRead.mutate(undefined, {
            onError: (e) => {
              Alert.alert('Error', e instanceof Error ? e.message : 'Could not update');
            },
          });
        },
      },
    ]);
  };

  let body: React.JSX.Element;

  if (!isSignedIn) {
    body = (
      <View style={styles.fillCenter}>
        <Text style={styles.emptyTitle}>Sign in for activity</Text>
        <Text style={styles.emptySub}>
          Messages, deals, reviews, and listing updates appear here.
        </Text>
      </View>
    );
  } else if (isLoading) {
    body = (
      <View style={styles.fillCenter}>
        <Spinner size="large" color={colors.primary} />
      </View>
    );
  } else if (isError) {
    body = (
      <View style={styles.fillCenter}>
        <Text style={styles.error}>
          {error instanceof Error ? error.message : 'Could not load activity'}
        </Text>
        <Pressable onPress={() => refetch()}>
          <Text style={styles.link}>Try again</Text>
        </Pressable>
      </View>
    );
  } else {
    const rows = data ?? [];
    body =
      rows.length === 0 ? (
        <View style={styles.fillCenter}>
          <Text style={styles.emptyTitle}>
            {filter === 'unread' ? 'All caught up' : 'No activity yet'}
          </Text>
          <Text style={styles.emptySub}>
            {filter === 'unread'
              ? 'You have no unread notifications.'
              : 'Messages, deals, reviews, and listing updates will show up here.'}
          </Text>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={rows}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <VisibleNotificationRow
              item={item}
              onPress={() => void onPressItem(item)}
              onVisible={markVisible}
              visibilityTick={visibilityTick}
              active={visibilityActive}
            />
          )}
          onScroll={onListScroll}
          scrollEventThrottle={16}
          removeClippedSubviews={false}
          refreshing={isRefetching}
          onRefresh={() => refetch()}
        />
      );
  }

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <View style={styles.segments}>
          <Pressable
            style={[styles.segment, filter === 'all' && styles.segmentActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.segmentText, filter === 'all' && styles.segmentTextActive]}>
              All
            </Text>
          </Pressable>
          <Pressable
            style={[styles.segment, filter === 'unread' && styles.segmentActive]}
            onPress={() => setFilter('unread')}
          >
            <Text style={[styles.segmentText, filter === 'unread' && styles.segmentTextActive]}>
              Unread
            </Text>
          </Pressable>
        </View>
        {isSignedIn && unreadTotal > 0 ? (
          <Pressable onPress={onMarkAllRead} disabled={markAllRead.isPending}>
            <Text style={styles.markAll}>Mark all read</Text>
          </Pressable>
        ) : null}
      </View>
      {body}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  segments: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  segmentTextActive: { color: colors.onPrimary },
  markAll: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  fillCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  list: { flex: 1 },
  listContent: { flexGrow: 1 },
  emptyTitle: { fontSize: fontSize.h2, fontWeight: fontWeight.semibold, color: colors.text },
  emptySub: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  error: { color: colors.error, textAlign: 'center', marginBottom: spacing.md },
  link: { color: colors.primary, fontWeight: fontWeight.semibold },
}));
