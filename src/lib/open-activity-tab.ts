import { Platform } from 'react-native';
import { router } from 'expo-router';
import { WEB_DESKTOP_BREAKPOINT } from '@/constants/feed-layout';
import { useWebSlidePanelStore } from '@/stores/web-slide-panel-store';

function isDesktopWebViewport(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    window.innerWidth >= WEB_DESKTOP_BREAKPOINT
  );
}

/**
 * Opens the Activity tab without pushing a second copy of the tab navigator
 * (avoids Android Fabric "child already has a parent" crashes).
 * On desktop web, opens the slide-over panel over the feed instead.
 */
export function openActivityTab(): void {
  if (isDesktopWebViewport()) {
    useWebSlidePanelStore.getState().open('activity');
    router.replace('/(tabs)');
    return;
  }

  if (router.canDismiss()) {
    router.dismissTo('/(tabs)/notifications');
    return;
  }
  router.navigate('/notifications');
}
