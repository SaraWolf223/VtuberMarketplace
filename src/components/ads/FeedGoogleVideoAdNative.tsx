import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import {
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaAspectRatio,
  NativeMediaView,
} from 'react-native-google-mobile-ads';
import { FeedGoogleVideoAdPlaceholder } from '@/components/ads/FeedGoogleVideoAdPlaceholder';
import { getFeedNativeVideoAdUnitId } from '@/lib/mobile-ads';
import { ensureMobileAdsReady } from '@/features/ads/ads-consent';
import { useGoogleFeedVideoStyles } from '@/components/ads/google-feed-video-styles';
import { useThemeColors } from '@/hooks/useThemeColors';

type Props = {
  slotKey: string;
};

export function FeedGoogleVideoAdNative({ slotKey }: Props): React.JSX.Element | null {
  const styles = useGoogleFeedVideoStyles();
  const colors = useThemeColors();
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let loaded: NativeAd | null = null;

    void ensureMobileAdsReady()
      .then(() =>
        NativeAd.createForAdRequest(getFeedNativeVideoAdUnitId(), {
          aspectRatio: NativeMediaAspectRatio.LANDSCAPE,
          startVideoMuted: true,
        })
      )
      .then((ad) => {
        if (cancelled) {
          ad.destroy();
          return;
        }
        loaded = ad;
        setNativeAd(ad);
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      loaded?.destroy();
    };
  }, [slotKey]);

  if (failed) {
    return <FeedGoogleVideoAdPlaceholder />;
  }

  if (!nativeAd) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.textMuted} />
      </View>
    );
  }

  return (
    <NativeAdView nativeAd={nativeAd} style={styles.card}>
      <View style={styles.sponsoredRow}>
        <Text style={styles.sponsoredBadge}>Sponsored</Text>
        <Text style={styles.adLabel}>Ad</Text>
      </View>
      <NativeMediaView style={styles.media} />
      <View style={styles.body}>
        <NativeAsset assetType={NativeAssetType.HEADLINE}>
          <Text style={styles.headline} />
        </NativeAsset>
        <NativeAsset assetType={NativeAssetType.ADVERTISER}>
          <Text style={styles.advertiser} />
        </NativeAsset>
        <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
          <View style={styles.cta}>
            <Text style={styles.ctaText} />
          </View>
        </NativeAsset>
      </View>
    </NativeAdView>
  );
}
