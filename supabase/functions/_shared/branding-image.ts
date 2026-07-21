// Server-side validation for admin-uploaded brand logos. Mirrors
// `_shared/avatar-image.ts` (magic-byte content sniffing, not just the
// client-declared MIME type) with limits sized for a logo mark rather than a
// small avatar.

const MAX_BYTES = 1024 * 1024; // 1MB
const MAX_WIDTH = 2048;
const MAX_HEIGHT = 2048;

export const BRANDING_LOGO_LIMITS = { MAX_BYTES, MAX_WIDTH, MAX_HEIGHT };

export function validateBrandingLogoBytes(bytes: Uint8Array): {
  contentType: string;
  width?: number;
  height?: number;
} {
  if (bytes.byteLength <= 0 || bytes.byteLength > MAX_BYTES) {
    throw new Error(`Logo must be under ${Math.round(MAX_BYTES / 1024)}KB`);
  }

  const contentType = detectImageType(bytes);
  if (!contentType) {
    throw new Error('Logo must be a PNG, JPEG, or WebP image');
  }

  const dims = readImageDimensions(bytes, contentType);
  if (dims && (dims.width > MAX_WIDTH || dims.height > MAX_HEIGHT)) {
    throw new Error(`Logo must be at most ${MAX_WIDTH}×${MAX_HEIGHT}px`);
  }

  return { contentType, ...dims };
}

function detectImageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  ) {
    return 'image/webp';
  }
  return null;
}

function readImageDimensions(
  bytes: Uint8Array,
  contentType: string
): { width: number; height: number } | undefined {
  if (contentType === 'image/png' && bytes.length >= 24) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (contentType === 'image/jpeg') {
    return readJpegDimensions(bytes);
  }
  return undefined;
}

function readJpegDimensions(bytes: Uint8Array): { width: number; height: number } | undefined {
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) break;
    const marker = bytes[i + 1];
    const len = (bytes[i + 2] << 8) + bytes[i + 3];
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: (bytes[i + 5] << 8) + bytes[i + 6],
        width: (bytes[i + 7] << 8) + bytes[i + 8],
      };
    }
    i += 2 + len;
  }
  return undefined;
}
