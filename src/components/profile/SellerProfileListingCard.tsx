import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import type { SellerProfileListingItem } from '@/types/seller-profile-listings';
import { listingImagePublicUrl } from '@/features/listings/listing-service';
import { categoryLabel } from '@/features/listings/category-labels';
import { formatListingPrice } from '@/utils/format-listing';
import { formatExpiresCountdown } from '@/utils/expires-countdown';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

type Props = {
  listing: SellerProfileListingItem;
};

export function SellerProfileListingCard({ listing }: Props): React.JSX.Element {
  const styles = useStyles();
  const router = useRouter();
  const sold = listing.status === 'sold';
  const thumbUri = listing.thumb_path ? listingImagePublicUrl(listing.thumb_path) : null;

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/listing/${listing.id}`)}
      accessibilityRole="button"
    >
      <View style={styles.imageWrap}>
        {thumbUri ? (
          <Image
            source={{ uri: thumbUri }}
            style={[styles.image, sold && styles.imageSold]}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={styles.placeholderText}>No photo</Text>
          </View>
        )}
        {sold ? (
          <>
            <View style={styles.soldOverlay} />
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>SOLD</Text>
            </View>
          </>
        ) : (
          <View style={styles.expiryBadge}>
            <Text style={styles.expiryText}>{formatExpiresCountdown(listing.expires_at)}</Text>
          </View>
        )}
      </View>
      <View style={styles.body}>
        <Text style={[styles.price, sold && styles.textMuted]} numberOfLines={1}>
          {formatListingPrice(listing.price)}
        </Text>
        <Text style={[styles.title, sold && styles.textMuted]} numberOfLines={2}>
          {listing.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {categoryLabel(listing.category)}
        </Text>
      </View>
    </Pressable>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  imageWrap: { position: 'relative', aspectRatio: 4 / 3 },
  image: { width: '100%', height: '100%' },
  imageSold: { opacity: 0.45 },
  imagePlaceholder: {
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { color: colors.textMuted, fontSize: fontSize.caption },
  soldOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(120, 120, 120, 0.35)',
  },
  statusBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  statusText: {
    color: colors.onPrimary,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
  },
  expiryBadge: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  expiryText: {
    color: colors.onPrimary,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
  body: { padding: spacing.sm, gap: 2 },
  price: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
    color: colors.price,
  },
  title: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  meta: { fontSize: fontSize.caption, color: colors.textMuted },
  textMuted: { color: colors.textSecondary },
}));
