import { AppOpenAd, AdEventType } from 'react-native-google-mobile-ads';
import { getAppOpenAdUnitId, shouldServeFullScreenAds } from '@/lib/mobile-ads';
import { ensureMobileAdsReady } from '@/features/ads/ads-consent';
import {
  APP_OPEN_AD_COOLDOWN_MS,
  APP_OPEN_AD_MAX_AGE_MS,
} from '@/constants/fullscreen-ads';
import {
  canShowFullScreenAd,
  markFullScreenAdShown,
  setFullScreenAdShowing,
} from '@/features/ads/fullscreen-ad-gate';

/**
 * App Open ad controller.
 *
 * App Open ads are the OfferUp-style full-screen ad shown when the user
 * switches BACK into the app. Per AdMob policy they must not appear on cold
 * start / splash, must not stack with interstitials, and must be pre-loaded so
 * they don't pop in late. All show/load calls no-op unless full-screen ads are
 * live AND the native module is linked (i.e. after an EAS rebuild).
 */

let ad: AppOpenAd | null = null;
let loadedAt = 0;
let loading = false;
let lastShownAt = 0;

function isReady(): boolean {
  return Boolean(ad?.loaded) && Date.now() - loadedAt < APP_OPEN_AD_MAX_AGE_MS;
}

export function preloadAppOpenAd(): void {
  if (!shouldServeFullScreenAds()) return;
  if (loading || isReady()) return;

  loading = true;
  void ensureMobileAdsReady()
    .then(() => {
      const instance = AppOpenAd.createForAdRequest(getAppOpenAdUnitId());
      const unsubscribeLoaded = instance.addAdEventListener(AdEventType.LOADED, () => {
        ad = instance;
        loadedAt = Date.now();
        loading = false;
      });
      const unsubscribeError = instance.addAdEventListener(AdEventType.ERROR, () => {
        ad = null;
        loading = false;
        unsubscribeLoaded();
        unsubscribeError();
      });
      instance.load();
    })
    .catch(() => {
      loading = false;
      ad = null;
    });
}

/**
 * Show the pre-loaded App Open ad if one is ready and pacing allows. Safe to
 * call on every foreground; it self-gates on cooldown + the shared gate.
 */
export function showAppOpenAdIfAvailable(): void {
  if (!shouldServeFullScreenAds()) return;
  if (Date.now() - lastShownAt < APP_OPEN_AD_COOLDOWN_MS) return;
  if (!canShowFullScreenAd()) return;

  if (!isReady() || !ad) {
    preloadAppOpenAd();
    return;
  }

  const shownAd = ad;
  try {
    setFullScreenAdShowing(true);
    const unsubscribeClosed = shownAd.addAdEventListener(AdEventType.CLOSED, () => {
      setFullScreenAdShowing(false);
      markFullScreenAdShown();
      lastShownAt = Date.now();
      ad = null;
      unsubscribeClosed();
      preloadAppOpenAd();
    });
    shownAd.show();
  } catch {
    setFullScreenAdShowing(false);
    ad = null;
    preloadAppOpenAd();
  }
}
