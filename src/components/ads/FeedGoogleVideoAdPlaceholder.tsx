import { View, Text, Pressable } from 'react-native';
import { useGoogleFeedVideoStyles } from '@/components/ads/google-feed-video-styles';

type Props = {
  onPress?: () => void;
};

/**
 * OfferUp-style in-feed sponsored video card (placeholder until AdMob native units are live).
 */
export function FeedGoogleVideoAdPlaceholder({ onPress }: Props): React.JSX.Element {
  const styles = useGoogleFeedVideoStyles();

  return (
    <Pressable
      style={styles.card}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel="Sponsored video advertisement placeholder"
    >
      <View style={styles.sponsoredRow}>
        <Text style={styles.sponsoredBadge}>Sponsored</Text>
        <Text style={styles.adLabel}>Ad</Text>
      </View>

      <View style={styles.media}>
        <View style={styles.placeholderMediaInner}>
          <View style={styles.placeholderPlay}>
            <Text style={styles.placeholderPlayIcon}>▶</Text>
          </View>
          <Text style={styles.placeholderHint}>Video ad · muted autoplay</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.headline}>Discover deals near you</Text>
        <Text style={styles.advertiser}>Sample advertiser · Google Ad slot</Text>
        <View style={styles.cta}>
          <Text style={styles.ctaText}>Learn more</Text>
        </View>
      </View>
    </Pressable>
  );
}
