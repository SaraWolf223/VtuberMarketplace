import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { NotificationKind, NotificationRow as Row } from '@/types/notifications';
import { notificationKindLabel } from '@/features/notifications/notification-navigation';
import { formatTimeAgo } from '@/utils/format-time-ago';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

type Props = {
  item: Row;
  onPress: () => void;
};

function kindIcon(kind: NotificationKind): keyof typeof Ionicons.glyphMap {
  switch (kind) {
    case 'dm_message':
    case 'dm_started':
      return 'chatbubble-outline';
    case 'deal_proposed':
    case 'deal_accepted':
    case 'deal_unlocked':
      return 'cash-outline';
    case 'review_received':
    case 'review_eligible':
      return 'star-outline';
    case 'listing_sold':
      return 'checkmark-circle-outline';
    case 'listing_expiring':
    case 'listing_expired':
      return 'time-outline';
    case 'listing_paused':
    case 'account_warned':
      return 'shield-outline';
    case 'account_banned':
      return 'close-circle-outline';
    case 'listing_removed':
      return 'trash-outline';
    default:
      return 'notifications-outline';
  }
}

export function NotificationRow({ item, onPress }: Props): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const unread = !item.read_at;

  return (
    <Pressable
      style={[styles.row, unread && styles.rowUnread]}
      onPress={onPress}
      accessibilityRole="button"
    >
      {item.actor_avatar_url ? (
        <Image source={{ uri: item.actor_avatar_url }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.iconWrap]}>
          <Ionicons name={kindIcon(item.kind)} size={22} color={colors.primary} />
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.top}>
          <Text style={[styles.title, unread && styles.titleUnread]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.time}>{formatTimeAgo(item.created_at)}</Text>
        </View>
        <View style={styles.metaRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{notificationKindLabel(item.kind)}</Text>
          </View>
          {unread ? <View style={styles.dot} /> : null}
        </View>
        <Text style={styles.bodyText} numberOfLines={2}>
          {item.body}
        </Text>
      </View>
    </Pressable>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  rowUnread: {
    backgroundColor: colors.priceBackground,
  },
  avatar: { width: 44, height: 44, borderRadius: radius.full },
  iconWrap: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 4 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  title: {
    flex: 1,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  titleUnread: { fontWeight: fontWeight.bold },
  time: { fontSize: fontSize.caption, color: colors.textMuted },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  bodyText: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
}));
