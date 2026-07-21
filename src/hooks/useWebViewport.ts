import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import {
  WEB_DESKTOP_BREAKPOINT,
  WEB_APP_MAX_WIDTH,
  DESKTOP_WEB_FEED_GRID_COLUMNS,
} from '@/constants/feed-layout';

export type WebFeedLayout = 'desktop' | 'mobile';

/** Viewport-based web layout: desktop OfferUp chrome vs mobile-web (app-like). */
export function useWebViewport(): {
  width: number;
  isWeb: boolean;
  isDesktopWeb: boolean;
  isMobileWeb: boolean;
  feedColumns: number;
  webFeedLayout: WebFeedLayout | null;
  maxContentWidth: number | undefined;
} {
  const [width, setWidth] = useState(() =>
    Platform.OS === 'web' && typeof window !== 'undefined' ? window.innerWidth : WEB_DESKTOP_BREAKPOINT
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isWeb = Platform.OS === 'web';
  const isDesktopWeb = isWeb && width >= WEB_DESKTOP_BREAKPOINT;
  const isMobileWeb = isWeb && !isDesktopWeb;

  return {
    width,
    isWeb,
    isDesktopWeb,
    isMobileWeb,
    feedColumns: isDesktopWeb ? desktopFeedColumns(width) : 2,
    webFeedLayout: isWeb ? (isDesktopWeb ? 'desktop' : 'mobile') : null,
    maxContentWidth: isDesktopWeb ? WEB_APP_MAX_WIDTH : undefined,
  };
}

/** OfferUp-style dense grid that adapts to the centered content width. */
function desktopFeedColumns(width: number): number {
  const contentWidth = Math.min(width, WEB_APP_MAX_WIDTH);
  if (contentWidth >= 1200) return DESKTOP_WEB_FEED_GRID_COLUMNS;
  if (contentWidth >= 992) return 4;
  return 3;
}
