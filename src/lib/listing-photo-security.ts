import type * as ImagePicker from 'expo-image-picker';

/** Max picker file size before compression. */
export const MAX_SOURCE_PHOTO_BYTES = 25 * 1024 * 1024;

/** Max uploaded JPEG size — must match server `MAX_LISTING_IMAGE_BYTES` (Prompt 17: 2MB). */
export const MAX_LISTING_PHOTO_BYTES = 2 * 1024 * 1024;

/** Typical phone camera long edge (12MP ≈ 4032px; allow up to 4K). */
export const MAX_INPUT_LONG_EDGE = 4096;

/** Max long edge after compression (listing storage / feed). */
export const MAX_OUTPUT_LONG_EDGE = 2048;

export const MIN_LISTING_PHOTO_DIMENSION = 32;

/** Only types we re-encode to JPEG via expo-image-manipulator. */
export const ALLOWED_PICKER_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export type PickerAssetLike = Pick<
  ImagePicker.ImagePickerAsset,
  'uri' | 'mimeType' | 'fileSize' | 'width' | 'height' | 'type'
>;

export function validatePickerAsset(asset: PickerAssetLike): void {
  if (!asset.uri) {
    throw new Error('Invalid photo file.');
  }

  if (asset.type === 'video' || asset.type === 'pairedVideo') {
    throw new Error('Only photos are allowed — videos cannot be uploaded.');
  }

  const mime = asset.mimeType?.toLowerCase().trim();
  if (mime) {
    if (!mime.startsWith('image/')) {
      throw new Error('Only image files are allowed.');
    }
    if (!ALLOWED_PICKER_MIME_TYPES.has(mime)) {
      throw new Error('Use a JPG, PNG, or WebP photo.');
    }
  }

  if (asset.fileSize != null && asset.fileSize > MAX_SOURCE_PHOTO_BYTES) {
    throw new Error('Photo is too large (max 25MB from library). Choose a smaller image.');
  }

  if (asset.width != null && asset.height != null) {
    const longEdge = Math.max(asset.width, asset.height);
    if (longEdge > MAX_INPUT_LONG_EDGE) {
      throw new Error(
        `Photo is too large (${asset.width}×${asset.height}). Max ${MAX_INPUT_LONG_EDGE}px on the longest side.`
      );
    }
    if (
      asset.width < MIN_LISTING_PHOTO_DIMENSION ||
      asset.height < MIN_LISTING_PHOTO_DIMENSION
    ) {
      throw new Error('Photo is too small. Use a clearer image.');
    }
  }
}

export function validateCompressedPhoto(input: {
  byteSize: number;
  width: number;
  height: number;
}): void {
  if (input.byteSize <= 0 || input.byteSize > MAX_LISTING_PHOTO_BYTES) {
    throw new Error('Photo must be under 2MB after processing.');
  }

  const longEdge = Math.max(input.width, input.height);
  if (longEdge > MAX_OUTPUT_LONG_EDGE) {
    throw new Error('Processed photo dimensions are too large.');
  }
  if (
    input.width < MIN_LISTING_PHOTO_DIMENSION ||
    input.height < MIN_LISTING_PHOTO_DIMENSION
  ) {
    throw new Error('Processed photo dimensions are invalid.');
  }
}

export function resizeToMaxLongEdge(
  width: number,
  height: number,
  maxEdge: number
): { width: number; height: number } {
  const long = Math.max(width, height);
  if (long <= maxEdge) return { width, height };
  const scale = maxEdge / long;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
