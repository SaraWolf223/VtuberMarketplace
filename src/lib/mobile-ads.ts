import { NativeModules, Platform } from 'react-native';
import {
  GOOGLE_FEED_ADS_MIN_LISTINGS,
} from '@/constants/google-feed-ads';

const TEST_ANDROID_BANNER = 'ca-app-pub-3940256099942544/6300978111';
const TEST_IOS_BANNER = 'ca-app-pub-3940256099942544/2934735716';

/** AdMob test native ad unit (supports video media). */
const TEST_ANDROID_NATIVE = 'ca-app-pub-3940256099942544/2247696110';
const TEST_IOS_NATIVE = 'ca-app-pub-3940256099942544/3986624511';

/** AdMob test App Open ad units. */
const TEST_ANDROID_APP_OPEN = 'ca-app-pub-3940256099942544/9257395921';
const TEST_IOS_APP_OPEN = 'ca-app-pub-3940256099942544/5575463023';

/** AdMob test Interstitial ad units. */
const TEST_ANDROID_INTERSTITIAL = 'ca-app-pub-3940256099942544/1033173712';
const TEST_IOS_INTERSTITIAL = 'ca-app-pub-3940256099942544/4411468910';

/** A configured production unit ID, or null when it's empty/still a Google test ID. */
function resolveProdUnitId(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.includes('3940256099942544')) return null;
  return trimmed;
}

/** True after native rebuild with react-native-google-mobile-ads (expo prebuild + installDebug). */
export function isMobileAdsNativeLinked(): boolean {
  if (Platform.OS === 'web') return false;
  return Boolean(
    (NativeModules as { RNGoogleMobileAdsModule?: unknown }).RNGoogleMobileAdsModule
  );
}

/** Banner unit for the home feed; uses env IDs or Google test units in dev. */
export function getFeedBannerAdUnitId(): string {
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_ID ?? TEST_IOS_BANNER;
  }
  return process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID ?? TEST_ANDROID_BANNER;
}

/** Native (video-capable) unit for in-feed sponsored cards. */
export function getFeedNativeVideoAdUnitId(): string {
  const prodIos = process.env.EXPO_PUBLIC_ADMOB_IOS_NATIVE_VIDEO_ID?.trim();
  const prodAndroid = process.env.EXPO_PUBLIC_ADMOB_ANDROID_NATIVE_VIDEO_ID?.trim();

  if (Platform.OS === 'ios') {
    if (prodIos && !prodIos.includes('3940256099942544')) return prodIos;
    return TEST_IOS_NATIVE;
  }
  if (prodAndroid && !prodAndroid.includes('3940256099942544')) return prodAndroid;
  return TEST_ANDROID_NATIVE;
}

/** When false, show UI placeholders instead of requesting AdMob native ads. */
export function isGoogleFeedVideoAdsLive(): boolean {
  return process.env.EXPO_PUBLIC_GOOGLE_FEED_VIDEO_ADS_LIVE === 'true';
}

/** App Open unit (full-screen, shown when switching back into the app). */
export function getAppOpenAdUnitId(): string {
  if (Platform.OS === 'ios') {
    return resolveProdUnitId(process.env.EXPO_PUBLIC_ADMOB_IOS_APP_OPEN_ID) ?? TEST_IOS_APP_OPEN;
  }
  return resolveProdUnitId(process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_OPEN_ID) ?? TEST_ANDROID_APP_OPEN;
}

/** Interstitial unit (full-screen, shown at capped browse breaks). */
export function getInterstitialAdUnitId(): string {
  if (Platform.OS === 'ios') {
    return (
      resolveProdUnitId(process.env.EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_ID) ?? TEST_IOS_INTERSTITIAL
    );
  }
  return (
    resolveProdUnitId(process.env.EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_ID) ??
    TEST_ANDROID_INTERSTITIAL
  );
}

/**
 * Full-screen ads (App Open + Interstitial) live flag — independent of the
 * in-feed video ads flag so each layer can be turned on separately.
 */
export function isFullScreenAdsLive(): boolean {
  return process.env.EXPO_PUBLIC_FULLSCREEN_ADS_LIVE === 'true';
}

/** True only when full-screen ads are enabled AND the native module is linked. */
export function shouldServeFullScreenAds(): boolean {
  return isFullScreenAdsLive() && isMobileAdsNativeLinked();
}

export function shouldShowFeedGoogleAds(feedListingCount: number): boolean {
  if (Platform.OS === 'web') return false;
  if (feedListingCount < GOOGLE_FEED_ADS_MIN_LISTINGS) return false;
  return process.env.EXPO_PUBLIC_GOOGLE_FEED_VIDEO_ADS_ENABLED !== 'false';
}

/** Secondary screens (Post Ad, profile footer, etc.) — no feed listing minimum. */
export function shouldShowPageGoogleAds(): boolean {
  if (Platform.OS === 'web') return false;
  return process.env.EXPO_PUBLIC_GOOGLE_FEED_VIDEO_ADS_ENABLED !== 'false';
}

export function shouldRenderLiveGoogleFeedVideoAd(): boolean {
  return isGoogleFeedVideoAdsLive() && isMobileAdsNativeLinked();
}
