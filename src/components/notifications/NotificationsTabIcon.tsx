import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { useUnreadNotificationCount } from '@/hooks/useUnreadNotificationCount';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontWeight } from '@/theme/typography';

type Props = {
  focused: boolean;
};

/** Custom tab icon with JS badge — avoids Android Fabric tabBarBadge mount bugs. */
export function NotificationsTabIcon({ focused }: Props): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const { isSignedIn } = useAuth();
  const { data: unread = 0 } = useUnreadNotificationCount();
  const showBadge = isSignedIn && unread > 0;
  const label = unread > 99 ? '99+' : String(unread);

  return (
    <View style={styles.wrap}>
      <Ionicons
        name={focused ? 'notifications' : 'notifications-outline'}
        size={22}
        color={focused ? colors.primary : colors.textMuted}
      />
      {showBadge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{label}</Text>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  wrap: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -2,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: colors.onPrimary,
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },
}));
