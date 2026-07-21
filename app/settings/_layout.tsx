import { Platform, View, StyleSheet } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useWebViewport } from '@/hooks/useWebViewport';
import { WebSettingsSidebar } from '@/components/web/WebSettingsSidebar';
import { WebPageTitle } from '@/components/web/WebPageTitle';
import { getSettingsPageTitle } from '@/constants/web-page-layout';
import { mergeWebStackScreenOptions } from '@/lib/web-layout';

export default function SettingsLayout(): React.JSX.Element {
  const colors = useThemeColors();
  const { isDesktopWeb } = useWebViewport();
  const pathname = usePathname() || '/settings';
  const desktopTitle = getSettingsPageTitle(pathname);
  const useDesktopShell = Platform.OS === 'web' && isDesktopWeb;

  const stack = (
    <Stack
      screenOptions={mergeWebStackScreenOptions(
        {
          headerShown: !useDesktopShell,
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        },
        colors
      )}
    >
      <Stack.Screen name="index" options={{ title: 'Settings' }} />
      <Stack.Screen name="location" options={{ title: 'Your location' }} />
      <Stack.Screen name="premium" options={{ title: 'Pro Seller' }} />
      <Stack.Screen name="seller-shop" options={{ title: 'Shop profile' }} />
      <Stack.Screen name="seller-discounts" options={{ title: 'Promo codes & sales' }} />
      <Stack.Screen name="payouts" options={{ title: 'Seller payouts' }} />
      <Stack.Screen name="safety" options={{ title: 'Safety' }} />
      <Stack.Screen name="blocked-users" options={{ title: 'Blocked users' }} />
      <Stack.Screen name="legal" options={{ title: 'Legal' }} />
      <Stack.Screen name="verify-phone" options={{ title: 'Verify phone' }} />
      <Stack.Screen name="verify-college-email" options={{ title: 'College badge' }} />
      <Stack.Screen name="redeem-promo" options={{ title: 'Redeem promo' }} />
      <Stack.Screen name="security" options={{ title: 'Two-factor authentication' }} />
    </Stack>
  );

  if (!useDesktopShell) {
    return stack;
  }

  return (
    <View style={styles.shell}>
      <WebSettingsSidebar />
      <View style={styles.main}>
        {desktopTitle && desktopTitle !== 'Account' ? (
          <WebPageTitle title={desktopTitle} />
        ) : null}
        {stack}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
});

