import { create } from 'zustand';
import type { ListingCategory } from '@/types/enums';
import type { CompressedPhoto } from '@/lib/image-compress';
import type { MyListingItem } from '@/types/my-listings';
import { myListingThumbPath } from '@/features/listings/my-listings-service';
import { listingImagePublicUrl } from '@/features/listings/listing-service';

export type DraftPhoto = CompressedPhoto & { id: string };

type DraftListingState = {
  step: number;
  editListingId: string | null;
  photos: DraftPhoto[];
  feedThumbnail: DraftPhoto | null;
  title: string;
  description: string;
  priceText: string;
  category: ListingCategory | null;
  zipCode: string;
  setStep: (step: number) => void;
  setPhotos: (photos: DraftPhoto[]) => void;
  addPhotos: (photos: DraftPhoto[]) => void;
  removePhoto: (id: string) => void;
  setFeedThumbnail: (photo: DraftPhoto | null) => void;
  setTitle: (title: string) => void;
  setDescription: (description: string) => void;
  setPriceText: (priceText: string) => void;
  setCategory: (category: ListingCategory | null) => void;
  setZipCode: (zipCode: string) => void;
  loadForEdit: (listing: MyListingItem) => void;
  reset: () => void;
};

const initial = {
  step: 0,
  editListingId: null as string | null,
  photos: [] as DraftPhoto[],
  feedThumbnail: null as DraftPhoto | null,
  title: '',
  description: '',
  priceText: '',
  category: null as ListingCategory | null,
  zipCode: '',
};

export const useDraftListingStore = create<DraftListingState>((set, get) => ({
  ...initial,
  setStep: (step) => set({ step }),
  setPhotos: (photos) => set({ photos }),
  addPhotos: (incoming) => {
    const merged = [...get().photos, ...incoming].slice(0, 5);
    set({ photos: merged });
  },
  removePhoto: (id) => set({ photos: get().photos.filter((p) => p.id !== id) }),
  setFeedThumbnail: (feedThumbnail) => set({ feedThumbnail }),
  setTitle: (title) => set({ title }),
  setDescription: (description) => set({ description }),
  setPriceText: (priceText) => set({ priceText }),
  setCategory: (category) => set({ category }),
  setZipCode: (zipCode) => set({ zipCode }),
  loadForEdit: (listing) => {
    // Edits never re-upload photos (see sell.tsx — the remove button is hidden
    // while editing and `update_listing` doesn't touch `listing_images`), so
    // these entries exist only for the read-only preview grid.
    const thumb = myListingThumbPath(listing);
    const photos: DraftPhoto[] = listing.listing_images.map((img) => ({
      id: `existing-${img.sort_order}`,
      uri: listingImagePublicUrl(img.storage_path),
      width: 0,
      height: 0,
      byteSize: 0,
      mimeType: 'image/jpeg',
    }));
    if (!photos.length && thumb) {
      photos.push({
        id: 'existing-0',
        uri: listingImagePublicUrl(thumb),
        width: 0,
        height: 0,
        byteSize: 0,
        mimeType: 'image/jpeg',
      });
    }
    const price = Number(listing.price);
    set({
      ...initial,
      editListingId: listing.id,
      step: 1,
      photos,
      title: listing.title,
      description: listing.description ?? '',
      priceText: price % 1 === 0 ? String(price) : price.toFixed(2),
      category: listing.category,
      zipCode: listing.zip_code,
    });
  },
  reset: () => set({ ...initial }),
}));
