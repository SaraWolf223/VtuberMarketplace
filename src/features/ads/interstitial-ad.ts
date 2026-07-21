import { InterstitialAd, AdEventType } from 'react-native-google-mobile-ads';
import { getInterstitialAdUnitId, shouldServeFullScreenAds } from '@/lib/mobile-ads';
import { ensureMobileAdsReady } from '@/features/ads/ads-consent';
import {
  INTERSTITIAL_AFTER_LISTING_VIEWS,
  INTERSTITIAL_COOLDOWN_MS,
} from '@/constants/fullscreen-ads';
import {
  canShowFullScreenAd,
  markFullScreenAdShown,
  setFullScreenAdShowing,
} from '@/features/ads/fullscreen-ad-gate';

/**
 * Capped interstitial controller.
 *
 * Shown only at a logical content break — when the user leaves a listing after
 * browsing several — never on every back-press (that violates AdMob policy).
 * Frequency is capped by both a view count and a time cooldown, and it never
 * stacks with the App Open ad. No-ops unless full-screen ads are live AND the
 * native module is linked (post EAS rebuild).
 */

let ad: InterstitialAd | null = null;
let loading = false;
let listingViewsSinceAd = 0;
let lastShownAt = 0;

export function preloadInterstitial(): void {
  if (!shouldServeFullScreenAds()) return;
  if (loading || ad?.loaded) return;

  loading = true;
  void ensureMobileAdsReady()
    .then(() => {
      const instance = InterstitialAd.createForAdRequest(getInterstitialAdUnitId());
      const unsubscribeLoaded = instance.addAdEventListener(AdEventType.LOADED, () => {
        ad = instance;
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
 * Register that the user finished viewing a listing (a logical break) and show
 * an interstitial if the view-count cadence + cooldown + shared gate all allow.
 */
export function registerListingViewAndMaybeShowInterstitial(): void {
  if (!shouldServeFullScreenAds()) return;

  listingViewsSinceAd += 1;
  preloadInterstitial();

  if (listingViewsSinceAd < INTERSTITIAL_AFTER_LISTING_VIEWS) return;
  if (Date.now() - lastShownAt < INTERSTITIAL_COOLDOWN_MS) return;
  if (!canShowFullScreenAd()) return;
  if (!ad?.loaded) return;

  const shownAd = ad;
  try {
    setFullScreenAdShowing(true);
    const unsubscribeClosed = shownAd.addAdEventListener(AdEventType.CLOSED, () => {
      setFullScreenAdShowing(false);
      markFullScreenAdShown();
      lastShownAt = Date.now();
      listingViewsSinceAd = 0;
      ad = null;
      unsubscribeClosed();
      preloadInterstitial();
    });
    shownAd.show();
  } catch {
    setFullScreenAdShowing(false);
    ad = null;
    preloadInterstitial();
  }
}
