import { Image } from 'expo-image';
import type { FeedListingItem } from '@/types/feed';
import { listingImagePublicUrl } from '@/features/listings/listing-service';

const prefetched = new Set<string>();

/** Prefetch listing thumbnails ahead of scroll to reduce layout shift. */
export function prefetchFeedListingImages(listings: FeedListingItem[], limit = 12): void {
  for (const item of listings.slice(0, limit)) {
    if (!item.thumb_path) continue;
    const uri = listingImagePublicUrl(item.thumb_path);
    if (!uri || prefetched.has(uri)) continue;
    prefetched.add(uri);
    void Image.prefetch(uri);
  }
}
