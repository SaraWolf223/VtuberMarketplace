import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import {
  MAX_LISTING_PHOTO_BYTES,
  MAX_OUTPUT_LONG_EDGE,
  resizeToMaxLongEdge,
  validateCompressedPhoto,
  validatePickerAsset,
  type PickerAssetLike,
} from '@/lib/listing-photo-security';

const QUALITY_STEPS = [0.82, 0.7, 0.55] as const;

export type CompressedPhoto = {
  uri: string;
  width: number;
  height: number;
  byteSize: number;
  mimeType: 'image/jpeg';
};

async function getFileSize(uri: string): Promise<number> {
  // expo-file-system is unavailable on web; picker/manipulator URIs there are
  // blob:/data: URLs whose size we read via fetch().blob().
  if (Platform.OS === 'web') {
    try {
      const blob = await (await fetch(uri)).blob();
      return blob.size;
    } catch {
      return 0;
    }
  }
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || info.size == null) return 0;
  return info.size;
}

/**
 * Re-encodes picker output as JPEG (strips non-image payloads / most EXIF).
 * Never uploads the original file bytes.
 */
export async function compressListingPhoto(asset: PickerAssetLike): Promise<CompressedPhoto> {
  validatePickerAsset(asset);

  const hasDims = asset.width != null && asset.height != null && asset.width > 0 && asset.height > 0;
  const startW = hasDims ? asset.width! : MAX_OUTPUT_LONG_EDGE;
  const startH = hasDims ? asset.height! : MAX_OUTPUT_LONG_EDGE;
  const target = resizeToMaxLongEdge(startW, startH, MAX_OUTPUT_LONG_EDGE);

  let currentUri = asset.uri;
  let width = target.width;
  let height = target.height;
  let byteSize = await getFileSize(asset.uri);

  const resizeAction =
    !hasDims || startW !== target.width || startH !== target.height
      ? [{ resize: { width: target.width, height: target.height } }]
      : [];

  for (const quality of QUALITY_STEPS) {
    const result = await ImageManipulator.manipulateAsync(currentUri, resizeAction, {
      compress: quality,
      format: ImageManipulator.SaveFormat.JPEG,
    });

    currentUri = result.uri;
    width = result.width;
    height = result.height;
    byteSize = await getFileSize(result.uri);

    if (byteSize > 0 && byteSize <= MAX_LISTING_PHOTO_BYTES) {
      const photo = {
        uri: currentUri,
        width,
        height,
        byteSize,
        mimeType: 'image/jpeg' as const,
      };
      validateCompressedPhoto(photo);
      return photo;
    }
  }

  if (byteSize > MAX_LISTING_PHOTO_BYTES) {
    throw new Error('Photo is still over 2MB after compression. Try a smaller or simpler image.');
  }

  const photo = {
    uri: currentUri,
    width,
    height,
    byteSize: byteSize || 1,
    mimeType: 'image/jpeg' as const,
  };
  validateCompressedPhoto(photo);
  return photo;
}
