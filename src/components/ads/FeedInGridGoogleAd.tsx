import { View, Text, Pressable, StyleSheet } from 'react-native';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

type Props = {
  slotKey: string;
};

/**
 * OfferUp-style in-grid programmatic ad — listing-sized card with Sponsored label
 * (mirrors Bing/eBay product cards on offerup.com explore pages).
 */
export function FeedInGridGoogleAd({ slotKey: _slotKey }: Props): React.JSX.Element {
  const styles = useStyles();

  return (
    <Pressable
      style={styles.card}
      testID="feed-in-grid-google-ad"
      accessibilityRole="text"
      accessibilityLabel="Sponsored advertisement placeholder"
    >
      <Text style={styles.sponsored}>Sponsored</Text>
      <View style={styles.imageWrap}>
        <View style={styles.imagePlaceholder}>
          <Text style={styles.placeholderIcon}>▶</Text>
        </View>
      </View>
      <Text style={styles.title} numberOfLines={2}>
        Discover deals near you
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        Sample advertiser · Ad
      </Text>
    </Pressable>
  );
}

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    card: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      minWidth: 0,
    },
    sponsored: {
      fontSize: 10,
      fontWeight: fontWeight.bold,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      paddingHorizontal: spacing.sm,
      paddingTop: spacing.xs,
    },
    imageWrap: {
      aspectRatio: 1,
      width: '100%',
      backgroundColor: colors.background,
    },
    imagePlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.priceBackground,
    },
    placeholderIcon: {
      fontSize: 28,
      color: colors.primary,
    },
    title: {
      fontSize: fontSize.caption,
      fontWeight: fontWeight.semibold,
      color: colors.text,
      paddingHorizontal: spacing.sm,
      paddingTop: spacing.xs,
    },
    meta: {
      fontSize: 11,
      color: colors.textMuted,
      paddingHorizontal: spacing.sm,
      paddingBottom: spacing.sm,
    },
  })
);
