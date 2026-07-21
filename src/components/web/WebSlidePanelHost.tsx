import { Platform } from 'react-native';
import { useWebSlidePanelStore } from '@/stores/web-slide-panel-store';
import { useWebViewport } from '@/hooks/useWebViewport';
import { WebRightSlidePanel } from '@/components/web/WebRightSlidePanel';
import ProfileScreen from '../../../app/(tabs)/profile';
import NotificationsScreen from '../../../app/(tabs)/notifications';

/** Desktop web — profile/activity drawer over the current page (feed stays visible). */
export function WebSlidePanelHost(): React.JSX.Element | null {
  const panel = useWebSlidePanelStore((s) => s.panel);
  const open = useWebSlidePanelStore((s) => s.open);
  const close = useWebSlidePanelStore((s) => s.close);
  const { isDesktopWeb } = useWebViewport();

  if (Platform.OS !== 'web' || !isDesktopWeb || panel == null) {
    return null;
  }

  return (
    <WebRightSlidePanel panel={panel} onClose={close} onSelectPanel={open}>
      {panel === 'profile' ? <ProfileScreen /> : <NotificationsScreen />}
    </WebRightSlidePanel>
  );
}
