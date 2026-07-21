/** Must match client `MAX_LISTING_PHOTO_BYTES` (2MB). */
export const MAX_LISTING_IMAGE_BYTES = 2 * 1024 * 1024;

/** Must match client `MAX_OUTPUT_LONG_EDGE`. */
export const MAX_LISTING_IMAGE_LONG_EDGE = 2048;

const JPEG_MAGIC = [0xff, 0xd8, 0xff];

export function isValidListingStoragePath(
  userId: string,
  listingId: string,
  sortOrder: number,
  path: string
): boolean {
  const expected = `${userId}/${listingId}/${sortOrder}.jpg`;
  if (path !== expected) return false;
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-4]\.jpg$/.test(path)) return false;
  return true;
}

export function validateImageMeta(
  userId: string,
  listingId: string,
  sortOrder: number,
  storagePath: string,
  byteSize: number,
  width: number | null,
  height: number | null
): string | null {
  if (!isValidListingStoragePath(userId, listingId, sortOrder, storagePath)) {
    return 'Invalid image path';
  }
  if (byteSize <= 0 || byteSize > MAX_LISTING_IMAGE_BYTES) {
    return 'Image must be between 1 byte and 2MB';
  }
  if (width != null && height != null) {
    const long = Math.max(width, height);
    if (long < 1 || long > MAX_LISTING_IMAGE_LONG_EDGE) {
      return 'Invalid image dimensions';
    }
  }
  return null;
}

export function isJpegBytes(header: Uint8Array): boolean {
  if (header.length < 3) return false;
  return (
    header[0] === JPEG_MAGIC[0] &&
    header[1] === JPEG_MAGIC[1] &&
    header[2] === JPEG_MAGIC[2]
  );
}
