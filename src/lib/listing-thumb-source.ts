import type { ImageProps } from 'expo-image';
import { listingImagePublicUrl } from '@/features/listings/listing-service';

type ListingThumbSource = NonNullable<ImageProps['source']>;

const MARKETING_THUMBS: Record<string, number> = {
  'desk-chair': require('../../assets/marketing/desk-chair.jpg'),
  'game-controller': require('../../assets/marketing/game-controller.jpg'),
  textbooks: require('../../assets/marketing/textbooks.jpg'),
  guitar: require('../../assets/marketing/guitar.jpg'),
};

/**
 * Resolves listing thumb for feed/cards.
 * `marketing:*` keys are bundled assets for screenshots only.
 */
export function listingThumbSource(thumbPath: string | null): ListingThumbSource | null {
  if (!thumbPath) return null;
  if (thumbPath.startsWith('marketing:')) {
    const key = thumbPath.slice('marketing:'.length);
    const asset = MARKETING_THUMBS[key];
    return asset != null ? asset : null;
  }
  return { uri: listingImagePublicUrl(thumbPath) };
}
