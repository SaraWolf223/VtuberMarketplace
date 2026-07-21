import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { requestListingPhotoLibraryPermission } from '@/lib/listing-photo-picker';
import { BRANDING_LOGO_LIMITS } from '@/constants/branding';

/** Pick a logo image from the library — no forced crop (logos can be any shape). */
export async function pickBrandingLogoFromLibrary(): Promise<string | null> {
  const granted = await requestListingPhotoLibraryPermission();
  if (!granted) {
    throw new Error('Allow photo library access in Settings to choose a logo.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    allowsEditing: false,
    quality: 1,
    exif: false,
  });

  const asset = result.assets?.[0];
  if (result.canceled || !asset?.uri) {
    return null;
  }
  return asset.uri;
}

export type CompressedLogo = { uri: string; width: number; height: number; byteSize: number };

/** Resize to fit within the max bounding box (keeps aspect ratio, preserves transparency). */
export async function compressBrandingLogo(uri: string): Promise<CompressedLogo> {
  const probe = await ImageManipulator.manipulateAsync(uri, [], {});
  const needsResize =
    probe.width > BRANDING_LOGO_LIMITS.MAX_WIDTH || probe.height > BRANDING_LOGO_LIMITS.MAX_HEIGHT;

  const result = needsResize
    ? await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: Math.min(probe.width, BRANDING_LOGO_LIMITS.MAX_WIDTH) } }],
        { format: ImageManipulator.SaveFormat.PNG }
      )
    : await ImageManipulator.manipulateAsync(uri, [], { format: ImageManipulator.SaveFormat.PNG });

  const response = await fetch(result.uri);
  const blob = await response.blob();

  if (blob.size > BRANDING_LOGO_LIMITS.MAX_BYTES) {
    throw new Error(
      `Logo must be under ${Math.round(BRANDING_LOGO_LIMITS.MAX_BYTES / 1024)}KB. Try a simpler image.`
    );
  }

  return { uri: result.uri, width: result.width, height: result.height, byteSize: blob.size };
}

export const BRANDING_LOGO_MIME = Platform.OS === 'web' ? 'image/png' : 'image/png';
