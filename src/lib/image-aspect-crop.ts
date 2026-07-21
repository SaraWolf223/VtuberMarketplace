import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

async function resolveDimensions(
  uri: string,
  width?: number,
  height?: number
): Promise<{ width: number; height: number }> {
  if (width != null && height != null && width > 0 && height > 0) {
    return { width, height };
  }
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (w, h) => resolve({ width: w, height: h }),
      (err) => reject(err ?? new Error('Could not read image size'))
    );
  });
}

/** Center-crop to the largest axis-aligned rectangle matching aspect (e.g. 1:1 or 3:1). */
export async function centerAspectCropUri(
  uri: string,
  aspectWidth: number,
  aspectHeight: number,
  knownWidth?: number,
  knownHeight?: number
): Promise<string> {
  const { width, height } = await resolveDimensions(uri, knownWidth, knownHeight);
  const targetRatio = aspectWidth / aspectHeight;
  const currentRatio = width / height;

  let cropW: number;
  let cropH: number;
  if (currentRatio > targetRatio) {
    cropH = height;
    cropW = Math.round(height * targetRatio);
  } else {
    cropW = width;
    cropH = Math.round(width / targetRatio);
  }

  cropW = Math.min(cropW, width);
  cropH = Math.min(cropH, height);

  if (cropW === width && cropH === height) {
    return uri;
  }

  const originX = Math.max(0, Math.round((width - cropW) / 2));
  const originY = Math.max(0, Math.round((height - cropH) / 2));

  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ crop: { originX, originY, width: cropW, height: cropH } }],
    { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

export async function centerSquareCropUri(
  uri: string,
  knownWidth?: number,
  knownHeight?: number
): Promise<string> {
  return centerAspectCropUri(uri, 1, 1, knownWidth, knownHeight);
}
