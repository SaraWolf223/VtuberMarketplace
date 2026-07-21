import { Platform } from 'react-native';

/** Desktop web breakpoint (px). Below = mobile-web (app-like). */
export const WEB_DESKTOP_BREAKPOINT = 768;

/** Listing cards per row — native app. */
export const NATIVE_FEED_GRID_COLUMNS = 2;

/** Desktop web feed columns (OfferUp-style dense grid). */
export const DESKTOP_WEB_FEED_GRID_COLUMNS = 5;

/** @deprecated Use useWebViewport().feedColumns on web. */
export const FEED_GRID_COLUMNS =
  Platform.OS === 'web' ? DESKTOP_WEB_FEED_GRID_COLUMNS : NATIVE_FEED_GRID_COLUMNS;

/** Max content width for desktop web feed (centered). */
export const WEB_APP_MAX_WIDTH = 1280;
