import { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useFavorites } from '@/hooks/useFavorites';
import { useToggleFavorite } from '@/hooks/useToggleFavorite';
import { useWebViewport } from '@/hooks/useWebViewport';
import { WebDesktopPage } from '@/components/web/WebDesktopPage';
import { FeedGridListingRow } from '@/components/feed/FeedGridListingRow';
import { FeedGridSkeleton } from '@/components/feed/FeedGridSkeleton';
import { buildListingGridRows } from '@/features/feed/feed-grid';
import { favoriteToFeedListingItem } from '@/features/favorites/favorites-service';
import { spacing } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { ErrorRetry } from '@/components/ui/ErrorRetry';
import { fontSize, fontWeight } from '@/theme/typography';

export default function FavoritesScreen(): React.JSX.Element {
  const styles = useStyles();
  const { isSignedIn } = useAuth();
  const { data, isLoading, isError, error, refetch, isRefetching } = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const [pendingFavoriteId, setPendingFavoriteId] = useState<string | null>(null);
  const { feedColumns } = useWebViewport();

  const gridRows = useMemo(() => {
    const listings = (data ?? []).map(favoriteToFeedListingItem);
    return buildListingGridRows(listings, feedColumns);
  }, [data, feedColumns]);

  const isFavorited = (id: string) => (data ?? []).some((item) => item.listing.id === id);

  const onToggleFavorite = (listingId: string, favorited: boolean) => {
    if (favorited) return;
    setPendingFavoriteId(listingId);
    toggleFavorite.mutate(
      { listingId, favorited: false },
      {
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

  if (!isSignedIn) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Sign in to save listings</Text>
        <Text style={styles.empty}>
          Tap the heart on a listing in Home to save favorites here.
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <WebDesktopPage title="Saved" subtitle="Listings you have saved">
        <FeedGridSkeleton />
      </WebDesktopPage>
    );
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <ErrorRetry
          message={error instanceof Error ? error.message : 'Could not load favorites'}
          onRetry={() => refetch()}
        />
      </View>
    );
  }

  return (
    <WebDesktopPage title="Saved" subtitle="Listings you have saved">
      <View style={styles.container}>
        <FlatList
          data={gridRows}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              No saved listings yet. Tap the heart on a listing in Home to save it here.
            </Text>
          }
          renderItem={({ item }) => (
            <FeedGridListingRow
              items={item.items}
              columnCount={feedColumns}
              isFavorited={isFavorited}
              pendingFavoriteId={pendingFavoriteId}
              onToggleFavorite={onToggleFavorite}
              favoritePending={toggleFavorite.isPending}
            />
          )}
        />
      </View>
    </WebDesktopPage>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    flexGrow: 1,
    ...(Platform.OS === 'web' ? { paddingHorizontal: spacing.lg } : {}),
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: fontSize.body,
    padding: spacing.xl,
    lineHeight: 22,
  },
  emptyTitle: {
    fontSize: fontSize.h2,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
}));
