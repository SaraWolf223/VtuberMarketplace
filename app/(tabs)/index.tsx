import { useEffect, useMemo, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Text,
  Platform,
  Pressable,
  Alert,
} from 'react-native';
import { useFeed } from '@/hooks/useFeed';
import { useWebViewport } from '@/hooks/useWebViewport';
import { useFavoriteIds } from '@/hooks/useFavoriteIds';
import { useToggleFavorite } from '@/hooks/useToggleFavorite';
import { FeedFilters } from '@/components/feed/FeedFilters';
import { WebFeedSidebar } from '@/components/web/WebFeedSidebar';
import { WebSortDropdown } from '@/components/web/WebSortDropdown';
import { useFeedFiltersStore } from '@/stores/feed-filters-store';
import { EmptyFeed } from '@/components/feed/EmptyFeed';
import { FeedGridListingRow } from '@/components/feed/FeedGridListingRow';
import { FeedGridMixedRow } from '@/components/feed/FeedGridMixedRow';
import { FeedGridSkeleton } from '@/components/feed/FeedGridSkeleton';
import { FeedGoogleVideoAd } from '@/components/ads/FeedGoogleVideoAd';
import { ErrorRetry } from '@/components/ui/ErrorRetry';
import { buildFeedGridRows, type FeedGridRow } from '@/features/feed/feed-grid';
import { prefetchFeedListingImages } from '@/lib/feed-image-prefetch';
import { AnalyticsEvents, trackEvent } from '@/lib/analytics';
import { hapticLight } from '@/lib/haptics';
import { spacing } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize } from '@/theme/typography';

export default function FeedScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const { collegeStudentsOnly, listingStatus } = useFeedFiltersStore();
  const { isFavorited } = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();
  const [pendingFavoriteId, setPendingFavoriteId] = useState<string | null>(null);
  const {
    listings,
    isLoading,
    isRefetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    error,
    isReady,
  } = useFeed();
  const { feedColumns, webFeedLayout, isDesktopWeb } = useWebViewport();
  // The desktop filter sidebar takes ~240px, so drop one column to keep cards roomy.
  const columns = isDesktopWeb ? Math.max(2, feedColumns - 1) : feedColumns;

  const gridRows = useMemo(
    () => buildFeedGridRows(listings, columns, webFeedLayout),
    [listings, columns, webFeedLayout]
  );

  useEffect(() => {
    if (listings.length > 0) {
      prefetchFeedListingImages(listings);
      trackEvent(AnalyticsEvents.feedViewed, {
        results_count: listings.length,
      });
    }
  }, [listings]);

  const onToggleFavorite = (listingId: string, favorited: boolean) => {
    void hapticLight();
    setPendingFavoriteId(listingId);
    toggleFavorite.mutate(
      { listingId, favorited },
      {
        onSuccess: () => {
          trackEvent(
            favorited ? AnalyticsEvents.listingFavorited : AnalyticsEvents.listingUnfavorited,
            { listing_id: listingId }
          );
        },
        onError: (e) => {
          Alert.alert(
            'Could not update favorite',
            e instanceof Error ? e.message : 'Try again'
          );
        },
        onSettled: () => setPendingFavoriteId(null),
      }
    );
  };

  const renderRow = ({ item }: { item: FeedGridRow }) => {
    if (item.type === 'mixed-row') {
      return (
        <FeedGridMixedRow
          cells={item.cells}
          columnCount={columns}
          isFavorited={isFavorited}
          pendingFavoriteId={pendingFavoriteId}
          onToggleFavorite={onToggleFavorite}
          favoritePending={toggleFavorite.isPending}
        />
      );
    }
    if (item.type === 'ad-row') {
      return <FeedGoogleVideoAd slotKey={item.key} feedListingCount={listings.length} />;
    }
    return (
      <FeedGridListingRow
        items={item.items}
        columnCount={columns}
        isFavorited={isFavorited}
        pendingFavoriteId={pendingFavoriteId}
        onToggleFavorite={onToggleFavorite}
        favoritePending={toggleFavorite.isPending}
      />
    );
  };

  const feedBody = (
    <>
      {error && listings.length > 0 ? (
        <View style={styles.partialError}>
          <Text style={styles.partialErrorText}>
            {error instanceof Error ? error.message : 'Could not refresh feed'}
          </Text>
          <Pressable onPress={() => refetch()} accessibilityRole="button">
            <Text style={styles.partialErrorRetry}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
      {error && !listings.length ? (
        <ErrorRetry
          message={error instanceof Error ? error.message : 'Could not load feed'}
          onRetry={() => void refetch()}
        />
      ) : null}
      {isLoading && !listings.length && !error ? (
        <FeedGridSkeleton />
      ) : (
        <FlatList
          data={gridRows}
          keyExtractor={(item) => item.key}
          renderItem={renderRow}
          removeClippedSubviews={Platform.OS === 'android'}
          windowSize={7}
          maxToRenderPerBatch={8}
          initialNumToRender={10}
          updateCellsBatchingPeriod={50}
          ListEmptyComponent={
            isReady && !isLoading ? (
              <EmptyFeed
                variant={
                  collegeStudentsOnly
                    ? 'college-only'
                    : listingStatus === 'sold'
                      ? 'sold'
                      : 'default'
                }
              />
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefetching && !isFetchingNextPage}
              onRefresh={() => void refetch()}
              tintColor={colors.primary}
            />
          }
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator style={styles.footer} color={colors.primary} />
            ) : null
          }
          contentContainerStyle={gridRows.length === 0 ? styles.emptyList : styles.listContent}
        />
      )}
    </>
  );

  if (isDesktopWeb) {
    return (
      <View style={[styles.container, styles.containerDesktop]}>
        <View style={styles.desktopRow}>
          <WebFeedSidebar />
          <View style={styles.desktopMain}>
            <View style={styles.sortHeader}>
              <WebSortDropdown />
            </View>
            {feedBody}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FeedFilters />
      {feedBody}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  containerDesktop: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  desktopRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.lg,
  },
  desktopMain: {
    flex: 1,
    minWidth: 0,
  },
  sortHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    zIndex: 20,
  },
  listContent: {
    paddingBottom: spacing.lg,
  },
  partialError: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: colors.warningMuted,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  partialErrorText: {
    flex: 1,
    fontSize: fontSize.caption,
    color: colors.warningMutedText,
  },
  partialErrorRetry: {
    fontSize: fontSize.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  footer: { paddingVertical: spacing.lg },
  emptyList: { flexGrow: 1 },
}));
