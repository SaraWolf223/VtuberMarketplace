import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useFeedFiltersStore } from '@/stores/feed-filters-store';
import { queryKeys } from '@/lib/query-keys';
import { fetchFeedPage } from '@/features/feed/feed-service';
import type { FeedListingItem, FeedQueryParams } from '@/types/feed';

export function useFeed() {
  const { session } = useAuth();
  const {
    category,
    minPrice,
    maxPrice,
    sort,
    search,
    listingStatus,
    publishedAfter,
    publishedBefore,
    minSellerRating,
    licenseType,
    hasCustomization,
    hasSetup,
  } = useFeedFiltersStore();
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const queryParams: FeedQueryParams = useMemo(
    () => ({
      category,
      minPrice,
      maxPrice,
      search: debouncedSearch,
      sort,
      listingStatus,
      publishedAfter,
      publishedBefore,
      minSellerRating,
      licenseType,
      hasCustomization,
      hasSetup,
    }),
    [
      category,
      minPrice,
      maxPrice,
      debouncedSearch,
      sort,
      listingStatus,
      publishedAfter,
      publishedBefore,
      minSellerRating,
      licenseType,
      hasCustomization,
      hasSetup,
    ]
  );

  const query = useInfiniteQuery({
    queryKey: queryKeys.feed(queryParams),
    queryFn: async ({ pageParam }) => {
      if (!session?.access_token) {
        return { items: [], next_cursor: null };
      }
      return fetchFeedPage(session.access_token, queryParams, pageParam);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled: !!session?.access_token,
  });

  const listings: FeedListingItem[] =
    query.data?.pages.flatMap((page) => page.items) ?? [];

  return {
    listings,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
    error: query.error,
    isReady: !!session?.access_token,
  };
}
