import { create } from 'zustand';
import type { ListingCategory } from '@/types/enums';
import type { CompressedPhoto } from '@/lib/image-compress';
import type { MyListingItem } from '@/types/my-listings';
import { myListingThumbPath } from '@/features/listings/my-listings-service';
import { listingImagePublicUrl } from '@/features/listings/listing-service';

export type DraftPhoto = CompressedPhoto & { id: string };

export type AssetType =
  | 'live2d_2d'
  | 'model_3d'
  | 'pngtuber'
  | 'accessory_prop'
  | 'background_overlay'
  | 'base_model'
  | 'other';

export type LicenseType = 'otu' | 'p2u';
export type SupportDuration = 'none' | 'days_30' | 'days_90' | 'lifetime';

type DraftListingState = {
  step: number;
  editListingId: string | null;
  photos: DraftPhoto[];
  feedThumbnail: DraftPhoto | null;
  title: string;
  description: string;
  priceText: string;
  category: ListingCategory | null;
  assetType: AssetType | null;
  licenseType: LicenseType;
  licenseText: string;
  downloadUrl: string;
  youtubeUrl: string;
  isMature: boolean;
  supportDuration: SupportDuration;
  compatibleSoftware: string[];
  fileFormats: string[];
  includesSourceFiles: boolean;
  /** @deprecated kept so edit load doesn't break */
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
  setAssetType: (assetType: AssetType | null) => void;
  setLicenseType: (licenseType: LicenseType) => void;
  setLicenseText: (licenseText: string) => void;
  setDownloadUrl: (downloadUrl: string) => void;
  setYoutubeUrl: (youtubeUrl: string) => void;
  setIsMature: (isMature: boolean) => void;
  setSupportDuration: (supportDuration: SupportDuration) => void;
  setCompatibleSoftware: (compatibleSoftware: string[]) => void;
  setFileFormats: (fileFormats: string[]) => void;
  setIncludesSourceFiles: (includesSourceFiles: boolean) => void;
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
  assetType: null as AssetType | null,
  licenseType: 'p2u' as LicenseType,
  licenseText: '',
  downloadUrl: '',
  youtubeUrl: '',
  isMature: false,
  supportDuration: 'none' as SupportDuration,
  compatibleSoftware: [] as string[],
  fileFormats: [] as string[],
  includesSourceFiles: false,
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
  setAssetType: (assetType) => set({ assetType }),
  setLicenseType: (licenseType) => set({ licenseType }),
  setLicenseText: (licenseText) => set({ licenseText }),
  setDownloadUrl: (downloadUrl) => set({ downloadUrl }),
  setYoutubeUrl: (youtubeUrl) => set({ youtubeUrl }),
  setIsMature: (isMature) => set({ isMature }),
  setSupportDuration: (supportDuration) => set({ supportDuration }),
  setCompatibleSoftware: (compatibleSoftware) => set({ compatibleSoftware }),
  setFileFormats: (fileFormats) => set({ fileFormats }),
  setIncludesSourceFiles: (includesSourceFiles) => set({ includesSourceFiles }),
  setZipCode: (zipCode) => set({ zipCode }),
  loadForEdit: (listing) => {
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
    const ext = listing as MyListingItem & {
      asset_type?: AssetType;
      license_type?: LicenseType;
      license_text?: string;
      download_url?: string;
      youtube_video_url?: string;
      is_mature?: boolean;
      support_duration?: SupportDuration;
    };
    set({
      ...initial,
      editListingId: listing.id,
      step: 1,
      photos,
      title: listing.title,
      description: listing.description ?? '',
      priceText: price % 1 === 0 ? String(price) : price.toFixed(2),
      category: listing.category,
      assetType: ext.asset_type ?? null,
      licenseType: ext.license_type ?? 'p2u',
      licenseText: ext.license_text ?? '',
      downloadUrl: ext.download_url ?? '',
      youtubeUrl: ext.youtube_video_url ?? '',
      isMature: !!ext.is_mature,
      supportDuration: ext.support_duration ?? 'none',
      zipCode: listing.zip_code ?? '',
    });
  },
  reset: () => set({ ...initial }),
}));
