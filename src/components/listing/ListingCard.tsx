import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import type { FeedListingItem } from '@/types/feed';
import { listingThumbSource } from '@/lib/listing-thumb-source';
import { categoryLabel } from '@/features/listings/category-labels';
import { formatListingPrice, formatTimeAgo } from '@/utils/format-listing';
import { FavoriteHeartButton } from '@/components/listing/FavoriteHeartButton';
import { PremiumBadge } from '@/components/profile/PremiumBadge';
import {
  getListingHighlightKind,
  listingHighlightBorderStyle,
} from '@/lib/listing-highlight';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

type Props = {
  listing: FeedListingItem;
  variant?: 'feed' | 'grid';
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
  favoriteLoading?: boolean;
};

export function ListingCard({
  listing,
  variant = 'feed',
  isFavorited = false,
  onToggleFavorite,
  favoriteLoading,
}: Props): React.JSX.Element {
  const styles = useStyles();
  const compact = variant === 'grid';
  const offerUpGrid = compact && Platform.OS === 'web';
  const router = useRouter();
  const thumbSource = listingThumbSource(listing.thumb_path);
  const displayPrice = Number(listing.effective_price ?? listing.price);
  const originalPrice = Number(listing.price);
  const onSale = Boolean(listing.on_sale && displayPrice < originalPrice);
  const highlightKind = getListingHighlightKind({
    boosted_until: listing.featured_until ?? listing.boosted_until ?? null,
    seller_is_premium: Boolean(listing.seller_is_pro_seller ?? listing.seller_is_premium),
  });
  const highlightBorder = listingHighlightBorderStyle(highlightKind);
  const cardStyle = StyleSheet.flatten([
    styles.card,
    compact && styles.cardGrid,
    offerUpGrid && styles.cardGridWeb,
    highlightBorder,
  ]);

  const cardBody = (
    <>
      <View style={[styles.imageWrap, offerUpGrid && styles.imageWrapWeb]}>
        {thumbSource ? (
          <Image
            source={thumbSource}
            style={[styles.image, offerUpGrid && styles.imageWeb]}
            contentFit="cover"
            recyclingKey={listing.id}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={styles.placeholderText}>No photo</Text>
          </View>
        )}
        {onToggleFavorite && Platform.OS !== 'web' ? (
          <View style={styles.heart}>
            <FavoriteHeartButton
              favorited={isFavorited}
              onToggle={onToggleFavorite}
              loading={favoriteLoading}
              size="sm"
            />
          </View>
        ) : null}
      </View>
      <View style={[styles.body, compact && styles.bodyGrid, offerUpGrid && styles.bodyGridWeb]}>
        {offerUpGrid ? (
          <>
            <Text style={styles.priceGridWeb}>
              {formatListingPrice(displayPrice)}
              {onSale ? `  ` : ''}
            </Text>
            {onSale ? (
              <Text style={styles.strikeGridWeb}>{formatListingPrice(originalPrice)}</Text>
            ) : null}
            <Text style={styles.titleGridWeb} numberOfLines={1}>
              {listing.title}
            </Text>
            <Text style={styles.metaGridWeb} numberOfLines={1}>
              {listing.status === 'sold'
                ? 'Sold'
                : listing.status === 'expired'
                  ? 'Expired'
                  : formatTimeAgo(listing.published_at)}
            </Text>
          </>
        ) : (
          <>
        <View style={styles.row}>
          <View style={styles.priceCol}>
            <Text style={[styles.price, compact && styles.priceGrid]}>
              {formatListingPrice(displayPrice)}
            </Text>
            {onSale ? (
              <Text style={styles.strike}>{formatListingPrice(originalPrice)}</Text>
            ) : null}
          </View>
          {!compact && listing.seller_rating_avg != null && (listing.seller_rating_count ?? 0) > 0 ? (
            <Text style={styles.distance}>★ {Number(listing.seller_rating_avg).toFixed(1)}</Text>
          ) : null}
        </View>
        <Text style={[styles.title, compact && styles.titleGrid]} numberOfLines={compact ? 1 : 2}>
          {listing.title}
        </Text>
        {!compact ? (
          <View style={styles.metaRow}>
            <Text style={styles.meta}>
              {categoryLabel(listing.category)} · {formatTimeAgo(listing.published_at)}
            </Text>
            {listing.seller_is_pro_seller || listing.seller_is_premium ? (
              <PremiumBadge compact />
            ) : null}
          </View>
        ) : (
          <Text style={styles.metaGrid} numberOfLines={1}>
            {listing.status === 'sold'
              ? 'Sold'
              : listing.status === 'expired'
                ? 'Expired'
                : `${formatTimeAgo(listing.published_at)}${
                    listing.seller_is_pro_seller || listing.seller_is_premium ? ' · Pro' : ''
                  }`}
          </Text>
        )}
          </>
        )}
      </View>
    </>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.cardShell, compact && styles.cardShellGrid]}>
        <Pressable
          style={cardStyle}
          onPress={() => router.push(`/listing/${listing.id}`)}
          accessibilityRole="link"
          accessibilityLabel={`${listing.title}, ${formatListingPrice(displayPrice)}`}
        >
          {cardBody}
        </Pressable>
        {onToggleFavorite ? (
          <View style={styles.heartOverlay}>
            <FavoriteHeartButton
              favorited={isFavorited}
              onToggle={onToggleFavorite}
              loading={favoriteLoading}
              size="sm"
            />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <Pressable
      style={cardStyle}
      onPress={() => router.push(`/listing/${listing.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${listing.title}, ${formatListingPrice(displayPrice)}`}
    >
      {cardBody}
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
  cardGrid: {
    marginBottom: 0,
    borderRadius: radius.sm,
  },
  cardGridWeb: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    borderRadius: 0,
  },
  cardShell: {
    position: 'relative',
  },
  cardShellGrid: {
    marginBottom: 0,
  },
  imageWrap: { position: 'relative', aspectRatio: 4 / 3 },
  imageWrapWeb: {
    aspectRatio: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  imageWeb: {
    borderRadius: radius.md,
  },
  imagePlaceholder: {
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { color: colors.textMuted, fontSize: fontSize.caption },
  heart: { position: 'absolute', top: spacing.sm, right: spacing.sm },
  heartOverlay: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 2,
  },
  body: { padding: spacing.md, gap: spacing.xs },
  bodyGrid: { padding: spacing.sm, gap: 2 },
  bodyGridWeb: {
    paddingHorizontal: 0,
    paddingTop: spacing.sm,
    paddingBottom: 0,
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceCol: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  price: {
    fontSize: fontSize.priceSm,
    fontWeight: fontWeight.bold,
    color: colors.price,
  },
  priceGrid: { fontSize: fontSize.body },
  strike: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  strikeGridWeb: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  distance: { fontSize: fontSize.caption, color: colors.textSecondary },
  title: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  titleGrid: { fontSize: fontSize.caption },
  titleGridWeb: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.regular,
    color: colors.textSecondary,
  },
  priceGridWeb: {
    fontSize: fontSize.priceSm,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  metaGridWeb: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  metaGrid: { fontSize: fontSize.caption, color: colors.textMuted },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  meta: { fontSize: fontSize.caption, color: colors.textSecondary, flex: 1 },
}));
