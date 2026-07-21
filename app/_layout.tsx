import '@/lib/setup-polyfills';
import '@/lib/logbox-config';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { queryClient } from '@/lib/query-client';
import { AppConfigProvider } from '@/providers/AppConfigProvider';
import { AuthProvider } from '@/providers/AuthProvider';
import { NotificationRealtimeSync } from '@/providers/NotificationRealtimeSync';
import { PushNotificationsBridge } from '@/providers/PushNotificationsBridge';
import { AppOpenAdBridge } from '@/providers/AppOpenAdBridge';
import { AppStripeProvider } from '@/providers/AppStripeProvider';
import { AuthGate } from '@/components/auth/AuthGate';
import { BannedAccountGate } from '@/components/auth/BannedAccountGate';
import { MfaStepUpGate } from '@/components/auth/MfaStepUpGate';
import { TermsAcceptanceGate } from '@/components/auth/TermsAcceptanceGate';
import { ImageCropProvider } from '@/providers/ImageCropProvider';
import { StartupSplash } from '@/components/splash/StartupSplash';
import { checkDevMetroReachable } from '@/lib/dev-metro-check';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useThemeStore } from '@/stores/theme-store';
import { useSystemChromeTheme } from '@/hooks/useSystemChromeTheme';
import { WebAppShell } from '@/components/web/WebAppShell';
import { WebAlertHost } from '@/components/web/WebAlertHost';
import { mergeWebStackScreenOptions } from '@/lib/web-layout';

if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout(): React.JSX.Element {
  const colors = useThemeColors();
  const themeMode = useThemeStore((s) => s.themeMode);
  const [splashDone, setSplashDone] = useState(Platform.OS === 'web');

  useSystemChromeTheme();

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    checkDevMetroReachable();
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AppConfigProvider>
        <AuthProvider>
          <ImageCropProvider>
          <NotificationRealtimeSync />
          {Platform.OS !== 'web' ? <PushNotificationsBridge /> : null}
          {Platform.OS !== 'web' ? <AppOpenAdBridge /> : null}
          <AppStripeProvider>
          <>
          {Platform.OS === 'web' ? <WebAlertHost /> : null}
          <AuthGate>
            <BannedAccountGate>
            <MfaStepUpGate>
            <TermsAcceptanceGate>
            <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
            {Platform.OS === 'web' ? (
              <WebAppShell>
                <Stack
                  screenOptions={mergeWebStackScreenOptions(
                    {
                      headerStyle: { backgroundColor: colors.surface },
                      headerTintColor: colors.text,
                      headerShadowVisible: false,
                      contentStyle: { backgroundColor: colors.background },
                    },
                    colors
                  )}
                >
                  <Stack.Screen name="index" options={{ headerShown: false }} />
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                  <Stack.Screen
                    name="location-setup"
                    options={{ title: 'Your location' }}
                  />
                  <Stack.Screen
                    name="accept-terms"
                    options={{ title: 'Terms & privacy' }}
                  />
                  <Stack.Screen name="legal" options={{ headerShown: false }} />
                  <Stack.Screen
                    name="marketing-capture"
                    options={{ headerShown: false, title: 'Marketing capture' }}
                  />
                  <Stack.Screen name="settings" options={{ headerShown: false }} />
                  <Stack.Screen name="listing/[id]" options={{ title: 'Listing' }} />
                  <Stack.Screen name="my-listings/index" options={{ title: 'My listings' }} />
                  <Stack.Screen name="profile/[userId]" options={{ title: 'Seller' }} />
                  <Stack.Screen name="messages" options={{ headerShown: false }} />
                  <Stack.Screen name="admin" options={{ headerShown: false }} />
                </Stack>
              </WebAppShell>
            ) : (
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.text,
                headerShadowVisible: false,
                contentStyle: { backgroundColor: colors.background },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen
                name="location-setup"
                options={{ headerShown: true, title: 'Your location' }}
              />
              <Stack.Screen
                name="accept-terms"
                options={{ headerShown: true, title: 'Terms & privacy' }}
              />
              <Stack.Screen name="legal" options={{ headerShown: false }} />
              <Stack.Screen
                name="marketing-capture"
                options={{ headerShown: false, title: 'Marketing capture' }}
              />
              <Stack.Screen name="settings" options={{ headerShown: false }} />
              <Stack.Screen
                name="listing/[id]"
                options={{ headerShown: true, title: 'Listing' }}
              />
              <Stack.Screen
                name="my-listings/index"
                options={{ headerShown: true, title: 'My listings' }}
              />
              <Stack.Screen
                name="profile/[userId]"
                options={{ headerShown: true, title: 'Seller' }}
              />
              <Stack.Screen name="messages" options={{ headerShown: false }} />
              <Stack.Screen name="admin" options={{ headerShown: false }} />
            </Stack>
            )}
            {Platform.OS !== 'web' && !splashDone ? (
              <StartupSplash
                backgroundColor={colors.background}
                onFinish={() => setSplashDone(true)}
              />
            ) : null}
            </TermsAcceptanceGate>
            </MfaStepUpGate>
            </BannedAccountGate>
          </AuthGate>
          </>
          </AppStripeProvider>
          </ImageCropProvider>
        </AuthProvider>
        </AppConfigProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
