import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { FeedGoogleVideoAdPlaceholder } from '@/components/ads/FeedGoogleVideoAdPlaceholder';
import {
  shouldRenderLiveGoogleFeedVideoAd,
  shouldShowFeedGoogleAds,
  shouldShowPageGoogleAds,
} from '@/lib/mobile-ads';

type NativeVideoComponent = React.ComponentType<{ slotKey: string }>;

type Props = {
  slotKey: string;
  feedListingCount?: number;
  /** `page` = secondary screens (no feed listing minimum). */
  placement?: 'feed' | 'page';
};

/**
 * OfferUp-style in-feed Google native/video ad between listing rows.
 * Uses placeholders until EXPO_PUBLIC_GOOGLE_FEED_VIDEO_ADS_LIVE=true and native rebuild.
 */
export function FeedGoogleVideoAd({
  slotKey,
  feedListingCount = 0,
  placement = 'feed',
}: Props): React.JSX.Element | null {
  const [NativeVideo, setNativeVideo] = useState<NativeVideoComponent | null>(null);

  const showSlot =
    placement === 'page'
      ? shouldShowPageGoogleAds()
      : shouldShowFeedGoogleAds(feedListingCount);
  const useLiveAd = shouldRenderLiveGoogleFeedVideoAd();

  useEffect(() => {
    if (!useLiveAd || Platform.OS === 'web') return;
    void import('./FeedGoogleVideoAdNative').then((mod) => {
      setNativeVideo(() => mod.FeedGoogleVideoAdNative);
    });
  }, [useLiveAd]);

  if (!showSlot) {
    return null;
  }

  if (useLiveAd && NativeVideo) {
    return <NativeVideo slotKey={slotKey} />;
  }

  return <FeedGoogleVideoAdPlaceholder />;
}
