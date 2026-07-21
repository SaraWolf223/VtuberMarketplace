import { useEffect, useRef, type ReactNode } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Platform,
  type ViewStyle,
} from 'react-native';
import type { WebSlidePanel } from '@/stores/web-slide-panel-store';
import { useUnreadNotificationCount } from '@/hooks/useUnreadNotificationCount';
import { WEB_RIGHT_PANEL_WIDTH } from '@/constants/web-page-layout';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { spacing, radius } from '@/theme/tokens';
import { fontSize, fontWeight } from '@/theme/typography';

type Props = {
  children: ReactNode;
  panel: WebSlidePanel;
  onClose: () => void;
  onSelectPanel: (panel: WebSlidePanel) => void;
};

/** Desktop web — slide-over panel; backdrop dims page content underneath. */
export function WebRightSlidePanel({
  children,
  panel,
  onClose,
  onSelectPanel,
}: Props): React.JSX.Element {
  const styles = useStyles();
  const { data: unreadTotal = 0 } = useUnreadNotificationCount();
  const slideX = useRef(new Animated.Value(WEB_RIGHT_PANEL_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const closingRef = useRef(false);
  const prevPanelRef = useRef(panel);

  useEffect(() => {
    const switchedTab = prevPanelRef.current !== panel && !closingRef.current;
    prevPanelRef.current = panel;

    if (switchedTab) {
      slideX.setValue(0);
      backdropOpacity.setValue(1);
      return;
    }

    slideX.setValue(WEB_RIGHT_PANEL_WIDTH);
    backdropOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(slideX, { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [panel, slideX, backdropOpacity]);

  const closePanel = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    Animated.parallel([
      Animated.timing(slideX, {
        toValue: WEB_RIGHT_PANEL_WIDTH,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      closingRef.current = false;
      if (finished) onClose();
    });
  };

  const activeTitle = panel === 'profile' ? 'Profile' : 'Activity';

  return (
    <View style={styles.root} testID="web-right-slide-panel">
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={closePanel}
          accessibilityLabel="Close panel"
        />
      </Animated.View>

      <Animated.View style={[styles.panel, { transform: [{ translateX: slideX }] }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{activeTitle}</Text>
        </View>

        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, panel === 'activity' && styles.tabActive]}
            onPress={() => onSelectPanel('activity')}
            accessibilityRole="tab"
            accessibilityState={{ selected: panel === 'activity' }}
          >
            <Text style={[styles.tabText, panel === 'activity' && styles.tabTextActive]}>
              Activity
            </Text>
            {unreadTotal > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadTotal > 99 ? '99+' : unreadTotal}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            style={[styles.tab, panel === 'profile' && styles.tabActive]}
            onPress={() => onSelectPanel('profile')}
            accessibilityRole="tab"
            accessibilityState={{ selected: panel === 'profile' }}
          >
            <Text style={[styles.tabText, panel === 'profile' && styles.tabTextActive]}>
              Profile
            </Text>
          </Pressable>
        </View>

        <View style={styles.body}>{children}</View>
      </Animated.View>
    </View>
  );
}

const panelShadow: ViewStyle =
  Platform.OS === 'web'
    ? ({ boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' } as ViewStyle)
    : {};

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    root: {
      ...StyleSheet.absoluteFill,
      zIndex: 50,
    },
    backdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(0,0,0,0.18)',
    },
    panel: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      width: WEB_RIGHT_PANEL_WIDTH,
      maxWidth: '100%',
      backgroundColor: colors.surface,
      borderLeftWidth: 1,
      borderLeftColor: colors.border,
      ...panelShadow,
    },
    header: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: fontSize.h2,
      fontWeight: fontWeight.bold,
      color: colors.text,
    },
    tabs: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
    },
    tabActive: {
      backgroundColor: colors.priceBackground,
    },
    tabText: {
      fontSize: fontSize.body,
      color: colors.textSecondary,
    },
    tabTextActive: {
      color: colors.primary,
      fontWeight: fontWeight.semibold,
    },
    badge: {
      minWidth: 18,
      height: 18,
      borderRadius: radius.full,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: fontWeight.bold,
      color: colors.onPrimary,
    },
    body: {
      flex: 1,
      minHeight: 0,
    },
  })
);
