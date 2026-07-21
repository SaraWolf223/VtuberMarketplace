import * as ImageManipulator from 'expo-image-manipulator';

export type CropTransform = {
  imageWidth: number;
  imageHeight: number;
  scale: number;
  translateX: number;
  translateY: number;
  frameWidth: number;
  frameHeight: number;
};

function clampCropRect(
  originX: number,
  originY: number,
  width: number,
  height: number,
  imageWidth: number,
  imageHeight: number
): { originX: number; originY: number; width: number; height: number } {
  let x = Math.max(0, Math.round(originX));
  let y = Math.max(0, Math.round(originY));
  let w = Math.max(1, Math.round(width));
  let h = Math.max(1, Math.round(height));
  if (x + w > imageWidth) w = imageWidth - x;
  if (y + h > imageHeight) h = imageHeight - y;
  return { originX: x, originY: y, width: w, height: h };
}

export function computeCropRect(transform: CropTransform): {
  originX: number;
  originY: number;
  width: number;
  height: number;
} {
  const { imageWidth, imageHeight, scale, translateX, translateY, frameWidth, frameHeight } =
    transform;
  const dispW = imageWidth * scale;
  const dispH = imageHeight * scale;
  const imgLeft = frameWidth / 2 - dispW / 2 + translateX;
  const imgTop = frameHeight / 2 - dispH / 2 + translateY;

  return clampCropRect(
    (0 - imgLeft) / scale,
    (0 - imgTop) / scale,
    frameWidth / scale,
    frameHeight / scale,
    imageWidth,
    imageHeight
  );
}

export async function exportCroppedImageUri(
  uri: string,
  transform: CropTransform
): Promise<string> {
  const crop = computeCropRect(transform);
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ crop }],
    { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

/** Min scale so the image fully covers the crop frame. */
export function minCoverScale(
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number
): number {
  return Math.max(frameWidth / imageWidth, frameHeight / imageHeight);
}

export function clampPan(
  imageWidth: number,
  imageHeight: number,
  scale: number,
  translateX: number,
  translateY: number,
  frameWidth: number,
  frameHeight: number
): { translateX: number; translateY: number } {
  const dispW = imageWidth * scale;
  const dispH = imageHeight * scale;
  const maxTx = (dispW - frameWidth) / 2;
  const maxTy = (dispH - frameHeight) / 2;
  const minTx = -maxTx;
  const minTy = -maxTy;
  return {
    translateX: Math.min(maxTx, Math.max(minTx, translateX)),
    translateY: Math.min(maxTy, Math.max(minTy, translateY)),
  };
}
