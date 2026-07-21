import { useEffect } from 'react';
import { Platform } from 'react-native';
import {
  preloadInterstitial,
  registerListingViewAndMaybeShowInterstitial,
} from '@/features/ads/interstitial-ad';

/**
 * Treats viewing a listing as a unit of browse content: pre-loads an
 * interstitial on entry, and on leaving the listing (back / navigate away)
 * registers the view as a logical break that may show a capped interstitial.
 *
 * Inert until the AdMob native module is linked and
 * EXPO_PUBLIC_FULLSCREEN_ADS_LIVE=true (see interstitial-ad.ts), and a no-op on web.
 */
export function useBrowseInterstitial(listingId: string | undefined): void {
  useEffect(() => {
    if (Platform.OS === 'web' || !listingId) return;
    preloadInterstitial();
    return () => {
      registerListingViewAndMaybeShowInterstitial();
    };
  }, [listingId]);
}
