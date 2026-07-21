import type { CropAspect } from '@/lib/image-crop-pick';

type CropHandler = (uri: string, aspect: CropAspect, title?: string) => Promise<string | null>;

let cropHandler: CropHandler | null = null;

export function registerImageCropHandler(handler: CropHandler | null): void {
  cropHandler = handler;
}

export async function runInAppImageCrop(
  uri: string,
  aspect: CropAspect,
  title?: string
): Promise<string | null> {
  if (!cropHandler) {
    throw new Error('Image crop UI is not ready. Restart the app.');
  }
  return cropHandler(uri, aspect, title);
}
