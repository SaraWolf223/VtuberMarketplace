import { View, Text, TextInput, Pressable, StyleSheet, Platform, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useProfile } from '@/hooks/useProfile';
import { FeedLocationHeader } from '@/components/feed/FeedLocationHeader';
import { WebAppLogo } from '@/components/web/WebAppLogo';
import { NotificationsTabIcon } from '@/components/notifications/NotificationsTabIcon';
import { useFeedFiltersStore } from '@/stores/feed-filters-store';
import { useWebSlidePanelStore } from '@/stores/web-slide-panel-store';
import { useWebViewport } from '@/hooks/useWebViewport';
import { WEB_APP_MAX_WIDTH } from '@/constants/feed-layout';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';
import { useAppConfigStore } from '@/stores/app-config-store';

const headerShadow: ViewStyle =
  Platform.OS === 'web'
    ? ({ boxShadow: '0 1px 8px rgba(0, 0, 0, 0.08)' } as ViewStyle)
    : {};

/**
 * OfferUp desktop header:
 * - Row 1: logo · location · prominent search · Post ad CTA · utility icons (Saved/Messages/Activity/Profile)
 * - Row 2: category chips (home feed / when a panel is open)
 */
export function WebTopBar(): React.JSX.Element | null {
  const styles = useStyles();
  const colors = useThemeColors();
  const router = useRouter();
  const pathname = usePathname() || '/';
  const { search, setSearch } = useFeedFiltersStore();
  const { isDesktopWeb } = useWebViewport();
  const openPanel = useWebSlidePanelStore((s) => s.open);
  const closePanel = useWebSlidePanelStore((s) => s.close);
  const activePanel = useWebSlidePanelStore((s) => s.panel);
  const { data: profile } = useProfile();
  const appDisplayName = useAppConfigStore((state) => state.config.appDisplayName);

  if (Platform.OS !== 'web' || !isDesktopWeb) return null;

  const goHome = () => {
    closePanel();
    router.push('/(tabs)');
  };

  const onSavedPress = () => {
    closePanel();
    router.push('/(tabs)/favorites');
  };

  const onMessagesPress = () => {
    closePanel();
    router.push('/messages');
  };

  const savedActive =
    activePanel == null && (pathname === '/favorites' || pathname.startsWith('/favorites'));
  const messagesActive =
    activePanel == null && (pathname === '/messages' || pathname.startsWith('/messages'));

  const iconColor = (active: boolean) => (active ? colors.primary : colors.textSecondary);

  return (
    <View style={styles.outer} testID="web-top-bar">
      <View style={styles.inner}>
        <View style={styles.navRow}>
          <View style={styles.logoWrap}>
            <WebAppLogo onPress={goHome} accessibilityLabel={`${appDisplayName} home`} prominent />
          </View>

          <View style={styles.locationWrap}>
            <FeedLocationHeader />
          </View>

          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={20} color={colors.textMuted} />
            <TextInput
              style={styles.search}
              placeholder="Search for sale"
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
              testID="web-top-search"
            />
          </View>

          <Pressable
            style={styles.postBtn}
            onPress={() => {
              closePanel();
              router.push('/(tabs)/sell');
            }}
            accessibilityRole="button"
            accessibilityLabel="Post an ad"
          >
            <Ionicons name="add" size={20} color={colors.onPrimary} />
            <Text style={styles.postBtnText}>Post</Text>
          </Pressable>

          <View style={styles.iconNav}>
            <IconButton
              styles={styles}
              label="Saved listings"
              active={savedActive}
              onPress={onSavedPress}
            >
              <Ionicons
                name={savedActive ? 'heart' : 'heart-outline'}
                size={24}
                color={iconColor(savedActive)}
              />
            </IconButton>

            <IconButton
              styles={styles}
              label="Messages"
              active={messagesActive}
              onPress={onMessagesPress}
            >
              <Ionicons
                name={messagesActive ? 'chatbubble' : 'chatbubble-outline'}
                size={23}
                color={iconColor(messagesActive)}
              />
            </IconButton>

            <IconButton
              styles={styles}
              label="Activity and notifications"
              active={activePanel === 'activity'}
              onPress={() => openPanel('activity')}
            >
              <NotificationsTabIcon focused={activePanel === 'activity'} />
            </IconButton>

            <IconButton
              styles={styles}
              label="Your profile"
              active={activePanel === 'profile'}
              onPress={() => openPanel('profile')}
            >
              {profile?.avatar_url ? (
                <Image
                  source={{ uri: profile.avatar_url }}
                  style={[
                    styles.profileAvatar,
                    activePanel === 'profile' && styles.profileAvatarActive,
                  ]}
                  contentFit="cover"
                />
              ) : (
                <Ionicons
                  name={activePanel === 'profile' ? 'person-circle' : 'person-circle-outline'}
                  size={26}
                  color={iconColor(activePanel === 'profile')}
                />
              )}
            </IconButton>
          </View>
        </View>
      </View>
    </View>
  );
}

function IconButton({
  styles,
  label,
  active,
  onPress,
  children,
}: {
  styles: ReturnType<typeof useStyles>;
  label: string;
  active: boolean;
  onPress: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Pressable
      style={[styles.iconBtn, active && styles.iconBtnActive]}
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      {children}
    </Pressable>
  );
}

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    outer: {
      width: '100%',
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      ...headerShadow,
    },
    inner: {
      width: '100%',
      maxWidth: WEB_APP_MAX_WIDTH,
      alignSelf: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 48,
    },
    logoWrap: {
      flexShrink: 0,
    },
    locationWrap: {
      flexShrink: 0,
    },
    searchWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.full,
      backgroundColor: colors.background,
      paddingHorizontal: spacing.md,
      minHeight: 44,
      minWidth: 120,
    },
    search: {
      flex: 1,
      fontSize: fontSize.body,
      color: colors.text,
      paddingVertical: spacing.sm,
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
    },
    postBtn: {
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.primary,
      borderRadius: radius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      minHeight: 44,
      justifyContent: 'center',
    },
    postBtnText: {
      color: colors.onPrimary,
      fontWeight: fontWeight.semibold,
      fontSize: fontSize.body,
    },
    iconNav: {
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconBtnActive: {
      backgroundColor: colors.priceBackground,
    },
    profileAvatar: {
      width: 30,
      height: 30,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
    },
    profileAvatarActive: {
      borderWidth: 2,
      borderColor: colors.primary,
    },
  })
);
