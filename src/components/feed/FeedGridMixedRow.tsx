import { View, StyleSheet, Platform } from 'react-native';
import type { FeedGridCell } from '@/features/feed/feed-grid';
import { ListingCard } from '@/components/listing/ListingCard';
import { FeedInGridGoogleAd } from '@/components/ads/FeedInGridGoogleAd';
import { DESKTOP_WEB_FEED_GRID_COLUMNS, FEED_GRID_COLUMNS } from '@/constants/feed-layout';
import { spacing } from '@/theme/tokens';

type Props = {
  cells: FeedGridCell[];
  columnCount?: number;
  isFavorited: (id: string) => boolean;
  pendingFavoriteId: string | null;
  onToggleFavorite: (listingId: string, favorited: boolean) => void;
  favoritePending: boolean;
};

/** OfferUp-style web row: listings and sponsored cards share the same grid cells. */
export function FeedGridMixedRow({
  cells,
  columnCount = Platform.OS === 'web' ? DESKTOP_WEB_FEED_GRID_COLUMNS : FEED_GRID_COLUMNS,
  isFavorited,
  pendingFavoriteId,
  onToggleFavorite,
  favoritePending,
}: Props): React.JSX.Element {
  const placeholders = Math.max(0, columnCount - cells.length);

  return (
    <View style={styles.row} testID="feed-listing-row">
      {cells.map((cell) => {
        if (cell.type === 'listing') {
          return (
            <View key={cell.listing.id} style={styles.cell} testID="feed-listing-cell">
              <ListingCard
                listing={cell.listing}
                variant="grid"
                isFavorited={isFavorited(cell.listing.id)}
                favoriteLoading={favoritePending && pendingFavoriteId === cell.listing.id}
                onToggleFavorite={() =>
                  onToggleFavorite(cell.listing.id, !isFavorited(cell.listing.id))
                }
              />
            </View>
          );
        }

        return (
          <View key={cell.key} style={styles.cell} testID="feed-ad-cell">
            <FeedInGridGoogleAd slotKey={cell.key} />
          </View>
        );
      })}
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
