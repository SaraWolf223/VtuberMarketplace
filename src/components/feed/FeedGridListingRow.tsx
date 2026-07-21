import { View, StyleSheet, Platform } from 'react-native';
import type { FeedListingItem } from '@/types/feed';
import { ListingCard } from '@/components/listing/ListingCard';
import { DESKTOP_WEB_FEED_GRID_COLUMNS, FEED_GRID_COLUMNS } from '@/constants/feed-layout';
import { spacing } from '@/theme/tokens';

type Props = {
  items: FeedListingItem[];
  columnCount?: number;
  isFavorited: (id: string) => boolean;
  pendingFavoriteId: string | null;
  onToggleFavorite: (listingId: string, favorited: boolean) => void;
  favoritePending: boolean;
};

export function FeedGridListingRow({
  items,
  columnCount = Platform.OS === 'web' ? DESKTOP_WEB_FEED_GRID_COLUMNS : FEED_GRID_COLUMNS,
  isFavorited,
  pendingFavoriteId,
  onToggleFavorite,
  favoritePending,
}: Props): React.JSX.Element {
  const placeholders = Math.max(0, columnCount - items.length);

  return (
    <View style={styles.row} testID="feed-listing-row">
      {items.map((listing) => (
        <View key={listing.id} style={styles.cell} testID="feed-listing-cell">
          <ListingCard
            listing={listing}
            variant="grid"
            isFavorited={isFavorited(listing.id)}
            favoriteLoading={favoritePending && pendingFavoriteId === listing.id}
            onToggleFavorite={() => onToggleFavorite(listing.id, !isFavorited(listing.id))}
          />
        </View>
      ))}
      {Array.from({ length: placeholders }, (_, index) => (
        <View key={`ph-${index}`} style={styles.cell} testID="feed-listing-cell-placeholder" />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Platform.OS === 'web' ? spacing.md : spacing.sm,
    marginBottom: Platform.OS === 'web' ? spacing.md : spacing.sm,
  },
  cell: { flex: 1, minWidth: 0 },
});
