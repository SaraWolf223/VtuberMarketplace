import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/useThemeColors';
import { FeedLocationHeader } from '@/components/feed/FeedLocationHeader';
import { NotificationsTabIcon } from '@/components/notifications/NotificationsTabIcon';
import { useWebViewport } from '@/hooks/useWebViewport';

type IconName = keyof typeof Ionicons.glyphMap;

function HomeHeaderTitle(): React.JSX.Element {
  return <FeedLocationHeader />;
}

export default function TabLayout(): React.JSX.Element {
  const colors = useThemeColors();
  const { isWeb, isDesktopWeb, isMobileWeb } = useWebViewport();

  const tabIcon = (name: IconName, focused: boolean) => (
    <Ionicons
      name={name}
      size={22}
      color={focused ? colors.primary : colors.textMuted}
    />
  );

  const hideTabBar = isWeb && isDesktopWeb;
  const showStackHeader = !isWeb || isMobileWeb;

  return (
    <Tabs
      screenOptions={{
        headerShown: showStackHeader,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        ...(hideTabBar
          ? {
              tabBar: () => null,
              tabBarStyle: { display: 'none', height: 0, overflow: 'hidden' },
            }
          : {
              tabBarStyle: {
                backgroundColor: colors.tabBar,
                borderTopColor: colors.tabBarBorder,
              },
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
            }),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: showStackHeader ? HomeHeaderTitle : undefined,
          tabBarAccessibilityLabel: 'Home feed',
          tabBarIcon: ({ focused }) => tabIcon(focused ? 'home' : 'home-outline', focused),
        }}
      />
      <Tabs.Screen
        name="sell"
        options={{
          title: 'Post Ad',
          tabBarAccessibilityLabel: 'Post a listing',
          tabBarIcon: ({ focused }) => tabIcon(focused ? 'cash' : 'cash-outline', focused),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Favorites',
          tabBarAccessibilityLabel: 'Saved listings',
          tabBarIcon: ({ focused }) => tabIcon(focused ? 'heart' : 'heart-outline', focused),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Activity',
          lazy: true,
          tabBarAccessibilityLabel: 'Activity and notifications',
          tabBarIcon: ({ focused }) => <NotificationsTabIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarAccessibilityLabel: 'Your profile',
          tabBarIcon: ({ focused }) => tabIcon(focused ? 'person' : 'person-outline', focused),
        }}
      />
    </Tabs>
  );
}
