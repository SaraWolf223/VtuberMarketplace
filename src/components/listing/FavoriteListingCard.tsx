import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import type { FavoriteListItem } from '@/types/favorites';
import { listingImagePublicUrl } from '@/features/listings/listing-service';
import { favoriteThumbPath } from '@/features/favorites/favorites-service';
import { categoryLabel } from '@/features/listings/category-labels';
import { formatListingPrice } from '@/utils/format-listing';
import { FavoriteHeartButton } from '@/components/listing/FavoriteHeartButton';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

type Props = {
  item: FavoriteListItem;
  onUnfavorite: () => void;
  heartLoading?: boolean;
};

export function FavoriteListingCard({
  item,
  onUnfavorite,
  heartLoading,
}: Props): React.JSX.Element {
  const styles = useStyles();
  const router = useRouter();
  const { listing } = item;
  const thumb = favoriteThumbPath(item);
  const thumbUri = thumb ? listingImagePublicUrl(thumb) : null;
  const inactive = listing.status === 'sold' || listing.status === 'expired';

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
            style={[styles.image, inactive && styles.imageInactive]}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={styles.placeholderText}>No photo</Text>
          </View>
        )}
        {inactive ? (
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>
              {listing.status === 'sold' ? 'SOLD' : 'EXPIRED'}
            </Text>
          </View>
        ) : null}
        <View style={styles.heart}>
          <FavoriteHeartButton
            favorited
            onToggle={onUnfavorite}
            loading={heartLoading}
            size="sm"
          />
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.price}>{formatListingPrice(listing.price)}</Text>
        <Text style={styles.title} numberOfLines={2}>
          {listing.title}
        </Text>
        <Text style={styles.meta}>{categoryLabel(listing.category)}</Text>
      </View>
    </Pressable>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  imageWrap: { position: 'relative', aspectRatio: 4 / 3 },
  image: { width: '100%', height: '100%' },
  imageInactive: { opacity: 0.5 },
  imagePlaceholder: {
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { color: colors.textMuted, fontSize: fontSize.caption },
  statusBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.55)',
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
  heart: { position: 'absolute', top: spacing.sm, right: spacing.sm },
  body: { padding: spacing.md, gap: spacing.xs },
  price: {
    fontSize: fontSize.priceSm,
    fontWeight: fontWeight.bold,
    color: colors.price,
  },
  title: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  meta: { fontSize: fontSize.caption, color: colors.textSecondary },
}));
