import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { requestListingPhotoLibraryPermission } from '@/lib/listing-photo-picker';
import { centerAspectCropUri } from '@/lib/image-aspect-crop';
import { runInAppImageCrop } from '@/lib/image-crop-session';

export type CropAspect = [number, number];

type PickCroppedImageOptions = {
  aspect: CropAspect;
  permissionDeniedMessage: string;
  /** When native crop is skipped, center-crop to aspect (iOS fallback only). */
  programmaticFallback?: boolean;
  shape?: ImagePicker.CropShape;
  cropTitle?: string;
};

async function resolvePickerResult(
  initial: ImagePicker.ImagePickerResult
): Promise<ImagePicker.ImagePickerResult> {
  if (Platform.OS !== 'android') {
    return initial;
  }
  if (!initial.canceled && initial.assets?.[0]?.uri) {
    return initial;
  }
  const pending = await ImagePicker.getPendingResultAsync();
  if (pending && !('code' in pending) && !pending.canceled && pending.assets?.[0]?.uri) {
    return pending;
  }
  return initial;
}

/**
 * Opens the photo library, then crops to the target aspect.
 * Android + web: in-app crop UI (Android's native toolbar is often invisible
 * on SDK 54; web's picker is a bare file input with no editing support at all).
 * iOS: system crop when available, then center-crop fallback if needed.
 */
export async function pickImageWithNativeCrop({
  aspect,
  permissionDeniedMessage,
  programmaticFallback = true,
  shape,
  cropTitle,
}: PickCroppedImageOptions): Promise<string | null> {
  const granted = await requestListingPhotoLibraryPermission();
  if (!granted) {
    throw new Error(permissionDeniedMessage);
  }

  const pickOptions: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    quality: 1,
    exif: false,
  };

  if (Platform.OS === 'ios') {
    Object.assign(pickOptions, {
      allowsEditing: true,
      aspect,
      presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
    });
  } else if (Platform.OS === 'android') {
    Object.assign(pickOptions, {
      allowsEditing: false,
      legacy: true,
      ...(shape ? { shape } : {}),
    });
  } else {
    // web: expo-image-picker just opens a bare <input type="file">, so none
    // of the native-editing options apply here.
    Object.assign(pickOptions, { allowsEditing: false });
  }

  let result = await ImagePicker.launchImageLibraryAsync(pickOptions);
  result = await resolvePickerResult(result);

  const asset = result.assets?.[0];
  if (result.canceled || !asset?.uri) {
    return null;
  }
  let uri = asset.uri;

  if (Platform.OS === 'android' || Platform.OS === 'web') {
    return runInAppImageCrop(uri, aspect, cropTitle);
  }

  if (!programmaticFallback) {
    return uri;
  }

  const needsFallback =
    asset.width != null &&
    asset.height != null &&
    asset.width > 0 &&
    asset.height > 0 &&
    Math.abs(asset.width / asset.height - aspect[0] / aspect[1]) > 0.02;

  if (needsFallback) {
    uri = await centerAspectCropUri(uri, aspect[0], aspect[1], asset.width, asset.height);
  }

  return uri;
}
