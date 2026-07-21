import { View, StyleSheet, Platform } from 'react-native';
import { usePathname } from 'expo-router';
import { WebTopBar } from '@/components/web/WebTopBar';
import { WebSlidePanelHost } from '@/components/web/WebSlidePanelHost';
import { shouldShowWebTopBar } from '@/constants/web-nav';
import { WEB_DESKTOP_CHROME_BG } from '@/constants/web-page-layout';
import { useAuthContext } from '@/providers/AuthProvider';
import { useWebViewport } from '@/hooks/useWebViewport';
import { useThemeColors } from '@/hooks/useThemeColors';

type Props = {
  children: React.ReactNode;
};

/** Global web shell — desktop OfferUp/Marketplace chrome; mobile-web uses native-like tabs only. */
export function WebAppShell({ children }: Props): React.JSX.Element {
  const pathname = usePathname() || '/';
  const colors = useThemeColors();
  const { isSignedIn } = useAuthContext();
  const { isDesktopWeb, maxContentWidth } = useWebViewport();
  const showTopBar = isDesktopWeb && shouldShowWebTopBar(pathname, isSignedIn);

  const chromeBg =
    Platform.OS === 'web' && isDesktopWeb ? WEB_DESKTOP_CHROME_BG : colors.background;

  return (
    <View style={[styles.root, { backgroundColor: chromeBg }]}>
      {showTopBar ? <WebTopBar /> : null}
      <View style={styles.contentOuter}>
        <View
          style={[
            styles.contentInner,
            isDesktopWeb && styles.contentInnerDesktop,
            isDesktopWeb && styles.contentInnerRelative,
            maxContentWidth != null ? { maxWidth: maxContentWidth } : styles.contentInnerMobileWeb,
            isDesktopWeb && { backgroundColor: colors.surface },
          ]}
        >
          {children}
          <WebSlidePanelHost />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  contentOuter: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  contentInner: {
    flex: 1,
    width: '100%',
  },
  contentInnerDesktop: {
    alignSelf: 'center',
  },
  contentInnerRelative: {
    position: 'relative',
  },
  contentInnerMobileWeb: {
    maxWidth: '100%',
    alignSelf: 'stretch',
  },
});
