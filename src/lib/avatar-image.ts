import * as ImageManipulator from 'expo-image-manipulator';
import {
  AVATAR_MAX_BYTES,
  AVATAR_MAX_HEIGHT,
  AVATAR_MAX_KB,
  AVATAR_MAX_WIDTH,
} from '@/constants/avatar';
import { pickImageWithNativeCrop } from '@/lib/image-crop-pick';

/** Pick and square-crop an avatar (native editor when available; center-crop fallback). */
export async function pickAvatarImageFromLibrary(): Promise<string | null> {
  const uri = await pickImageWithNativeCrop({
    aspect: [1, 1],
    permissionDeniedMessage: 'Allow photo library access in Settings to change your photo.',
    shape: 'rectangle',
    cropTitle: 'Crop profile photo',
  });

  if (!uri) {
    return null;
  }

  return uri;
}

export type CompressedAvatar = {
  uri: string;
  width: number;
  height: number;
  byteSize: number;
};

export async function compressAvatarImage(uri: string): Promise<CompressedAvatar> {
  let quality = 0.88;
  let result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: AVATAR_MAX_WIDTH, height: AVATAR_MAX_HEIGHT } }],
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
  );

  let response = await fetch(result.uri);
  let blob = await response.blob();

  while (blob.size > AVATAR_MAX_BYTES && quality > 0.4) {
    quality -= 0.1;
    result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: AVATAR_MAX_WIDTH, height: AVATAR_MAX_HEIGHT } }],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
    );
    response = await fetch(result.uri);
    blob = await response.blob();
  }

  const width = result.width ?? AVATAR_MAX_WIDTH;
  const height = result.height ?? AVATAR_MAX_HEIGHT;

  if (width > AVATAR_MAX_WIDTH || height > AVATAR_MAX_HEIGHT) {
    throw new Error(`Avatar must be at most ${AVATAR_MAX_WIDTH}×${AVATAR_MAX_HEIGHT}px.`);
  }

  if (blob.size > AVATAR_MAX_BYTES) {
    throw new Error(`Avatar must be under ${AVATAR_MAX_KB}KB after processing. Try a simpler image.`);
  }

  return { uri: result.uri, width, height, byteSize: blob.size };
}
